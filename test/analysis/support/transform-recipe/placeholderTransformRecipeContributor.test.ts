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

describe("PlaceholderTransformRecipeContributor", () => {

    describe("parameter finding", () => {

        it("should find no parameters", async () => {
            const p = InMemoryProject.of();
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 0);
        });

        it("should find one parameter in a file", async () => {
            const f = new InMemoryFile("src/main/java/$$Thing$$.java", "public class $Thing$ {}");
            const p = InMemoryProject.of(f);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 1);
            assert.strictEqual(params.parameters[0].name, "Thing");
        });

        it("should find one repeated parameter in a file", async () => {
            const f = new InMemoryFile("src/main/java/$$Thing$$.java",
                "//This is all about $$Thing$$\npublic class $$Thing$$ {}");
            const p = InMemoryProject.of(f);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 1);
            assert.strictEqual(params.parameters[0].name, "Thing");
        });

        it("should find two parameters in a file", async () => {
            const f = new InMemoryFile("src/main/java/$$Thing$$.java",
                "// This is all about $$Dogs$$\npublic class $$Thing$$ {}");
            const p = InMemoryProject.of(f);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 2);
            assert.strictEqual(params.parameters[0].name, "Thing");
            assert.strictEqual(params.parameters[1].name, "Dogs");
        });

        it("should find one parameter in a file and path", async () => {
            const f = new InMemoryFile("src/main/java/$$Thing$$.java", "public class $$Thing$$ {}");
            const p = InMemoryProject.of(f);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 1);
            assert.strictEqual(params.parameters[0].name, "Thing");
        });

        it("should find one parameter in a file and another in a path", async () => {
            const f = new InMemoryFile("src/main/$$Language$$/$$Thing$$.java", "public class $$Thing$$ {}");
            const p = InMemoryProject.of(f);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 2);
            assert.strictEqual(params.parameters[0].name, "Language");
            assert.strictEqual(params.parameters[1].name, "Thing");
        });

        it("should find one parameter with YAML definitions", async () => {
            const f = new InMemoryFile("src/main/$$Language$$/$$Thing$$.java", "public class $$Thing$$ {}");
            const yaml = new InMemoryFile(YamlPath, `
parameters:
   Thing:
      description: This is a thing
        `);
            const p = InMemoryProject.of(f, yaml);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 2);
            assert.strictEqual(params.parameters[0].name, "Language");
            assert.strictEqual(params.parameters[1].name, "Thing");
            const p1 = params.parameters[1] as BaseParameter;
            assert.strictEqual(p1.description, "This is a thing");
        });

        it("allows non delimited variable defined in YAML", async () => {
            const f = new InMemoryFile("src/main/java/Thing.java", "public class Thing {}");
            // TODO literal should ultimately take a regex
            const yaml = new InMemoryFile(YamlPath, `
parameters:
   Thing:
      description: This is a thing
      literal: Thing
        `);
            const p = InMemoryProject.of(f, yaml);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 1);
            assert.strictEqual(params.parameters[0].name, "Thing");
            const p1 = params.parameters[0] as BaseParameter;
            assert.strictEqual(p1.description, "This is a thing");
            await params.transforms[0](p, {
                context: { workspaceId: "X" },
                parameters: { Thing: "MyThing" },
            } as any, undefined);
            const newFile = await p.findFile("src/main/java/MyThing.java");
            assert.strictEqual(newFile.getContentSync(), f.getContentSync().replace("Thing", "MyThing"));
        });

    });

    describe("transformation", () => {

        it("should find no parameters", async () => {
            const p = InMemoryProject.of();
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 0);
            assert.strictEqual(params.transforms.length, 1);
        });

        it("should find one parameter and transform within a file", async () => {
            const f = new InMemoryFile("src/main/java/Thing.java", "public class $$Thing$$ {}");
            const p = InMemoryProject.of(f);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.transforms.length, 1);
            await params.transforms[0](p, {
                context: { workspaceId: "X" },
                parameters: { Thing: "MyThing" },
            } as any, undefined);
            const newFile = await p.findFile(f.path);
            assert.strictEqual(newFile.getContentSync(), f.getContentSync().replace("$$Thing$$", "MyThing"));
        });

        it("should find one parameter and transform within a file", async () => {
            const f = new InMemoryFile("src/main/java/Thing.java", "public class $Thing$ {}");
            const p = InMemoryProject.of(f);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.transforms.length, 1);
            await params.transforms[0](p, {
                context: { workspaceId: "X" },
                parameters: { Thing: "MyThing" },
            } as any, undefined);
            const newFile = await p.findFile(f.path);
            assert.strictEqual(newFile.getContentSync(), f.getContentSync().replace("$$Thing$$", "MyThing"));
        });

        it("should find one parameter and transform within a file and path", async () => {
            const f = new InMemoryFile("src/main/java/$$Thing$$.java", "public class $$Thing$$ {}");
            const p = InMemoryProject.of(f);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.transforms.length, 1);
            await params.transforms[0](p, {
                context: { workspaceId: "X" },
                parameters: { Thing: "MyThing" },
            } as any, undefined);
            const newFile = await p.findFile("src/main/java/MyThing.java");
            assert.strictEqual(newFile.getContentSync(), f.getContentSync().replace("$$Thing$$", "MyThing"));
        });

        it("should handle cookiecutter template", async () => {
            const f = new InMemoryFile("package.json", cookieCutterPackageJson);
            const p = InMemoryProject.of(f);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 2);
            const parameters = { github_repository_name: "MyRepo", description: "my description" };
            await params.transforms[0](p, { context: { workspaceId: "X" }, parameters } as any, undefined);
            const newFile = await p.findFile("package.json");
            assert.strictEqual(newFile.getContentSync(), f.getContentSync()
                .replace("{{cookiecutter.github_repository_name}}", parameters.github_repository_name)
                .replace("{{cookiecutter.description}}", parameters.description));
        });

        it("should handle well known parameter", async () => {
            const f = new InMemoryFile("thing", "$$workspace$$");
            const p = InMemoryProject.of(f);
            const params = await new PlaceholderTransformRecipeContributor().analyze(p);
            assert.strictEqual(params.parameters.length, 1);
            await params.transforms[0](p, { context: { workspaceId: "X" }, parameters: {} } as any, undefined);
            const newFile = await p.findFile("thing");
            assert.strictEqual(newFile.getContentSync(), "X");
        });

    });

});

const cookieCutterPackageJson = `{
  "name": "{{cookiecutter.github_repository_name}}",
  "version": "0.1.0",
  "description": "{{cookiecutter.description}}",`;
