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
    goals,
    PushListenerInvocation,
} from "@atomist/sdm";
import * as assert from "assert";
import { analyzerBuilder } from "../../lib/analysis/analyzerBuilder";
import { Interpreter } from "../../lib/analysis/Interpretation";
import {
    Scorer,
    StackSupport,
} from "../../lib/analysis/ProjectAnalyzer";
import { TechnologyScanner } from "../../lib/analysis/TechnologyScanner";
import { TechnologyStack } from "../../lib/analysis/TechnologyStack";
import { TransformRecipeContributionRegistration } from "../../lib/analysis/TransformRecipeContributor";

describe("projectAnalyzer", () => {

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
            const analyzer = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .analyze(p, pli, { full: false });
            assert(!analyzer.seedAnalysis);
        });

        it("should perform seed analysis when asked", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analyzer = await analyzerBuilder({} as any).withScanner(toyScanner).build()
                .analyze(p, pli, { full: true });
            assert(!!analyzer.seedAnalysis);
        });

        it("should find transform in recipe in seed analysis", async () => {
            const pli: PushListenerInvocation = { push: {} } as any;
            const p = InMemoryProject.of();
            const analyzer = await analyzerBuilder({} as any).withTransformRecipeContributor(AlwaysTRC).build()
                .analyze(p, pli, { full: true });
            assert.strictEqual(analyzer.seedAnalysis.transformRecipes.length, 1);
            assert.strictEqual(analyzer.seedAnalysis.transformRecipes[0].recipe.transforms.length, 1);

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
