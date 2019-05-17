/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    GitProject,
    logger,
    Project,
    RemoteRepoRef,
} from "@atomist/automation-client";
import { isProject } from "@atomist/automation-client/lib/project/Project";
import {
    AutoCodeInspection,
    Autofix,
    AutofixRegistration,
    AutoInspectRegistration,
    Goal,
    PushListenerInvocation,
    Queue,
    SdmContext,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";

import { FP } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import {
    Interpretation,
    Interpreter,
    isAutofixRegisteringInterpreter,
    isCodeInspectionRegisteringInterpreter,
} from "../Interpretation";
import {
    ConsolidatedFingerprints,
    Dependency,
    Elements,
    HasAnalysis,
    InspectionResults,
    ProjectAnalysis,
    ProjectAnalysisOptions,
    SeedAnalysis,
    Services,
    TechnologyElement,
    TransformRecipe,
    TransformRecipeRequest,
} from "../ProjectAnalysis";
import {
    Classification,
    ConditionalRegistration,
    isConditionalRegistration,
    ProjectAnalyzer,
    ProjectAnalyzerBuilder,
    RunCondition,
    Scorer,
    StackSupport,
} from "../ProjectAnalyzer";
import {
    FastProject,
    isExtractedTechnologyFeature,
    ManagedFeature,
    PhasedTechnologyScanner,
    ScannerAction,
    toPhasedTechnologyScanner,
} from "../TechnologyScanner";
import { TransformRecipeContributionRegistration } from "../TransformRecipeContributor";
import {
    registerAutofixes,
    registerCodeInspections,
} from "./interpretationDriven";
import { messageGoal } from "./messageGoal";
import { allMessages } from "./projectAnalysisUtils";
import { TechnologyStack } from "../TechnologyStack";

/**
 * Implementation of both ProjectAnalyzer and ProjectAnalyzerBuilder.
 * Inspect repos to find tech stack and CI info
 */
export class DefaultProjectAnalyzerBuilder implements ProjectAnalyzer, ProjectAnalyzerBuilder {

    public readonly scanners: Array<ConditionalRegistration<PhasedTechnologyScanner<any>>> = [];

    public readonly interpreters: Array<ConditionalRegistration<Interpreter>> = [];

    public readonly transformRecipeContributorRegistrations: TransformRecipeContributionRegistration[] = [];

    public readonly possibleAutofixes: AutofixRegistration[] = [];

    public readonly possibleCodeInspections: Array<AutoInspectRegistration<any, any>> = [];

    public readonly autofixGoal: Autofix;

    public readonly codeInspectionGoal: AutoCodeInspection;

    public readonly messageGoal: Goal;

    public readonly scorers: Array<ConditionalRegistration<Scorer>> = [];

    private readonly queueGoal: Queue;

    constructor(private readonly sdm: SoftwareDeliveryMachine) {
        const queueConfig = _.get(sdm, "configuration.sdm.goal.queue");
        if (!!queueConfig && queueConfig.enabled === true) {
            this.queueGoal = new Queue(
                {
                    concurrent: queueConfig.concurrent || 2,
                    fetch: queueConfig.fetch || 20,
                });
        }

        this.messageGoal = messageGoal(async gi => {
            const { configuration } = gi;
            return configuration.sdm.projectLoader.doWithProject({ ...gi, readOnly: true }, async p => {
                const classification = await this.classify(p, gi);
                const interpretation = await this.interpret(p, gi);
                return [...interpretation.messages, ...allMessages(classification)];
            });
        });

        this.autofixGoal = new Autofix({ isolate: true });
        this.codeInspectionGoal = new AutoCodeInspection({ isolate: true });
    }

    public withScanner<T extends TechnologyElement>(scanner: ScannerAction<T> | ConditionalRegistration<ScannerAction<T>>): this {
        let toAdd: ConditionalRegistration<PhasedTechnologyScanner<T>>;
        if (isConditionalRegistration(scanner)) {
            toAdd = {
                action: toPhasedTechnologyScanner(scanner.action),
                runWhen: scanner.runWhen,
            };
        } else {
            toAdd = runOnCondition(toPhasedTechnologyScanner(scanner));
        }
        this.scanners.push(toAdd);
        return this;
    }

    public withInterpreter(raw: Interpreter | ConditionalRegistration<Interpreter>): this {
        const reg = isConditionalRegistration(raw) ? raw : runOnCondition(raw);
        const interpreter = reg.action;
        this.interpreters.push(reg);
        if (isAutofixRegisteringInterpreter(interpreter)) {
            this.possibleAutofixes.push(...interpreter.autofixes);
            if (!!interpreter.configureAutofixGoal) {
                interpreter.configureAutofixGoal(this.autofixGoal);
            }
        }
        if (isCodeInspectionRegisteringInterpreter(interpreter)) {
            this.possibleCodeInspections.push(...interpreter.codeInspections);
            if (!!interpreter.configureCodeInspectionGoal) {
                interpreter.configureCodeInspectionGoal(this.codeInspectionGoal);
            }
        }
        return this;
    }

    public withScorer(scorer: Scorer | ConditionalRegistration<Scorer>): ProjectAnalyzerBuilder {
        this.scorers.push(isConditionalRegistration(scorer) ? scorer : runOnCondition(scorer));
        return this;
    }

    public withStack(stackSupport: StackSupport): this {
        // Conditionalize if necessary
        const scanners: Array<ConditionalRegistration<ScannerAction<any>>> =
            stackSupport.scanners.map(s => isConditionalRegistration(s) ? s : runOnCondition(s, stackSupport.condition));
        const interpreters: Array<ConditionalRegistration<Interpreter>> =
            stackSupport.interpreters.map(i => isConditionalRegistration(i) ? i : runOnCondition(i, stackSupport.condition));
        const scorers: Array<ConditionalRegistration<Scorer>> =
            (stackSupport.scorers || []).map(s => isConditionalRegistration(s) ? s : runOnCondition(s, stackSupport.condition));

        scanners.forEach(s => this.withScanner(s));
        interpreters.forEach(i => this.withInterpreter(i));
        stackSupport.transformRecipeContributors.forEach(trc => this.withTransformRecipeContributor(trc));
        scorers.forEach(scorer => this.withScorer(scorer));
        return this;
    }

    public withTransformRecipeContributor(trc: TransformRecipeContributionRegistration): this {
        this.transformRecipeContributorRegistrations.push(trc);
        return this;
    }

    /**
     * Construct and return analyzer
     * @return
     */
    public build(): ProjectAnalyzer {
        for (const interpreter of this.interpreters) {
            if (!!interpreter.action.setAnalyzer) {
                interpreter.action.setAnalyzer(this);
            }
        }
        registerAutofixes(this.autofixGoal, this);
        registerCodeInspections(this.codeInspectionGoal, this);
        return this;
    }

    public async classify(p: FastProject,
                          sdmContext: SdmContext): Promise<Classification> {
        const classifiers = await Promise.all(this.scanners
            .filter(s => s.runWhen({ full: false }, sdmContext))
            .map(s => s.action.classify(p, sdmContext)));
        const classification: Classification = { elements: {} };
        classifiers
            .filter(c => !!c)
            .forEach(c => {
                classification.elements[c.name] = c;
            });
        return classification;
    }

    public async interpret(p: Project | ProjectAnalysis,
                           sdmContext: SdmContext,
                           options: ProjectAnalysisOptions = { full: false }): Promise<Interpretation> {
        const analysis = isProject(p) ? await this.analyze(p, sdmContext, options) : p;
        return this.runInterpretation(analysis, sdmContext, options);
    }

    /**
     * Return a CodeInspection gathering all data
     * @return
     */
    public async analyze(p: Project,
                         sdmContext: SdmContext,
                         options: ProjectAnalysisOptions = { full: false }): Promise<ProjectAnalysis> {
        const elements: Elements = {};
        const services: Services = {};
        const dependencies: Dependency[] = [];
        const referencedEnvironmentVariables: string[] = [];
        const fingerprints: ConsolidatedFingerprints = {};
        const analysis: ProjectAnalysis = {
            id: p.id as RemoteRepoRef,
            options,
            elements,
            services,
            dependencies,
            referencedEnvironmentVariables,
            messages: [],
            fingerprints,
        };

        async function extractify(feature: ManagedFeature<any, any>, te: TechnologyElement): Promise<FP> {
            return isExtractedTechnologyFeature(feature) ?
                feature.extract(p) :
                feature.consequence(te, analysis);
        }

        const scans: Array<{ scanner: PhasedTechnologyScanner<any>, result: TechnologyStack }> =
            (await Promise.all(this.scanners
                .filter(s => s.runWhen(options, sdmContext))
                .map(s => s.action.scan(p, sdmContext, analysis, options)
                    .then(result => !!result ? ({ scanner: s.action, result }) : undefined)),
            )).filter(r => !!r);

        for (const scan of scans) {
            const s = scan.result;
            elements[s.name] = s;
            if (!!s.services) {
                _.merge(services, s.services);
            }
            if (!!s.dependencies) {
                dependencies.push(...s.dependencies);
            }
            if (!!s.referencedEnvironmentVariables) {
                referencedEnvironmentVariables.push(
                    ...s.referencedEnvironmentVariables.filter((e: string) => !referencedEnvironmentVariables.includes(e)));
            }
            if (scan.scanner.features) {
                s.fingerprints = s.fingerprints || [];
                await Promise.all(scan.scanner.features.map(
                    feature => extractify(feature, s)
                        .then(fp => s.fingerprints.push(fp))));
            }
            if (!!s.fingerprints) {
                s.fingerprints.forEach((fp: any) => fingerprints[fp.name] = fp);
            }
        }

        if (options && options.full) {
            await this.enrichToFullAnalysis(p, sdmContext, options, analysis);
        }
        return analysis;
    }

    private async runInterpretation(
        analysis: ProjectAnalysis,
        sdmContext: SdmContext,
        options: ProjectAnalysisOptions): Promise<Interpretation | undefined> {
        const interpretation: Interpretation = {
            reason: {
                analysis,
                availableInterpreters: this.interpreters.map(i => i.action),
                chosenInterpreters: [],
                pushListenerInvocation: !!sdmContext && !!(sdmContext as PushListenerInvocation).push ?
                    sdmContext as PushListenerInvocation :
                    undefined,
            },
            autofixes: [],
            inspections: [],
            materialChangePushTests: [],
            autofixGoal: this.autofixGoal,
            codeInspectionGoal: this.codeInspectionGoal,
            queueGoal: this.queueGoal,
            scores: {},
            messages: [],
        };

        const fullOptions: ProjectAnalysisOptions & HasAnalysis = {
            ...options,
            analysis,
        };

        for (const interpreter of this.interpreters) {
            if (interpreter.runWhen(fullOptions, sdmContext)) {
                const enriched = await interpreter.action.enrich(interpretation, sdmContext);
                if (enriched) {
                    interpretation.reason.chosenInterpreters.push(interpreter.action);
                }
            }
        }

        for (const scorer of this.scorers) {
            if (scorer.runWhen(fullOptions, sdmContext)) {
                const score = await scorer.action(interpretation, sdmContext);
                interpretation.scores[score.name] = score;
            }
        }

        return interpretation;
    }

    private async enrichToFullAnalysis(p: Project,
                                       sdmContext: SdmContext,
                                       options: ProjectAnalysisOptions,
                                       analysis: ProjectAnalysis): Promise<void> {
        if (isGitProject(p)) {
            try {
                analysis.gitStatus = await p.gitStatus();
            } catch (err) {
                // Don't fail on this
            }
        }
        analysis.seedAnalysis = await performSeedAnalysis(p, analysis, this.transformRecipeContributorRegistrations, sdmContext);
        // We'll need to get more from the interpretation
        const interpretation = await this.runInterpretation(analysis, sdmContext, options);
        analysis.scores = interpretation.scores;
        analysis.messages.push(...interpretation.messages);
        analysis.inspections = await runInspections(p, interpretation.inspections);
        // Unfortunately there's no way to see this at runtime, so we need to hardcode.
        // At least it's checked by the compiler, so will stay in sync
        analysis.phaseStatus = {
            startupGoals: !!interpretation.startupGoals,
            containerBuildGoals: !!interpretation.containerBuildGoals,
            checkGoals: !!interpretation.checkGoals,
            deployGoals: !!interpretation.deployGoals,
            releaseGoals: !!interpretation.releaseGoals,
            cancelGoal: !!interpretation.cancelGoal,
            deliveryStartedGoals: !!interpretation.deliveryStartedGoals,
            queueGoal: !!interpretation.queueGoal,
            buildGoals: !!interpretation.buildGoals,
            testGoals: !!interpretation.testGoals,
        };
    }

}

/**
 * Use expert system to analyze a potential seed
 * and work out which transforms are appropriate and what parameters
 * they need. Uses multiple sub analyzers to compose facets.
 */
async function performSeedAnalysis(
    project: Project,
    analysis: ProjectAnalysis,
    contributorRegistrations: TransformRecipeContributionRegistration[],
    sdmContext: SdmContext): Promise<SeedAnalysis> {
    const transformRecipes: TransformRecipeRequest[] = [];
    for (const contributor of contributorRegistrations) {
        const rawRecipe = await contributor.contributor.analyze(project, analysis, sdmContext);
        if (rawRecipe) {
            const recipe: TransformRecipe = {
                // Remove duplicate parameters
                parameters: rawRecipe.parameters.filter(p =>
                    !_.flatten(transformRecipes.map(t => t.recipe.parameters)).some(existing => existing.name === p.name)),
                transforms: rawRecipe.transforms,
            };
            transformRecipes.push({
                originator: contributor.originator,
                optional: contributor.optional,
                description: contributor.description || contributor.originator,
                recipe,
            });
        }
    }
    const result = {
        transformRecipes,
    };
    logger.info("Analysis for project at %s is %j, seed analysis is %j",
        project.id.url, analysis, result);
    return result;
}

function runOnCondition<W>(action: W, runWhen: RunCondition = () => true): ConditionalRegistration<W> {
    return {
        action,
        runWhen,
    };
}

async function runInspections(p: Project,
                              registrations: Array<AutoInspectRegistration<any, any>>): Promise<InspectionResults> {
    const inspections: InspectionResults = {};
    const asArray: Array<Promise<{ name: string, result: any }>> = registrations.map(async ir => ({
        name: ir.name,
        // TODO not clean
        result: await ir.inspection(p, undefined),
    }));
    const results = await Promise.all(asArray);
    results.forEach(r => inspections[r.name] = r.result);
    return inspections;
}

function isGitProject(p: Project): p is GitProject {
    const maybe = p as GitProject;
    return !!maybe.gitStatus;
}
