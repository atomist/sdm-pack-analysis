import { DerivedFeature, Feature, FP } from "@atomist/sdm-pack-fingerprints";
import { ProjectAnalysis } from "./ProjectAnalysis";

export type AnalysisDerivedFeature<FPI extends FP = FP> = DerivedFeature<ProjectAnalysis, FPI>;

/**
 * This pack knows how to manage features that are directly extracted from
 * projects or extracted from ProjectAnalysis
 */
export type ManagedFeature<FPI extends FP = FP> = Feature<FPI> | AnalysisDerivedFeature<FPI>;