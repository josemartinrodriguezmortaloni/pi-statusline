import { COLOR_TOKENS, COMMON_OPTIONS, type Config, SEGMENT_DOCS, type SegmentDoc } from "../config/index.ts";
import { APPLY_TOOL } from "./tool.ts";

function optionsText(options: Record<string, unknown>): string {
  return Object.keys(options).length > 0 ? JSON.stringify(options) : "none";
}

function segmentText(doc: SegmentDoc): string {
  return `- \`${doc.id}\`: ${doc.summary}\n  options: ${optionsText(doc.options)}`;
}

export interface PromptInput {
  description: string;
  path: string;
  current: Config;
}

/** The request that `/statusline <description>` sends to the agent. It derives from the segment catalog. */
export function designPrompt(input: PromptInput): string {
  return [
    "Design my pi statusline (the footer of the pi TUI) from this description:",
    "",
    `> ${input.description}`,
    "",
    `Write the config only by calling the \`${APPLY_TOOL}\` tool with the whole config. Do not edit ${input.path} with any other tool.`,
    `The tool validates the config, writes it and returns a preview at my terminal width. If it fails, fix the reported paths and call it again. Check the preview against the description and call the tool again when it does not match.`,
    "",
    "## Config shape",
    "",
    "{ enabled?: boolean, lines: [{ left: [segment, ...], right: [segment, ...] }, ...] }",
    "",
    "- Each line renders the `left` group, then the `right` group aligned to the right edge.",
    "- A line whose segments all have nothing to show is left out.",
    "- Each segment is an object: { segment: <id>, priority?, color?, ...its options }.",
    ...Object.entries(COMMON_OPTIONS).map(
      ([name, schema]) =>
        `- \`${name}\` (every segment): ${(schema as { description?: string }).description}`,
    ),
    "- When a line still does not fit after hiding segments, it truncates with ...",
    `- Theme color tokens: ${COLOR_TOKENS.join(", ")}.`,
    "- A segment can override its color with a warning or error tone, as context does above 70 %.",
    "",
    "## Segments",
    "",
    ...SEGMENT_DOCS.map(segmentText),
    "",
    "## Current config",
    "",
    "```json",
    JSON.stringify(input.current, null, 2),
    "```",
  ].join("\n");
}
