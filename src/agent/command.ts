import type { ExtensionCommandContext, RegisteredCommand } from "@earendil-works/pi-coding-agent";
import { type Config, type ConfigStore, describeIssues, PRESET, type Result } from "../config/index.ts";

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

export type Describe = (description: string, ctx: ExtensionCommandContext) => void;

/** `/statusline`: the subcommands act on the config; any other text goes to `describe`. */
export function statuslineCommand(
  store: () => ConfigStore | undefined,
  describe: Describe,
): Omit<RegisteredCommand, "name" | "sourceInfo"> {
  const route = (args: string, ctx: ExtensionCommandContext, current: ConfigStore) => {
    const sub = SUBCOMMANDS[args];
    if (sub) runSubcommand(sub, current, ctx);
    else describe(args, ctx);
  };
  return {
    description: "Design the statusline with the agent, or turn it on, off or back to the preset",
    getArgumentCompletions: (prefix) =>
      Object.entries(SUBCOMMANDS)
        .filter(([name]) => name.startsWith(prefix.trim()))
        .map(([name, sub]) => ({ value: name, label: name, description: sub.description })),
    handler: async (raw, ctx) => {
      const args = raw.trim();
      const current = store();
      if (!args || !current) return ctx.ui.notify(USAGE, "info");
      route(args, ctx, current);
    },
  };
}
