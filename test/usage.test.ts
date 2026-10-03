import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { boot, fakeFetch, taggedTheme, tempHome, writeConfig, writeJson } from "./harness.ts";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const BODY = JSON.parse(readFileSync(new URL("./fixtures/anthropic-usage.json", import.meta.url), "utf8"));
const CLAUDE_ACP = { provider: "claude-acp", id: "opus" };
const OAUTH = "sk-ant-oat01-test";

afterEach(() => {
  vi.useRealTimers();
});

async function usageFooter(options: {
  segments: object[];
  body?: () => unknown;
  model?: { provider: string; id: string };
  credentials?: boolean;
  providerAuth?: Record<string, string>;
}) {
  const home = tempHome();
  writeConfig(home, { lines: [{ left: options.segments }] });
  if (options.credentials ?? true)
    writeJson(home, ".claude/.credentials.json", { claudeAiOauth: { accessToken: OAUTH } });
  const fake = fakeFetch({ [USAGE_URL]: options.body ?? (() => BODY) });
  const booted = await boot({
    home,
    fetch: fake.fetch,
    model: options.model ?? CLAUDE_ACP,
    providerAuth: options.providerAuth,
  });
  return { ...booted, calls: fake.calls };
}

describe("usage with the Anthropic adapter", () => {
  it("shows the 5h and 7d windows with their reset in the system locale", async () => {
    const { mount, calls } = await usageFooter({
      segments: [{ segment: "usage" }, { segment: "usage", window: "7d" }],
    });
    const footer = mount();
    await vi.waitFor(() =>
      expect(footer.render(80)).toEqual([
        "5h ●●●○○○○○ 42% ⟳ 06:00 p. m. 7d ●●●●●●●○ 91% ⟳ 5 oct, 12:00 p. m.",
      ]),
    );
    expect(calls).toEqual([
      {
        url: USAGE_URL,
        headers: {
          Accept: "application/json",
          "User-Agent": "pi-statusline/0.1.0",
          Authorization: `Bearer ${OAUTH}`,
          "anthropic-beta": "oauth-2025-04-20",
        },
      },
    ]);
  });

  it("shows the extra credits spent", async () => {
    const { mount } = await usageFooter({ segments: [{ segment: "usage", window: "extra" }] });
    const footer = mount();
    await vi.waitFor(() => expect(footer.render(80)).toEqual(["extra ●●○○○○○○ $12.50/$50.00"]));
  });

  it("turns to warning at 50 % and error at 90 % by default, or at the configured thresholds", async () => {
    const { mount } = await usageFooter({
      segments: [
        { segment: "usage", color: "dim" },
        { segment: "usage", window: "7d" },
        { segment: "usage", window: "extra", thresholds: { warning: 20 } },
      ],
    });
    const footer = mount(taggedTheme);
    await vi.waitFor(() => expect(footer.render(120)[0]).toContain("<error>7d"));
    expect(footer.render(120)[0]).toMatch(
      /^<dim>5h .+<\/dim> <error>7d .+<\/error> <warning>extra .+<\/warning>$/,
    );
  });

  it("reads the pi login for the anthropic provider", async () => {
    const { mount, calls } = await usageFooter({
      segments: [{ segment: "usage" }],
      model: { provider: "anthropic", id: "opus" },
      credentials: false,
      providerAuth: { anthropic: "sk-ant-oat01-pi" },
    });
    const footer = mount();
    await vi.waitFor(() => expect(footer.render(80)[0]).toMatch(/^5h /));
    expect(calls[0]?.headers.Authorization).toBe("Bearer sk-ant-oat01-pi");
  });

  it("is hidden without a request when there is no subscription credential", async () => {
    const missing = await usageFooter({
      segments: [{ segment: "usage" }, { segment: "cwd" }],
      credentials: false,
    });
    const apiKey = await usageFooter({
      segments: [{ segment: "usage" }, { segment: "cwd" }],
      model: { provider: "anthropic", id: "opus" },
      providerAuth: { anthropic: "sk-ant-api03-paid" },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(missing.mount().render(80)).toEqual(["~/proj"]);
    expect(apiKey.mount().render(80)).toEqual(["~/proj"]);
    expect([...missing.calls, ...apiKey.calls]).toEqual([]);
  });

  it("is hidden for a provider without an adapter", async () => {
    const { mount, calls } = await usageFooter({
      segments: [{ segment: "usage" }, { segment: "cwd" }],
      model: { provider: "ollama", id: "llama" },
    });
    expect(mount().render(80)).toEqual(["~/proj"]);
    expect(calls).toEqual([]);
  });

  it("does not request any quota when the config has no usage segment", async () => {
    const { calls } = await usageFooter({ segments: [{ segment: "cwd" }] });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toEqual([]);
  });

  it("keeps the render working when the network fails", async () => {
    const { mount } = await usageFooter({
      segments: [{ segment: "usage" }, { segment: "cwd" }],
      body: () => {
        throw new TypeError("fetch failed");
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mount().render(80)).toEqual(["~/proj"]);
  });

  it("keeps the last windows when a refresh fails, and refreshes every 60 s", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let fail = false;
    const { mount, calls } = await usageFooter({
      segments: [{ segment: "usage" }],
      body: () => (fail ? new Response("busy", { status: 529 }) : BODY),
    });
    const footer = mount();
    await vi.waitFor(() => expect(footer.render(80)[0]).toMatch(/^5h /));
    fail = true;
    vi.advanceTimersByTime(60_000);
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(footer.render(80)[0]).toMatch(/^5h ●●●○○○○○ 42%/);
  });

  it("follows the active provider when the model changes", async () => {
    const { mount, calls, ctx, emit } = await usageFooter({
      segments: [{ segment: "usage" }],
      model: { provider: "ollama", id: "llama" },
    });
    const footer = mount();
    expect(calls).toEqual([]);
    ctx.model = CLAUDE_ACP;
    await emit("model_select", { model: CLAUDE_ACP, source: "set" }, ctx);
    await vi.waitFor(() => expect(footer.render(80)[0]).toMatch(/^5h /));
    expect(calls).toHaveLength(1);
  });

  it("shows a fixed provider while another provider is active", async () => {
    const { mount } = await usageFooter({
      segments: [{ segment: "usage", provider: "claude-acp" }],
      model: { provider: "ollama", id: "llama" },
    });
    const footer = mount();
    await vi.waitFor(() => expect(footer.render(80)[0]).toMatch(/^5h /));
  });
});

describe("rate limit of the quota endpoint", () => {
  async function limited(retryAfter: string | undefined) {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const clock = { now: 0 };
    let limit = true;
    const home = tempHome();
    writeConfig(home, { lines: [{ left: [{ segment: "usage" }] }] });
    writeJson(home, ".claude/.credentials.json", { claudeAiOauth: { accessToken: OAUTH } });
    const headers = retryAfter === undefined ? undefined : { "Retry-After": retryAfter };
    const fake = fakeFetch({
      [USAGE_URL]: () => (limit ? new Response("slow down", { status: 429, headers }) : BODY),
    });
    const booted = await boot({ home, fetch: fake.fetch, model: CLAUDE_ACP, now: () => clock.now });
    await vi.waitFor(() => expect(fake.calls).toHaveLength(1));
    const tick = async (ms: number) => {
      clock.now += ms;
      vi.advanceTimersByTime(ms);
      await new Promise((resolve) => setTimeout(resolve, 10));
    };
    return { ...booted, calls: fake.calls, tick, unlimit: () => (limit = false) };
  }

  it("waits for Retry-After before it asks again", async () => {
    const { calls, tick, unlimit, mount } = await limited("150");
    await tick(60_000);
    await tick(60_000);
    expect(calls).toHaveLength(1);
    unlimit();
    await tick(60_000);
    expect(calls).toHaveLength(2);
    await vi.waitFor(() => expect(mount().render(80)[0]).toMatch(/^5h /));
  });

  it("waits 5 minutes when the server gives no Retry-After", async () => {
    const { calls, tick } = await limited(undefined);
    for (let minute = 1; minute < 5; minute++) await tick(60_000);
    expect(calls).toHaveLength(1);
    await tick(60_000);
    expect(calls).toHaveLength(2);
  });

  it("sends a User-Agent that names the extension", async () => {
    const { calls } = await limited("1");
    expect(calls[0]?.headers["User-Agent"]).toMatch(/^pi-statusline\/\d+\.\d+\.\d+$/);
  });
});
