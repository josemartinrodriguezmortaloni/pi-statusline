import { Type } from "typebox";
import type { Snapshot } from "../host/index.ts";
import type { QuotaWindow } from "../quota/index.ts";
import { meter } from "./format.ts";
import { defineSegment, type Tone } from "./segment.ts";

interface Thresholds {
  warning: number;
  error: number;
}

function tone(percent: number, thresholds: Thresholds): Tone | undefined {
  if (percent >= thresholds.error) return "error";
  return percent >= thresholds.warning ? "warning" : undefined;
}

/** Reset times follow the system locale: `Intl` without a locale argument. */
const RESET_FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
  "5h": { hour: "2-digit", minute: "2-digit" },
  "7d": { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
};

function reset(window: QuotaWindow): string {
  if (window.resetsAt === undefined) return "";
  return ` ⟳ ${new Intl.DateTimeFormat(undefined, RESET_FORMATS[window.id]).format(window.resetsAt)}`;
}

function detail(window: QuotaWindow): string {
  if (!window.spent) return `${Math.round(window.usedPercent)}%${reset(window)}`;
  return `$${window.spent.used.toFixed(2)}/$${window.spent.limit.toFixed(2)}`;
}

function provider(snapshot: Snapshot, chosen: string): string | undefined {
  return chosen === "active" ? snapshot.model?.provider : chosen;
}

function quotaWindow(snapshot: Snapshot, chosen: string, id: QuotaWindow["id"]): QuotaWindow | undefined {
  const name = provider(snapshot, chosen);
  return name === undefined ? undefined : snapshot.quota(name, id);
}

export const usage = defineSegment({
  id: "usage",
  summary:
    "Subscription quota of one window: a bar, the used percent and the reset time (⟳), or the extra credits spent. Hidden when the provider has no quota or no credential.",
  options: {
    provider: Type.String({
      default: "active",
      description:
        '"active" follows the provider of the model in use; or a fixed provider id: anthropic, claude-acp, openai-codex.',
    }),
    window: Type.Enum(["5h", "7d", "extra"], { default: "5h", description: "Quota window to show." }),
    thresholds: Type.Object(
      {
        warning: Type.Number({ default: 50, description: "Used percent that turns the segment to warning." }),
        error: Type.Number({ default: 90, description: "Used percent that turns the segment to error." }),
      },
      { default: {}, additionalProperties: false },
    ),
  },
  render: (snapshot, options) => {
    const window = quotaWindow(snapshot, options.provider, options.window as QuotaWindow["id"]);
    if (!window) return undefined;
    const text = `${window.id} ${meter(window.usedPercent)} ${detail(window)}`;
    return { text, tone: tone(window.usedPercent, options.thresholds) };
  },
});
