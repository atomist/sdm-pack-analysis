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
    Feature,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import {
    ProjectAnalysis,
    TechnologyElement,
} from "./ProjectAnalysis";

export interface PossibleIdeal<FPI extends FP> {
    ideal: FPI;
    scope: keyof PossibleIdeals<FPI>;
    reason: string;
    url?: string;
}

export interface PossibleIdeals<FPI extends FP> {

    /**
     * Ideal found from wider world--e.g. a package repository
     */
    world?: PossibleIdeal<FPI>;

    /**
     * Ideal based on what we've found internally
     */
    fromProjects?: PossibleIdeal<FPI>;

    /**
     * Ideals managed internally in an organization
     */
    custom?: Array<PossibleIdeal<FPI>>;
}

/**
 * Do we consider that the particular fingerprint is relevant to this project?
 */
export type RelevanceTest = (fingerprintName: string, analysis: ProjectAnalysis) => boolean;

/**
 * Feature that can be managed visually. Extends Fingerprint support.
 */
export interface VisualFeature<FPI extends FP> {

    /**
     * Is this feature relevant to this project? For example, if
     * we are tracking TypeScript version, is this even a Node project?
     * Is the target at all relevant
     */
    relevanceTest?: RelevanceTest;

    /**
     * Is this feature desired on this project, according to our standards?
     */
    necessityTest?: RelevanceTest;

    /**
     * Based on the given fingerprints, suggest ideals
     * @param {FPI[]} cohort
     * @return {PossibleIdeals<FPI extends FP>}
     */
    suggestIdeal?(cohort: FPI[]): PossibleIdeals<FPI>;
}

/**
 * Feature that can be extracted from a Project directly.
 */
export interface ExtractedFeature<FPI extends FP = FP> extends Feature<FPI>,
    VisualFeature<FPI> {

}

/**
 * Feature that can be inferred from an analysis of a project
 */
export interface InferredFeature<T extends TechnologyElement, FPI extends FP = FP>
    extends Pick<Feature<FPI>, "displayName" | "selector" | "apply" | "comparators" | "toDisplayableString">,
        VisualFeature<FPI> {

    /**
     * Can this feature be inferred from the given analysis, without going back to the project
     * @param {ProjectAnalysis} analysis complete analysis to date
     */
    consequence(analysis: ProjectAnalysis): FPI | FPI[] | undefined | Promise<FPI | undefined | FPI[]>;

}

/**
 * Feature we can manage, including with visualization, however it is extracted.
 */
export type ManagedFeature<T extends TechnologyElement, FPI extends FP = FP> =
    ExtractedFeature<FPI> | InferredFeature<T, FPI>;

export function isExtractedTechnologyFeature(mf: ManagedFeature<any, any>): mf is ExtractedFeature<any> {
    const maybe = mf as ExtractedFeature<any>;
    return !!maybe.extract;
}
