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

import { Project } from "@atomist/automation-client";
import { SdmContext } from "@atomist/sdm";
import {
    Feature,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import {
    Classified,
    ProjectAnalysis,
    ProjectAnalysisOptions,
    TechnologyElement,
} from "./ProjectAnalysis";
import { HasMessages } from "./support/messageGoal";

/**
 * Subset of Project that is efficient and can be used during a precheck
 */
export type FastProject = Pick<Project, "id" | "findFile" | "hasFile" | "getFile" | "provenance">;

/**
 * Scan the given project for a particular element.
 * Ordering is significant, as we can see the analysis to date.
 * It is important that scanners are efficient, because many may be
 * invoked on every push. Thus a scanner should determine as quickly
 * as possible if it should run expensive checks such as parsing,
 * and should use results in the analysis so far if possible.
 * Scanners that can analyse to varying depth should check the options parameter.
 */
export type TechnologyScanner<T extends TechnologyElement> =
    (p: Project, ctx: SdmContext, analysisSoFar: ProjectAnalysis, options: ProjectAnalysisOptions) => Promise<T | undefined>;

export type RelevanceTest<T extends TechnologyElement> = (t: T, analysis: ProjectAnalysis) => boolean;

/**
 * Result of quickly classifying a project.
 */
export type TechnologyClassification = Classified & HasMessages;

/**
 * Feature that can be managed visually. Extends Fingerprint support.
 */
export interface VisualFeature<T extends TechnologyElement> {

    readonly name: string;

    /**
     * Is this feature relevant to this project? For example, if
     * we are tracking TypeScript version, is this even a Node project?
     * Is the target at all relevant
     */
    relevanceTest?: RelevanceTest<T>;

    /**
     * Is this feature necessary to this project according to our standards?
     */
    necessityTest?: RelevanceTest<T>;
}

/**
 * Feature that can be extracted from a Project directly.
 */
export interface ExtractedFeature<T extends TechnologyElement, FPI extends FP = FP> extends Feature<FPI>, VisualFeature<T> {

}

/**
 * Feature that can be inferred from an analysis of a project
 */
export interface InferredFeature<T extends TechnologyElement, FPI extends FP = FP>
    extends Pick<Feature<FPI>, "selector" | "apply" | "comparators" | "toDisplayableString">,
        VisualFeature<T> {

    /**
     * Can this feature be inferred from the given analysis, without going back to the project
     * @param {T} t relevant technology element
     * @param {ProjectAnalysis} analysis complete analysis to date
     * @return {FPI} fingerprint if found
     */
    consequence(t: T, analysis: ProjectAnalysis): FPI | undefined;

}

/**
 * Feature we can manage, including with visualization, however it is extracted.
 */
export type ManagedFeature<T extends TechnologyElement, FPI extends FP = FP> =
    ExtractedFeature<T, FPI> | InferredFeature<T, FPI>;

export function isExtractedTechnologyFeature(mf: ManagedFeature<any, any>): mf is ExtractedFeature<any, any> {
    const maybe = mf as ExtractedFeature<any>;
    return !!maybe.extract;
}

/**
 * More elaborate scanner that can work in phases
 */
export interface PhasedTechnologyScanner<T extends TechnologyElement> {

    /**
     * Quick classification of this project. Should be efficient.
     */
    classify: (p: FastProject, ctx: SdmContext) => Promise<TechnologyClassification | undefined>;

    /**
     * Perform a scan of the project.
     */
    scan: TechnologyScanner<T>;

    /**
     * Return the features that can be managed in this project
     */
    features?: Array<ManagedFeature<T, any>>;
}

export function isPhasedTechnologyScanner(a: any): a is PhasedTechnologyScanner<any> {
    const maybe = a as PhasedTechnologyScanner<any>;
    return !!maybe.scan;
}

export function toPhasedTechnologyScanner<T extends TechnologyElement>(sa: ScannerAction<T>): PhasedTechnologyScanner<T> {
    return isPhasedTechnologyScanner(sa) ?
        sa :
        // tslint:disable-next-line:no-object-literal-type-assertion
        {
            // If it wants to be classified, it has to do work
            classify: async () => undefined,
            scan: sa,
        } as PhasedTechnologyScanner<T>;
}

export type ScannerAction<T extends TechnologyElement> = TechnologyScanner<T> | PhasedTechnologyScanner<T>;
