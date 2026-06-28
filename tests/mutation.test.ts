import { test, expect, describe } from 'bun:test';
import { parseKredit, parseOkDate, findUnclaimedPayment } from '../src/services/mutation.ts';

describe('parseKredit', () => {
  test('strips thousand-separator dots', () => {
    expect(parseKredit('35.002')).toBe(35002);
    expect(parseKredit('1.001')).toBe(1001);
    expect(parseKredit('11')).toBe(11);
  });

  test('returns 0 for missing/garbage', () => {
    expect(parseKredit('')).toBe(0);
    expect(parseKredit(undefined)).toBe(0);
    expect(parseKredit(null)).toBe(0);
  });
});

describe('parseOkDate', () => {
  test('parses "DD/MM/YYYY HH:mm:ss" as WIB (UTC+7)', () => {
    // 25/06/2026 10:24:08 WIB == 2026-06-25T03:24:08Z
    const expected = Date.UTC(2026, 5, 25, 3, 24, 8) / 1000;
    expect(parseOkDate('25/06/2026 10:24:08')).toBe(expected);
  });

  test('returns null for unparseable input', () => {
    expect(parseOkDate('')).toBeNull();
    expect(parseOkDate('not a date')).toBeNull();
    expect(parseOkDate(undefined)).toBeNull();
  });
});

describe('findUnclaimedPayment', () => {
  // Three real-world look-alike mutations: same amount, status IN, close in time.
  const baseTime = Date.UTC(2026, 5, 25, 3, 0, 0) / 1000; // 10:00:00 WIB
  const history = [
    { id: 236848266, kredit: '1.001', status: 'IN', tanggal: '25/06/2026 10:26:23' },
    { id: 236847920, kredit: '1.001', status: 'IN', tanggal: '25/06/2026 10:24:22' },
    { id: 236847898, kredit: '1.001', status: 'IN', tanggal: '25/06/2026 10:24:08' },
    { id: 236847000, kredit: '1.001', status: 'OUT', tanggal: '25/06/2026 10:20:00' },
  ];

  test('matches an IN mutation by final amount', () => {
    const m = findUnclaimedPayment(history, {
      finalAmount: 1001,
      createdAt: baseTime,
      claimedIds: new Set(),
    });
    expect(m?.id).toBe(236848266);
  });

  test('ignores OUT mutations', () => {
    const m = findUnclaimedPayment(history, {
      finalAmount: 1001,
      createdAt: baseTime,
      claimedIds: new Set([236848266, 236847920, 236847898]),
    });
    expect(m).toBeNull();
  });

  test('skips already-claimed mutations and returns the next unclaimed one', () => {
    const m = findUnclaimedPayment(history, {
      finalAmount: 1001,
      createdAt: baseTime,
      claimedIds: new Set([236848266]),
    });
    expect(m?.id).toBe(236847920);
  });

  test('one payment claims exactly one transaction (no double-detection)', () => {
    // Two transactions, same final amount, both pending. Only ONE matching
    // mutation exists. The second check must NOT reuse the claimed mutation.
    const single = [
      { id: 999, kredit: '1.001', status: 'IN', tanggal: '25/06/2026 10:24:08' },
    ];
    const first = findUnclaimedPayment(single, {
      finalAmount: 1001,
      createdAt: baseTime,
      claimedIds: new Set(),
    });
    expect(first?.id).toBe(999);
    const second = findUnclaimedPayment(single, {
      finalAmount: 1001,
      createdAt: baseTime,
      claimedIds: new Set([999]),
    });
    expect(second).toBeNull();
  });

  test('rejects a mutation older than the transaction (beyond grace)', () => {
    const createdAfterPayment = Date.UTC(2026, 5, 25, 4, 0, 0) / 1000; // 11:00 WIB, after all
    const m = findUnclaimedPayment(history, {
      finalAmount: 1001,
      createdAt: createdAfterPayment,
      claimedIds: new Set(),
    });
    expect(m).toBeNull();
  });

  test('accepts a payment within the clock-skew grace window', () => {
    // created_at is 100s AFTER the payment timestamp — within default grace.
    const payEpoch = Date.UTC(2026, 5, 25, 3, 24, 8) / 1000;
    const m = findUnclaimedPayment(
      [{ id: 5, kredit: '1.001', status: 'IN', tanggal: '25/06/2026 10:24:08' }],
      { finalAmount: 1001, createdAt: payEpoch + 100, claimedIds: new Set() },
    );
    expect(m?.id).toBe(5);
  });

  test('does not match a different amount', () => {
    const m = findUnclaimedPayment(history, {
      finalAmount: 1002,
      createdAt: baseTime,
      claimedIds: new Set(),
    });
    expect(m).toBeNull();
  });
});
