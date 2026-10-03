import { visibleWidth } from "@earendil-works/pi-tui";
import type { Fragment } from "../segments/index.ts";

/** One segment of a line as the config declares it: the id, `priority`, `color` and its own options. */
export interface SegmentSpec {
  segment: string;
  priority?: number;
  color?: string;
  [option: string]: unknown;
}

export interface LineSpec {
  left: readonly SegmentSpec[];
  right: readonly SegmentSpec[];
}

/** The part of the config that the render reads. */
export interface Layout {
  lines: readonly LineSpec[];
}

export type Side = "left" | "right";

/** A segment that has text to show, with its place in the line. */
export interface Placed {
  spec: SegmentSpec;
  side: Side;
  order: number;
  fragment: Fragment;
}

/** Minimum gap between the left and the right group, the same as the default pi footer. */
export const GAP = 2;

export function groupWidth(placed: readonly Placed[], side: Side): number {
  const texts = placed.filter((item) => item.side === side).map((item) => item.fragment.text);
  return visibleWidth(texts.join(" "));
}

/** The gap separates two groups; a group alone needs none. */
export function gapBetween(leftWidth: number, rightWidth: number): number {
  return leftWidth > 0 && rightWidth > 0 ? GAP : 0;
}

export function lineWidth(placed: readonly Placed[]): number {
  const left = groupWidth(placed, "left");
  const right = groupWidth(placed, "right");
  return left + gapBetween(left, right) + right;
}

const priorityOf = (item: Placed) => item.spec.priority ?? 0;

/** Lower priority goes first; among equal priorities, the segment later in the line goes first. */
function goesBefore(a: Placed, b: Placed): boolean {
  const difference = priorityOf(a) - priorityOf(b);
  return difference === 0 ? a.order > b.order : difference < 0;
}

/** The segment to hide first. */
function leastImportant(placed: readonly Placed[]): Placed {
  return placed.reduce((worst, item) => (goesBefore(item, worst) ? item : worst));
}

/** Hides segments by ascending priority until the line fits. The last segment always stays. */
export function fitToWidth(placed: readonly Placed[], width: number): readonly Placed[] {
  let shown = placed;
  while (shown.length > 1 && lineWidth(shown) > width) {
    const hidden = leastImportant(shown);
    shown = shown.filter((item) => item !== hidden);
  }
  return shown;
}
