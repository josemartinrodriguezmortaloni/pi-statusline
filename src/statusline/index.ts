/**
 * Lays out and paints the segments of a config into lines. The render is pure and does no I/O.
 */
export { createFooter, type FooterFactory, type FooterSources, footerSwitch } from "./footer.ts";
export type { Layout, LineSpec, SegmentSpec } from "./layout.ts";
export type { Painter } from "./paint.ts";
export { renderStatusline } from "./render.ts";
