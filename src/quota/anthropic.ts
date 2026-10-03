import { join } from "node:path";
import { getJson, isoTime, type Json, number, object, readJson, text } from "./json.ts";
import type { AdapterDeps, QuotaAdapter, QuotaWindow, QuotaWindowId } from "./types.ts";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";

/** Only subscription logins have a quota; an API key pays per token. */
const OAUTH_PREFIX = "sk-ant-oat";

function window(id: QuotaWindowId, value: unknown): QuotaWindow[] {
  const json = object(value);
  const usedPercent = number(json.utilization);
  if (usedPercent === undefined) return [];
  return [{ id, usedPercent, resetsAt: isoTime(json.resets_at) }];
}

/** Extra usage reports its credits in cents. */
const dollars = (cents: unknown) => (number(cents) ?? 0) / 100;

function extra(value: unknown): QuotaWindow[] {
  const json = object(value);
  if (json.is_enabled !== true) return [];
  const spent = { used: dollars(json.used_credits), limit: dollars(json.monthly_limit) };
  return [{ id: "extra", usedPercent: number(json.utilization) ?? 0, spent }];
}

export function parseAnthropic(body: Json): QuotaWindow[] {
  return [...window("5h", body.five_hour), ...window("7d", body.seven_day), ...extra(body.extra_usage)];
}

/** `claude-acp` bills the login of the `claude` binary; `anthropic` bills the pi login. */
async function token(provider: string, deps: AdapterDeps): Promise<string | undefined> {
  if (provider === "claude-acp") {
    const credentials = await readJson(join(deps.home, ".claude", ".credentials.json"));
    return text(object(credentials.claudeAiOauth).accessToken);
  }
  return (await deps.registry.getProviderAuth(provider))?.auth.apiKey;
}

export function anthropicAdapter(deps: AdapterDeps): QuotaAdapter {
  return {
    providers: ["anthropic", "claude-acp"],
    fetch: async (provider, signal) => {
      const oauth = await token(provider, deps);
      if (!oauth?.startsWith(OAUTH_PREFIX)) return [];
      const headers = { Authorization: `Bearer ${oauth}`, "anthropic-beta": "oauth-2025-04-20" };
      return parseAnthropic(await getJson(deps.fetch, USAGE_URL, headers, signal));
    },
  };
}
