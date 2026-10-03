import type { ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import type { Snapshot } from "../host/index.ts";
import type { Layout } from "./layout.ts";
import type { Painter } from "./paint.ts";
import { renderStatusline } from "./render.ts";

/** Subscribes a listener to a source of change and returns the unsubscribe. */
export type Subscribe = (listener: () => void) => () => void;

export interface FooterSources {
  snapshot(footerData: ReadonlyFooterDataProvider): Snapshot;
  layout(): Layout;
  /** Changes that pi does not know about and that need a new frame, such as a config reload. */
  changes: readonly Subscribe[];
}

/** The footer component that pi mounts. It renders from live data on every frame. */
export function createFooter(
  tui: { requestRender(): void },
  theme: Painter,
  footerData: ReadonlyFooterDataProvider,
  sources: FooterSources,
): Component & { dispose(): void } {
  const rerender = () => tui.requestRender();
  const stops = [
    footerData.onBranchChange(rerender),
    ...sources.changes.map((subscribe) => subscribe(rerender)),
  ];
  return {
    render: (width) => renderStatusline(sources.layout(), sources.snapshot(footerData), theme, width),
    invalidate: () => {},
    dispose: () => {
      for (const stop of stops) stop();
    },
  };
}
