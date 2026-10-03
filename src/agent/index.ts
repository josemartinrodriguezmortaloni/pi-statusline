/**
 * The agent side of the statusline: the `/statusline` command and the `statusline_apply` tool.
 */
export { type Describe, statuslineCommand, USAGE } from "./command.ts";
export { APPLY_TOOL, type ApplyTarget, applyTool } from "./tool.ts";
