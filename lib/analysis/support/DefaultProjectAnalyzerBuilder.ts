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
    Project,
    RemoteRepoRef,
} from "@atomist/automation-client";
import { isProject } from "@atomist/automation-client/lib/project/Project";
import {
    AutoCodeInspection,
    Autofix,
    AutofixRegistration,
    AutoInspectRegistration,
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
    Services,
    TechnologyElement,
} from "../ProjectAnalysis";
import {
    ConditionalRegistration,
    isConditionalRegistration,
    performSeedAnalysis,
    ProjectAnalyzer,
    ProjectAnalyzerBuilder,
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

    public readonly scannerRegistrations: Array<ConditionalRegistration<TechnologyScanner<any>>> = [];

    public readonly interpreters: Array<ConditionalRegistration<Interpreter>> = [];

    public readonly transformRecipeContributorRegistrations: TransformRecipeContributionRegistration[] = [];

    public readonly possibleAutofixes: AutofixRegistration[] = [];

    public readonly possibleCodeInspections: Array<AutoInspectRegistration<any, any>> = [];

    public readonly autofixGoal: Autofix = new Autofix({ isolate: true });

    public readonly codeInspectionGoal: AutoCodeInspection = new AutoCodeInspection({ isolate: true });

    private readonly scorers: Array<ConditionalRegistration<Scorer>> = [];

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
        this.scannerRegistrations.push(isConditionalRegistration(scanner) ? scanner : {
            action: scanner,
            runWhen: () => true,
        });
        return this;
    }

    public withInterpreter(raw: Interpreter | ConditionalRegistration<Interpreter>): this {
        const reg = isConditionalRegistration(raw) ? raw : {
            action: raw,
            runWhen: () => true,
        };
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
        this.scorers.push(isConditionalRegistration(scorer) ? scorer : {
            action: scorer,
            runWhen: () => true,
        });
        return this;
    }

    public withStack<T extends TechnologyElement>(stackSupport: StackSupport<T>): this {
        stackSupport.scanners.forEach(s => this.withScanner(s));
        stackSupport.interpreters.forEach(i => this.withInterpreter(i));
        stackSupport.transformRecipeContributors.forEach(trc => this.withTransformRecipeContributor(trc));
        (stackSupport.scorers || []).forEach(scorer => this.withScorer(scorer));
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

    public async interpret(p: Project | ProjectAnalysis, sdmContext: SdmContext,
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
        const analysis: ProjectAnalysis = {
            id: p.id as RemoteRepoRef,
            options,
            elements,
            services,
            dependencies,
            referencedEnvironmentVariables,
        };

        const scanned = (await Promise.all(this.scannerRegistrations
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
