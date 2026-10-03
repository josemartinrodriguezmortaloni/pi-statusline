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

describe("/statusline <description>", () => {
  it("sends the design request with the catalog, the config path, the current config and the description", async () => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "cwd", color: "accent" }] }] });
    const booted = await boot({ home });
    await run(booted, "model on the right, quota on the left");
    expect(booted.sent).toHaveLength(1);
    const prompt = booted.sent[0] ?? "";
    expect(prompt).toContain("> model on the right, quota on the left");
    expect(prompt).toContain("`statusline_apply`");
    expect(prompt).toContain(join(home, ".pi", "agent", "statusline.json"));
    expect(prompt).toContain('"segment": "cwd",\n          "color": "accent"');
    expect(prompt).toMatch(
      /- `usage`: Subscription quota.+\n {2}options: \{"provider":\{.*"default":"active"/,
    );
    expect(prompt).toMatch(/- `status`: .+\n {2}options: \{"key":\{"type":"string"/);
    expect(prompt).toMatch(/- `cwd`: .+\n {2}options: none/);
    expect(prompt).toContain("- `priority` (every segment): Segments with a lower priority hide first");
  });

  it("lists every segment that the config schema accepts", async () => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "?" }] }] });
    const booted = await boot({ home });
    const accepted = booted.notified[0]?.message.match(/must be one of: (.+)/)?.[1]?.split(", ") ?? [];
    await run(booted, "anything");
    expect(accepted.length).toBeGreaterThan(10);
    for (const id of accepted) expect(booted.sent[0]).toContain(`- \`${id}\`: `);
  });

  it("queues the request as a follow-up while the agent works", async () => {
    const booted = await boot();
    booted.ctx.idle = false;
    await run(booted, "minimal");
    expect(booted.sent[0]).toMatch(/^\[followUp\] Design my pi statusline/);
  });

  it("does not treat a subcommand as a description", async () => {
    const booted = await boot();
    for (const sub of ["on", "off", "reset"]) await run(booted, sub);
    expect(booted.sent).toEqual([]);
  });
});
