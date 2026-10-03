import { readFile } from "node:fs/promises";

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

/** GETs JSON and rejects on any status other than 2xx. */
export async function getJson(
  fetcher: typeof fetch,
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Json> {
  const response = await fetcher(url, { headers: { Accept: "application/json", ...headers }, signal });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return object(await response.json());
}
