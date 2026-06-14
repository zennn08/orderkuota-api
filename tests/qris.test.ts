import { describe, expect, test } from 'bun:test';

import { generateDynamicQris, validateQris } from '../src/services/qris.ts';

// A minimal but structurally valid static QRIS (NobuBank-style sample).
const STATIC_QRIS =
  '00020101021126670016COM.NOBUBANK.WWW01189360050300000898240214123456789012340303UMI51440014ID.CO.QRIS.WWW0215ID20232634750570303UMI5204594553033605802ID5910Toko Demo6007Jakarta61051234562070703A0163041B2A';

describe('generateDynamicQris', () => {
  test('produces a CRC-valid string', () => {
    const dynamic = generateDynamicQris(STATIC_QRIS, 10001);
    expect(validateQris(dynamic)).toBe(true);
  });

  test('sets tag 01 to dynamic (12) and embeds amount in tag 54', () => {
    const dynamic = generateDynamicQris(STATIC_QRIS, 10001);
    expect(dynamic).toContain('010212'); // tag 01, len 02, value 12
    expect(dynamic).toContain('5405' + '10001'); // tag 54, len 05, value 10001
  });
});

describe('validateQris', () => {
  test('rejects a string with a corrupted CRC', () => {
    const dynamic = generateDynamicQris(STATIC_QRIS, 5000);
    const corrupted = dynamic.slice(0, -4) + '0000';
    expect(validateQris(corrupted)).toBe(false);
  });

  test('rejects too-short input', () => {
    expect(validateQris('0002')).toBe(false);
  });
});
