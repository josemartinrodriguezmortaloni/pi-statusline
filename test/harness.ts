import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerStatusline } from "../src/index.ts";

type Handler = (event: unknown, ctx: unknown) => unknown;
type FooterFactory = (tui: unknown, theme: unknown, footerData: unknown) => FooterComponent;

export interface FooterComponent {
  render(width: number): string[];
  dispose?(): void;
}

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}

/** A theme whose `fg` is the identity, so lines compare as plain text. */
export const plainTheme = { fg: (_color: string, text: string) => text, bold: (text: string) => text };

/** A theme that tags each painted run with its token, so tests can see which color applies. */
export const taggedTheme = {
  fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
  bold: (text: string) => text,
};

export function assistantEntry(usage: Usage) {
  const { cost, ...tokens } = usage;
  return {
    type: "message",
    message: { role: "assistant", usage: { ...tokens, cost: { total: cost } } },
  };
}

export function fakePi() {
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<
    string,
    { description?: string; handler: Handler; getArgumentCompletions?: Handler }
  >();
  const tools = new Map<string, { execute: (...args: unknown[]) => Promise<unknown> }>();
  const sent: string[] = [];
  const settings: Record<string, unknown> = {};
  const pi = {
    on: (event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return () => {};
    },
    registerCommand: (name: string, options: never) => commands.set(name, options),
    registerTool: (tool: { name: string; execute: never }) => tools.set(tool.name, tool),
    sendUserMessage: (content: string) => sent.push(content),
    getSettings: () => settings,
  } as unknown as ExtensionAPI;
  const emit = async (event: string, payload: object, ctx: unknown) => {
    for (const handler of handlers.get(event) ?? []) await handler({ type: event, ...payload }, ctx);
  };
  return { pi, emit, commands, tools, sent, settings };
}

export function fakeFooterData(branch: string | null = "main", statuses: Record<string, string> = {}) {
  const listeners: (() => void)[] = [];
  const data = {
    branch,
    statuses: new Map(Object.entries(statuses)),
    getGitBranch: () => data.branch,
    getExtensionStatuses: () => data.statuses,
    getAvailableProviderCount: () => 2,
    onBranchChange: (callback: () => void) => {
      listeners.push(callback);
      return () => listeners.splice(listeners.indexOf(callback), 1);
    },
    switchBranch(next: string) {
      data.branch = next;
      for (const listener of [...listeners]) listener();
    },
  };
  return data;
}

export interface CtxOptions {
  cwd: string;
  entries: object[];
  sessionName?: string;
  model?: { provider: string; id: string; reasoning?: boolean; contextWindow?: number };
  thinkingLevel?: string;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null };
  oauth?: boolean;
  startedAt?: string;
}

export function fakeCtx(options: CtxOptions) {
  const notified: { message: string; type?: string }[] = [];
  const footers: (FooterFactory | undefined)[] = [];
  const counters = { getEntries: 0 };
  const ctx = {
    cwd: options.cwd,
    mode: "tui",
    hasUI: true,
    model: options.model,
    thinkingLevel: options.thinkingLevel,
    ui: {
      notify: (message: string, type?: string) => notified.push({ message, type }),
      setFooter: (factory: FooterFactory | undefined) => footers.push(factory),
      setStatus: () => {},
    },
    sessionManager: {
      getCwd: () => options.cwd,
      getSessionId: () => "session-1",
      getSessionName: () => options.sessionName,
      getLeafId: () => `leaf-${options.entries.length}`,
      getHeader: () => ({ type: "session", id: "session-1", cwd: options.cwd, timestamp: options.startedAt }),
      getEntries: () => {
        counters.getEntries++;
        return [...options.entries];
      },
    },
    modelRegistry: { isUsingOAuth: () => options.oauth ?? false },
    getContextUsage: () => options.contextUsage,
  };
  return { ctx, notified, footers, counters };
}

export function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "pi-statusline-"));
  mkdirSync(join(home, ".pi", "agent"), { recursive: true });
  return home;
}

export function writeConfig(home: string, config: unknown): void {
  writeFileSync(join(home, ".pi", "agent", "statusline.json"), JSON.stringify(config, null, 2));
}

export interface BootOptions extends Partial<CtxOptions> {
  home?: string;
  now?: () => number;
  fetch?: typeof fetch;
}

/** Registers the extension, starts a session and mounts the footer it sets. */
export async function boot(options: BootOptions = {}) {
  const home = options.home ?? tempHome();
  const fake = fakePi();
  const fetchFake = options.fetch ?? (async () => new Response("{}", { status: 404 }));
  registerStatusline(fake.pi, { home, fetch: fetchFake, now: options.now ?? (() => 0) });
  const session = fakeCtx({ cwd: join(home, "proj"), entries: [], ...options });
  await fake.emit("session_start", { reason: "startup" }, session.ctx);
  const tui = { renders: 0, requestRender: () => tui.renders++ };
  const footerData = fakeFooterData();
  const mount = (theme: object = plainTheme) => {
    const factory = session.footers.at(-1);
    if (!factory) throw new Error("no footer set");
    return factory(tui, theme, footerData);
  };
  return { ...fake, ...session, home, tui, footerData, mount };
}
