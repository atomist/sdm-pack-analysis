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
    CodeInspectionRegistration,
    CommandListenerInvocation,
} from "@atomist/sdm";
import { Interpretation } from "../Interpretation";
import { FullProjectAnalysis } from "../ProjectAnalysis";
import { ProjectAnalyzer } from "../ProjectAnalyzer";
import {
    allTechnologyElements,
    isUsableAsSeed,
} from "../support/projectAnalysisUtils";

export type ResultDisplayer = (analysis: FullProjectAnalysis, interpret: Interpretation, i: CommandListenerInvocation) => Promise<void>;

export function assessInspection(
    analyzer: ProjectAnalyzer,
    resultDisplayer: ResultDisplayer = displayToSlack): CodeInspectionRegistration<FullProjectAnalysis> {
    return {
        name: "assess",
        intent: ["assess", "assess project"],
        inspection: async (p, i) => {
            return analyzer.analyzeFully(p, i);
        },
        onInspectionResults: async (results, i) => {
            for (const result of results) {
                const analysis = result.result;
                const interpretation = await analyzer.interpret(analysis, i);
                return resultDisplayer(analysis, interpretation, i);
            }
        },
    };

}

const displayToSlack: ResultDisplayer = async (analysis, interpretation, i) => {
    await i.addressChannels("I found the following technologies in this project:\n\t" +
        allTechnologyElements(analysis)
            .filter(e => e.name !== "preferences")
            .map(e => `*${e.name}*`).join("\n\t"));

    if (isUsableAsSeed(analysis)) {
        await i.addressChannels("I can use this project as a seed :thumbsup:");
    }
    if (!!interpretation.buildGoals) {
        await i.addressChannels("I know how to build this project! :thumbsup:");
    } else {
        await i.addressChannels("I don't know how to build this project :thumbsdown:");
    }
    if (!!interpretation.testGoals) {
        await i.addressChannels("I know how to test this project! :thumbsup:");
    } else {
        await i.addressChannels("I don't know how to test this project :thumbsdown:");
    }
    if (!!interpretation.deployGoals) {
        await i.addressChannels("I know how to deploy this project! :thumbsup:");
    } else {
        await i.addressChannels("I don't know how to deploy this project :thumbsdown:");
    }
};
