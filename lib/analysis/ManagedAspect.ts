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
    Aspect,
    AtomicAspect,
    DerivedAspect,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import { ProjectAnalysis } from "./ProjectAnalysis";

export type AnalysisDerivedAspect<FPI extends FP = FP> = DerivedAspect<ProjectAnalysis, FPI>;

/**
 * This pack knows how to manage aspects that are directly extracted from
 * projects or extracted from ProjectAnalysis
 */
export type ManagedAspect<FPI extends FP = FP> = Aspect<FPI> | AtomicAspect<FPI> | AnalysisDerivedAspect<FPI>;
