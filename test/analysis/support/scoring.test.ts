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
