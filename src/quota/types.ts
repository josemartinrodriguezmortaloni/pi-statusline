export type QuotaWindowId = "5h" | "7d" | "extra";

export interface QuotaWindow {
  id: QuotaWindowId;
  /** Used share of the window, 0 to 100. */
  usedPercent: number;
  /** Epoch ms when the window resets. */
  resetsAt?: number;
  /** Credits of the `extra` window, in dollars. */
  spent?: { used: number; limit: number };
}

/** Reads the subscription quota of the providers it serves. */
export interface QuotaAdapter {
  providers: readonly string[];
  /** Resolves no windows when the provider has no credential. Rejects on a network or HTTP failure. */
  fetch(provider: string, signal: AbortSignal): Promise<QuotaWindow[]>;
}

/** The part of the pi model registry that resolves a provider credential. */
export interface ProviderAuth {
  getProviderAuth(provider: string): Promise<{ auth: { apiKey?: string } } | undefined>;
}

export interface AdapterDeps {
  fetch: typeof fetch;
  home: string;
  registry: ProviderAuth;
}
