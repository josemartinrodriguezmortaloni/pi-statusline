import { defineSegment } from "./segment.ts";

export const model = defineSegment({
  id: "model",
  summary: "Active provider in parentheses and model id.",
  options: {},
  render: ({ model }) => ({ text: model ? `(${model.provider}) ${model.id}` : "no-model" }),
});

export const thinking = defineSegment({
  id: "thinking",
  summary: "Thinking level after a bullet. Hidden when the model does not reason.",
  options: {},
  render: ({ thinking }) => {
    if (!thinking) return undefined;
    return { text: thinking === "off" ? "• thinking off" : `• ${thinking}` };
  },
});
