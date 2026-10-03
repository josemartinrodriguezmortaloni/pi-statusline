import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { statuslineCommand, USAGE } from "./agent/index.ts";
import {
  type ConfigStore,
  configPath,
  describeIssues,
  type Issue,
  openConfigStore,
  quotaProviders,
} from "./config/index.ts";
import { createHost, type Host } from "./host/index.ts";
import { createAdapters, createQuotaMonitor, type QuotaMonitor } from "./quota/index.ts";
import { createFooter, footerSwitch } from "./statusline/index.ts";

/** What the extension reads from outside pi. Tests inject each one. */
export interface StatuslineDeps {
  home: string;
  fetch: typeof fetch;
  now: () => number;
}

interface Session {
  store: ConfigStore;
  host: Host;
  quota: QuotaMonitor;
  /** Watches the quota of the providers that the config needs now. */
  syncQuota(ctx: ExtensionContext): void;
}

function warn(ctx: ExtensionContext, fallback: string, issues: readonly Issue[]): void {
  if (issues.length > 0)
    ctx.ui.notify(`statusline.json is invalid, ${fallback}:\n${describeIssues(issues)}`, "warning");
}

function startSession(pi: ExtensionAPI, deps: StatuslineDeps, ctx: ExtensionContext): Session {
  const { store, issues } = openConfigStore(configPath(deps.home));
  warn(ctx, "using the preset", issues);
  store.onChange((_config, issues) => warn(ctx, "keeping the last valid config", issues));
  const quota = createQuotaMonitor(
    createAdapters({ fetch: deps.fetch, home: deps.home, registry: ctx.modelRegistry }),
  );
  const syncQuota = (current: ExtensionContext) =>
    quota.watch(quotaProviders(store.current(), current.model?.provider));
  store.onChange(() => syncQuota(ctx));
  syncQuota(ctx);
  const host = createHost({
    ctx,
    home: deps.home,
    now: deps.now,
    autoCompact: () => pi.getSettings().compaction?.enabled ?? true,
    quota: quota.get,
  });
  const show = footerSwitch(ctx.ui, (tui, theme, footerData) =>
    createFooter(tui, theme, footerData, {
      snapshot: host.snapshot,
      layout: store.current,
      changes: [store.onChange, quota.onUpdate],
    }),
  );
  show(store.current().enabled);
  store.onChange((config) => show(config.enabled));
  return { store, host, quota, syncQuota };
}

function endSession(session: Session | undefined): void {
  session?.store.dispose();
  session?.quota.dispose();
}

/** Wires pi events to the modules. It holds no logic of its own. */
export function registerStatusline(pi: ExtensionAPI, deps: StatuslineDeps): void {
  let session: Session | undefined;
  pi.on("session_start", (_event, ctx) => {
    endSession(session);
    session = startSession(pi, deps, ctx);
  });
  pi.on("session_shutdown", () => {
    endSession(session);
    session = undefined;
  });
  pi.on("model_select", (_event, ctx) => session?.syncQuota(ctx));
  pi.registerCommand(
    "statusline",
    statuslineCommand(
      () => session?.store,
      (_description, ctx) => ctx.ui.notify(USAGE, "info"),
    ),
  );
  pi.on("agent_start", () => session?.host.turnStarted());
  pi.on("agent_end", () => session?.host.turnEnded());
}

export default function statusline(pi: ExtensionAPI): void {
  registerStatusline(pi, { home: homedir(), fetch: globalThis.fetch, now: Date.now });
}
