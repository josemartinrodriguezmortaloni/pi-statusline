import type { ContextUsage } from "@earendil-works/pi-coding-agent";

export interface Tokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  /** Cache hit rate of the latest assistant message, in percent. */
  cacheHitRate?: number;
}

export interface Snapshot {
  /** Working directory, with the home directory shown as `~`. */
  cwd: string;
  gitBranch: string | null;
  sessionName?: string;
  tokens: Tokens;
  /** True when the active provider bills through a subscription instead of per token. */
  subscription: boolean;
  context?: ContextUsage;
  autoCompact: boolean;
  model?: { provider: string; id: string };
  /** Thinking level, only when the model reasons. */
  thinking?: string;
  statuses: ReadonlyMap<string, string>;
  now: number;
}
