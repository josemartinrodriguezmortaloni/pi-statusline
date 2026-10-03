import { afterEach, describe, expect, it, vi } from "vitest";
import { boot, tempHome, writeConfig } from "./harness.ts";

const STARTED = "2026-10-03T10:00:00.000Z";
const T0 = Date.parse(STARTED);

function clock(start = T0) {
  const state = { now: start };
  return { state, now: () => state.now };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("session-time", () => {
  it("advances between renders without pi events", async () => {
    const time = clock();
    const { mount } = await boot({ startedAt: STARTED, now: time.now });
    const footer = mount();
    time.state.now = T0 + 45_000;
    expect(footer.render(30)[0]).toBe(`~/proj (main)${" ".repeat(12)}⏱ 45s`);
    time.state.now = T0 + 62 * 60_000;
    expect(footer.render(30)[0]).toBe(`~/proj (main)${" ".repeat(11)}⏱ 1h2m`);
  });

  it("re-renders every second while the config shows a time segment", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const { mount, tui } = await boot({ startedAt: STARTED });
    const footer = mount();
    vi.advanceTimersByTime(3000);
    expect(tui.renders).toBe(3);
    footer.dispose?.();
    vi.advanceTimersByTime(3000);
    expect(tui.renders).toBe(3);
  });

  it("does not tick when no segment changes with time", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "cwd" }] }] });
    const { mount, tui } = await boot({ home });
    mount();
    vi.advanceTimersByTime(3000);
    expect(tui.renders).toBe(0);
  });
});

describe("turn-time", () => {
  async function turnFooter() {
    const time = clock(0);
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "turn-time" }] }] });
    const booted = await boot({ home, now: time.now });
    return { ...booted, time, footer: booted.mount() };
  }

  it("is hidden before the first turn", async () => {
    const { footer } = await turnFooter();
    expect(footer.render(20)).toEqual([]);
  });

  it("shows the turn in progress, then the duration of the last turn", async () => {
    const { footer, time, emit, ctx } = await turnFooter();
    time.state.now = 1000;
    await emit("agent_start", {}, ctx);
    time.state.now = 6000;
    expect(footer.render(20)).toEqual(["▶ 5s"]);
    time.state.now = 8000;
    await emit("agent_end", { messages: [] }, ctx);
    time.state.now = 90_000;
    expect(footer.render(20)).toEqual(["■ 7s"]);
  });
});

describe("status", () => {
  it("shows one extension status and leaves it out of statuses", async () => {
    const home = tempHome();
    writeConfig(home, {
      lines: [{ left: [{ segment: "status", key: "mcp" }] }, { left: [{ segment: "statuses" }] }],
    });
    const { mount, footerData } = await boot({ home });
    footerData.statuses = new Map([
      ["mcp", "MCP 3"],
      ["engram", "🧠 on"],
      ["acp", "plan"],
    ]);
    expect(mount().render(40)).toEqual(["MCP 3", "plan 🧠 on"]);
  });

  it("is hidden when the key has no status", async () => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "status", key: "mcp" }, { segment: "cwd" }] }] });
    const { mount } = await boot({ home });
    expect(mount().render(40)).toEqual(["~/proj"]);
  });

  it("requires a key", async () => {
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "status" }] }] });
    const { notified } = await boot({ home });
    expect(notified[0]?.message).toContain("/lines/0/left/0: must have required properties key");
  });
});
