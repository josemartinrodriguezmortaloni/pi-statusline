import type { QuotaAdapter, QuotaWindow, QuotaWindowId } from "./types.ts";

export interface QuotaMonitor {
  /** Polls these providers from now on, the new ones at once. Providers without an adapter are ignored. */
  watch(providers: ReadonlySet<string>): void;
  get(provider: string, window: QuotaWindowId): QuotaWindow | undefined;
  /** Called after each successful fetch. */
  onUpdate(listener: () => void): () => void;
  dispose(): void;
}

const REFRESH_MS = 60_000;
const TIMEOUT_MS = 10_000;

function byProvider(adapters: readonly QuotaAdapter[]): ReadonlyMap<string, QuotaAdapter> {
  return new Map(
    adapters.flatMap((adapter) => adapter.providers.map((provider) => [provider, adapter] as const)),
  );
}

/**
 * Polls only the watched providers. A failed fetch keeps the last windows, so the render never sees
 * the error.
 */
export function createQuotaMonitor(adapters: readonly QuotaAdapter[]): QuotaMonitor {
  const adapterOf = byProvider(adapters);
  const windows = new Map<string, QuotaWindow[]>();
  const inFlight = new Set<string>();
  const listeners = new Set<() => void>();
  const stop = new AbortController();
  let watched = new Set<string>();

  const store = (provider: string, fetched: QuotaWindow[]) => {
    windows.set(provider, fetched);
    for (const listener of listeners) listener();
  };
  const poll = (provider: string) => {
    if (inFlight.has(provider)) return;
    inFlight.add(provider);
    const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(TIMEOUT_MS)]);
    (adapterOf.get(provider) as QuotaAdapter)
      .fetch(provider, signal)
      .then(
        (fetched) => store(provider, fetched),
        () => {},
      )
      .finally(() => inFlight.delete(provider));
  };
  const timer = setInterval(() => watched.forEach(poll), REFRESH_MS);

  return {
    watch: (providers) => {
      const next = new Set([...providers].filter((provider) => adapterOf.has(provider)));
      const added = [...next].filter((provider) => !watched.has(provider));
      watched = next;
      added.forEach(poll);
    },
    get: (provider, id) => windows.get(provider)?.find((window) => window.id === id),
    onUpdate: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      clearInterval(timer);
      stop.abort();
      listeners.clear();
    },
  };
}
