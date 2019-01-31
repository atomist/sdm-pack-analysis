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

/**
 * Definition of a service such as riak or mongodb
 * that we've seen a project depends on.
 */
// tslint:disable-next-line:no-empty-interface
export interface Service {

}

export type Services = Record<string, Service>;

export type Elements = Record<string, TechnologyElement>;

export interface Dependency {
    group?: string;
    artifact: string;
    version: string;
}

/**
 * An analysis of the various facets of a project.
 * An analysis doesn't involve decisions about how to process the project:
 * That is the role of an Interpretation.
 */
export interface ProjectAnalysis {

    readonly id: RemoteRepoRef;

    readonly elements: Elements;

    /**
     * Services we depend on
     */
    services: Services;

    dependencies: Dependency[];

    /**
     * Environment variables referenced in all stacks
     */
    referencedEnvironmentVariables: string[];

}

/**
 * Full analysis for purposes beyond delivery, adding seed analysis.
 * Can be persisted.
 */
export interface FullProjectAnalysis extends ProjectAnalysis {

    readonly seedAnalysis: SeedAnalysis;

}

// TODO align with fingerprints
/**
 * Instance of a known element type, such as NodeTechnologyElement,
 * in a specific project.
 */
export interface TechnologyElement {

    /**
     * Name of the element, such as "node".
     * Must be unique in analysis
     */
    readonly name: string;

    /**
     * Tags associated with this element's use.
     */
    readonly tags: string[];

    /**
     * Names of environment variables referenced by this stack.
     */
    readonly referencedEnvironmentVariables?: string[];

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

    optional: boolean;

    recipe: TransformRecipe;

}

/**
 * Information about how this project may be used as a seed
 */
export interface SeedAnalysis {

    transformRecipes: TransformRecipeRequest[];
}
