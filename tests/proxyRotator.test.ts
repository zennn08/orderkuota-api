import { describe, expect, test } from 'bun:test';

import { ProxyPool, poolFromEnv } from '../src/services/proxyRotator.ts';

const P0 = 'http://p0:8080';
const P1 = 'http://p1:8080';
const P2 = 'http://p2:8080';

describe('ProxyPool.create', () => {
  test('parses comma-separated entries, trimming whitespace', () => {
    const pool = ProxyPool.create([` ${P0} `, P1, P2]);
    expect(pool?.size()).toBe(3);
  });

  test('drops empty entries (e.g. trailing comma)', () => {
    const pool = ProxyPool.create([P0, '', '  ', P1]);
    expect(pool?.size()).toBe(2);
  });

  test('drops invalid URLs but keeps valid ones', () => {
    const pool = ProxyPool.create([P0, 'not a url', 'missing-scheme:8080', P1]);
    expect(pool?.size()).toBe(2);
  });

  test('returns null when no valid entries remain', () => {
    expect(ProxyPool.create([])).toBeNull();
    expect(ProxyPool.create(['', '  '])).toBeNull();
  });
});

describe('ProxyPool.next', () => {
  test('cycles through proxies in round-robin order', () => {
    const pool = ProxyPool.create([P0, P1, P2])!;
    const seen = Array.from({ length: 9 }, () => pool.next());
    expect(seen).toEqual([P0, P1, P2, P0, P1, P2, P0, P1, P2]);
  });

  test('skips a proxy that has been marked bad', () => {
    const pool = ProxyPool.create([P0, P1, P2])!;
    pool.markBad(P1);
    const seen = Array.from({ length: 4 }, () => pool.next());
    expect(seen).toEqual([P0, P2, P0, P2]);
  });

  test('returns the proxy to rotation after the cooldown elapses', () => {
    let clock = 1_000_000;
    const pool = ProxyPool.create([P0, P1], () => clock)!;
    pool.markBad(P1);
    expect(pool.next()).toBe(P0);
    expect(pool.next()).toBe(P0); // P1 still in cooldown
    clock += 61_000; // advance past the 60s cooldown
    const seen = new Set([pool.next(), pool.next()]);
    expect(seen).toEqual(new Set([P0, P1]));
  });

  test('returns null when every proxy is in cooldown', () => {
    const pool = ProxyPool.create([P0, P1])!;
    pool.markBad(P0);
    pool.markBad(P1);
    expect(pool.next()).toBeNull();
  });

  test('ignores markBad for an unknown URL', () => {
    const pool = ProxyPool.create([P0, P1])!;
    pool.markBad('http://not-in-pool:8080');
    const seen = Array.from({ length: 2 }, () => pool.next());
    expect(seen).toEqual([P0, P1]);
  });
});

describe('poolFromEnv', () => {
  test('returns null when PROXY_URL is unset', () => {
    expect(poolFromEnv({})).toBeNull();
  });

  test('builds a pool from a comma-separated PROXY_URL', () => {
    const pool = poolFromEnv({ PROXY_URL: `${P0},${P1}` });
    expect(pool?.size()).toBe(2);
  });
});
