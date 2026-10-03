import { describe, expect, it } from "vitest";
import { assistantEntry, boot, taggedTheme } from "./harness.ts";

const MODEL = { provider: "anthropic", id: "claude-x", reasoning: true, contextWindow: 200_000 };
const USAGE = { input: 1200, output: 340, cacheRead: 5000, cacheWrite: 200, cost: 0.0123 };
const CONTEXT = { tokens: 24_600, contextWindow: 200_000, percent: 12.3 };

describe("preset footer", () => {
  it("replaces the footer on session start and renders the default pi layout", async () => {
    const { mount, footerData } = await boot({
      sessionName: "demo",
      model: MODEL,
      thinkingLevel: "high",
      entries: [assistantEntry(USAGE)],
      contextUsage: CONTEXT,
    });
    footerData.statuses = new Map([
      ["mcp", "MCP 3"],
      ["engram", "🧠\ton"],
    ]);
    const lines = mount().render(100);
    expect(lines).toEqual([
      "~/proj (main) • demo",
      `↑1.2k ↓340 R5.0k W200 CH78.1% $0.012 12.3%/200k (auto)${" ".repeat(19)}(anthropic) claude-x • high`,
      "🧠 on MCP 3",
    ]);
    expect(lines.every((line) => line.length <= 100)).toBe(true);
  });

  it("leaves out the status line and the empty spend before the first response", async () => {
    const { mount } = await boot({ model: { provider: "local", id: "llama" } });
    expect(mount().render(40)).toEqual(["~/proj (main)", `${" ".repeat(27)}(local) llama`]);
  });

  it("shows thinking off, (sub) cost and no (auto) when compaction is disabled", async () => {
    const { mount, settings } = await boot({ model: MODEL, oauth: true, contextUsage: CONTEXT });
    settings.compaction = { enabled: false };
    expect(mount().render(67)[1]).toBe(
      `$0.000 (sub) 12.3%/200k${" ".repeat(9)}(anthropic) claude-x • thinking off`,
    );
  });

  it("dims the preset and paints the context warning above 70 %", async () => {
    const { mount } = await boot({
      model: { provider: "local", id: "m" },
      contextUsage: { tokens: 150_000, contextWindow: 200_000, percent: 75 },
    });
    expect(mount(taggedTheme).render(40)[1]).toBe(
      `<warning>75.0%/200k (auto)</warning>${" ".repeat(14)}<dim>(local) m</dim>`,
    );
  });

  it("re-renders with the new branch when the git branch changes", async () => {
    const { mount, footerData, tui } = await boot();
    const footer = mount();
    footerData.switchBranch("feature");
    expect(tui.renders).toBe(1);
    expect(footer.render(80)[0]).toBe("~/proj (feature)");
    footer.dispose?.();
    footerData.switchBranch("main");
    expect(tui.renders).toBe(1);
  });

  it("sums the session tokens once per leaf", async () => {
    const entries = [assistantEntry(USAGE)];
    const { mount, counters } = await boot({ entries });
    const footer = mount();
    footer.render(80);
    footer.render(80);
    expect(counters.getEntries).toBe(1);
    entries.push(assistantEntry(USAGE));
    expect(footer.render(80)[1]).toContain("↑2.4k ↓680");
    expect(counters.getEntries).toBe(2);
  });
});
