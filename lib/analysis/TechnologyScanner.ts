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

/**
 * Result of quickly classifying a project.
 */
export type TechnologyClassification = Classified & HasMessages;

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
