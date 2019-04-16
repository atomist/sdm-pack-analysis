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
    BaseParameter,
    RemoteRepoRef,
} from "@atomist/automation-client";
import {
    CodeTransform,
    HasDefaultValue,
    MappedParameterOrSecretDeclaration,
} from "@atomist/sdm";
import { Scores } from "./Score";

/**
 * Definition of a service such as riak or mongodb
 * that we've seen a project depends on.
 */
// tslint:disable-next-line:no-empty-interface
export interface Service {

}

export type Services = Record<string, Service>;

export type Elements = Record<string, TechnologyElement>;

/**
 * Results of running code inspections on the current project
 */
export type InspectionResults = Record<string, object>;

/**
 * Cross-platform representation of a dependency
 */
export interface Dependency {
    group?: string;
    artifact: string;
    version: string;
}

/**
 * Options with which the analysis was performed
 */
export interface ProjectAnalysisOptions {
    full: boolean;
}

/**
 * An analysis of the various facets of a project.
 * An analysis doesn't involve decisions about how to process the project:
 * That is the role of an Interpretation. It merely provides the background information,
 * so that Interpreters don't need to refer to the project.
 * Analyses can be persisted.
 */
export interface ProjectAnalysis {

    /**
     * Options used to perform this analysis.
     * Will determine whether optional fields are available.
     */
    options: ProjectAnalysisOptions;

    readonly id: RemoteRepoRef;

    /**
     * Technology elements we've found in this project.
     */
    readonly elements: Elements;

    /**
     * Services we depend on
     */
    readonly services: Services;

    /**
     * Dependencies of this project.
     */
    readonly dependencies: Dependency[];

    /**
     * Environment variables referenced in all elements
     */
    readonly referencedEnvironmentVariables: string[];

    /**
     * Analysis of this project as a potential seed
     * Only available on a full analysis
     */
    seedAnalysis?: SeedAnalysis;

    /**
     * Inspections. Only performed on a full analysis
     */
    inspections?: InspectionResults;

    /**
     * Scores. Only performed on a full analysis
     */
    scores?: Scores;

}

export interface Classified {

    /**
     * Name of the element, such as "node".
     * Must be unique in analysis
     */
    readonly name: string;

    /**
     * Tags associated with this element's use.
     */
    readonly tags: string[];
}

/**
 * Instance of a known element type, such as NodeTechnologyElement,
 * in a specific project.
 */
export interface TechnologyElement extends Classified {

    /**
     * Names of environment variables referenced by this stack.
     */
    readonly referencedEnvironmentVariables?: string[];

    /**
     * Any services required by this element
     */
    readonly services?: Services;

}

export type ParamInfo = ((BaseParameter & HasDefaultValue) | MappedParameterOrSecretDeclaration);

export type NamedParameter = { name: string } & ParamInfo;

/**
 * Recipe contribution to use this as project a seed.
 */
export interface TransformRecipe {

    parameters: NamedParameter[];

    transforms: Array<CodeTransform<any>>;

    /**
     * Messages from this transform recipe.
     * E.g. we might want to inform the user of environment variables
     * they will need to set to run the project.
     */
    messages?: string[];

    /**
     * Warnings from this transform recipe.
     * E.g. we might want to warn about a problematic license.
     */
    warnings?: string[];
}

export interface TransformRecipeRequest {

    /**
     * Originating strategy
     */
    originator: string;

    description: string;

    optional: boolean;

    recipe: TransformRecipe;

}

/**
 * Information about how this project may be used as a seed
 */
export interface SeedAnalysis {

    transformRecipes: TransformRecipeRequest[];
}
