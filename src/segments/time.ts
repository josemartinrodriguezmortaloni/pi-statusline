import type { Turn } from "../host/index.ts";
import { formatDuration } from "./format.ts";
import { defineSegment } from "./segment.ts";

export const sessionTime = defineSegment({
  id: "session-time",
  summary: "Time since the session started, after ⏱. Advances on its own every second.",
  options: {},
  clock: true,
  render: ({ sessionStartedAt, now }) =>
    sessionStartedAt === undefined ? undefined : { text: `⏱ ${formatDuration(now - sessionStartedAt)}` },
});

function turnText(turn: Turn, now: number): string | undefined {
  if (turn.startedAt !== undefined) return `▶ ${formatDuration(now - turn.startedAt)}`;
  return turn.lastMs === undefined ? undefined : `■ ${formatDuration(turn.lastMs)}`;
}

export const turnTime = defineSegment({
  id: "turn-time",
  summary:
    "Duration of the agent turn in progress (▶), or of the last turn (■). Hidden before the first turn.",
  options: {},
  clock: true,
  render: ({ turn, now }) => {
    const text = turnText(turn, now);
    return text ? { text } : undefined;
  },
});
