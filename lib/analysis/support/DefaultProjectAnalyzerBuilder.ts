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
} from "@atomist/sdm";
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
    isTechnologyScannerRegistration,
    performSeedAnalysis,
    ProjectAnalyzer,
    ProjectAnalyzerBuilder,
    StackSupport,
    TechnologyScannerRegistration,
} from "../ProjectAnalyzer";
import { TechnologyScanner } from "../TechnologyScanner";
import { TransformRecipeContributionRegistration } from "../TransformRecipeContributor";
import {
    registerAutofixes,
    registerCodeInspections,
} from "./interpretationDriven";

import * as _ from "lodash";

/**
 * Inspect repos to find tech stack and CI info
 */
export class DefaultProjectAnalyzerBuilder implements ProjectAnalyzer, ProjectAnalyzerBuilder {

    public readonly scannerRegistrations: Array<TechnologyScannerRegistration<any>> = [];

    public readonly interpreters: Interpreter[] = [];

    public readonly transformRecipeContributorRegistrations: TransformRecipeContributionRegistration[] = [];

    public readonly possibleAutofixes: AutofixRegistration[] = [];

    public readonly possibleCodeInspections: Array<AutoInspectRegistration<any, any>> = [];

    public readonly autofixGoal: Autofix = new Autofix({ isolate: true });

    public readonly codeInspectionGoal: AutoCodeInspection = new AutoCodeInspection({ isolate: true });

    private readonly queueGoal: Queue = new Queue({ concurrent: 2, fetch: 20 });

    public withScanner<T extends TechnologyElement>(scanner: TechnologyScanner<T> | TechnologyScannerRegistration<T>): this {
        this.scannerRegistrations.push(isTechnologyScannerRegistration(scanner) ? scanner : {
            scanner,
            runWhen: () => true,
        });
        return this;
    }

    public withInterpreter(interpreter: Interpreter): this {
        this.interpreters.push(interpreter);
        if (isAutofixRegisteringInterpreter(interpreter)) {
            this.possibleAutofixes.push(...interpreter.autofixes);
        }
        if (isCodeInspectionRegisteringInterpreter(interpreter)) {
            this.possibleCodeInspections.push(...interpreter.codeInspections);
        }
        return this;
    }

    public withStack<T extends TechnologyElement>(stackSupport: StackSupport<T>): this {
        stackSupport.scanners.forEach(s => this.withScanner(s));
        stackSupport.interpreters.forEach(i => this.withInterpreter(i));
        stackSupport.transformRecipeContributors.forEach(trc => this.withTransformRecipeContributor(trc));
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
            if (!!interpreter.setAnalyzer) {
                interpreter.setAnalyzer(this);
            }
        }
        registerAutofixes(this.autofixGoal, this);
        registerCodeInspections(this.codeInspectionGoal, this);
        return this;
    }

    public async interpret(p: Project | ProjectAnalysis, sdmContext: SdmContext,
                           options: ProjectAnalysisOptions = { full: false }): Promise<Interpretation> {
        const analysis = isProject(p) ? await this.analyze(p, sdmContext, options) : p;
        return this.runInterpretation(analysis, sdmContext);
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
            .filter(s => s.runWhen(options))
            .map(s => s.scanner(p, sdmContext, analysis, options))))
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
        sdmContext: SdmContext): Promise<Interpretation | undefined> {
        const interpretation: Interpretation = {
            reason: {
                analysis,
                availableInterpreters: this.interpreters,
                chosenInterpreters: [],
            },
            autofixes: [],
            inspections: [],
            materialChangePushTests: [],
            autofixGoal: this.autofixGoal,
            codeInspectionGoal: this.codeInspectionGoal,
            queueGoal: this.queueGoal,
        };

        for (const interpreter of this.interpreters) {
            const enriched = await interpreter.enrich(interpretation, sdmContext);
            if (enriched) {
                interpretation.reason.chosenInterpreters.push(interpreter);
            }
        }

        return interpretation;
    }

}
