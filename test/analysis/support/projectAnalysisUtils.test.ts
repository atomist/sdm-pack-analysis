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

import * as assert from "assert";
import { ProjectAnalysis } from "../../../lib/analysis/ProjectAnalysis";
import { isUsableAsSeed } from "../../../lib/analysis/support/projectAnalysisUtils";

describe("projectAnalysisUtils", () => {

    describe("isUsableAsSeed", () => {

        it("won't use with no seedAnalysis", async () => {
            const analysis: ProjectAnalysis = newAnalysis();
            assert(!isUsableAsSeed(analysis));
        });

        it("will not use with seedAnalysis but not parameters", async () => {
            const analysis: ProjectAnalysis = newAnalysis();
            analysis.seedAnalysis = {
                transformRecipes: [
                    {
                        optional: false,
                        originator: "foo",
                        description: "foo",
                        recipe: {
                            parameters: [],
                            transforms: [],
                        },
                    },
                ],
            };
            assert(!isUsableAsSeed(analysis));
        });

        it("will use with seedAnalysis and parameters", async () => {
            const analysis: ProjectAnalysis = newAnalysis();
            analysis.seedAnalysis = {
                transformRecipes: [
                    {
                        optional: false,
                        originator: "foo",
                        description: "foo",
                        recipe: {
                            parameters: [{
                                name: "thing",
                            }],
                            transforms: [],
                        },
                    },
                ],
            };
            assert(isUsableAsSeed(analysis));
        });

    });

});

function newAnalysis(): ProjectAnalysis {
    return {
        elements: {},
        id: undefined,
        options: { full: true },
        dependencies: [],
        referencedEnvironmentVariables: [],
        services: {},
        messages: [],
    };
}
