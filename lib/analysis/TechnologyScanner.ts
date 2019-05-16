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

export type RelevanceTest = (analysis: ProjectAnalysis) => boolean;

/**
 * Result of quickly classifying a project.
 */
export type TechnologyClassification = Classified & HasMessages;

/**
 * Way of attaching fingerprints to scanners. This will automatically be exposed on analysis.
 */
export interface TechnologyFeature<FPI extends FP = FP> extends Feature<FPI> {

    /**
     * Is this registration relevant to this project? For example, if
     * we are tracking TypeScript version, is this even a Node project?
     * Is the target at all relevant
     */
    relevanceTest?: RelevanceTest;

}

export interface InferredTechnologyFeature<T extends TechnologyElement, FPI extends FP = FP>
    extends Pick<Feature<FPI>, "selector" | "apply" | "comparators" | "toDisplayableString"> {

    consequence(t: T): FPI;

    /**
     * Is this registration relevant to this project? For example, if
     * we are tracking TypeScript version, is this even a Node project?
     * Is the target at all relevant
     */
    relevanceTest?: RelevanceTest;

}

export type ManagedFeature<T extends TechnologyElement, FPI extends FP = FP> =
    TechnologyFeature<FPI> | InferredTechnologyFeature<T, FPI>;

export function isInferredTechnologyFeature(mf: ManagedFeature<any, any>): mf is InferredTechnologyFeature<any> {
    const maybe = mf as InferredTechnologyFeature<any, any>;
    return !!maybe.consequence;
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
        {
            // If it wants to be classified, it has to do work
            classify: async () => undefined,
            scan: sa,
        };
}

export type ScannerAction<T extends TechnologyElement> = TechnologyScanner<T> | PhasedTechnologyScanner<T>;
