import { Type } from "typebox";
import { joinParts, singleLine } from "./format.ts";
import { defineSegment } from "./segment.ts";

export const status = defineSegment({
  id: "status",
  summary: "Status of one extension, by its status key (for example mcp). Hidden when that status is absent.",
  options: { key: Type.String({ description: "Status key of the extension." }) },
  render: (snapshot, { key }) => {
    const text = singleLine(snapshot.statuses.get(key) ?? "");
    return text ? { text } : undefined;
  },
});

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
