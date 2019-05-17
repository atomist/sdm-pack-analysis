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

import { InMemoryProject } from "@atomist/automation-client";
import {
    CodeInspectionRegistration,
    goals,
    PushListenerInvocation,
} from "@atomist/sdm";
import * as assert from "assert";
import { analyzerBuilder } from "../../lib/analysis/analyzerBuilder";
import {
    CodeInspectionRegisteringInterpreter,
    Interpreter,
} from "../../lib/analysis/Interpretation";
import {
    ProjectAnalyzer,
    Scorer,
    StackSupport,
} from "../../lib/analysis/ProjectAnalyzer";
import { SnipTransformRecipeContributor } from "../../lib/analysis/support/transform-recipe/SnipTransformRecipeContributor";
import { TechnologyScanner } from "../../lib/analysis/TechnologyScanner";
import { TechnologyStack } from "../../lib/analysis/TechnologyStack";
import { TransformRecipeContributionRegistration } from "../../lib/analysis/TransformRecipeContributor";

describe("projectAnalyzer", () => {

    describe("relevance", () => {

        it("should not be classified by default", async () => {
            const p = InMemoryProject.of();
            const classification = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .classify(p, undefined);
            assert(!!classification);
            assert.deepStrictEqual(classification, { elements: {} });
        });

        it("should be classified with classification", async () => {
            const p = InMemoryProject.of();
            const classification = await analyzerBuilder({} as any).withScanner({
                classify: async () => ({ name: "foo", tags: [], messages: [] }),
                scan: toyScanner,
            }).build()
                .classify(p, undefined);
            assert(!!classification);
            assert(!!classification.elements.foo);
        });

        it("should not be classified with no classification", async () => {
            const p = InMemoryProject.of();
            const classification = await analyzerBuilder({} as any).withScanner({
                classify: async () => undefined,
                scan: toyScanner,
            }).build()
                .classify(p, undefined);
            assert(!!classification);
            assert.deepStrictEqual(classification, { elements: {} });
        });

        it("should be classified with one true and one false classification", async () => {
            const p = InMemoryProject.of();
            const classified = await analyzerBuilder({} as any)
                .withScanner({
                    classify: async () => ({ name: "foo", tags: [], messages: [] }),
                    scan: toyScanner,
                })
                .withScanner({
                    classify: async () => undefined,
                    scan: toyScanner,
                }).build()
                .classify(p, undefined);
            assert(!!classified);
            assert(!!classified.elements.foo);
        });

    });

    describe("analysis", () => {

        it("should pull up services", async () => {
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .analyze(p, undefined);
            assert.deepStrictEqual(analysis.elements.toy.services, {
                riak: {},
                rabbitmq: {},
                memcached: {},
            });
            assert.deepStrictEqual(analysis.services, {
                riak: {},
                rabbitmq: {},
                memcached: {},
            });
        });

        it("should merge environment variables without duplication", async () => {
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any).withScanner(toyScanner).withScanner(toy2Scanner).build()
                .analyze(p, undefined);
            assert.deepStrictEqual(analysis.referencedEnvironmentVariables, ["frogs", "dogs"]);
        });

        it("should not perform seed analysis unless asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .analyze(p, pli, { full: false });
            assert(!analysis.seedAnalysis);
        });

        it("should perform seed analysis when asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .analyze(p, pli, { full: true });
            assert(!!analysis.seedAnalysis);
        });

        it("should find transform in recipe in seed analysis", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any).withTransformRecipeContributor(AlwaysTRC).build()
                .analyze(p, pli, { full: true });
            assert.strictEqual(analysis.seedAnalysis.transformRecipes.length, 1);
            assert.strictEqual(analysis.seedAnalysis.transformRecipes[0].recipe.transforms.length, 1);
        });

        it("should find transforms in recipe in seed analysis", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any)
                .withTransformRecipeContributor({
                    originator: "snip",
                    optional: true,
                    contributor: new SnipTransformRecipeContributor(),
                })
                .withTransformRecipeContributor(AlwaysTRC).build()
                .analyze(p, pli, { full: true });
            assert.strictEqual(analysis.seedAnalysis.transformRecipes.length, 2);
            assert.strictEqual(analysis.seedAnalysis.transformRecipes[1].recipe.transforms.length, 1);
        });

        it("should not perform scoring unless asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .analyze(p, pli, { full: false });
            assert(!analysis.scores);
        });

        it("should perform scoring when asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .analyze(p, pli, { full: true });
            assert.deepStrictEqual(analysis.scores, {});
        });

        it("should not perform inspection unless asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .analyze(p, pli, { full: false });
            assert(!analysis.inspections);
        });

        it("should perform inspections when asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .analyze(p, pli, { full: true });
            assert.deepStrictEqual(analysis.inspections, {});
        });

        it("should perform concrete inspection when asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const barCr: CodeInspectionRegistration<any, any> = {
                name: "foo",
                inspection: async () => {
                    return { bar: true };
                },
            };
            const i: CodeInspectionRegisteringInterpreter = {
                enrich: async interpretation => {
                    interpretation.inspections.push(barCr);
                    return true;
                },
                codeInspections: [barCr],
            };
            const analysis = await analyzerBuilder({} as any)
                .withScanner(toyScanner)
                .withInterpreter(i)
                .build()
                .analyze(p, pli, { full: true });
            assert.deepStrictEqual(analysis.inspections, { foo: { bar: true } });
        });

        it("should not return messages unless asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .analyze(p, pli, { full: false });
            assert.strictEqual(analysis.messages.length, 0);
        });

        it("should find concrete message when asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const i: Interpreter = {
                enrich: async interpretation => {
                    interpretation.messages.push({ message: "foobar" });
                    return true;
                },
            };
            const analysis = await analyzerBuilder({} as any)
                .withScanner(toyScanner)
                .withInterpreter(i)
                .build()
                .analyze(p, pli, { full: true });
            assert.deepStrictEqual(analysis.messages, [{ message: "foobar" }]);
        });

        it("should not find phases status when not asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const buildGoals = goals("thing");
            const i: Interpreter = {
                enrich: async interpretation => {
                    interpretation.buildGoals = buildGoals;
                    return true;
                },
            };
            const analysis = await analyzerBuilder({} as any)
                .withScanner(toyScanner)
                .withInterpreter(i)
                .build()
                .analyze(p, pli, { full: false });
            assert(!analysis.phaseStatus);
        });

        it("should find phases status when asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const buildGoals = goals("thing");
            const i: Interpreter = {
                enrich: async interpretation => {
                    interpretation.buildGoals = buildGoals;
                    return true;
                },
            };
            const analysis = await analyzerBuilder({} as any)
                .withScanner(toyScanner)
                .withInterpreter(i)
                .build()
                .analyze(p, pli, { full: true });
            assert(!!analysis.phaseStatus);
            assert.strictEqual(analysis.phaseStatus.buildGoals, true);
            assert.strictEqual(analysis.phaseStatus.deployGoals, false);
        });

        it("should return empty fingerprints", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analysis = await analyzerBuilder({} as any)
                .withScanner(toyScanner)
                .build()
                .analyze(p, pli, { full: true });
            assert.deepStrictEqual(analysis.fingerprints, {});
        });

        it("should consolidate one fingerprint", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const fp1 = {
                name: "one",
                version: "0.1.0",
                abbreviation: "abc",
                sha: "abcd",
                data: "x",
            };
            const analysis = await analyzerBuilder({} as any)
                .withScanner(async () => ({
                    name: "foo",
                    tags: [],
                    fingerprints: [fp1],
                }))
                .build()
                .analyze(p, pli, { full: true });
            assert.deepStrictEqual(analysis.fingerprints, { one: fp1 });
        });

        it("should add feature fingerprints", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const fp1 = {
                name: "one",
                version: "0.1.0",
                abbreviation: "abc",
                sha: "abcd",
                data: "x",
            };
            const analysis = await analyzerBuilder({} as any)
                .withFeature(
                    {
                        name: "foo",
                        extract: async proj => {
                            return fp1;
                        },
                        toDisplayableString: () => "foo",
                    })
                .build()
                .analyze(p, pli, { full: true });
            assert.deepStrictEqual(analysis.fingerprints, { one: fp1 });
        });

        it("should add consequent feature fingerprints", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const fp1 = {
                name: "one",
                version: "0.1.0",
                abbreviation: "abc",
                sha: "abcd",
                data: "x",
            };
            const pa: ProjectAnalyzer = analyzerBuilder({} as any)
                .withFeature(
                    {
                        name: "foo",
                        consequence: proj => {
                            return fp1;
                        },
                        toDisplayableString: () => "foo",
                    })
                .build();
            assert.strictEqual(pa.features.length, 1);
            const analysis = await pa.analyze(p, pli, { full: true });
            assert.deepStrictEqual(analysis.fingerprints, { one: fp1 });
        });

    });

    describe("interpretation", () => {

        it("should expose analysis", async () => {
            const p = InMemoryProject.of();
            const interpretation = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .interpret(p, undefined);
            assert.deepStrictEqual(interpretation.reason.analysis.elements.toy.services, {
                riak: {},
                rabbitmq: {},
                memcached: {},
            });
            assert.deepStrictEqual(interpretation.reason.analysis.services, {
                riak: {},
                rabbitmq: {},
                memcached: {},
            });
        });

        it("should add via non-conditional stack", async () => {
            const p = InMemoryProject.of();
            const stack: StackSupport = {
                scanners: [toyScanner],
                interpreters: [],
                transformRecipeContributors: [],
            };
            const interpretation = await analyzerBuilder({} as any).withStack(stack).build()
                .interpret(p, undefined);
            assert.deepStrictEqual(interpretation.reason.analysis.elements.toy.services, {
                riak: {},
                rabbitmq: {},
                memcached: {},
            });
            assert.deepStrictEqual(interpretation.reason.analysis.services, {
                riak: {},
                rabbitmq: {},
                memcached: {},
            });
        });

        it("should expose PushListenerInvocation if available", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const interpretation = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .interpret(p, pli);
            assert.strictEqual(interpretation.reason.pushListenerInvocation, pli);
        });

        it("should attach goal", async () => {
            let count = 0;
            const bi: Interpreter = {
                enrich: async i => {
                    ++count;
                    if (!!i.reason.analysis.elements.toy) {
                        assert(!i.deployGoals);
                        i.deployGoals = goals("whatever");
                        return true;
                    }
                    return false;
                },
            };
            const p = InMemoryProject.of();
            const interpretation = await analyzerBuilder({} as any).withScanner(toyScanner).withInterpreter(bi).build()
                .interpret(p, undefined);
            assert.strictEqual(count, 1, "Should have invoked interpreter");
            assert(interpretation.deployGoals, "Interpreter should have set deploy goal");
        });

        it("should attach single score with default weight", async () => {
            let count = 0;
            const bi: Scorer = async i => {
                ++count;
                assert(!i.scores.thing);
                return {
                    name: "thing",
                    score: 4,
                };
            };
            const p = InMemoryProject.of();
            const interpretation = await analyzerBuilder({} as any).withScorer(bi).build()
                .interpret(p, undefined);
            assert.strictEqual(count, 1, "Should have invoked scorer");
            assert(interpretation.scores.thing, "Score should have been attached");
            assert.strictEqual(interpretation.scores.thing.score, 4);
        });

    });

});

const toyScanner: TechnologyScanner<TechnologyStack> = async () => {
    return {
        dependencies: [],
        name: "toy",
        services: {
            riak: {},
            rabbitmq: {},
            memcached: {},
        },
        tags: ["toy"],
        referencedEnvironmentVariables: ["frogs", "dogs"],
    };
};

const toy2Scanner: TechnologyScanner<TechnologyStack> = async () => {
    return {
        dependencies: [],
        name: "toy2",
        tags: ["toy2"],
        referencedEnvironmentVariables: ["dogs"],
    };
};

const AlwaysTRC: TransformRecipeContributionRegistration = {
    originator: "always",
    contributor: {
        analyze: async () => {
            return {
                parameters: [
                    { name: "foo" },
                ],
                transforms: [
                    async p => p.addFile("foo.txt", "Foo is foo"),
                ],
            };
        },
    },
    optional: true,
};
