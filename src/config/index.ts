/**
 * The statusline config: the schema derived from the segment catalog, the preset, and the store that
 * reads, validates, writes and watches `~/.pi/agent/statusline.json`.
 */
export { PRESET } from "./preset.ts";
export { quotaProviders } from "./quota.ts";
export {
  COLOR_TOKENS,
  COMMON_OPTIONS,
  describeIssues,
  type Issue,
  type Result,
  SEGMENT_DOCS,
  type SegmentDoc,
} from "./schema.ts";
export { type ChangeListener, type ConfigStore, configPath, openConfigStore } from "./store.ts";
export type { Config, LineConfig, SegmentConfig } from "./types.ts";
