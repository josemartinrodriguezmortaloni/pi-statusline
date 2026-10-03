import type { ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences } from "@earendil-works/pi-tui";
import type { Snapshot } from "../host/index.ts";
import type { Layout } from "./layout.ts";
import type { Painter } from "./paint.ts";
import { renderStatusline } from "./render.ts";

/** What the footer saw on its last frame: the terminal width and the footer data of pi. */
export interface Viewport {
  width: number;
  footerData?: ReadonlyFooterDataProvider;
}

export function createViewport(): Viewport {
  return { width: process.stdout.columns || 100 };
}

const PLAIN: Painter = { fg: (_color, text) => text };

/** The lines as plain text: no colors and no escape codes from other extensions' statuses. */
export function previewStatusline(layout: Layout, snapshot: Snapshot, width: number): string[] {
  return renderStatusline(layout, snapshot, PLAIN, width).map(stripTerminalSequences);
}
