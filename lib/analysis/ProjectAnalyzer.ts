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

import { Project } from "@atomist/automation-client";
import {
    AutoCodeInspection,
    Autofix,
    AutofixRegistration,
    AutoInspectRegistration,
    Goal,
    SdmContext,
} from "@atomist/sdm";
import {
    Interpretation,
    Interpreter,
} from "./Interpretation";
import {
    ProjectAnalysis,
    ProjectAnalysisOptions,
    TechnologyElement,
} from "./ProjectAnalysis";
import { Score } from "./Score";
import {
    FastProject,
    ScannerAction, TechnologyClassification,
    TechnologyScanner,
} from "./TechnologyScanner";
import { TransformRecipeContributionRegistration } from "./TransformRecipeContributor";

/**
 * When an action should be run
 */
export type RunCondition = (options: ProjectAnalysisOptions, sdmContext: SdmContext) => boolean;

/**
 * Registration of a TechnologyScanner, Interpreter etc that should run conditionally
 * depending on analysis options and SdmContext.
 */
export interface ConditionalRegistration<W> {

    /**
     * Action we are registering, such as a TechnologyScanner or Interpreter
     */
    action: W;

    /**
     * Test for when this action should run,
     * depending on analysis options and the current SDM context
     * (allowing for feature flagging).
     * Default is always run.
     * @param {ProjectAnalysisOptions} options
     * @return {boolean}
     */
    runWhen: RunCondition;
}

export function isConditionalRegistration(a: any): a is ConditionalRegistration<any> {
    const maybe = a as ConditionalRegistration<any>;
    return !!maybe.action;
}

export type Scorer = (i: Interpretation, ctx: SdmContext) => Promise<Score>;

/**
 * Result of classifying the project quickly to determine its nature.
 */
export interface Classification {

    elements: Record<string, TechnologyClassification>;
}

/**
 * Type with ability to analyze individual projects and determine their delivery.
 * We use a fixed set of goals created ahead of time with function implementations
 * that are parameterized based on analyzing and interpreting the project on push.
 */
export interface ProjectAnalyzer {

    /**
     * Classify this project. The implementations should be faster than delivery steps of interpretation and analysis.
     * Allows a project to be classified quickly to determine the relevance of this SDM to handling it.
     */
    classify(p: FastProject, sdmContext: SdmContext): Promise<Classification>;

    /**
     * Analyze the given project. Analysis will always be in sufficient detail to back delivery.
     * If options are provided and specify a full analysis, go deeper.
     */
    analyze(p: Project, sdmContext: SdmContext, options?: ProjectAnalysisOptions): Promise<ProjectAnalysis>;

    /**
     * Interpret the project, analyzing it first if necessary
     */
    interpret(p: Project | ProjectAnalysis, sdmContext: SdmContext, options?: ProjectAnalysisOptions): Promise<Interpretation>;

    readonly interpreters: Array<ConditionalRegistration<Interpreter>>;

    readonly scanners: Array<ConditionalRegistration<ScannerAction<any>>>;

    readonly scorers: Array<ConditionalRegistration<Scorer>>;

    readonly possibleAutofixes: AutofixRegistration[];

    readonly possibleCodeInspections: Array<AutoInspectRegistration<any, any>>;

    readonly autofixGoal: Autofix;

    readonly codeInspectionGoal: AutoCodeInspection;

    readonly messageGoal: Goal;
}

/**
 * Integrated support for a new stack.
 * At least one scanner is always required.
 * Interpreters are optional, as are
 * any number of transform recipe contributors to
 * facilitate use as a seed project.
 */
export interface StackSupport {

    /**
     * Scanner or scanners that identify the new stack. Necessary to drive
     * any Interpreters, TransformRecipeContributors or Scorers.
     */
    scanners: Array<TechnologyScanner<any> | ConditionalRegistration<TechnologyScanner<any>>>;

    interpreters: Array<Interpreter | ConditionalRegistration<Interpreter>>;

    scorers?: Array<Scorer | ConditionalRegistration<Scorer>>;

    transformRecipeContributors: TransformRecipeContributionRegistration[];

    /**
     * If this is set, it will conditionalize all registrations except those with their own explicit conditions.
     */
    condition?: RunCondition;

}

/**
 * Fluent builder interface we can use to build an immutable ProjectAnalyzer
 */
export interface ProjectAnalyzerBuilder {

    /**
     * Add a scanner that can discern a technology stack.
     * Ordering is important. Later analyzers can see the work
     * of previous analyzers. This ensure that expensive parsing
     * can be done only once.
     */
    withScanner<T extends TechnologyElement>(scanner: ScannerAction<T> | ConditionalRegistration<ScannerAction<T>>): ProjectAnalyzerBuilder;

    /**
     * Add an interpreter that can interpret the analysis.
     * Ordering is important, as interpreters registered later
     * can choose to stand down if relevant goals have already been
     * computed by higher priority interpreters.
     * @param {Interpreter} interpreter
     * @return {ProjectAnalyzerBuilder}
     */
    withInterpreter(interpreter: Interpreter | ConditionalRegistration<Interpreter>): ProjectAnalyzerBuilder;

    /**
     * Add a scorer to this analyzer
     */
    withScorer(scorer: Scorer | ConditionalRegistration<Scorer>): ProjectAnalyzerBuilder;

    /**
     * Add a contributor that can analyze this project as a potential seed
     * @param {TransformRecipeContributionRegistration} trc
     * @return {ProjectAnalyzerBuilder}
     */
    withTransformRecipeContributor(trc: TransformRecipeContributionRegistration): ProjectAnalyzerBuilder;

    /**
     * Add support for a new stack
     */
    withStack(stackSupport: StackSupport): this;

    /**
     * Create a ProjectAnalyzer instance
     * @return {ProjectAnalyzer}
     */
    build(): ProjectAnalyzer;

}
