import { mkdirSync, readFileSync, realpathSync, renameSync, watch, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { PRESET } from "./preset.ts";
import { type Issue, type Result, validate } from "./schema.ts";
import type { Config } from "./types.ts";

export type ChangeListener = (config: Config, issues: readonly Issue[]) => void;

export interface ConfigStore {
  current(): Config;
  /** What fails in the file on disk now. Empty while the file is valid or missing. */
  issues(): readonly Issue[];
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

/** The file behind a symlink, so a write keeps the link and the watch sees edits of the target. */
function realTarget(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * Watches the directory, because an atomic write replaces the file. Without a watcher, for example
 * at the inotify limit, the statusline still works and only hot reload stops.
 */
function watchFile(path: string, onChange: () => void): () => void {
  try {
    const watcher = watch(dirname(path), (_event, file) => file === basename(path) && onChange());
    watcher.on("error", () => watcher.close());
    return () => watcher.close();
  } catch {
    return () => {};
  }
}

/** An editor that truncates and then writes fires several events; only the last one reloads. */
const SETTLE_MS = 50;

/** Opens the config file. An invalid file at open falls back to the preset; `issues` says why. */
export function openConfigStore(path: string): { store: ConfigStore; issues: readonly Issue[] } {
  const target = realTarget(path);
  mkdirSync(dirname(target), { recursive: true });
  const listeners = new Set<ChangeListener>();
  let text = readText(target);
  const opened = parse(text);
  let config = opened.ok ? opened.value : PRESET;
  let issues: readonly Issue[] = opened.ok ? [] : opened.issues;

  const commit = (next: Config, found: readonly Issue[]) => {
    config = next;
    issues = found;
    for (const listener of listeners) listener(config, issues);
  };
  const settle = (result: Result<Config>) =>
    result.ok ? commit(result.value, []) : commit(config, result.issues);
  const reload = () => {
    const next = readText(target);
    if (next === text) return;
    text = next;
    settle(parse(text));
  };
  let pending: NodeJS.Timeout | undefined;
  const stopWatch = watchFile(target, () => {
    clearTimeout(pending);
    pending = setTimeout(reload, SETTLE_MS);
  });

  const store: ConfigStore = {
    current: () => config,
    issues: () => issues,
    apply: (raw) => {
      const result = validate(raw);
      if (!result.ok) return result;
      text = `${JSON.stringify(result.value, null, 2)}\n`;
      writeAtomic(target, text);
      commit(result.value, []);
      return result;
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      clearTimeout(pending);
      stopWatch();
      listeners.clear();
    },
  };
  return { store, issues };
}
