import type {
  ExtensionAPI,
  ExtensionCommandContext,
  RegisteredCommand,
} from "@earendil-works/pi-coding-agent";
import { type Config, type ConfigStore, describeIssues, PRESET, type Result } from "../config/index.ts";
import { designPrompt } from "./prompt.ts";
import type { ApplyTarget } from "./tool.ts";

interface Subcommand {
  description: string;
  done: string;
  run(store: ConfigStore): Result<Config>;
}

const SUBCOMMANDS: Record<string, Subcommand> = {
  on: {
    description: "Show the statusline",
    done: "Statusline on.",
    run: (store) => store.apply({ ...store.current(), enabled: true }),
  },
  off: {
    description: "Restore the default pi footer",
    done: "Statusline off: pi shows its default footer.",
    run: (store) => store.apply({ ...store.current(), enabled: false }),
  },
  reset: {
    description: "Replace the config with the preset",
    done: "Statusline reset to the preset.",
    run: (store) => store.apply(PRESET),
  },
};

export const USAGE = [
  "Usage: /statusline <description> | on | off | reset",
  "  <description>  ask the agent to design the statusline",
  ...Object.entries(SUBCOMMANDS).map(
    ([name, sub]) => `  ${name.padEnd(13)}  ${sub.description.toLowerCase()}`,
  ),
].join("\n");

function runSubcommand(sub: Subcommand, store: ConfigStore, ctx: ExtensionCommandContext): void {
  const result = sub.run(store);
  if (result.ok) ctx.ui.notify(sub.done, "info");
  else ctx.ui.notify(`statusline: ${describeIssues(result.issues)}`, "error");
}

/** Sends the design request as a user turn; while the agent works, it waits as a follow-up. */
function requestDesign(
  pi: ExtensionAPI,
  description: string,
  target: ApplyTarget,
  ctx: ExtensionCommandContext,
) {
  const prompt = designPrompt({ description, path: target.path, current: target.store.current() });
  pi.sendUserMessage(prompt, ctx.isIdle() ? undefined : { deliverAs: "followUp" });
}

/** `/statusline`: the subcommands act on the config; any other text asks the agent for a design. */
export function statuslineCommand(
  pi: ExtensionAPI,
  target: () => ApplyTarget | undefined,
): Omit<RegisteredCommand, "name" | "sourceInfo"> {
  const route = (args: string, ctx: ExtensionCommandContext, current: ApplyTarget) => {
    const sub = SUBCOMMANDS[args];
    if (sub) runSubcommand(sub, current.store, ctx);
    else requestDesign(pi, args, current, ctx);
  };
  return {
    description: "Design the statusline with the agent, or turn it on, off or back to the preset",
    getArgumentCompletions: (prefix) =>
      Object.entries(SUBCOMMANDS)
        .filter(([name]) => name.startsWith(prefix.trim()))
        .map(([name, sub]) => ({ value: name, label: name, description: sub.description })),
    handler: async (raw, ctx) => {
      const args = raw.trim();
      const current = target();
      if (!args || !current) return ctx.ui.notify(USAGE, "info");
      route(args, ctx, current);
    },
  };
}
