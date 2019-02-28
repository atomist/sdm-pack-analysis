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
    allSatisfied,
    AnyPush,
    anySatisfied,
    AutoCodeInspection,
    Autofix,
    AutofixRegistration,
    AutoInspectRegistration,
    not,
    pushTest,
    PushTest,
    StatefulPushListenerInvocation,
} from "@atomist/sdm";
import { Interpretation } from "../Interpretation";
import { ProjectAnalyzer } from "../ProjectAnalyzer";

function interpretationAutofixPushTest(thisTransform: AutofixRegistration, analyzer: ProjectAnalyzer): PushTest {
    return pushTest("interpretationAutofixPushTest", async pu => {
        const interpretation = await analyzer.interpret(pu.project, pu);
        return interpretation.autofixes.includes(thisTransform);
    });
}

export function registerAutofixes(autofixGoal: Autofix, analyzer: ProjectAnalyzer): void {
    for (const autofixRegistration of analyzer.possibleAutofixes) {
        autofixGoal.with({
            ...autofixRegistration,
            pushTest: allSatisfied(
                interpretationAutofixPushTest(autofixRegistration, analyzer),
                autofixRegistration.pushTest || AnyPush),
        });
    }
}

function interpretationCodeInspectionPushTest(thisTransform: AutoInspectRegistration<any, any>, analyzer: ProjectAnalyzer): PushTest {
    return pushTest("interpretationCodeInspectionPushTest", async pu => {
        const interpretation = await analyzer.interpret(pu.project, pu);
        return interpretation.inspections.includes(thisTransform);
    });
}

export function registerCodeInspections(codeInspectionGoal: AutoCodeInspection, analyzer: ProjectAnalyzer): void {
    for (const codeInspectionRegistration of analyzer.possibleCodeInspections) {
        codeInspectionGoal.with({
            ...codeInspectionRegistration,
            pushTest: allSatisfied(
                interpretationCodeInspectionPushTest(codeInspectionRegistration, analyzer),
                codeInspectionRegistration.pushTest || AnyPush),
        });
    }
}

/**
 * Is this a material change? I.e. did none of the material change push tests spot a material change.
 * @param {StatefulPushListenerInvocation<{interpretation: Interpretation}>} pu
 * @return {Promise<boolean>}
 */
export async function materialChange(pu: StatefulPushListenerInvocation<{interpretation: Interpretation}>): Promise<boolean> {
    if (!!pu.facts.interpretation.materialChangePushTests && pu.facts.interpretation.materialChangePushTests.length > 0) {
        return not(anySatisfied(...pu.facts.interpretation.materialChangePushTests)).mapping(pu);
    } else {
        return false;
    }
}
