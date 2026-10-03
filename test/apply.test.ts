import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boot, taggedTheme, tempHome, writeConfig } from "./harness.ts";

const MODEL = { provider: "anthropic", id: "claude-x" };

async function applyFooter() {
  const home = tempHome();
  writeConfig(home, { lines: [{ left: [{ segment: "cwd" }] }] });
  const booted = await boot({ home, model: MODEL });
  const footer = booted.mount(taggedTheme);
  footer.render(50);
  const tool = booted.tools.get("statusline_apply");
  if (!tool) throw new Error("no statusline_apply tool");
  const apply = (config: unknown) => tool.execute("call-1", { config }, undefined, undefined, booted.ctx);
  const file = () => readFileSync(join(home, ".pi", "agent", "statusline.json"), "utf8");
  return { ...booted, footer, apply, file };
}

describe("statusline_apply", () => {
  it("writes a valid config and returns a plain preview at the current width", async () => {
    const { apply, file, footerData, home } = await applyFooter();
    footerData.statuses = new Map([["mcp", "\x1b[32mMCP 3\x1b[39m"]]);
    const config = {
      lines: [
        {
          left: [{ segment: "model", color: "accent" }],
          right: [{ segment: "status", key: "mcp", color: "#00ff00" }],
        },
      ],
    };
    const result = (await apply(config)) as { content: { text: string }[] };
    expect(result.content[0]?.text).toBe(
      `Wrote ${join(home, ".pi", "agent", "statusline.json")}. Preview at 50 columns:\n` +
        `\`\`\`\n(anthropic) claude-x${" ".repeat(25)}MCP 3\n\`\`\``,
    );
    expect(JSON.parse(file()).lines[0].right).toEqual([{ segment: "status", key: "mcp", color: "#00ff00" }]);
  });

  it("rejects an invalid config with the failing paths and writes nothing", async () => {
    const { apply, file } = await applyFooter();
    const before = file();
    await expect(apply({ lines: [{ left: [{ segment: "usage", window: "1d" }] }] })).rejects.toThrow(
      "Invalid config, nothing written:\n/lines/0/left/0/window: must be one of: 5h, 7d, extra",
    );
    expect(file()).toBe(before);
  });

  it("shows the applied config in the footer at once", async () => {
    const { apply, footer, tui } = await applyFooter();
    await apply({ lines: [{ left: [{ segment: "model" }] }] });
    expect(tui.renders).toBeGreaterThan(0);
    expect(footer.render(50)).toEqual(["(anthropic) claude-x"]);
  });

  it("says so when every segment is hidden", async () => {
    const { apply } = await applyFooter();
    const result = (await apply({ lines: [{ left: [{ segment: "session-name" }] }] })) as {
      content: { text: string }[];
    };
    expect(result.content[0]?.text).toContain("(no lines: every segment is hidden with the current data)");
  });
});
