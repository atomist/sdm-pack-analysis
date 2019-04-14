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
    guid,
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
    SdmGoalEvent,
    slackFooter,
    slackInfoMessage,
    slackSuccessMessage,
    slackTs,
} from "@atomist/sdm";
import {
    Action,
    Attachment,
    bold,
    codeLine,
    url,
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
                planned: "Send project analysis messages",
                requested: "Sending project analysis messages",
                inProcess: "Sending project analysis messages",
                completed: "Sent project analysis messages",
            },
        },
        async gi => {
            const { goalEvent } = gi;

            const pushMessages = await messageFactory(gi) || [];

            if (pushMessages.length > 0) {

                const options: MessageOptions = {
                    id: guid(),
                };

                const attachments: Attachment[] = [];
                for (const pm of pushMessages) {
                    if (!(await isDismissed(pm, goalEvent, gi))) {
                        let attachment: Attachment;
                        if (typeof pm.message === "string") {
                            attachment = {
                                text: pm.message,
                                fallback: pm.message,
                            };
                        } else {
                            attachment = pm.message;
                        }
                        attachment.actions = [...(attachment.actions || []), createDismissAction(pm, goalEvent, options.id)];
                        attachments.push(attachment);
                    }
                }

                const slug = url(goalEvent.push.repo.url, `${goalEvent.repo.owner}/${goalEvent.repo.name}/${goalEvent.branch}`);
                const msg = slackInfoMessage(
                    "Project Analysis",
                    `Finished analyzing commit ${codeLine(url(goalEvent.push.after.url, goalEvent.sha.slice(0, 7)))} of ${
                        bold(slug)} with following messages:`,
                    { actions: pushMessages.length > 1 ? [createDismissAllAction(pushMessages, goalEvent, options.id)] : [] });

                msg.attachments[0].footer = undefined;
                msg.attachments[0].ts = undefined;
                msg.attachments.push(...attachments);

                const lastAttachment = attachments.slice(-1)[0];
                lastAttachment.footer = slackFooter();
                lastAttachment.ts = slackTs();

                await addressMessage(msg, gi, {});
            }
        });
}

export async function isDismissed(pm: PushMessage, goalEvent: SdmGoalEvent, context: SdmContext): Promise<boolean> {
    return context.preferences.get<boolean>(
        `project-analysis.message.dismissed.${createHash(pm)}`,
        { defaultValue: false, scope: `${goalEvent.repo.owner}/${goalEvent.repo.name}` });
}

function createDismissAction(pm: PushMessage, goalEvent: SdmGoalEvent, msgId: string): Action {
    return actionableButton<{ scope: string, hash: string, msgId: string }>(
        { text: "Dismiss" },
        DismissMessageCommand,
        {
            scope: `${goalEvent.repo.owner}/${goalEvent.repo.name}`,
            hash: JSON.stringify([createHash(pm)]),
            msgId,
        });
}

function createDismissAllAction(pm: PushMessage[], goalEvent: SdmGoalEvent, msgId: string): Action {
    return actionableButton<{ scope: string, hash: string, msgId: string }>(
        { text: "Dismiss all" },
        DismissMessageCommand,
        {
            scope: `${goalEvent.repo.owner}/${goalEvent.repo.name}`,
            hash: JSON.stringify(pm.map(createHash)),
            msgId,
        });
}

function createHash(pm: PushMessage): string {
    const content = JSON.stringify(pm);
    return crypto.createHash("md5").update(content).digest("base64").toString();
}

async function addressMessage(msg: any, gi: GoalInvocation, options?: MessageOptions): Promise<void> {
    if (!gi.goalEvent.push.repo.channels || gi.goalEvent.push.repo.channels.length === 0) {
        await gi.context.messageClient.send(msg, addressWeb(), options);
    } else {
        await gi.addressChannels(msg, options);
    }
}
