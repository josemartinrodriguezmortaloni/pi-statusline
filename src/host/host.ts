import { isAbsolute, relative, sep } from "node:path";
import type { ExtensionContext, ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import type { Snapshot, Tokens } from "./snapshot.ts";
import { sumTokens } from "./tokens.ts";
import { createTurnClock } from "./turn.ts";

export interface HostSources {
  ctx: ExtensionContext;
  home: string;
  now: () => number;
  autoCompact: () => boolean;
  quota: Snapshot["quota"];
}

export interface Host {
  /** Reads pi now. `footerData` is absent where pi shows no footer, as in RPC mode. */
  snapshot(footerData?: ReadonlyFooterDataProvider): Snapshot;
  turnStarted(): void;
  turnEnded(): void;
}

type FooterFacts = Pick<Snapshot, "gitBranch" | "statuses">;

const NO_FOOTER: FooterFacts = { gitBranch: null, statuses: new Map() };

function footerFacts(footerData: ReadonlyFooterDataProvider | undefined): FooterFacts {
  if (!footerData) return NO_FOOTER;
  return { gitBranch: footerData.getGitBranch(), statuses: footerData.getExtensionStatuses() };
}

const escapesHome = (inside: string) => inside === ".." || inside.startsWith(`..${sep}`);
const isInsideHome = (inside: string) => !escapesHome(inside) && !isAbsolute(inside);

export function formatCwd(cwd: string, home: string): string {
  const inside = relative(home, cwd);
  if (!isInsideHome(inside)) return cwd;
  return inside === "" ? "~" : `~${sep}${inside}`;
}

const reasons = (ctx: ExtensionContext) => ctx.model?.reasoning === true;

function thinking(ctx: ExtensionContext): string | undefined {
  if (!reasons(ctx)) return undefined;
  return ctx.thinkingLevel ?? "off";
}

function model(ctx: ExtensionContext): Snapshot["model"] {
  return ctx.model && { provider: ctx.model.provider, id: ctx.model.id };
}

const headerTimestamp = (ctx: ExtensionContext) => ctx.sessionManager.getHeader()?.timestamp ?? "";

function sessionStartedAt(ctx: ExtensionContext): number | undefined {
  const started = Date.parse(headerTimestamp(ctx));
  return Number.isNaN(started) ? undefined : started;
}

function subscription(ctx: ExtensionContext): boolean {
  return ctx.model ? ctx.modelRegistry.isUsingOAuth(ctx.model) : false;
}

/**
 * Token totals scan every session entry and the footer renders on every frame. Entries are
 * append-only and every append moves the leaf, so the totals change only with the session or leaf.
 * The leaf therefore stands for the entry count, which the read-only session manager does not expose.
 */
function memoizedTokens(ctx: ExtensionContext): () => Tokens {
  let key: string | undefined;
  let tokens: Tokens | undefined;
  return () => {
    const { sessionManager } = ctx;
    const next = `${sessionManager.getSessionId()}:${sessionManager.getLeafId()}`;
    if (next !== key || !tokens) tokens = sumTokens(sessionManager.getEntries());
    key = next;
    return tokens;
  };
}

export function createHost(sources: HostSources): Host {
  const { ctx } = sources;
  const tokens = memoizedTokens(ctx);
  const turn = createTurnClock(sources.now);
  return {
    turnStarted: turn.start,
    turnEnded: turn.end,
    snapshot: (footerData) => ({
      cwd: formatCwd(ctx.sessionManager.getCwd(), sources.home),
      ...footerFacts(footerData),
      sessionName: ctx.sessionManager.getSessionName(),
      tokens: tokens(),
      subscription: subscription(ctx),
      context: ctx.getContextUsage(),
      autoCompact: sources.autoCompact(),
      model: model(ctx),
      thinking: thinking(ctx),
      sessionStartedAt: sessionStartedAt(ctx),
      turn: turn.current(),
      now: sources.now(),
      quota: sources.quota,
    }),
  };
}
