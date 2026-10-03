import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, type TestContext } from "vitest";
import { createAdapters, type QuotaAdapter, RateLimited } from "../src/quota/index.ts";

/**
 * Calls the real quota endpoints with the logins of this machine, outside the test seam: the seam
 * reads credentials from the same home as the config, and a smoke run must not touch the real config.
 * Each case skips when its login file is missing.
 */
const HOME = homedir();
const ADAPTERS = createAdapters({
  fetch: globalThis.fetch,
  home: HOME,
  registry: { getProviderAuth: async () => undefined },
});

const adapterOf = (provider: string) =>
  ADAPTERS.find((adapter) => adapter.providers.includes(provider)) as QuotaAdapter;

/** A 429 says nothing about the request shape, so the case skips with the wait the server asked for. */
async function windowsOf(provider: string, context: TestContext) {
  try {
    const windows = await adapterOf(provider).fetch(provider, AbortSignal.timeout(15_000));
    return Object.fromEntries(windows.map((window) => [window.id, window]));
  } catch (error) {
    if (error instanceof RateLimited) context.skip(`${provider}: ${error.message}`);
    throw error;
  }
}

describe("real quota endpoints", () => {
  it.skipIf(!existsSync(join(HOME, ".claude", ".credentials.json")))(
    "reads the claude-acp quota",
    async (context) => {
      const windows = await windowsOf("claude-acp", context);
      expect(windows["5h"]?.usedPercent).toBeTypeOf("number");
      expect(windows["7d"]?.resetsAt).toBeTypeOf("number");
    },
  );

  it.skipIf(!existsSync(join(HOME, ".codex", "auth.json")))(
    "reads the openai-codex quota",
    async (context) => {
      const windows = await windowsOf("openai-codex", context);
      expect(windows["5h"]?.usedPercent).toBeTypeOf("number");
      expect(windows["7d"]?.resetsAt).toBeTypeOf("number");
    },
  );
});
