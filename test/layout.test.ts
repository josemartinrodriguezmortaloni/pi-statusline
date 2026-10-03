import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { assistantEntry, boot, taggedTheme, tempHome, writeConfig } from "./harness.ts";

const MODEL = { provider: "anthropic", id: "claude-x", reasoning: true };

/** `~/proj claude-x` on the left and `(main)` on the right: 35 columns in full. */
async function prioritized() {
  const home = tempHome();
  writeConfig(home, {
    lines: [
      {
        left: [
          { segment: "cwd", priority: 1 },
          { segment: "model", priority: 5 },
        ],
        right: [{ segment: "git-branch", priority: 3 }],
      },
    ],
  });
  return (await boot({ home, model: MODEL })).mount();
}

describe("layout by width", () => {
  it("shows every segment when the line fits", async () => {
    expect((await prioritized()).render(35)).toEqual(["~/proj (anthropic) claude-x  (main)"]);
  });

  it("hides segments by ascending priority until the line fits", async () => {
    const footer = await prioritized();
    expect(footer.render(34)).toEqual([`(anthropic) claude-x${" ".repeat(8)}(main)`]);
    expect(footer.render(27)).toEqual(["(anthropic) claude-x"]);
  });

  it("truncates the last segment with ... when it still does not fit", async () => {
    const [line] = (await prioritized()).render(10);
    expect(visibleWidth(line ?? "")).toBe(10);
    expect(stripTerminalSequences(line ?? "")).toBe("(anthro...");
  });

  it("hides the later of two segments with equal priority first", async () => {
    const home = tempHome();
    writeConfig(home, {
      lines: [{ left: [{ segment: "cwd" }, { segment: "model" }, { segment: "git-branch" }] }],
    });
    const footer = (await boot({ home, model: MODEL })).mount();
    expect(footer.render(27)).toEqual(["~/proj (anthropic) claude-x"]);
    expect(footer.render(26)).toEqual(["~/proj"]);
  });

  it("never renders the preset wider than the terminal", async () => {
    const { mount, footerData } = await boot({
      sessionName: "a long session name",
      model: MODEL,
      thinkingLevel: "high",
      entries: [assistantEntry({ input: 1200, output: 340, cacheRead: 5000, cacheWrite: 200, cost: 0.01 })],
      contextUsage: { tokens: 1, contextWindow: 200_000, percent: 12.3 },
    });
    footerData.statuses = new Map([["mcp", "MCP 3 servers connected and ready"]]);
    const footer = mount();
    for (let width = 1; width <= 120; width++) {
      for (const line of footer.render(width)) expect(visibleWidth(line)).toBeLessThanOrEqual(width);
    }
  });
});

describe("segment color", () => {
  const colored = async (color: string) => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "cwd", color }] }] });
    return (await boot({ home })).mount(taggedTheme).render(40);
  };

  it("paints with a theme token through theme.fg", async () => {
    expect(await colored("accent")).toEqual(["<accent>~/proj</accent>"]);
  });

  it("paints a #rrggbb hex in truecolor", async () => {
    expect(await colored("#ff8800")).toEqual(["\x1b[38;2;255;136;0m~/proj\x1b[39m"]);
  });
});

describe("context bar", () => {
  const contextLine = async (contextUsage: {
    tokens: number | null;
    contextWindow: number;
    percent: number | null;
  }) => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "context", bar: true }] }] });
    return (await boot({ home, contextUsage })).mount(taggedTheme).render(80);
  };

  it("shows a bar, the used tokens and the tokens left", async () => {
    expect(await contextLine({ tokens: 24_600, contextWindow: 200_000, percent: 12.3 })).toEqual([
      "●○○○○○○○ 12.3% · 25k used · 175k left (auto)",
    ]);
  });

  it("keeps the warning tone above 70 %", async () => {
    expect(await contextLine({ tokens: 150_000, contextWindow: 200_000, percent: 75 })).toEqual([
      "<warning>●●●●●●○○ 75.0% · 150k used · 50k left (auto)</warning>",
    ]);
  });

  it("falls back to the plain text while the used tokens are unknown", async () => {
    expect(await contextLine({ tokens: null, contextWindow: 200_000, percent: null })).toEqual([
      "?/200k (auto)",
    ]);
  });
});
