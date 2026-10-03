import type { Turn } from "./snapshot.ts";

/** Times agent turns from `agent_start` to `agent_end`. */
export function createTurnClock(now: () => number) {
  let turn: Turn = {};
  return {
    start: () => {
      turn = { ...turn, startedAt: now() };
    },
    end: () => {
      if (turn.startedAt !== undefined) turn = { lastMs: now() - turn.startedAt };
    },
    current: (): Turn => turn,
  };
}
