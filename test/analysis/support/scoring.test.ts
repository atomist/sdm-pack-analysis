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
import { Interpretation } from "../../../lib/analysis/Interpretation";
import { ProjectAnalysis } from "../../../lib/analysis/ProjectAnalysis";
import { weightedCompositeScore } from "../../../lib/analysis/support/scoring";

describe("scoring", () => {

    it("should not score with no scores", async () => {
        const i = newInterpretation();
        const score = weightedCompositeScore(i);
        assert(!score);
    });

    it("should score with one scores", async () => {
        const i = newInterpretation();
        i.scores.thing = { name: "thing", score: 5 };
        const score = weightedCompositeScore(i);
        assert.strictEqual(score, 5);
    });

    it("should score with two evenly weighted scores", async () => {
        const i = newInterpretation();
        i.scores.dog = { name: "dog", score: 5 };
        i.scores.cat = { name: "cat", score: 3 };

        const score = weightedCompositeScore(i);
        assert.strictEqual(score, 4);
    });

    it("should score with two unevenly weighted scores", async () => {
        const i = newInterpretation();
        i.scores.dog = { name: "dog", score: 5 };
        i.scores.cat = { name: "cat", score: 3 };

        const score = weightedCompositeScore(i, { dog: 2 });
        assert.strictEqual(score, (2 * 5 + 3) / 3);
    });
});

function newInterpretation(analysis?: ProjectAnalysis): Interpretation {
    return {
        reason: {
            analysis,
            availableInterpreters: [],
            chosenInterpreters: [],
        },
        autofixes: [],
        inspections: [],
        materialChangePushTests: [],
        autofixGoal: undefined,
        codeInspectionGoal: undefined,
        queueGoal: undefined,
        scores: {},
    };
}
