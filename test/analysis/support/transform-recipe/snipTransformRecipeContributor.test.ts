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
    InMemoryProject,
} from "@atomist/automation-client";
import { InMemoryFile } from "@atomist/automation-client/lib/project/mem/InMemoryFile";
import * as assert from "assert";
import {
    PlaceholderTransformRecipeContributor,
    YamlPath,
} from "../../../../lib/analysis/support/transform-recipe/PlaceholderTransformRecipeContributor";
import { SnipTransformRecipeContributor } from "../../../../lib/analysis/support/transform-recipe/SnipTransformRecipeContributor";
import { TransformRecipeContributor } from "../../../../lib/analysis/TransformRecipeContributor";

describe("SnipTransformRecipeContributor", () => {

    it("should transform within a file", async () => {
        const toRemove = "// #atomist.snip //This is silly\n// #atomist.snip";
        const f = new InMemoryFile("src/main/java/Thing.java",
            `public ${toRemove}\nclass $$Thing$$ {}`);
        const p = InMemoryProject.of(f);
        const snipTrc: TransformRecipeContributor = new SnipTransformRecipeContributor();
        const params = await snipTrc.analyze(p, undefined, undefined);
        assert.strictEqual(params.transforms.length, 1);
        await params.transforms[0](p, {
            context: { workspaceId: "X" },
            parameters: { Thing: "MyThing" },
        } as any, undefined);
        const newFile = await p.findFile(f.path);
        assert.strictEqual(newFile.getContentSync(),
            f.getContentSync().replace(toRemove, ""));
    });

});
