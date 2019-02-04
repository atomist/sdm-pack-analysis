import { astUtils, MicrogrammarBasedFileParser } from "@atomist/automation-client";
import { Grammar, microgrammar, skipTo } from "@atomist/microgrammar";
import { CodeTransform } from "@atomist/sdm";
import { TransformRecipe } from "../../ProjectAnalysis";
import { TransformRecipeContributor } from "../../TransformRecipeContributor";

export interface SnipOptions {

    globPatterns: string;

    leftDelim: string;
    rightDelim: string;
}

function snipTransform(opts: SnipOptions): CodeTransform {
    return async p => {
        await astUtils.zapAllMatches(p,
            new MicrogrammarBasedFileParser("file", "toSnip", toSnip(opts)),
            opts.globPatterns,
            // Use @value so it's efficient
            `//file/toSnip[/left[@value='${opts.leftDelim}']]`,
        );
    };
}

function snipTransformRecipe(opts: SnipOptions): TransformRecipe {
    return {
        parameters: [],
        transforms: [snipTransform(opts)],
        messages: [],
        warnings: [],
    };
}

export const DefaultAtomistSnipDelimiter = "// #atomist.snip";

/**
 * Return a transform recipe that will delete anything between the given pairs of delimiters
 */
export class SnipTransformRecipeContributor implements TransformRecipeContributor {

    private readonly transformRecipe: TransformRecipe;

    public async analyze(): Promise<TransformRecipe | undefined> {
        return this.transformRecipe;
    }

    constructor(opts: SnipOptions = {
        globPatterns: "**/*.*",
        leftDelim: DefaultAtomistSnipDelimiter,
        rightDelim: DefaultAtomistSnipDelimiter,
    }) {
        this.transformRecipe = snipTransformRecipe(opts);
    }

}

function toSnip(opts: SnipOptions): Grammar<any> {
    return microgrammar(
        {
            left: opts.leftDelim,
            consumeAll: skipTo(opts.rightDelim),
        });
}
