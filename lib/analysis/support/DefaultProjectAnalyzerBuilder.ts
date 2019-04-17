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
    PushListenerInvocation,
    Queue,
    SdmContext,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";

import * as _ from "lodash";
import {
    Interpretation,
    Interpreter,
    isAutofixRegisteringInterpreter,
    isCodeInspectionRegisteringInterpreter,
} from "../Interpretation";
import {
    Dependency,
    Elements,
    ProjectAnalysis,
    ProjectAnalysisOptions,
    SeedAnalysis,
    Services,
    TechnologyElement,
    TransformRecipe,
    TransformRecipeRequest,
} from "../ProjectAnalysis";
import {
    ConditionalRegistration,
    isConditionalRegistration,
    ProjectAnalyzer,
    ProjectAnalyzerBuilder,
    RunCondition,
    Scorer,
    StackSupport,
} from "../ProjectAnalyzer";
import { TechnologyScanner } from "../TechnologyScanner";
import { TransformRecipeContributionRegistration } from "../TransformRecipeContributor";
import {
    registerAutofixes,
    registerCodeInspections,
} from "./interpretationDriven";

/**
 * Implementation of both ProjectAnalyzer and ProjectAnalyzerBuilder.
 * Inspect repos to find tech stack and CI info
 */
export class DefaultProjectAnalyzerBuilder implements ProjectAnalyzer, ProjectAnalyzerBuilder {

    public readonly scanners: Array<ConditionalRegistration<TechnologyScanner<any>>> = [];

    public readonly interpreters: Array<ConditionalRegistration<Interpreter>> = [];

    public readonly transformRecipeContributorRegistrations: TransformRecipeContributionRegistration[] = [];

    public readonly possibleAutofixes: AutofixRegistration[] = [];

    public readonly possibleCodeInspections: Array<AutoInspectRegistration<any, any>> = [];

    public readonly autofixGoal: Autofix = new Autofix({ isolate: true });

    public readonly codeInspectionGoal: AutoCodeInspection = new AutoCodeInspection({ isolate: true });

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
    }

    public withScanner<T extends TechnologyElement>(scanner: TechnologyScanner<T> | ConditionalRegistration<TechnologyScanner<T>>): this {
        this.scanners.push(isConditionalRegistration(scanner) ? scanner : runOnCondition(scanner));
        return this;
    }

    public withInterpreter(raw: Interpreter | ConditionalRegistration<Interpreter>): this {
        const reg = isConditionalRegistration(raw) ? raw : runOnCondition(raw);
        const interpreter = reg.action;
        this.interpreters.push(reg);
        if (isAutofixRegisteringInterpreter(interpreter)) {
            this.possibleAutofixes.push(...interpreter.autofixes);
        }
        if (isCodeInspectionRegisteringInterpreter(interpreter)) {
            this.possibleCodeInspections.push(...interpreter.codeInspections);
        }
        return this;
    }

    public withScorer(scorer: Scorer | ConditionalRegistration<Scorer>): ProjectAnalyzerBuilder {
        this.scorers.push(isConditionalRegistration(scorer) ? scorer : runOnCondition(scorer));
        return this;
    }

    public withStack(stackSupport: StackSupport): this {
        // Conditionalize if necessary
        const scanners: Array<ConditionalRegistration<TechnologyScanner<any>>> =
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
        const tags: string[] = [];
        const referencedEnvironmentVariables: string[] = [];
        const analysis: ProjectAnalysis = {
            id: p.id as RemoteRepoRef,
            options,
            elements,
            services,
            dependencies,
            tags,
            referencedEnvironmentVariables,
        };

        const scanned = (await Promise.all(this.scanners
            .filter(s => s.runWhen(options, sdmContext))
            .map(s => s.action(p, sdmContext, analysis, options))))
            .filter(r => !!r);

        for (const s of scanned) {
            elements[s.name] = s;
            if (!!s.services) {
                _.merge(services, s.services);
            }
            if (!!s.dependencies) {
                dependencies.push(...s.dependencies);
            }
            if (!!s.tags) {
                tags.push(...s.tags);
            }
            if (!!s.referencedEnvironmentVariables) {
                referencedEnvironmentVariables.push(
                    ...s.referencedEnvironmentVariables.filter((e: string) => !referencedEnvironmentVariables.includes(e)));
            }
        }

        if (options && options.full) {
            analysis.seedAnalysis = await performSeedAnalysis(p, analysis, this.transformRecipeContributorRegistrations, sdmContext);
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
        };

        for (const interpreter of this.interpreters) {
            if (interpreter.runWhen(options, sdmContext)) {
                const enriched = await interpreter.action.enrich(interpretation, sdmContext);
                if (enriched) {
                    interpretation.reason.chosenInterpreters.push(interpreter.action);
                }
            }
        }

        for (const scorer of this.scorers) {
            if (scorer.runWhen(options, sdmContext)) {
                const score = await scorer.action(interpretation, sdmContext);
                interpretation.scores[score.name] = score;
            }
        }

        return interpretation;
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
                // Remove duplicates
                parameters: rawRecipe.parameters.filter(p =>
                    !_.flatten(transformRecipes.map(t => t.recipe.parameters)).some(existing => existing.name === p.name)),
                transforms: rawRecipe.transforms.filter(p =>
                    !_.flatten(transformRecipes.map(t => t.recipe.transforms)).some(existing => existing.name === p.name)),
            };
            transformRecipes.push({
                originator: contributor.originator,
                optional: contributor.optional,
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
