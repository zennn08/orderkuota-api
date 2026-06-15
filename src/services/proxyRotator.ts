/**
 * Round-robin proxy pool with passive health tracking, ported from the
 * `proxyrotator` package in wbs-wa-go.
 *
 * Configuration is via the PROXY_URL environment variable, which may hold
 * one URL or many comma-separated URLs:
 *
 *   PROXY_URL=http://a:8080
 *   PROXY_URL=http://user:pass@a:8080,http://b:8080,http://c:8080
 *
 * When PROXY_URL is unset or yields no valid entries, getDefaultPool()
 * returns null and callers make direct connections.
 */

/** Duration a proxy is skipped after a single transport-level failure. */
const BAD_COOLDOWN_MS = 60_000;

/** Strip credentials from a proxy URL for safe logging. */
function redact(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.username || u.password) {
      u.username = '';
      u.password = '';
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/**
 * Pool tracks N proxies, a round-robin cursor, and per-proxy cooldown.
 * JavaScript is single-threaded, so no locking/atomics are needed.
 */
export class ProxyPool {
  private readonly proxies: string[];
  private cursor = 0;
  private readonly badUntil: number[];
  private readonly now: () => number;

  private constructor(proxies: string[], now: () => number) {
    this.proxies = proxies;
    this.badUntil = new Array<number>(proxies.length).fill(0);
    this.now = now;
  }

  /**
   * Build a Pool from explicit URL strings. Whitespace is trimmed, empty
   * entries are skipped, and entries that fail to parse (or lack a
   * scheme/host) are dropped with a warning. Returns null if the
   * resulting list is empty — the canonical "no proxy configured" value.
   */
  static create(raw: string[], now: () => number = Date.now): ProxyPool | null {
    const proxies: string[] = [];
    for (const entry of raw) {
      const s = entry.trim();
      if (s === '') continue;
      let u: URL;
      try {
        u = new URL(s);
      } catch {
        console.warn(`[proxyRotator] dropping invalid proxy URL ${JSON.stringify(s)}`);
        continue;
      }
      if (!u.protocol || !u.host) {
        console.warn(
          `[proxyRotator] dropping invalid proxy URL ${JSON.stringify(s)}: missing scheme or host`,
        );
        continue;
      }
      proxies.push(s);
    }
    if (proxies.length === 0) return null;
    return new ProxyPool(proxies, now);
  }

  /** Number of proxies in the pool. */
  size(): number {
    return this.proxies.length;
  }

  /**
   * Return the next healthy proxy in round-robin order, or null when every
   * proxy is currently in cooldown.
   */
  next(): string | null {
    const n = this.proxies.length;
    for (let i = 0; i < n; i++) {
      const idx = this.cursor % n;
      this.cursor++;
      if (this.now() >= this.badUntil[idx]!) {
        return this.proxies[idx]!;
      }
    }
    return null;
  }

  /**
   * Record a transport-level failure for the given proxy. The proxy is
   * skipped by next() until the cooldown elapses. Unknown URLs (not in the
   * pool) are silently ignored.
   */
  markBad(url: string): void {
    const idx = this.proxies.indexOf(url);
    if (idx < 0) return;
    this.badUntil[idx] = this.now() + BAD_COOLDOWN_MS;
    console.warn(`[proxyRotator] marking ${redact(url)} bad for ${BAD_COOLDOWN_MS}ms`);
  }
}

/**
 * Build a Pool from PROXY_URL (comma-separated). Returns null when
 * PROXY_URL is unset or contains no valid entries.
 */
export function poolFromEnv(env: Record<string, string | undefined> = Bun.env): ProxyPool | null {
  const raw = env.PROXY_URL;
  if (!raw) return null;
  return ProxyPool.create(raw.split(','));
}

// Process-wide singleton: undefined = not yet initialised, null = no pool.
let defaultPool: ProxyPool | null | undefined;

/**
 * Return the process-wide pool, initialised from PROXY_URL on first call.
 * Sharing one pool keeps the round-robin cursor and health state global.
 */
export function getDefaultPool(): ProxyPool | null {
  if (defaultPool === undefined) {
    defaultPool = poolFromEnv();
    if (defaultPool) {
      console.log(`[proxyRotator] loaded ${defaultPool.size()} proxies from PROXY_URL`);
    }
  }
  return defaultPool;
}

/** Test helper: reset the cached singleton so it re-reads PROXY_URL. */
export function resetDefaultPool(): void {
  defaultPool = undefined;
}
