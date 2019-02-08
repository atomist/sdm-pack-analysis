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

import { configurationValue } from "@atomist/automation-client";
import {
    Goal,
    PreferenceScope,
} from "@atomist/sdm";
import { TechnologyElement } from "../../analysis/ProjectAnalysis";
import { TechnologyScanner } from "../../analysis/TechnologyScanner";

export interface PreferencesElement extends TechnologyElement {
    name: "preferences";
    disabledGoals: string[];
}

/**
 * Scanner that detects if certain goals are enabled
 * @param p
 * @param ctx
 */
export const preferencesScanner: TechnologyScanner<PreferencesElement> = async (p, ctx) => {

    const preferences: PreferencesElement = {
        name: "preferences",
        tags: [],
        disabledGoals: [],
    };

    const optionalGoals = configurationValue<Goal[]>("sdm.goal.optional", []);

    for (const optionalGoal of optionalGoals) {
        const displayName = optionalGoal.definition.displayName;
        if (!await ctx.preferences.get<boolean>(`${displayName}:enabled`, { scope: PreferenceScope.Sdm })) {
            preferences.disabledGoals.push(displayName);
        }
    }

    return preferences;
};
