/**
 * Subscription quota: a monitor that polls the providers the config needs, and one adapter per
 * provider family. Adding a provider means adding one adapter here.
 */
import { anthropicAdapter } from "./anthropic.ts";
import { codexAdapter } from "./codex.ts";
import type { AdapterDeps, QuotaAdapter } from "./types.ts";

export { createQuotaMonitor, type QuotaMonitor } from "./monitor.ts";
export type { AdapterDeps, ProviderAuth, QuotaAdapter, QuotaWindow, QuotaWindowId } from "./types.ts";

export function createAdapters(deps: AdapterDeps): QuotaAdapter[] {
  return [anthropicAdapter(deps), codexAdapter(deps)];
}
