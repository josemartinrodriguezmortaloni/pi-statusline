import type { ContextUsage } from "@earendil-works/pi-coding-agent";
import type { QuotaWindow, QuotaWindowId } from "../quota/index.ts";

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
  /** Epoch ms of the session header, the first entry of the session file. */
  sessionStartedAt?: number;
  turn: Turn;
  now: number;
  /** Last known quota window of a provider. Nothing when the provider has no quota data. */
  quota(provider: string, window: QuotaWindowId): QuotaWindow | undefined;
}

/** The agent turn in progress, or the duration of the last one. */
export interface Turn {
  startedAt?: number;
  lastMs?: number;
}
