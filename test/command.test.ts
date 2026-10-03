import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boot, fakeCtx, tempHome, writeConfig } from "./harness.ts";

const readConfig = (home: string) =>
  JSON.parse(readFileSync(join(home, ".pi", "agent", "statusline.json"), "utf8"));

async function run(booted: Awaited<ReturnType<typeof boot>>, args: string) {
  const command = booted.commands.get("statusline");
  if (!command) throw new Error("no /statusline command");
  await command.handler(args, booted.ctx);
}

describe("/statusline subcommands", () => {
  it("off restores the default footer and persists enabled: false across sessions", async () => {
    const booted = await boot();
    await run(booted, " off ");
    expect(booted.footers.at(-1)).toBeUndefined();
    expect(readConfig(booted.home).enabled).toBe(false);
    expect(booted.notified.at(-1)).toEqual({
      message: "Statusline off: pi shows its default footer.",
      type: "info",
    });

    const next = fakeCtx({ cwd: join(booted.home, "proj"), entries: [] });
    await booted.emit("session_start", { reason: "new" }, next.ctx);
    expect(next.footers).toEqual([undefined]);
    await booted.emit("session_shutdown", {}, next.ctx);
  });

  it("on shows the statusline again and persists enabled: true", async () => {
    const home = tempHome();
    writeConfig(home, { enabled: false, lines: [{ left: [{ segment: "cwd" }] }] });
    const booted = await boot({ home });
    expect(booted.footers).toEqual([undefined]);
    await run(booted, "on");
    expect(readConfig(home)).toEqual({ enabled: true, lines: [{ left: [{ segment: "cwd" }], right: [] }] });
    expect(booted.mount().render(40)).toEqual(["~/proj"]);
  });

  it("reset writes the preset", async () => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "cwd" }] }] });
    const booted = await boot({ home });
    await run(booted, "reset");
    expect(readConfig(home).lines).toHaveLength(3);
    expect(booted.mount().render(40)[0]).toBe("~/proj (main)");
  });

  it("shows the usage without arguments", async () => {
    const booted = await boot();
    await run(booted, "");
    expect(booted.notified.at(-1)?.message).toMatch(
      /^Usage: \/statusline <description> \| on \| off \| reset\n/,
    );
  });

  it("completes the subcommands", async () => {
    const { commands } = await boot();
    const complete = async (prefix: string) => {
      const items = await commands.get("statusline")?.getArgumentCompletions?.(prefix, {});
      return (items as { value: string }[]).map((item) => item.value);
    };
    expect(await complete("")).toEqual(["on", "off", "reset"]);
    expect(await complete("o")).toEqual(["on", "off"]);
  });
});
