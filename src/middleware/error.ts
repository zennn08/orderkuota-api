import type { Context } from 'hono';
import { ApiError } from '../types.ts';

/** Hono onError handler: map ApiError / unknown errors to the response envelope. */
export function onError(err: Error, c: Context): Response {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400,
    );
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
}
