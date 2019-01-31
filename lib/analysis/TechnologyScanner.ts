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
    ProjectAnalysis,
    TechnologyElement,
} from "./ProjectAnalysis";

/**
 * Scan the given project for a particular element.
 * Ordering is significant, as we can see the analysis to date.
 * It is important that scanners are efficient, because many may be
 * invoked on every push. Thus a scanner should determine as quickly
 * as possible if it should run expensive checks such as parsing,
 * and should use results in the analysis so far if possible.
 */
export type TechnologyScanner<T extends TechnologyElement> =
    (p: Project, ctx: SdmContext, analysisSoFar: ProjectAnalysis) => Promise<T | undefined>;
