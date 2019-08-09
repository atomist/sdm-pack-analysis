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
    Score,
    Scores,
} from "../Score";

export type Weighting = 1 | 2 | 3;

export interface Scored {
    readonly scores: Scores;
}

/**
 * Score the given object in the given context
 * @param scoreFunctions scoring functions
 * @param {T} toScore what to score
 * @param {CONTEXT} context
 * @return {Promise<Scores>}
 */
export async function scoresFor<T, CONTEXT>(scoreFunctions: Array<(t: T, c: CONTEXT) => Promise<Score>>,
                                            toScore: T,
                                            context: CONTEXT): Promise<Scores> {
    const scores: Scores = {};
    for (const scorer of scoreFunctions) {
        const score = await scorer(toScore, context);
        scores[score.name] = score;
    }
    return scores;
}

/**
 * Weighting to apply to this name score. Default is 1.
 * Other values can be used to increase the weighting.
 */
export type ScoreWeightings = Record<string, Weighting>;

/**
 * Perform a weighted composite score for the given scores.
 * Returns a real number from 0 to 5
 */
export function weightedCompositeScore(scored: Scored,
                                       weightings: ScoreWeightings = {}): number | undefined {
    const keys = Object.getOwnPropertyNames(scored.scores);
    if (keys.length === 0) {
        return undefined;
    }
    let compositeScore: number = 0.0;
    let divideBy = 0;
    const scores = keys.map(k => scored.scores[k]);
    for (const score of scores) {
        const weighting = weightings[score.name] || 1;
        compositeScore += score.score * weighting;
        divideBy += weighting;
    }
    return compositeScore / divideBy;
}
