import { joinParts, singleLine } from "./format.ts";
import { defineSegment } from "./segment.ts";

export const statuses = defineSegment({
  id: "statuses",
  summary: "Statuses of other extensions, sorted by key, except the keys that status segments show.",
  options: {},
  render: (snapshot, _options, scope) => {
    const shown = [...snapshot.statuses]
      .filter(([key]) => !scope.claimedStatusKeys.has(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, text]) => singleLine(text));
    const text = joinParts(shown);
    return text ? { text } : undefined;
  },
});
