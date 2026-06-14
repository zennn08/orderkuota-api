import type { MiddlewareHandler } from 'hono';

/** Reject requests whose X-API-Key header does not match the configured key. */
export function apiKeyGuard(expectedKey: string): MiddlewareHandler {
  return async (c, next) => {
    const provided = c.req.header('X-API-Key');
    if (provided !== expectedKey) {
      return c.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-API-Key' } },
        401,
      );
    }
    await next();
  };
}
