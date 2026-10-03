import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { boot, fakeFetch, tempHome, writeConfig, writeJson } from "./harness.ts";

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const BODY = JSON.parse(readFileSync(new URL("./fixtures/codex-usage.json", import.meta.url), "utf8"));
const CODEX = { provider: "openai-codex", id: "gpt-5" };
const SHOWN = "5h ●●●●●○○○ 63% ⟳ 04:00 p. m. 7d ●○○○○○○○ 12% ⟳ 7 oct, 12:00 p. m.";

/** A ChatGPT access token: a JWT whose auth claim carries the account id. */
function accessToken(accountId: string): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none" })}.${part({ "https://api.openai.com/auth": { chatgpt_account_id: accountId } })}.sig`;
}

async function codexFooter(options: { providerAuth?: Record<string, string>; cliLogin?: boolean }) {
  const home = tempHome();
  writeConfig(home, {
    lines: [
      {
        left: [
          { segment: "usage", provider: "openai-codex" },
          { segment: "usage", provider: "openai-codex", window: "7d" },
          { segment: "cwd" },
        ],
      },
    ],
  });
  if (options.cliLogin) {
    writeJson(home, ".codex/auth.json", { tokens: { access_token: "cli-token", account_id: "acct-cli" } });
  }
  const fake = fakeFetch({ [USAGE_URL]: () => BODY });
  const booted = await boot({ home, fetch: fake.fetch, model: CODEX, providerAuth: options.providerAuth });
  return { footer: booted.mount(), calls: fake.calls };
}

describe("usage with the OpenAI Codex adapter", () => {
  it("shows both windows, resolved by their length, with the pi login", async () => {
    const token = accessToken("acct-pi");
    const { footer, calls } = await codexFooter({ providerAuth: { "openai-codex": token }, cliLogin: true });
    await vi.waitFor(() => expect(footer.render(100)).toEqual([`${SHOWN} ~/proj`]));
    expect(calls).toEqual([
      {
        url: USAGE_URL,
        headers: {
          Accept: "application/json",
          "User-Agent": "pi-statusline/0.1.0",
          Authorization: `Bearer ${token}`,
          "ChatGPT-Account-Id": "acct-pi",
        },
      },
    ]);
  });

  it("falls back to the Codex CLI login when pi has none", async () => {
    const { footer, calls } = await codexFooter({ cliLogin: true });
    await vi.waitFor(() => expect(footer.render(100)).toEqual([`${SHOWN} ~/proj`]));
    expect(calls[0]?.headers).toMatchObject({
      Authorization: "Bearer cli-token",
      "ChatGPT-Account-Id": "acct-cli",
    });
  });

  it("is hidden without a request when there is no login", async () => {
    const { footer, calls } = await codexFooter({});
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(footer.render(100)).toEqual(["~/proj"]);
    expect(calls).toEqual([]);
  });
});
