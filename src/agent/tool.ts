import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { type Config, type ConfigStore, describeIssues } from "../config/index.ts";

export const APPLY_TOOL = "statusline_apply";

/** What the tool acts on in the current session. */
export interface ApplyTarget {
  store: ConfigStore;
  path: string;
  /** Plain-text lines of a config at the current terminal width. */
  preview(config: Config): { width: number; lines: string[] };
}

const PARAMETERS = Type.Object({
  config: Type.Unknown({
    description:
      "The whole statusline config: { enabled?: boolean, lines: [{ left: [segment, ...], right: [segment, ...] }] }, where each segment is { segment: <id>, priority?, color?, ...its options }.",
  }),
});

function previewText(target: ApplyTarget, config: Config): string {
  const { width, lines } = target.preview(config);
  const shown =
    lines.length > 0 ? lines.join("\n") : "(no lines: every segment is hidden with the current data)";
  return `Wrote ${target.path}. Preview at ${width} columns:\n\`\`\`\n${shown}\n\`\`\``;
}

/** Validates, writes atomically and previews. An invalid config fails with the paths and writes nothing. */
export function applyTool(target: () => ApplyTarget | undefined): ToolDefinition<typeof PARAMETERS> {
  return {
    name: APPLY_TOOL,
    label: "Apply statusline",
    description:
      "Validate the pi statusline config, write it to statusline.json and return a plain-text preview at the current terminal width. Invalid configs are not written; the error lists each failing field path.",
    parameters: PARAMETERS,
    execute: async (_id, params) => {
      const current = target();
      if (!current) throw new Error("No pi session is active.");
      const result = current.store.apply(params.config);
      if (!result.ok) throw new Error(`Invalid config, nothing written:\n${describeIssues(result.issues)}`);
      return { content: [{ type: "text", text: previewText(current, result.value) }], details: undefined };
    },
  };
}
