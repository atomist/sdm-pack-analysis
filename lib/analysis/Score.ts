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

export type FiveStar = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Represents a quality ranking of a particular element of a project.
 */
export interface Score {

    readonly name: string;

    /**
     * Category this score belongs to, if any
     */
    readonly category?: string;

    /**
     * Explanation for this score, if available
     */
    readonly reason?: string;

    readonly score: FiveStar;

}

/**
 * Structure representing a score on a particular aspect of a project.
 */
export type Scores = Record<string, Score>;
