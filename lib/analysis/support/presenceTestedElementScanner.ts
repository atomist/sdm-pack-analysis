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

import { ProjectPredicate } from "@atomist/sdm";
import { TechnologyElement } from "../../analysis/ProjectAnalysis";
import { TechnologyScanner } from "../../analysis/TechnologyScanner";

/**
 * Return a largely empty TechnologyElement that indicates the presence
 * of a technology we're not otherwise interested in. Useful for querying.
 * @param elementIdentification element identification
 * @param test predicate determining whether the project satisfies this element.
 * For example, does it have a particular file?
 */
export function presenceTestedElementScanner(
    elementIdentification: Pick<TechnologyElement, "name" | "tags">,
    test: ProjectPredicate): TechnologyScanner<TechnologyElement> {
    return async p => {
        const satisfied = await test(p);
        return satisfied ? {
            ...elementIdentification,
            referencedEnvironmentVariables: [],
        } :
            undefined;
    };
}
