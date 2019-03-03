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
    Cancel,
    Goals,
    GoalsBuilder,
    Queue,
} from "@atomist/sdm";

export interface StartupPhase {

    cancelGoal?: Cancel;

    queueGoal?: Queue;
}

/**
 * Well known Phases.
 */
export interface CheckPhase {

    checkGoals?: Goals;

}

export interface BuildPhase {

    buildGoals?: Goals;

    testGoals?: Goals;

}

export interface ContainerPhase {

    containerBuildGoals?: Goals;
}

/**
 * Single or phased deploy
 */
export interface DeployPhase {

    /**
     * If this is set stagedDeploy should not be set
     */
    deployGoals?: Goals;
}

/**
 * Phase to publish and release artifacts or create tags
 */
export interface ReleasePhase {

    releaseGoals?: Goals;
}

/**
 * Standard CI phases.
 * All goals should be constructed ahead of time and selected,
 * rather than created on the fly.
 */
export type CiPhases = StartupPhase & CheckPhase & BuildPhase & ContainerPhase & ReleasePhase & DeployPhase;
