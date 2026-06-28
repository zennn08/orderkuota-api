/**
 * Matching OrderKuota QRIS mutations to our pending transactions.
 *
 * A mutation must be tied to a *specific* transaction, otherwise a single
 * incoming payment can mark several same-amount transactions as paid, and a
 * stale historical payment can mark a freshly-created transaction as paid once
 * its suffix is reused. We guard against both by (a) only accepting mutations
 * at/after the transaction's creation time and (b) refusing mutations whose id
 * was already claimed by another transaction.
 */

/** Seconds of leeway for clock skew between OrderKuota and us. */
const DEFAULT_GRACE_SECONDS = 300;

/** WIB is UTC+7; OrderKuota timestamps are wall-clock in this zone. */
const WIB_OFFSET_SECONDS = 7 * 3600;

/** Parse a `kredit`/`debet` string ("35.002") to an integer (35002). */
export function parseKredit(value: unknown): number {
  const digits = String(value ?? '').replace(/\./g, '');
  return parseInt(digits, 10) || 0;
}

/**
 * Parse an OrderKuota `tanggal` ("DD/MM/YYYY HH:mm:ss", WIB) to epoch seconds.
 * Returns null when the input does not match that shape.
 */
export function parseOkDate(value: unknown): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(
    String(value ?? '').trim(),
  );
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min, ss] = m;
  const utcMs = Date.UTC(+yyyy!, +mm! - 1, +dd!, +hh!, +min!, +ss!);
  if (Number.isNaN(utcMs)) return null;
  return utcMs / 1000 - WIB_OFFSET_SECONDS;
}

export interface OkMutation {
  id?: unknown;
  kredit?: unknown;
  status?: unknown;
  tanggal?: unknown;
}

export interface MatchedMutation {
  id: number;
}

export interface FindOptions {
  finalAmount: number;
  createdAt: number;
  claimedIds: Set<number>;
  graceSeconds?: number;
}

/**
 * Return the first incoming mutation that pays `finalAmount`, is not older than
 * the transaction (minus grace), and has not already been claimed — or null.
 */
export function findUnclaimedPayment(
  history: OkMutation[],
  opts: FindOptions,
): MatchedMutation | null {
  const grace = opts.graceSeconds ?? DEFAULT_GRACE_SECONDS;
  for (const h of history) {
    if (h.status !== 'IN') continue;
    if (parseKredit(h.kredit) !== opts.finalAmount) continue;

    const id = Number(h.id);
    if (!Number.isFinite(id)) continue;
    if (opts.claimedIds.has(id)) continue;

    const at = parseOkDate(h.tanggal);
    // Unparseable timestamps fall back to claim-only protection.
    if (at !== null && at < opts.createdAt - grace) continue;

    return { id };
  }
  return null;
}
