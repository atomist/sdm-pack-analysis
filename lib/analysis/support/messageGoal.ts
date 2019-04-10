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
    guid,
    isSlackMessage,
    MessageOptions,
    SlackFileMessage,
} from "@atomist/automation-client";
import {
    actionableButton,
    CommandHandlerRegistration,
    doWithProject,
    goal,
    Goal,
    PreferenceScope,
    SdmContext,
    slackInfoMessage,
    slackSuccessMessage,
} from "@atomist/sdm";
import {
    Action,
    italic,
} from "@atomist/slack-messages";
import * as crypto from "crypto";
import { PushMessage } from "../Interpretation";
import { ProjectAnalyzer } from "../ProjectAnalyzer";

/**
 * Command to dismiss a certain PushMessage
 */
export const DismissMessageCommand: CommandHandlerRegistration<{ hash: string, msgId: string }> = {
    name: "DismissMessage",
    description: "Dismiss a Project Analysis message",
    autoSubmit: true,
    parameters: { hash: { displayable: false }, msgId: { displayable: false } },
    listener: async ci => {
        await ci.preferences.put(
            `project-analysis.message.dismissed.${ci.parameters.hash}`,
            true,
            { scope: PreferenceScope.Sdm });
        await ci.addressChannels(
            slackSuccessMessage(
                "Project Analysis",
                "Successfully dismissed message"),
            { id: ci.parameters.msgId });
    },
};

/**
 * Create a Goal that sends PushMessages.
 * It adds a dismiss button to the messages it sends.
 * @param analyzer
 */
export function messageGoal(analyzer: ProjectAnalyzer): Goal {
    return goal({ displayName: "Messages" }, doWithProject(async gi => {
        const { project } = gi;
        const interpretation = await analyzer.interpret(project, gi, { full: false });

        for (const pm of interpretation.messages) {
            if (!(await isDismissed(pm, gi))) {
                const options: MessageOptions = {
                    id: guid(),
                    ...(pm.opts || {}),
                };

                if (typeof pm.message === "string") {
                    const msg = slackInfoMessage(
                        "Project Analysis",
                        pm.message,
                        { actions: [createDismissAction(pm, options.id)] });
                    await gi.addressChannels(msg, options);
                } else if (isSlackMessage(pm.message)) {
                    const msg = pm.message;
                    if (!msg.attachments || msg.attachments.length === 0) {
                        msg.attachments = [{
                            fallback: "Dismiss",
                            actions: [],
                        }];
                    }
                    const attachment = msg.attachments.slice(-1)[0];
                    attachment.actions = [...(attachment.actions || []), createDismissAction(pm, options.id)];
                    await gi.addressChannels(msg, options);
                } else {
                    const fileMsg = pm.message as SlackFileMessage & { title: string };
                    const msg = slackInfoMessage(
                        "Project Analysis",
                        `Dismiss ${italic(fileMsg.title)}`,
                        { actions: [createDismissAction(pm, options.id)] });
                    await gi.addressChannels(msg, options);
                    await gi.addressChannels(pm.message);
                }
            }
        }

    }, { readOnly: true }));
}

function createDismissAction(pm: PushMessage, msgId: string): Action {
    return actionableButton<{ hash: string, msgId: string }>(
        { text: "Dismiss" },
        DismissMessageCommand,
        { hash: createHash(pm), msgId });
}

async function isDismissed(pm: PushMessage, context: SdmContext): Promise<boolean> {
    return context.preferences.get<boolean>(
        `project-analysis.message.dismissed.${createHash(pm)}`,
        { defaultValue: false, scope: PreferenceScope.Sdm });
}

function createHash(pm: PushMessage): string {
    const content = JSON.stringify(pm);
    return crypto.createHash("md5").update(content).digest("base64").toString();
}
