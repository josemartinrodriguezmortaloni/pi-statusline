import { type FSWatcher, mkdirSync, readFileSync, renameSync, watch, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { PRESET } from "./preset.ts";
import { type Issue, type Result, validate } from "./schema.ts";
import type { Config } from "./types.ts";

export type ChangeListener = (config: Config, issues: readonly Issue[]) => void;

export interface ConfigStore {
  current(): Config;
  /** Validates the config and, only when it is valid, writes it atomically. */
  apply(raw: unknown): Result<Config>;
  /** Called after each reload. Issues mean the file is invalid and the last valid config stays. */
  onChange(listener: ChangeListener): () => void;
  dispose(): void;
}

export function configPath(home: string): string {
  return join(home, ".pi", "agent", "statusline.json");
}

function readText(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

function parseJson(text: string): Result<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, issues: [{ path: "", message: `invalid JSON: ${(error as Error).message}` }] };
  }
}

/** No file means the preset. */
function parse(text: string | undefined): Result<Config> {
  if (text === undefined) return { ok: true, value: PRESET };
  const json = parseJson(text);
  return json.ok ? validate(json.value) : json;
}

/** Writes a sibling temporary file and renames it, so a reader never sees half a file. */
function writeAtomic(path: string, text: string): void {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, text);
  renameSync(temporary, path);
}

/**
 * Opens the config file and watches its directory, because an atomic write replaces the file.
 * An invalid file at open falls back to the preset; the returned issues say why.
 */
export function openConfigStore(path: string): { store: ConfigStore; issues: readonly Issue[] } {
  mkdirSync(dirname(path), { recursive: true });
  const listeners = new Set<ChangeListener>();
  let text = readText(path);
  const opened = parse(text);
  let config = opened.ok ? opened.value : PRESET;

  const commit = (next: Config, issues: readonly Issue[]) => {
    config = next;
    for (const listener of listeners) listener(config, issues);
  };
  const settle = (result: Result<Config>) =>
    result.ok ? commit(result.value, []) : commit(config, result.issues);
  const reload = () => {
    const next = readText(path);
    if (next === text) return;
    text = next;
    settle(parse(text));
  };
  const watcher: FSWatcher = watch(dirname(path), (_event, file) => file === basename(path) && reload());
  watcher.on("error", () => watcher.close());

  const store: ConfigStore = {
    current: () => config,
    apply: (raw) => {
      const result = validate(raw);
      if (!result.ok) return result;
      text = `${JSON.stringify(result.value, null, 2)}\n`;
      writeAtomic(path, text);
      commit(result.value, []);
      return result;
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      watcher.close();
      listeners.clear();
    },
  };
  return { store, issues: opened.ok ? [] : opened.issues };
}
