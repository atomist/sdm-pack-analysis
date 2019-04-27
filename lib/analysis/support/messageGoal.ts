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
    addressWeb,
    MessageOptions,
} from "@atomist/automation-client";
import {
    actionableButton,
    CommandHandlerRegistration,
    DefaultGoalNameGenerator,
    goal,
    Goal,
    GoalInvocation,
    SdmContext,
    SdmGoalState,
    slackFooter,
    slackInfoMessage,
    slackSuccessMessage,
    slackTs,
} from "@atomist/sdm";
import {
    Action,
    Attachment,
} from "@atomist/slack-messages";
import * as crypto from "crypto";

/**
 * Message relating to this project
 */
export interface PushMessage {

    readonly message: string | Attachment; // require the title on file messages so that we can dismiss
}

/**
 * Extended by any type that can have messages associated with it.
 */
export interface HasMessages {

    /**
     * Any messages regarding this project or push that should be displayed
     * to users when handling the project.
     */
    readonly messages: PushMessage[];
}

/**
 * Factory that is able to produce PushMessages
 */
export type PushMessageFactory = (gi: GoalInvocation) => Promise<PushMessage[]>;

/**
 * Command to dismiss a certain PushMessage
 */
export const DismissMessageCommand: CommandHandlerRegistration<{ scope: string, hash: string, msgId: string }> = {
    name: "DismissMessage",
    description: "Dismiss a Project Analysis message",
    autoSubmit: true,
    parameters: { scope: { displayable: false }, hash: { displayable: false }, msgId: { displayable: false } },
    listener: async ci => {
        const hashes = JSON.parse(ci.parameters.hash) as string[];

        for (const hash of hashes) {
            await ci.preferences.put(
                `project-analysis.message.dismissed.${hash}`,
                true,
                { scope: ci.parameters.scope });
        }

        await ci.addressChannels(
            slackSuccessMessage(
                "Project Analysis",
                `Successfully dismissed ${hashes.length === 1 ? "analysis message" : "all analysis messages"}`),
            { id: ci.parameters.msgId });
    },
};

/**
 * Create a Goal that sends PushMessages.
 * It adds a dismiss button to the messages it sends.
 */
export function messageGoal(messageFactory: PushMessageFactory): Goal {
    return goal({
            uniqueName: DefaultGoalNameGenerator.generateName(),
            displayName: "message",
            descriptions: {
                planned: "Analyze project",
                requested: "Analyzing project",
                inProcess: "Analyzing project",
                completed: "Analyzed project",
            },
        },
        async gi => {
            const { goalEvent } = gi;

            const pushMessages = await messageFactory(gi) || [];

            const options: MessageOptions = {
                id: `project-analysis/message/${goalEvent.repo.owner}/${goalEvent.repo.name}`,
                ttl: 1000 * 60 * 60 * 24, // 1 day
            };

            let count = 0;
            if (pushMessages.length > 0) {

                const attachments: Attachment[] = [];
                for (const pm of pushMessages) {
                    if (!(await isDismissed(pm, goalEvent.repo, gi))) {
                        let attachment: Attachment;
                        if (typeof pm.message === "string") {
                            attachment = {
                                text: pm.message,
                                fallback: pm.message,
                            };
                        } else {
                            attachment = pm.message;
                        }
                        if (!attachment.actions || attachment.actions.length === 0) {
                            attachment.actions = [createDismissAction(pm, goalEvent.repo, options.id)];
                        }
                        attachments.push(attachment);
                        count++;
                    }
                }

                const msg = slackInfoMessage(
                    "Project Analysis",
                    "");

                msg.attachments[0].footer = undefined;
                msg.attachments[0].ts = undefined;
                msg.attachments.push(...attachments);

                const lastAttachment = attachments.slice(-1)[0];
                lastAttachment.footer = slackFooter();
                lastAttachment.ts = slackTs();
                lastAttachment.actions = [
                    ...(lastAttachment.actions || []),
                    ...(pushMessages.length > 1 ? [createDismissAllAction(pushMessages, goalEvent.repo, options.id)] : []),
                ];

                await addressMessage(msg, gi, options);

            }
            
            return {
                state: SdmGoalState.success,
                phase: count > 0 ? `${count} ${count > 1 ? "messages" : "message"}` : undefined,
            };
        });
}

export async function isDismissed(pm: PushMessage, repo: { owner: string, name: string }, context: SdmContext): Promise<boolean> {
    return context.preferences.get<boolean>(
        `project-analysis.message.dismissed.${createHash(pm)}`,
        { defaultValue: false, scope: `${repo.owner}/${repo.name}` });
}

export function createDismissAction(pm: PushMessage, repo: { owner: string, name: string }, msgId: string): Action {
    return actionableButton<{ scope: string, hash: string, msgId: string }>(
        { text: "Dismiss" },
        DismissMessageCommand,
        {
            scope: `${repo.owner}/${repo.name}`,
            hash: JSON.stringify([createHash(pm)]),
            msgId,
        });
}

export function createDismissAllAction(pm: PushMessage[], repo: { owner: string, name: string }, msgId: string): Action {
    return actionableButton<{ scope: string, hash: string, msgId: string }>(
        { text: "Dismiss all" },
        DismissMessageCommand,
        {
            scope: `${repo.owner}/${repo.name}`,
            hash: JSON.stringify(pm.map(createHash)),
            msgId,
        });
}

function createHash(pm: PushMessage): string {
    let text;
    if (typeof pm.message === "string") {
        text = pm.message;
    } else {
        text = {
            title: pm.message.title,
            text: pm.message.text,
        };
    }
    const content = JSON.stringify(text);
    return crypto.createHash("md5").update(content).digest("base64").toString();
}

async function addressMessage(msg: any, gi: GoalInvocation, options?: MessageOptions): Promise<void> {
    if (!gi.goalEvent.push.repo.channels || gi.goalEvent.push.repo.channels.length === 0) {
        await gi.context.messageClient.send(msg, addressWeb(), options);
    } else {
        await gi.addressChannels(msg, options);
    }
}
