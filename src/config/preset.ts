import { validate } from "./schema.ts";
import type { Config } from "./types.ts";

/** Reproduces the three lines of the default pi footer. Higher priorities stay longer on a narrow terminal. */
const DEFINITION: Config = {
  enabled: true,
  lines: [
    {
      left: [
        { segment: "cwd", color: "dim", priority: 10 },
        { segment: "git-branch", color: "dim", priority: 8 },
        { segment: "session-name", color: "dim", priority: 6 },
      ],
      right: [{ segment: "session-time", color: "dim", priority: 3 }],
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

/** The preset passes through the schema like any config, so it carries the option defaults. */
export const PRESET = (validate(DEFINITION) as { value: Config }).value;
