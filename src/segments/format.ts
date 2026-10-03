interface Scale {
  below: number;
  format(count: number): string;
}

const TOKEN_SCALES: readonly Scale[] = [
  { below: 1000, format: (count) => count.toString() },
  { below: 10_000, format: (count) => `${(count / 1000).toFixed(1)}k` },
  { below: 1_000_000, format: (count) => `${Math.round(count / 1000)}k` },
  { below: 10_000_000, format: (count) => `${(count / 1_000_000).toFixed(1)}M` },
  { below: Number.POSITIVE_INFINITY, format: (count) => `${Math.round(count / 1_000_000)}M` },
];

/** Compact token count, the same format the default pi footer uses. */
export function formatTokens(count: number): string {
  const scale = TOKEN_SCALES.find((candidate) => count < candidate.below) as Scale;
  return scale.format(count);
}

const METER_WIDTH = 8;

/** An 8-dot bar of a percent, clamped to 0..100. */
export function meter(percent: number): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * METER_WIDTH);
  return "●".repeat(filled) + "○".repeat(METER_WIDTH - filled);
}

/** Removes line breaks and tabs, so an extension status stays on one line. */
export function singleLine(text: string): string {
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

/** Joins the parts that have text; nothing when none has. */
export function joinParts(parts: readonly (string | false)[]): string | undefined {
  const shown = parts.filter((part): part is string => Boolean(part));
  return shown.length > 0 ? shown.join(" ") : undefined;
}

/** `45s` under a minute, `12m` under an hour, `1h2m` after. */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
  return minutes >= 1 ? `${minutes}m` : `${Math.floor(Math.max(0, ms) / 1000)}s`;
}
