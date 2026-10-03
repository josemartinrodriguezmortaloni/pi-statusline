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
