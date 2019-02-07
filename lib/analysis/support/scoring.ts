/**
 * How heavily to weight this score. Default is 1.
 */
import { Interpretation } from "../Interpretation";

export type Weighting = 1 | 2 | 3;

/**
 * Weighting to apply to this name score. Default is 1.
 * Other values can be used to increase the weighting.
 */
export type ScoreWeightings = Record<string, Weighting>;

/**
 * Perform a weighted composite score for the given Interpretation.
 * Returns a real number from 0 to 5
 */
export function weightedCompositeScore(i: Interpretation,
                                       weightings: ScoreWeightings = {}): number | undefined {
    const keys = Object.getOwnPropertyNames(i.scores);
    if (keys.length === 0) {
        return undefined;
    }
    let compositeScore: number = 0.0;
    let divideBy = 0;
    const scores = keys.map(k => i.scores[k]);
    for (const score of scores) {
        const weighting = weightings[score.name] || 1;
        compositeScore += score.score * weighting;
        divideBy += weighting;
    }
    return compositeScore / divideBy;
}
