import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { Tokens } from "./snapshot.ts";

interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: { total: number };
}

/** Usage that an entry adds to the session totals, the same entries the default pi footer sums. */
function entryUsage(entry: SessionEntry): Usage | undefined {
  if (entry.type === "message") return (entry.message as { usage?: Usage }).usage;
  return (entry as { usage?: Usage }).usage;
}

function hitRate(usage: Usage): number | undefined {
  const prompt = usage.input + usage.cacheRead + usage.cacheWrite;
  return prompt > 0 ? (usage.cacheRead / prompt) * 100 : undefined;
}

function isAssistant(entry: SessionEntry): boolean {
  return entry.type === "message" && entry.message.role === "assistant";
}

function add(totals: Tokens, entry: SessionEntry): Tokens {
  const usage = entryUsage(entry);
  if (!usage) return totals;
  return {
    input: totals.input + usage.input,
    output: totals.output + usage.output,
    cacheRead: totals.cacheRead + usage.cacheRead,
    cacheWrite: totals.cacheWrite + usage.cacheWrite,
    cost: totals.cost + usage.cost.total,
    cacheHitRate: isAssistant(entry) ? hitRate(usage) : totals.cacheHitRate,
  };
}

const EMPTY: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };

export function sumTokens(entries: readonly SessionEntry[]): Tokens {
  return entries.reduce(add, EMPTY);
}
