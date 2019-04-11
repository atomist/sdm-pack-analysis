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
    ReviewListenerRegistration,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import { ProjectAnalyzerBuilder } from "./ProjectAnalyzer";
import { DefaultProjectAnalyzerBuilder } from "./support/DefaultProjectAnalyzerBuilder";

/**
 * Options to configure the ProjectAnalyzer instance
 */
export interface AnalyzerOptions {

    /** Configure the code inspection goal */
    codeInspection?: {
        /** ReviewListener for be added to code inspection goal */
        reviewListener?: ReviewListenerRegistration | ReviewListenerRegistration[];
    };

}

/**
 * Return the default ProjectAnalyzerBuilder so we don't need to know about the implementing class.
 * @param {SoftwareDeliveryMachine} sdm
 * @return {ProjectAnalyzerBuilder}
 */
export function analyzerBuilder(sdm: SoftwareDeliveryMachine,
                                options: AnalyzerOptions = {}): ProjectAnalyzerBuilder {
    return new DefaultProjectAnalyzerBuilder(sdm, options);
}
