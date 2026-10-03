import type { Config } from "./types.ts";

/** Reproduces the three lines of the default pi footer. Higher priorities stay longer on a narrow terminal. */
export const PRESET: Config = {
  enabled: true,
  lines: [
    {
      left: [
        { segment: "cwd", color: "dim", priority: 10 },
        { segment: "git-branch", color: "dim", priority: 8 },
        { segment: "session-name", color: "dim", priority: 6 },
      ],
      right: [],
    },
    {
      left: [
        { segment: "tokens", color: "dim", priority: 7 },
        { segment: "cache", color: "dim", priority: 4 },
        { segment: "cost", color: "dim", priority: 6 },
        { segment: "context", color: "dim", priority: 10 },
      ],
      right: [
        { segment: "model", color: "dim", priority: 9 },
        { segment: "thinking", color: "dim", priority: 5 },
      ],
    },
    { left: [{ segment: "statuses" }], right: [] },
  ],
};
