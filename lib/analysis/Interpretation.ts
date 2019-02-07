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
    AutoCodeInspection,
    Autofix,
    AutofixRegistration,
    AutoInspectRegistration,
    goals,
    Goals,
    GoalWithPrecondition,
    PushTest,
    SdmContext,
} from "@atomist/sdm";
import { PreferencesElement } from "../element/preferences/preferencesScanner";
import { CiPhases } from "./phases";
import { ProjectAnalysis } from "./ProjectAnalysis";
import { ProjectAnalyzer } from "./ProjectAnalyzer";

/**
 * Consolidated interpretation. Unlike a ProjectAnalysis, an interpretation is not
 * intended to be persisted.
 */
export interface Interpretation extends CiPhases {

    /**
     * The data on which we arrived at this interpretation
     */
    readonly reason: {
        readonly analysis: ProjectAnalysis;
        readonly availableInterpreters: Interpreter[];
        readonly chosenInterpreters: Interpreter[];
    };

    /**
     * List of push tests determining if a change is a material change.
     * This varies depending on the technology stack.
     * Allows consistent handling of non-material changes across
     * all technologies.
     */
    readonly materialChangePushTests: PushTest[];

    readonly autofixes: AutofixRegistration[];
    readonly inspections: Array<AutoInspectRegistration<any, any>>;

    readonly autofixGoal: Autofix;
    readonly codeInspectionGoal: AutoCodeInspection;

}

/**
 * Implemented by types that can use a ProjectAnalysis--
 * without access to the underlying project--to fill in how
 * the repo should be handled: checked, autofixed, built, deployed etc.
 */
export interface Interpreter {

    /**
     * Some interpreters need to create goals that invoke their own analysis.
     * This callback enables that.
     */
    setAnalyzer?(analyzer: ProjectAnalyzer): void;

    /**
     *
     * @param {Interpretation} interpretation
     * @param sdmContext context to compute in
     * @return {Promise<boolean>} whether enrichment was made
     */
    enrich(interpretation: Interpretation, sdmContext: SdmContext): Promise<boolean>;
}

export interface AutofixRegisteringInterpreter extends Interpreter {
    autofixes: AutofixRegistration[];
}

export interface CodeInspectionRegisteringInterpreter extends Interpreter {
    codeInspections: Array<AutoInspectRegistration<any, any>>;
}

export function isAutofixRegisteringInterpreter(a: Interpreter): a is AutofixRegisteringInterpreter {
    const maybe = a as AutofixRegisteringInterpreter;
    return !!maybe.autofixes;
}

export function isCodeInspectionRegisteringInterpreter(a: Interpreter): a is CodeInspectionRegisteringInterpreter {
    const maybe = a as CodeInspectionRegisteringInterpreter;
    return !!maybe.codeInspections;
}

export function controlGoals(interpretation: Interpretation): Goals {
    const startup = goals("control");
    if (!!interpretation.cancelGoal) {
        startup.plan(interpretation.cancelGoal);
    }
    if (!!interpretation.queueGoal) {
        startup.plan(interpretation.queueGoal);
    }
    return startup;
}

export function checkGoals(interpretation: Interpretation, analyzer: ProjectAnalyzer): Goals {
    const checks = goals("checks");
    const startup = controlGoals(interpretation);
    if (interpretation.autofixes.length > 0) {
        checks.plan(analyzer.autofixGoal).after(startup);
    }
    if (interpretation.inspections.length > 0) {
        checks.plan(analyzer.codeInspectionGoal).after(startup, analyzer.autofixGoal);
    }
    if (!!interpretation.checkGoals) {
        checks.plan(interpretation.checkGoals).after(startup, analyzer.autofixGoal);
    }
    if (!!interpretation.reason.analysis.elements.preferences) {
        const preferences = interpretation.reason.analysis.elements.preferences as PreferencesElement;
        return goals("checks").plan(...checks.goals.filter(g => !preferences.disabledGoals.includes(g.definition.displayName)));
    }
    return checks;
}

export function buildGoals(interpretation: Interpretation, analyzer: ProjectAnalyzer): Goals {
    const preCondition = checkGoals(interpretation, analyzer);
    const startup = controlGoals(interpretation);
    if (!!interpretation.buildGoals) {
        interpretation.buildGoals.goals.forEach(
            g => (g as GoalWithPrecondition).dependsOn.push(...startup.goals, ...preCondition.goals));
    }
    return interpretation.buildGoals;
}

export function testGoals(interpretation: Interpretation, analyzer: ProjectAnalyzer): Goals {
    const preCondition = buildGoals(interpretation, analyzer) || checkGoals(interpretation, analyzer);
    const startup = controlGoals(interpretation);
    if (!!interpretation.testGoals) {
        interpretation.testGoals.goals.forEach(
            g => (g as GoalWithPrecondition).dependsOn.push(...startup.goals, ...preCondition.goals));
    }
    return interpretation.testGoals;
}

export function containerGoals(interpretation: Interpretation, analyzer: ProjectAnalyzer): Goals {
    const preCondition = testGoals(interpretation, analyzer) || buildGoals(interpretation, analyzer) || checkGoals(interpretation, analyzer);
    const startup = controlGoals(interpretation);
    if (!!interpretation.containerBuildGoals) {
        interpretation.containerBuildGoals.goals.forEach(
            g => (g as GoalWithPrecondition).dependsOn.push(...startup.goals, ...preCondition.goals));
    }
    return interpretation.containerBuildGoals;
}

export function deployGoals(interpretation: Interpretation, analyzer: ProjectAnalyzer): Goals {
    const preCondition = containerGoals(interpretation, analyzer) || testGoals(interpretation, analyzer)
        || buildGoals(interpretation, analyzer) || checkGoals(interpretation, analyzer);
    const startup = controlGoals(interpretation);
    if (!!interpretation.deployGoals) {
        interpretation.deployGoals.goals.forEach(
            g => (g as GoalWithPrecondition).dependsOn.push(...startup.goals, ...preCondition.goals));
    }
    return interpretation.deployGoals;
}
