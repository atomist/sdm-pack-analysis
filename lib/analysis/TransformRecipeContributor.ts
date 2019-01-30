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
    TransformRecipe,
} from "./ProjectAnalysis";

/**
 * Contributor to seed analysis. Many TransformRecipeContributors
 * can be used, each parameterizing part of a seed project.
 */
export interface TransformRecipeContributor {

    /**
     * Contribute a transform recipe to a seed analysis.
     */
    analyze(p: Project, analysis: ProjectAnalysis, sdmContext: SdmContext): Promise<TransformRecipe | undefined>;
}

/**
 * Registration of a TransformRecipeContributor, determining
 * how it should be applied in this SDM.
 */
export interface TransformRecipeContributionRegistration {

    /**
     * Originating strategy. Useful for provenance.
     */
    originator: string;

    /**
     * Whether this recipe is optional, meaning that the user should
     * be asked whether it should apply, rather than it being automatically
     * applied to the repo.
     */
    optional: boolean;

    contributor: TransformRecipeContributor;
}
