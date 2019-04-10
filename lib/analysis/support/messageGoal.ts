import {
    isSlackMessage,
    SlackFileMessage,
} from "@atomist/automation-client";
import {
    actionableButton,
    CommandHandlerRegistration,
    doWithProject,
    Goal,
    goal,
    PreferenceScope,
    SdmContext,
    slackInfoMessage,
} from "@atomist/sdm";
import {
    Action,
    italic,
    SlackMessage,
} from "@atomist/slack-messages";
import * as crypto from "crypto";
import { PushMessage } from "../Interpretation";
import { ProjectAnalyzer } from "../ProjectAnalyzer";

/**
 * Command to dismiss a certain PushMessage
 */
export const DismissMessageCommand: CommandHandlerRegistration<{ hash: string }> = {
    name: "DismissMessage",
    description: "Dismiss a Project Analysis message",
    autoSubmit: true,
    parameters: { hash: { required: true } },
    listener: async ci => {
        await ci.preferences.put(
            `project-analysis.message.dismissed.${ci.parameters.hash}`,
            true,
            { scope: PreferenceScope.Sdm });
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
                if (typeof pm.message === "string") {
                    const msg = slackInfoMessage(
                        "Project Analysis",
                        pm.message,
                        { actions: [createDismissAction(pm)] });
                    await gi.addressChannels(msg, pm.opts);
                } else if (isSlackMessage(pm.message)) {
                    const msg = pm.message;
                    if (!msg.attachments || msg.attachments.length === 0) {
                        msg.attachments = [{
                            fallback: "Dismiss",
                            actions: [],
                        }];
                    }
                    const attachment = msg.attachments.slice(-1)[0];
                    attachment.actions = [...(attachment.actions || []), createDismissAction(pm)];
                    await gi.addressChannels(msg, pm.opts);
                } else {
                    const fileMsg = pm.message as SlackFileMessage & { title: string };
                    const msg = slackInfoMessage(
                        "Project Analysis",
                        `Dismiss ${italic(fileMsg.title)}`,
                        { actions: [createDismissAction(pm)] });
                    await gi.addressChannels(msg);
                    await gi.addressChannels(pm.message, pm.opts);
                }
            }
        }

    }, { readOnly: true }));
}

function createDismissAction(pm: PushMessage): Action {
    return actionableButton<{ hash: string }>(
        { text: "Dismiss" },
        DismissMessageCommand,
        { hash: createHash(pm) });
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
