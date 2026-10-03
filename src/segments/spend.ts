import type { ContextUsage } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Tokens } from "../host/index.ts";
import { formatTokens, joinParts, meter } from "./format.ts";
import { defineSegment, type Tone } from "./segment.ts";

const fragment = (text: string | false | undefined) => (text ? { text } : undefined);

export const tokens = defineSegment({
  id: "tokens",
  summary: "Session input (↑) and output (↓) tokens. Hidden before the first response.",
  options: {},
  render: ({ tokens }) =>
    fragment(
      joinParts([
        tokens.input > 0 && `↑${formatTokens(tokens.input)}`,
        tokens.output > 0 && `↓${formatTokens(tokens.output)}`,
      ]),
    ),
});

/** The default pi footer shows the hit rate only once the cache has been read or written. */
function hitRate(tokens: Tokens): string | false {
  if (tokens.cacheRead + tokens.cacheWrite === 0) return false;
  return tokens.cacheHitRate !== undefined && `CH${tokens.cacheHitRate.toFixed(1)}%`;
}

export const cache = defineSegment({
  id: "cache",
  summary: "Prompt cache reads (R), writes (W) and the hit rate of the latest response (CH).",
  options: {},
  render: ({ tokens }) =>
    fragment(
      joinParts([
        tokens.cacheRead > 0 && `R${formatTokens(tokens.cacheRead)}`,
        tokens.cacheWrite > 0 && `W${formatTokens(tokens.cacheWrite)}`,
        hitRate(tokens),
      ]),
    ),
});

const costText = (tokens: Tokens, subscription: boolean) =>
  `$${tokens.cost.toFixed(3)}${subscription ? " (sub)" : ""}`;

export const cost = defineSegment({
  id: "cost",
  summary: "Session cost in dollars, with (sub) when the provider bills through a subscription.",
  options: {},
  render: ({ tokens, subscription }) =>
    fragment((tokens.cost > 0 || subscription) && costText(tokens, subscription)),
});

function contextTone(percent: number): Tone | undefined {
  if (percent > 90) return "error";
  return percent > 70 ? "warning" : undefined;
}

const autoText = (autoCompact: boolean) => (autoCompact ? " (auto)" : "");

function percentText(context: ContextUsage): string {
  const used = context.percent === null ? "?" : `${context.percent.toFixed(1)}%`;
  return `${used}/${formatTokens(context.contextWindow)}`;
}

/** The bar needs the used tokens; right after a compaction pi does not know them yet. */
function barText(context: ContextUsage): string {
  if (context.tokens === null || context.percent === null) return percentText(context);
  const left = Math.max(0, context.contextWindow - context.tokens);
  const used = `${context.percent.toFixed(1)}% · ${formatTokens(context.tokens)} used`;
  return `${meter(context.percent)} ${used} · ${formatTokens(left)} left`;
}

const contextText = (context: ContextUsage, bar: boolean) => (bar ? barText(context) : percentText(context));

export const context = defineSegment({
  id: "context",
  summary: "Used share of the context window, with (auto) when auto-compaction is on. Warns above 70 %.",
  options: {
    bar: Type.Boolean({
      default: false,
      description: "Show a bar, the percent, the used tokens and the tokens left instead of percent/window.",
    }),
  },
  render: ({ context, autoCompact }, { bar }) => {
    if (!context) return undefined;
    return {
      text: contextText(context, bar) + autoText(autoCompact),
      tone: contextTone(context.percent ?? 0),
    };
  },
});
