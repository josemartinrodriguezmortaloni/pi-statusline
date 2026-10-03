import type { Static, TObject, TProperties } from "typebox";
import type { Snapshot } from "../host/index.ts";

export type Tone = "success" | "warning" | "error";

/** What a segment shows. A tone overrides the color the config gives the segment. */
export interface Fragment {
  text: string;
  tone?: Tone;
}

/** Facts about the whole statusline that a segment needs beyond the Snapshot. */
export interface RenderScope {
  /** Status keys that `status` segments show on their own. */
  claimedStatusKeys: ReadonlySet<string>;
}

export interface Segment {
  id: string;
  summary: string;
  /** Typebox properties of the options the segment accepts besides `priority` and `color`. */
  options: TProperties;
  /** Returns nothing when the segment has no data to show. */
  render(snapshot: Snapshot, options: Record<string, unknown>, scope: RenderScope): Fragment | undefined;
}

interface TypedSegment<Options extends TProperties> {
  id: string;
  summary: string;
  options: Options;
  render(snapshot: Snapshot, options: Static<TObject<Options>>, scope: RenderScope): Fragment | undefined;
}

/** Keeps each definition typed by its own options; the catalog then holds them as plain `Segment`s. */
export function defineSegment<Options extends TProperties>(segment: TypedSegment<Options>): Segment {
  return segment as unknown as Segment;
}
