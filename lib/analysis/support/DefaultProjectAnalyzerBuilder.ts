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
    SdmContext,
} from "@atomist/sdm";
import {
    Interpretation,
    Interpreter,
    isAutofixRegisteringInterpreter,
    isCodeInspectionRegisteringInterpreter,
} from "../Interpretation";
import { interpretWith } from "../interpreter";
import {
    Dependency,
    Elements,
    FullProjectAnalysis,
    ProjectAnalysis,
    Services,
    TechnologyElement,
} from "../ProjectAnalysis";
import {
    performSeedAnalysis,
    ProjectAnalyzer,
    ProjectAnalyzerBuilder,
    StackSupport,
} from "../ProjectAnalyzer";
import { TechnologyScanner } from "../TechnologyScanner";
import { TransformRecipeContributionRegistration } from "../TransformRecipeContributor";
import {
    registerAutofixes,
    registerCodeInspections,
} from "./interpretationDriven";

/**
 * Inspect repos to find tech stack and CI info
 */
export class DefaultProjectAnalyzerBuilder implements ProjectAnalyzer, ProjectAnalyzerBuilder {

    public readonly scanners: Array<TechnologyScanner<any>> = [];

    public readonly interpreters: Interpreter[] = [];

    public readonly transformRecipeContributorRegistrations: TransformRecipeContributionRegistration[] = [];

    public readonly possibleAutofixes: AutofixRegistration[] = [];

    public readonly possibleCodeInspections: Array<AutoInspectRegistration<any, any>> = [];

    public readonly autofixGoal: Autofix = new Autofix({ isolate: true });

    public readonly codeInspectionGoal: AutoCodeInspection = new AutoCodeInspection({ isolate: true });

    public withScanner<T extends TechnologyElement>(scanner: TechnologyScanner<T>): this {
        this.scanners.push(scanner);
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
        if (!!stackSupport.interpreter) {
            this.withInterpreter(stackSupport.interpreter);
        }
        (stackSupport.transformRecipeContributors || [])
            .forEach(trc => this.withTransformRecipeContributor(trc));
        return this.withScanner(stackSupport.scanner);
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

    public async interpret(p: Project | ProjectAnalysis, sdmContext: SdmContext): Promise<Interpretation> {
        const analysis = isProject(p) ? await this.analyze(p, sdmContext) : p;
        return interpretWith(this, analysis, sdmContext);
    }

    /**
     * Return a CodeInspection gathering all data
     * @return
     */
    public async analyze(p: Project, sdmContext: SdmContext): Promise<ProjectAnalysis> {
        const elements: Elements = {};
        let services: Services = {};
        const dependencies: Dependency[] = [];
        const analysis: ProjectAnalysis = {
            id: p.id as RemoteRepoRef,
            elements,
            services,
            dependencies,
        };

        const scanned = (await Promise.all(this.scanners.map(i => i(p, sdmContext, analysis))))
            .filter(r => !!r);

        for (const s of scanned) {
            elements[s.name] = s;
            if (!!s.services) {
                services = {
                    ...services,
                    ...s.services,
                };
            }
            if (!!s.dependencies) {
                dependencies.push(...s.dependencies);
            }
        }
        return analysis;
    }

    public async analyzeFully(p: Project, sdmContext: SdmContext): Promise<FullProjectAnalysis> {
        const initialAnalysis = await this.analyze(p, sdmContext);
        const seedAnalysis = await performSeedAnalysis(p, initialAnalysis, this.transformRecipeContributorRegistrations, sdmContext);
        return {
            ...initialAnalysis,
            seedAnalysis,
        };
    }
}
