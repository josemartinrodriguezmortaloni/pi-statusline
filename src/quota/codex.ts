import { join } from "node:path";
import { getJson, type Json, number, object, readJson, text } from "./json.ts";
import type { AdapterDeps, QuotaAdapter, QuotaWindow, QuotaWindowId } from "./types.ts";

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

/** The claim of the ChatGPT access token that holds the account id. */
const AUTH_CLAIM = "https://api.openai.com/auth";

/** Codex reports each window by its length, not by its name. */
const WINDOW_BY_SECONDS: Record<number, QuotaWindowId> = { 18000: "5h", 604800: "7d" };

interface Login {
  token: string;
  accountId: string;
}

const windowId = (json: Json): QuotaWindowId | undefined =>
  WINDOW_BY_SECONDS[number(json.limit_window_seconds) ?? 0];

/** `reset_at` is in epoch seconds. */
function epochMs(value: unknown): number | undefined {
  const seconds = number(value);
  return seconds === undefined ? undefined : seconds * 1000;
}

function window(value: unknown): QuotaWindow[] {
  const json = object(value);
  const id = windowId(json);
  const usedPercent = number(json.used_percent);
  if (!id || usedPercent === undefined) return [];
  return [{ id, usedPercent, resetsAt: epochMs(json.reset_at) }];
}

/** No body means a rejected credential: no windows, so the segment hides. */
export function parseCodex(body: Json | undefined): QuotaWindow[] {
  if (!body) return [];
  const limits = object(body.rate_limit);
  return [...window(limits.primary_window), ...window(limits.secondary_window)];
}

function jwtPayload(token: string): Json {
  try {
    return object(JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")));
  } catch {
    return {};
  }
}

function login(token: string | undefined, accountId: string | undefined): Login[] {
  return token && accountId ? [{ token, accountId }] : [];
}

async function piLogin(deps: AdapterDeps): Promise<Login[]> {
  const token = (await deps.registry.getProviderAuth("openai-codex"))?.auth.apiKey;
  return login(token, text(object(jwtPayload(token ?? "")[AUTH_CLAIM]).chatgpt_account_id));
}

/** The login of the Codex CLI, when pi has none. */
async function codexCliLogin(deps: AdapterDeps): Promise<Login[]> {
  const tokens = object((await readJson(join(deps.home, ".codex", "auth.json"))).tokens);
  return login(text(tokens.access_token), text(tokens.account_id));
}

async function findLogin(deps: AdapterDeps): Promise<Login | undefined> {
  const [pi] = await piLogin(deps);
  return pi ?? (await codexCliLogin(deps))[0];
}

export function codexAdapter(deps: AdapterDeps): QuotaAdapter {
  return {
    providers: ["openai-codex"],
    fetch: async (_provider, signal) => {
      const found = await findLogin(deps);
      if (!found) return [];
      const headers = { Authorization: `Bearer ${found.token}`, "ChatGPT-Account-Id": found.accountId };
      return parseCodex(await getJson(deps.fetch, USAGE_URL, headers, signal));
    },
  };
}
