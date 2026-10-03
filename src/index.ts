import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { PRESET } from "./config/index.ts";
import { createHost } from "./host/index.ts";
import { createFooter } from "./statusline/index.ts";

/** What the extension reads from outside pi. Tests inject each one. */
export interface StatuslineDeps {
  home: string;
  fetch: typeof fetch;
  now: () => number;
}

function startSession(pi: ExtensionAPI, deps: StatuslineDeps, ctx: ExtensionContext): void {
  const host = createHost({
    ctx,
    home: deps.home,
    now: deps.now,
    autoCompact: () => pi.getSettings().compaction?.enabled ?? true,
  });
  ctx.ui.setFooter((tui, theme, footerData) =>
    createFooter(tui, theme, footerData, { snapshot: host.snapshot, layout: () => PRESET }),
  );
}

/** Wires pi events to the modules. It holds no logic of its own. */
export function registerStatusline(pi: ExtensionAPI, deps: StatuslineDeps): void {
  pi.on("session_start", (_event, ctx) => startSession(pi, deps, ctx));
}

export default function statusline(pi: ExtensionAPI): void {
  registerStatusline(pi, { home: homedir(), fetch: globalThis.fetch, now: Date.now });
}
