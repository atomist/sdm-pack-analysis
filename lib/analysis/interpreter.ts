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
    Queue,
    SdmContext,
} from "@atomist/sdm";
import { Interpretation } from "./Interpretation";
import { ProjectAnalysis } from "./ProjectAnalysis";
import { ProjectAnalyzer } from "./ProjectAnalyzer";

const queueGoal = new Queue({ concurrent: 2, fetch: 20 });

export async function interpretWith(projectAnalyzer: ProjectAnalyzer,
                                    analysis: ProjectAnalysis,
                                    sdmContext: SdmContext): Promise<Interpretation | undefined> {
    const interpretation: Interpretation = {
        reason: {
            analysis,
            availableInterpreters: projectAnalyzer.interpreters,
            chosenInterpreters: [],
        },
        autofixes: [],
        inspections: [],

        autofixGoal: projectAnalyzer.autofixGoal,
        codeInspectionGoal: projectAnalyzer.codeInspectionGoal,

        queueGoal,
    };

    for (const interpreter of projectAnalyzer.interpreters) {
        const enriched = await interpreter.enrich(interpretation, sdmContext);
        if (enriched) {
            interpretation.reason.chosenInterpreters.push(interpreter);
        }
    }

    return interpretation;
}
