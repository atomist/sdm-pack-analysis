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
} from "@atomist/automation-client";
import {
    AutoCodeInspection,
    Autofix,
    AutofixRegistration,
    AutoInspectRegistration,
    SdmContext,
} from "@atomist/sdm";
import * as _ from "lodash";
import {
    Interpretation,
    Interpreter,
} from "./Interpretation";
import {
    FullProjectAnalysis,
    ProjectAnalysis,
    SeedAnalysis,
    TechnologyElement,
    TransformRecipe,
    TransformRecipeRequest,
} from "./ProjectAnalysis";
import { TechnologyScanner } from "./TechnologyScanner";
import { TransformRecipeContributionRegistration } from "./TransformRecipeContributor";

/**
 * Type with ability to analyze individual projects and determine their delivery.
 * We use a fixed set of goals created ahead of time with function implementations
 * that are parameterized based on analyzing and interpreting the project on push.
 */
export interface ProjectAnalyzer {

    /**
     * Analyze the given project
     * @param {Project} p
     * @param {SdmContext} sdmContext
     * @return {Promise<FullProjectAnalysis>}
     */
    analyze(p: Project, sdmContext: SdmContext): Promise<ProjectAnalysis>;

    /**
     * Perform a full analysis of the project, going beyond what is necessary for delivery.
     */
    analyzeFully(p: Project, sdmContext: SdmContext): Promise<FullProjectAnalysis>;

    /**
     * Interpret the project, analyzing it first if necessary
     * @param {Project | FullProjectAnalysis} p
     * @param {SdmContext} sdmContext
     * @return {Promise<Interpretation>}
     */
    interpret(p: Project | ProjectAnalysis, sdmContext: SdmContext): Promise<Interpretation>;

    readonly interpreters: Interpreter[];

    readonly scanners: Array<TechnologyScanner<any>>;

    readonly possibleAutofixes: AutofixRegistration[];

    readonly possibleCodeInspections: Array<AutoInspectRegistration<any, any>>;

    readonly autofixGoal: Autofix;

    readonly codeInspectionGoal: AutoCodeInspection;
}

/**
 * Integratated support for a new stack
 */
export interface StackSupport<T extends TechnologyElement> {

    scanner: TechnologyScanner<T>;

    interpreter?: Interpreter;

    transformRecipeContributor?: TransformRecipeContributionRegistration;
}

export interface ProjectAnalyzerBuilder {

    /**
     * Add a scanner that can discern a technology stack.
     * Ordering is important
     * @param {TechnologyScanner<T extends TechnologyElement>} i
     * @return {ProjectAnalyzerBuilder}
     */
    withScanner<T extends TechnologyElement>(i: TechnologyScanner<T>): ProjectAnalyzerBuilder;

    /**
     * Add an interpreter that can interpret the analysis.
     * Ordering is important
     * @param {Interpreter} interpreter
     * @return {ProjectAnalyzerBuilder}
     */
    withInterpreter(...interpreter: Interpreter[]): ProjectAnalyzerBuilder;

    /**
     * Add a contributor that can analyze this project as a potential seed
     * @param {TransformRecipeContributionRegistration} trc
     * @return {ProjectAnalyzerBuilder}
     */
    withTransformRecipeContributor(trc: TransformRecipeContributionRegistration): ProjectAnalyzerBuilder;

    /**
     * Add support for a new stack
     */
    withStack<T extends TechnologyElement>(stackSupport: StackSupport<T>): this;

    /**
     * Create a ProjectAnalyzer instance
     * @return {ProjectAnalyzer}
     */
    build(): ProjectAnalyzer;

}

/**
 * Use expert based system to analyze a potential seed
 * and work out which transforms are appropriate and what parameters
 * they need. Uses multiple sub analyzers to compose facets.
 */
export async function performSeedAnalysis(
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
