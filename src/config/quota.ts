import type { Config } from "./types.ts";

/** Providers whose quota the config shows: the fixed ids, and the active provider where a segment follows it. */
export function quotaProviders(config: Config, activeProvider: string | undefined): ReadonlySet<string> {
  const chosen = config.lines
    .flatMap((line) => [...line.left, ...line.right])
    .filter((spec) => spec.segment === "usage")
    .map((spec) => (spec.provider === "active" ? activeProvider : spec.provider));
  return new Set(chosen.filter((provider): provider is string => typeof provider === "string"));
}
