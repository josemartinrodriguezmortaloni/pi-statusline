import { truncateToWidth } from "@earendil-works/pi-tui";
import type { Snapshot } from "../host/index.ts";
import { findSegment, type RenderScope } from "../segments/index.ts";
import {
  fitToWidth,
  gapBetween,
  groupWidth,
  type Layout,
  type LineSpec,
  lineWidth,
  type Placed,
  type SegmentSpec,
  type Side,
} from "./layout.ts";
import { type Painter, paint } from "./paint.ts";

interface Frame {
  snapshot: Snapshot;
  scope: RenderScope;
  theme: Painter;
  width: number;
}

function claimedStatusKeys(layout: Layout): ReadonlySet<string> {
  const specs = layout.lines.flatMap((line) => [...line.left, ...line.right]);
  const keys = specs.filter((spec) => spec.segment === "status").map((spec) => spec.key);
  return new Set(keys.filter((key): key is string => typeof key === "string"));
}

function renderSpec(spec: SegmentSpec, frame: Frame) {
  return findSegment(spec.segment)?.render(frame.snapshot, spec, frame.scope);
}

function place(line: LineSpec, frame: Frame): Placed[] {
  const specs = [
    ...line.left.map((spec) => ({ spec, side: "left" as Side })),
    ...line.right.map((spec) => ({ spec, side: "right" as Side })),
  ];
  return specs.flatMap(({ spec, side }, order) => {
    const fragment = renderSpec(spec, frame);
    return fragment ? [{ spec, side, order, fragment }] : [];
  });
}

function paintGroup(placed: readonly Placed[], side: Side, theme: Painter): string {
  return placed
    .filter((item) => item.side === side)
    .map((item) => paint(theme, item.fragment.tone ?? item.spec.color, item.fragment.text))
    .join(" ");
}

/** Left group, then the right group aligned to the right edge. */
function compose(shown: readonly Placed[], frame: Frame): string {
  const left = paintGroup(shown, "left", frame.theme);
  const leftWidth = groupWidth(shown, "left");
  const rightWidth = groupWidth(shown, "right");
  if (rightWidth === 0) return left;
  const padding = Math.max(gapBetween(leftWidth, rightWidth), frame.width - leftWidth - rightWidth);
  return left + " ".repeat(padding) + paintGroup(shown, "right", frame.theme);
}

/** Truncates with `...` only a line that still overflows after hiding segments. */
function finish(shown: readonly Placed[], frame: Frame): string {
  const line = compose(shown, frame);
  return lineWidth(shown) > frame.width ? truncateToWidth(line, frame.width, "...") : line;
}

function renderLine(line: LineSpec, frame: Frame): string[] {
  const placed = place(line, frame);
  return placed.length === 0 ? [] : [finish(fitToWidth(placed, frame.width), frame)];
}

/** Pure: the lines of the statusline for this snapshot and width. A line with nothing to show is left out. */
export function renderStatusline(
  layout: Layout,
  snapshot: Snapshot,
  theme: Painter,
  width: number,
): string[] {
  const frame = { snapshot, theme, width, scope: { claimedStatusKeys: claimedStatusKeys(layout) } };
  return layout.lines.flatMap((line) => renderLine(line, frame));
}
