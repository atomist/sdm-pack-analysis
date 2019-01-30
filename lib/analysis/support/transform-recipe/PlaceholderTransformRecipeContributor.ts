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
    AllFiles,
    Project,
} from "@atomist/automation-client";
import { fileIterator } from "@atomist/automation-client/lib/project/util/projectUtils";
import {
    CodeTransform,
    PushAwareParametersInvocation,
} from "@atomist/sdm";
import * as yaml from "yamljs";
import {
    ParamInfo,
    TransformRecipe,
    TransformRecipeContributor,
} from "../../../..";

/**
 * Path to YAML template definitions file
 * @type {string}
 */
export const YamlPath = "atomist-seed.yml";

/**
 * Placeholder of the form $$NAME$$
 * @type {RegExp}
 */
const EnclosedVariable = /\$\$([A-Za-z0-9_\.]+)\$\$/g;

/**
 * Placeholder for Cookie cutter variable definition.
 */
const CookieCutterVariable = /{{cookiecutter\.([A-Za-z0-9_\$]+)}}/g;

/**
 * Parameter based on a placeholder.
 * literal is what was matched (e.g. $NAME$) to allow easy replacement.
 */
export type PlaceholderParameter = { name: string, literal: string } & ParamInfo;

/**
 * Type for format of file at $YamlPath
 * Format is like this:
 *
 * parameters:
 *    Thing:
 *       description: This is a thing
 *       pattern: [a-z]+
 */
export interface PlaceholderParameterDefinitions {

    // Similar to ParametersObject, but also includes literal
    parameters: {
        [name: string]: PlaceholderParameter;
    };
}

/**
 * Definition of a well-known parameter available to all
 * transforms.
 */
export interface WellKnownParameterDefinition {
    name: string;
    compute: (papi: PushAwareParametersInvocation<any>) => string;
}

/**
 * Well known parameters we can rely on
 */
const defaultParameterDefinitions: WellKnownParameterDefinition[] = [
    { name: "workspace", compute: papi => papi.context.workspaceId },
    { name: "date", compute: () => new Date().toISOString() },
];

/**
 * Identify and replace placeholders in a seed project.
 * Syntax is of form $$NAME$$, and may occur in files or directories.
 * Also handles cookie cutter templates.
 */
export class PlaceholderTransformRecipeContributor implements TransformRecipeContributor {

    public readonly wellKnownParameters: WellKnownParameterDefinition[];

    public async analyze(p: Project): Promise<TransformRecipe> {
        const y = await parseYml(p);
        const placeholdersInferredFromProjectContent = await findPlaceholders(p, this.placeholders);
        const placeholdersWithLiteralsDefinedInYaml: PlaceholderParameter[] =
            Object.getOwnPropertyNames(y.parameters)
                .map(name => ({ name, literal: undefined, ...y.parameters[name] }) as any)
                .filter(param => !!param.literal);
        const parameters = placeholdersInferredFromProjectContent.concat(placeholdersWithLiteralsDefinedInYaml)
            .map(param => ({ ...param, ...y.parameters[param.name] }) || param);
        return {
            parameters,
            transforms: [parametersTransform(parameters, this.wellKnownParameters)],
        };
    }

    /**
     * Create a new PlaceholderTransformRecipeContributor.
     * It is possible to define alternative or additional placeholder expansions
     * and additional well known parameters.
     * @param {RegExp[]} placeholder pattenrs. Placeholders must be specified with /g
     * and must define a single capture group for the actual value.
     * @param customParameterDefinitions definitions of additional well known parameters
     */
    constructor(private readonly placeholders: RegExp[] = [EnclosedVariable, CookieCutterVariable],
                customParameterDefinitions: WellKnownParameterDefinition[] = []) {
        this.wellKnownParameters = customParameterDefinitions.concat(defaultParameterDefinitions);
    }

}

async function parseYml(p: Project): Promise<PlaceholderParameterDefinitions> {
    const yamlFile = await p.getFile(YamlPath);
    if (!yamlFile) {
        return {
            parameters: {},
        };
    }
    const native = await yaml.parse(await yamlFile.getContent());
    return { parameters: native.parameters };
}

async function findPlaceholders(project: Project, placeholders: RegExp[]): Promise<PlaceholderParameter[]> {
    const params: PlaceholderParameter[] = [];
    for await (const f of fileIterator(project, AllFiles)) {
        const allContent = f.path + await f.getContent();
        let m;
        for (const placeholder of placeholders) {
            // tslint:disable-next-line:no-conditional-assignment
            while (m = placeholder.exec(allContent)) {
                const name = m[1];
                if (!params.some(p => p.name === name)) {
                    params.push({
                        name,
                        literal: m[0],
                    });
                }
            }
        }
    }
    return params;
}

/**
 * Replace all placeholders
 * @param {PlaceholderParameter[]} params
 * @param {WellKnownParameterDefinition[]} wellKnownParameterDefinitions
 * @return {CodeTransform<any>}
 */
function parametersTransform(params: PlaceholderParameter[], wellKnownParameterDefinitions: WellKnownParameterDefinition[]): CodeTransform<any> {
    return async (p, papi) => {
        addWellKnownParameters(wellKnownParameterDefinitions, papi);
        for await (const f of fileIterator(p, AllFiles)) {
            for (const param of params.concat(toPlaceholderParameters(wellKnownParameterDefinitions))) {
                await f.setPath(f.path.replace(param.literal, papi.parameters[param.name]));
                await f.replaceAll(param.literal, papi.parameters[param.name]);
            }
        }
    };
}

function addWellKnownParameters(wellKnownParameterDefinitions: WellKnownParameterDefinition[],
                                papi: PushAwareParametersInvocation<any>): void {
    wellKnownParameterDefinitions
        .forEach(p => {
            papi.parameters[p.name] = p.compute(papi);
        });
}

function toPlaceholderParameters(defs: WellKnownParameterDefinition[]): Array<WellKnownParameterDefinition & PlaceholderParameter> {
    return defs.map(def => ({ ...def, literal: "$" + def.name + "$" }));
}
