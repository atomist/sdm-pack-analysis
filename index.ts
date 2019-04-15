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

export { analysisSupport } from "./lib/pack";
export {
    assessInspection,
    ResultDisplayer,
} from "./lib/analysis/command/assess";
export {
    ElementsGoalsKey,
    ElementsEnrichGoal,
} from "./lib/analysis/support/enrichGoal";
export {
    registerAutofixes,
    registerCodeInspections,
    materialChange,
} from "./lib/analysis/support/interpretationDriven";
export {
    presenceTestedElementScanner,
} from "./lib/analysis/support/presenceTestedElementScanner";
export {
    allTechnologyElements,
    isUsableAsSeed,
} from "./lib/analysis/support/projectAnalysisUtils";
export {
    analyzerBuilder,
} from "./lib/analysis/analyzerBuilder";
export {
    testGoals,
    buildGoals,
    AutofixRegisteringInterpreter,
    checkGoals,
    CodeInspectionRegisteringInterpreter,
    containerGoals,
    controlGoals,
    deliveryNotificationGoals,
    deployGoals,
    releaseGoals,
    Interpretation,
    Interpreter,
    messagingGoals,
    isAutofixRegisteringInterpreter,
    isCodeInspectionRegisteringInterpreter,
} from "./lib/analysis/Interpretation";
export {
    BuildPhase,
    CheckPhase,
    DeliveryPhases,
    ContainerPhase,
    DeployPhase,
    ReleasePhase,
    StartupPhase,
} from "./lib/analysis/phases";
export {
    TechnologyElement,
    NamedParameter,
    Dependency,
    Elements,
    ParamInfo,
    ProjectAnalysis,
    SeedAnalysis,
    Service,
    Services,
    TransformRecipe,
    TransformRecipeRequest,
} from "./lib/analysis/ProjectAnalysis";
export {
    ProjectAnalyzer,
    ProjectAnalyzerBuilder,
    StackSupport,
} from "./lib/analysis/ProjectAnalyzer";
export {
    FastProject,
    ScannerAction,
    TechnologyScanner,
} from "./lib/analysis/TechnologyScanner";
export {
    isTechnologyStack,
    TechnologyStack,
} from "./lib/analysis/TechnologyStack";
export {
    TransformRecipeContributionRegistration,
    TransformRecipeContributor,
} from "./lib/analysis/TransformRecipeContributor";
export {
    PreferencesElement,
    preferencesScanner,
} from "./lib/element/preferences/preferencesScanner";
export * from "./lib/analysis/support/transform-recipe/PlaceholderTransformRecipeContributor";
export * from "./lib/analysis/support/transform-recipe/SnipTransformRecipeContributor";
export {
    DismissMessageCommand,
    createDismissAllAction,
    createDismissAction,
} from "./lib/analysis/support/messageGoal";
