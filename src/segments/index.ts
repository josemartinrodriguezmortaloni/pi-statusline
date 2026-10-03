/**
 * The segment catalog: the single source of the config schema, the agent prompt and the render.
 */
import { cwd, gitBranch, sessionName } from "./location.ts";
import { model, thinking } from "./model.ts";
import type { Segment } from "./segment.ts";
import { cache, context, cost, tokens } from "./spend.ts";
import { status, statuses } from "./statuses.ts";
import { sessionTime, turnTime } from "./time.ts";

export type { Fragment, RenderScope, Segment, Tone } from "./segment.ts";

export const CATALOG: readonly Segment[] = [
  cwd,
  gitBranch,
  sessionName,
  tokens,
  cache,
  cost,
  context,
  model,
  thinking,
  sessionTime,
  turnTime,
  status,
  statuses,
];

const BY_ID = new Map(CATALOG.map((segment) => [segment.id, segment]));

export function findSegment(id: string): Segment | undefined {
  return BY_ID.get(id);
}
