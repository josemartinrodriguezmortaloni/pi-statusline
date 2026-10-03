import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const USER_AGENT = `pi-statusline/${createRequire(import.meta.url)("../../package.json").version}`;

export type Json = Record<string, unknown>;

export const object = (value: unknown): Json => Object(value) as Json;

export const number = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

export const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** Epoch ms of an ISO date string, or nothing when the value is not one. */
export function isoTime(value: unknown): number | undefined {
  const time = Date.parse(text(value) ?? "");
  return Number.isNaN(time) ? undefined : time;
}

/** A JSON file that is missing or broken reads as an empty object. */
export async function readJson(path: string): Promise<Json> {
  try {
    return object(JSON.parse(await readFile(path, "utf8")));
  } catch {
    return {};
  }
}

/** The server refused the credential: it expired or was revoked. */
const REJECTED = new Set([401, 403]);

/** Without Retry-After, wait 5 minutes; never more than an hour. Claude Code backs off the same way. */
const DEFAULT_BACKOFF_MS = 300_000;
const MAX_BACKOFF_MS = 3_600_000;

/** The server asks the client to wait before the next request. */
export class RateLimited extends Error {
  constructor(readonly retryAfterMs: number) {
    super(`rate limited for ${Math.round(retryAfterMs / 1000)} s`);
  }
}

/** Retry-After is either seconds or an HTTP date. */
function delayOf(header: string | null): number {
  if (!header) return Number.NaN;
  const seconds = Number(header);
  return Number.isNaN(seconds) ? Date.parse(header) - Date.now() : seconds * 1000;
}

function backoffMs(header: string | null): number {
  const delay = delayOf(header);
  return delay > 0 ? Math.min(delay, MAX_BACKOFF_MS) : DEFAULT_BACKOFF_MS;
}

function failure(response: Response, url: string): Error {
  if (response.status === 429) return new RateLimited(backoffMs(response.headers.get("Retry-After")));
  return new Error(`${url}: HTTP ${response.status}`);
}

/**
 * GETs JSON. Resolves nothing when the server rejects the credential. Rejects on any other failure,
 * which is transient; a 429 rejects with `RateLimited`.
 */
export async function getJson(
  fetcher: typeof fetch,
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Json | undefined> {
  const response = await fetcher(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...headers },
    signal,
  });
  if (REJECTED.has(response.status)) return undefined;
  if (!response.ok) throw failure(response, url);
  return object(await response.json());
}
