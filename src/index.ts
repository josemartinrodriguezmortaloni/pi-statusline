import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type ConfigStore, configPath, describeIssues, type Issue, openConfigStore } from "./config/index.ts";
import { createHost } from "./host/index.ts";
import { createFooter } from "./statusline/index.ts";

/** What the extension reads from outside pi. Tests inject each one. */
export interface StatuslineDeps {
  home: string;
  fetch: typeof fetch;
  now: () => number;
}

function warn(ctx: ExtensionContext, fallback: string, issues: readonly Issue[]): void {
  if (issues.length > 0)
    ctx.ui.notify(`statusline.json is invalid, ${fallback}:\n${describeIssues(issues)}`, "warning");
}

function startSession(pi: ExtensionAPI, deps: StatuslineDeps, ctx: ExtensionContext): ConfigStore {
  const { store, issues } = openConfigStore(configPath(deps.home));
  warn(ctx, "using the preset", issues);
  store.onChange((_config, issues) => warn(ctx, "keeping the last valid config", issues));
  const host = createHost({
    ctx,
    home: deps.home,
    now: deps.now,
    autoCompact: () => pi.getSettings().compaction?.enabled ?? true,
  });
  ctx.ui.setFooter((tui, theme, footerData) =>
    createFooter(tui, theme, footerData, {
      snapshot: host.snapshot,
      layout: store.current,
      changes: [store.onChange],
    }),
  );
  return store;
}

/** Wires pi events to the modules. It holds no logic of its own. */
export function registerStatusline(pi: ExtensionAPI, deps: StatuslineDeps): void {
  let session: ConfigStore | undefined;
  pi.on("session_start", (_event, ctx) => {
    session?.dispose();
    session = startSession(pi, deps, ctx);
  });
  pi.on("session_shutdown", () => {
    session?.dispose();
    session = undefined;
  });
}

export default function statusline(pi: ExtensionAPI): void {
  registerStatusline(pi, { home: homedir(), fetch: globalThis.fetch, now: Date.now });
}
