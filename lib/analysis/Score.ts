
/**
 * Rating. More stars are better.
 */
export type FiveStar = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Represents a quality ranking of a particular element of a project.
 */
export interface Score {

    name: string;

    category?: string;

    score: FiveStar;

}

/**
 * Structure representing a score on a particular aspect of a project.
 */
export type Scores = Record<string, Score>;
