import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type ApplyTarget, applyTool, statuslineCommand } from "./agent/index.ts";
import {
  type Config,
  type ConfigStore,
  configPath,
  describeIssues,
  type Issue,
  openConfigStore,
  quotaProviders,
} from "./config/index.ts";
import { createHost, type Host } from "./host/index.ts";
import { createAdapters, createQuotaMonitor, type QuotaMonitor } from "./quota/index.ts";
import {
  createFooter,
  createViewport,
  footerSwitch,
  previewStatusline,
  type Viewport,
} from "./statusline/index.ts";

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
  apply: ApplyTarget;
}

function warn(ctx: ExtensionContext, fallback: string, issues: readonly Issue[]): void {
  if (issues.length > 0)
    ctx.ui.notify(`statusline.json is invalid, ${fallback}:\n${describeIssues(issues)}`, "warning");
}

function openStore(path: string, ctx: ExtensionContext): ConfigStore {
  const { store, issues } = openConfigStore(path);
  warn(ctx, "using the preset", issues);
  store.onChange((_config, issues) => warn(ctx, "keeping the last valid config", issues));
  return store;
}

function startQuota(deps: StatuslineDeps, ctx: ExtensionContext, store: ConfigStore) {
  const quota = createQuotaMonitor(
    createAdapters({ fetch: deps.fetch, home: deps.home, registry: ctx.modelRegistry }),
    deps.now,
  );
  const syncQuota = (current: ExtensionContext) =>
    quota.watch(quotaProviders(store.current(), current.model?.provider));
  store.onChange(() => syncQuota(ctx));
  syncQuota(ctx);
  return { quota, syncQuota };
}

function showFooter(
  ctx: ExtensionContext,
  session: Omit<Session, "apply" | "syncQuota">,
  viewport: Viewport,
): void {
  const { store, host, quota } = session;
  const show = footerSwitch(ctx.ui, (tui, theme, footerData) =>
    createFooter(tui, theme, footerData, {
      snapshot: host.snapshot,
      layout: store.current,
      changes: [store.onChange, quota.onUpdate],
      viewport,
    }),
  );
  show(store.current().enabled);
  store.onChange((config) => show(config.enabled));
}

function startSession(pi: ExtensionAPI, deps: StatuslineDeps, ctx: ExtensionContext): Session {
  const path = configPath(deps.home);
  const store = openStore(path, ctx);
  const { quota, syncQuota } = startQuota(deps, ctx, store);
  const host = createHost({
    ctx,
    home: deps.home,
    now: deps.now,
    autoCompact: () => pi.getSettings().compaction?.enabled ?? true,
    quota: quota.get,
  });
  const viewport = createViewport();
  showFooter(ctx, { store, host, quota }, viewport);
  const preview = (config: Config) => ({
    width: viewport.width,
    lines: previewStatusline(config, host.snapshot(viewport.footerData), viewport.width),
  });
  return { store, host, quota, syncQuota, apply: { store, path, preview } };
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
    statuslineCommand(pi, () => session?.apply),
  );
  pi.registerTool(applyTool(() => session?.apply));
  pi.on("agent_start", () => session?.host.turnStarted());
  pi.on("agent_end", () => session?.host.turnEnded());
}

export default function statusline(pi: ExtensionAPI): void {
  registerStatusline(pi, { home: homedir(), fetch: globalThis.fetch, now: Date.now });
}
