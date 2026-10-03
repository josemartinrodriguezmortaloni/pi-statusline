import type { ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import type { Snapshot } from "../host/index.ts";
import type { Layout } from "./layout.ts";
import type { Painter } from "./paint.ts";
import { renderStatusline } from "./render.ts";

export interface FooterSources {
  snapshot(footerData: ReadonlyFooterDataProvider): Snapshot;
  layout(): Layout;
}

/** The footer component that pi mounts. It renders from live data on every frame. */
export function createFooter(
  tui: { requestRender(): void },
  theme: Painter,
  footerData: ReadonlyFooterDataProvider,
  sources: FooterSources,
): Component & { dispose(): void } {
  const stopBranch = footerData.onBranchChange(() => tui.requestRender());
  return {
    render: (width) => renderStatusline(sources.layout(), sources.snapshot(footerData), theme, width),
    invalidate: () => {},
    dispose: stopBranch,
  };
}
