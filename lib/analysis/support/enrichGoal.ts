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
    EnrichGoal,
    PushListenerInvocation,
    SdmGoalMessage,
    StatefulPushListenerInvocation,
} from "@atomist/sdm";
import * as _ from "lodash";

export const ElementsGoalsKey = "@atomist/sdm-pack-analysis/elements";
export const ServicesGoalsKey = "@atomist/sdm-pack-analysis/services";

export const ElementsEnrichGoal: EnrichGoal = async (goal: SdmGoalMessage, pli: PushListenerInvocation) => {
    // Add recorded elements into the goal for later retrieval
    if (!!(pli as StatefulPushListenerInvocation<any>).facts) {
        const data: any = {};
        data[ElementsGoalsKey] = _.get(pli, "facts.interpretation.reason.analysis.elements");
        data[ServicesGoalsKey] = _.get(pli, "facts.interpretation.reason.analysis.services");
        goal.data = JSON.stringify(data);
    }
    return goal;
};
