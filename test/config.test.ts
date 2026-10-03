import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { boot, tempHome, writeConfig } from "./harness.ts";

const MODEL = { provider: "anthropic", id: "claude-x" };

const oneLine = (left: object[], right: object[] = []) => ({ lines: [{ left, right }] });

describe("config file", () => {
  it("renders the lines of a valid config", async () => {
    const home = tempHome();
    writeConfig(home, oneLine([{ segment: "model" }], [{ segment: "cwd" }]));
    const { mount, notified } = await boot({ home, model: MODEL });
    expect(mount().render(40)).toEqual([`(anthropic) claude-x${" ".repeat(14)}~/proj`]);
    expect(notified).toEqual([]);
  });

  it("fills a missing side with no segments and enabled with true", async () => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "cwd" }] }] });
    const { mount } = await boot({ home });
    expect(mount().render(40)).toEqual(["~/proj"]);
  });

  it("re-renders an edit of the file without a restart", async () => {
    const home = tempHome();
    writeConfig(home, oneLine([{ segment: "cwd" }]));
    const { mount, tui } = await boot({ home, model: MODEL });
    const footer = mount();
    writeConfig(home, oneLine([{ segment: "model" }]));
    await vi.waitFor(() => expect(tui.renders).toBeGreaterThan(0));
    expect(footer.render(40)).toEqual(["(anthropic) claude-x"]);
  });

  it("starts with the preset and names the failing field when the config is invalid", async () => {
    const home = tempHome();
    writeConfig(home, oneLine([{ segment: "cwd", color: "nope" }, { segment: "clock" }]));
    const { mount, notified } = await boot({ home });
    expect(mount().render(40)[0]).toBe("~/proj (main)");
    expect(notified).toHaveLength(1);
    expect(notified[0]?.type).toBe("warning");
    expect(notified[0]?.message).toContain("using the preset");
    expect(notified[0]?.message).toContain("/lines/0/left/1/segment: must be one of: cwd, git-branch");
  });

  it("names an invalid option of a known segment", async () => {
    const home = tempHome();
    writeConfig(home, oneLine([{ segment: "cwd", color: "nope", extra: 1 }]));
    const { notified } = await boot({ home });
    expect(notified[0]?.message).toContain(
      "/lines/0/left/0/color: must be a theme color token or a #rrggbb hex",
    );
    expect(notified[0]?.message).toContain("/lines/0/left/0: must not have additional properties");
  });

  it("keeps the last valid config when an edit is invalid", async () => {
    const home = tempHome();
    writeConfig(home, oneLine([{ segment: "model" }]));
    const { mount, notified } = await boot({ home, model: MODEL });
    const footer = mount();
    writeConfig(home, oneLine([{ segment: "model", priority: "high" }]));
    await vi.waitFor(() => expect(notified).toHaveLength(1));
    expect(notified[0]?.message).toContain("keeping the last valid config");
    expect(notified[0]?.message).toContain("/lines/0/left/0/priority");
    expect(footer.render(40)).toEqual(["(anthropic) claude-x"]);
  });

  it("reports a file that is not JSON", async () => {
    const home = tempHome();
    writeFileSync(join(home, ".pi", "agent", "statusline.json"), "{ lines: ");
    const { mount, notified } = await boot({ home });
    expect(notified[0]?.message).toMatch(
      /^statusline.json is invalid, using the preset:\n\/: invalid JSON: /,
    );
    expect(mount().render(40)[0]).toBe("~/proj (main)");
  });
});
