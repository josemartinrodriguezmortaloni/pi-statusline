import { lstatSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { boot, fakeFetch, tempHome, writeConfig, writeJson } from "./harness.ts";

const MODEL = { provider: "anthropic", id: "claude-x" };
const configFile = (home: string) => join(home, ".pi", "agent", "statusline.json");

afterEach(() => {
  vi.useRealTimers();
});

async function run(booted: Awaited<ReturnType<typeof boot>>, args: string) {
  await booted.commands.get("statusline")?.handler(args, booted.ctx);
}

describe("regressions from review", () => {
  it("on and off refuse to replace an invalid file; reset still replaces it", async () => {
    const home = tempHome();
    writeFileSync(configFile(home), '{ "lines": [ { "left": [ { "segment": "cwd", "color": "nope" } ] } ] }');
    const booted = await boot({ home });
    await run(booted, "off");
    expect(booted.notified.at(-1)?.type).toBe("error");
    expect(booted.notified.at(-1)?.message).toContain("/lines/0/left/0/color");
    expect(readFileSync(configFile(home), "utf8")).toContain('"nope"');
    await run(booted, "reset");
    expect(JSON.parse(readFileSync(configFile(home), "utf8")).lines).toHaveLength(3);
  });

  it("sends a word that only an object prototype knows to the agent", async () => {
    const booted = await boot();
    await run(booted, "constructor");
    expect(booted.sent[0]).toContain("> constructor");
  });

  it("writes through a symlinked config and reloads edits of its target", async () => {
    const home = tempHome();
    const dots = join(home, "dots");
    mkdirSync(dots);
    writeFileSync(join(dots, "statusline.json"), JSON.stringify({ lines: [{ left: [{ segment: "cwd" }] }] }));
    symlinkSync(join(dots, "statusline.json"), configFile(home));
    const booted = await boot({ home, model: MODEL });
    const footer = booted.mount();
    writeFileSync(
      join(dots, "statusline.json"),
      JSON.stringify({ lines: [{ left: [{ segment: "model" }] }] }),
    );
    await vi.waitFor(() => expect(footer.render(40)).toEqual(["(anthropic) claude-x"]));
    await run(booted, "off");
    expect(lstatSync(configFile(home)).isSymbolicLink()).toBe(true);
    expect(JSON.parse(readFileSync(join(dots, "statusline.json"), "utf8")).enabled).toBe(false);
  });

  it("does not warn about the empty file an editor leaves between truncate and write", async () => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "cwd" }] }] });
    const booted = await boot({ home, model: MODEL });
    const footer = booted.mount();
    writeFileSync(configFile(home), "");
    writeConfig(home, { lines: [{ left: [{ segment: "model" }] }] });
    await vi.waitFor(() => expect(footer.render(40)).toEqual(["(anthropic) claude-x"]));
    expect(booted.notified).toEqual([]);
  });

  it("hides excluded keys from statuses", async () => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "statuses", exclude: ["engram"] }] }] });
    const { mount, footerData } = await boot({ home });
    footerData.statuses = new Map([
      ["engram", "🧠 on"],
      ["mcp", "MCP 3"],
    ]);
    expect(mount().render(40)).toEqual(["MCP 3"]);
  });

  it("does not poll quota while the statusline is off", async () => {
    const home = tempHome();
    writeConfig(home, { enabled: false, lines: [{ left: [{ segment: "usage" }] }] });
    writeJson(home, ".claude/.credentials.json", { claudeAiOauth: { accessToken: "sk-ant-oat01-x" } });
    const fake = fakeFetch({});
    await boot({ home, fetch: fake.fetch, model: { provider: "claude-acp", id: "opus" } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.calls).toEqual([]);
  });

  it("hides the quota once the server rejects the credential", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "usage" }, { segment: "cwd" }] }] });
    writeJson(home, ".claude/.credentials.json", { claudeAiOauth: { accessToken: "sk-ant-oat01-x" } });
    let status = 200;
    const fake = fakeFetch({
      "https://api.anthropic.com/api/oauth/usage": () =>
        status === 200 ? { five_hour: { utilization: 10 } } : new Response("expired", { status }),
    });
    const booted = await boot({ home, fetch: fake.fetch, model: { provider: "claude-acp", id: "opus" } });
    const footer = booted.mount();
    await vi.waitFor(() => expect(footer.render(80)[0]).toMatch(/^5h /));
    status = 401;
    vi.advanceTimersByTime(60_000);
    await vi.waitFor(() => expect(footer.render(80)).toEqual(["~/proj"]));
  });

  it("fits a right group alone without the gap between groups", async () => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [], right: [{ segment: "model" }] }] });
    const { mount } = await boot({ home, model: MODEL });
    expect(mount().render(20)).toEqual(["(anthropic) claude-x"]);
  });
});
