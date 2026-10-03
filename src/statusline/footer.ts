import type { ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import type { Snapshot } from "../host/index.ts";
import { findSegment } from "../segments/index.ts";
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

const TICK_MS = 1000;

function usesClock(layout: Layout): boolean {
  const specs = layout.lines.flatMap((line) => [...line.left, ...line.right]);
  return specs.some((spec) => findSegment(spec.segment)?.clock === true);
}

/** Re-renders every second while the layout shows a segment that changes with time alone. */
function tick(layout: () => Layout, rerender: () => void): () => void {
  const timer = setInterval(() => usesClock(layout()) && rerender(), TICK_MS);
  return () => clearInterval(timer);
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
    tick(sources.layout, rerender),
  ];
  return {
    render: (width) => renderStatusline(sources.layout(), sources.snapshot(footerData), theme, width),
    invalidate: () => {},
    dispose: () => {
      for (const stop of stops) stop();
    },
  };
}

export type FooterFactory = (
  tui: { requestRender(): void },
  theme: Painter,
  footerData: ReadonlyFooterDataProvider,
) => Component & { dispose(): void };

/** Shows the statusline while enabled and the default pi footer otherwise. Mounts only on a change. */
export function footerSwitch(
  ui: { setFooter(factory: FooterFactory | undefined): void },
  factory: FooterFactory,
): (enabled: boolean) => void {
  let shown: boolean | undefined;
  return (enabled) => {
    if (enabled === shown) return;
    shown = enabled;
    ui.setFooter(enabled ? factory : undefined);
  };
}
