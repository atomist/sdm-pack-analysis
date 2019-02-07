import { ProjectAnalysis } from "../../../lib/analysis/ProjectAnalysis";
import { isUsableAsSeed } from "../../../lib/analysis/support/projectAnalysisUtils";
import * as assert from "assert";

describe("projectAnalysisUtils", () => {

    describe("isUsableAsSeed", () => {

        it("won't use with no seedAnalysis", async () => {
            const analysis: ProjectAnalysis = newAnalysis();
            assert(!isUsableAsSeed(analysis));
        });

        it("will not use with seedAnalysis but not parameters", async () => {
            const analysis: ProjectAnalysis = newAnalysis();
            analysis.seedAnalysis = {
                transformRecipes: [
                    {
                        optional: false,
                        originator: "foo",
                        recipe: {
                            parameters: [],
                            transforms: [],
                        },
                    },
                ],
            };
            assert(!isUsableAsSeed(analysis));
        });

        it("will use with seedAnalysis and parameters", async () => {
            const analysis: ProjectAnalysis = newAnalysis();
            analysis.seedAnalysis = {
                transformRecipes: [
                    {
                        optional: false,
                        originator: "foo",
                        recipe: {
                            parameters: [ {
                                name: "thing",
                            }],
                            transforms: [],
                        },
                    },
                ],
            };
            assert(isUsableAsSeed(analysis));
        });

    });

});

function newAnalysis(): ProjectAnalysis {
    return {
        elements: {},
        id: undefined,
        options: { full: true },
        dependencies: [],
        referencedEnvironmentVariables: [],
        services: {},
    };
}