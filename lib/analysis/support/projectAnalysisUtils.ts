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
    ProjectAnalysis,
    TechnologyElement,
} from "../ProjectAnalysis";

import * as _ from "lodash";

export function allTechnologyElements(projectAnalysis: ProjectAnalysis): TechnologyElement[] {
    return Object.getOwnPropertyNames(projectAnalysis.elements)
        .map(name => projectAnalysis.elements[name]);
}

/**
 * Is this project usable as a seed?
 */
export function isUsableAsSeed(fpa: ProjectAnalysis): boolean {
    if (!fpa.seedAnalysis) {
        return false;
    }
    const parameters = _.flatten(fpa.seedAnalysis.transformRecipes.filter(tr => tr.optional).map(tr => tr.recipe.parameters));
    return parameters.length > 0;
}
