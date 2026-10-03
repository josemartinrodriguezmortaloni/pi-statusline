/**
 * The agent side of the statusline: the `/statusline` command and the `statusline_apply` tool.
 */
export { statuslineCommand, USAGE } from "./command.ts";
export { designPrompt, type PromptInput } from "./prompt.ts";
export { APPLY_TOOL, type ApplyTarget, applyTool } from "./tool.ts";
