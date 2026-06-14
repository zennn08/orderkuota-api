import { ApiError } from '../types.ts';

const OK_LOGIN_ENDPOINT = 'https://app.orderkuota.com/api/v2/login';
const OK_GET_ENDPOINT = 'https://app.orderkuota.com/api/v2/get';

const OK_HEADERS: Record<string, string> = {
  'User-Agent': 'okhttp/4.12.0',
  Host: 'app.orderkuota.com',
  'Content-Type': 'application/x-www-form-urlencoded',
};

const OK_CONSTANTS = {
  app_reg_id:
    'e5aCENGrQOWvhQWYnv-uNc:APA91bFj3O_mv5Nf_2SM4Duz4Z8Ug3nBNaHlgodlY92CBuNIA9xmc0Dahev5xxqssPmnTdcie4mlhiG9ZAE1iCe1QbyhxcUyGXlenJxiUaXdfm1rklOEo9k',
  phone_uuid: 'e5aCENGrQOWvhQWYnv-uNc',
  phone_model: 'sdk_gphone64_x86_64',
  phone_android_version: '16',
  app_version_code: '250811',
  app_version_name: '25.08.11',
  ui_mode: 'light',
} as const;

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

async function postForm(url: string, fields: Record<string, string>): Promise<unknown> {
  const body = new URLSearchParams(fields).toString();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: OK_HEADERS,
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`Upstream HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1) {
        await Bun.sleep(2 ** attempt * 1000);
      }
    }
  }
  throw new ApiError('UPSTREAM_ERROR', lastError?.message ?? 'Upstream request failed', 502);
}

export function requestOtp(username: string, password: string): Promise<unknown> {
  return postForm(OK_LOGIN_ENDPOINT, { username, password, ...OK_CONSTANTS });
}

export function getToken(username: string, otp: string): Promise<unknown> {
  return postForm(OK_LOGIN_ENDPOINT, { username, password: otp, ...OK_CONSTANTS });
}

export function generateQrisAjaib(
  username: string,
  token: string,
  amount: number,
): Promise<unknown> {
  return postForm(OK_GET_ENDPOINT, {
    ...OK_CONSTANTS,
    auth_username: username,
    auth_token: token,
    request_time: Date.now().toString(),
    'requests[qris_ajaib][amount]': amount.toString(),
  });
}

export function getQrisHistory(
  username: string,
  token: string,
  historyType = 'qris_history',
): Promise<unknown> {
  const tokenId = token.split(':')[0] ?? '';
  return postForm(`https://app.orderkuota.com/api/v2/qris/mutasi/${tokenId}`, {
    app_reg_id: OK_CONSTANTS.app_reg_id,
    phone_uuid: OK_CONSTANTS.phone_uuid,
    phone_model: OK_CONSTANTS.phone_model,
    [`requests[${historyType}][keterangan]`]: '',
    [`requests[${historyType}][jumlah]`]: '',
    request_time: Date.now().toString(),
    phone_android_version: OK_CONSTANTS.phone_android_version,
    app_version_code: OK_CONSTANTS.app_version_code,
    auth_username: username,
    [`requests[${historyType}][page]`]: '1',
    auth_token: token,
    app_version_name: OK_CONSTANTS.app_version_name,
    ui_mode: OK_CONSTANTS.ui_mode,
    [`requests[${historyType}][dari_tanggal]`]: '',
    'requests[0]': 'account',
    [`requests[${historyType}][ke_tanggal]`]: '',
  });
}

export function getBalance(username: string, token: string): Promise<unknown> {
  const tokenId = token.split(':')[0] ?? '';
  return postForm(`https://app.orderkuota.com/api/v2/qris/menu/${tokenId}`, {
    request_time: Date.now().toString(),
    app_reg_id: OK_CONSTANTS.app_reg_id,
    phone_android_version: OK_CONSTANTS.phone_android_version,
    app_version_code: OK_CONSTANTS.app_version_code,
    phone_uuid: OK_CONSTANTS.phone_uuid,
    auth_username: username,
    'requests[1]': 'qris_menu',
    auth_token: token,
    app_version_name: OK_CONSTANTS.app_version_name,
    ui_mode: OK_CONSTANTS.ui_mode,
    'requests[0]': 'account',
    phone_model: OK_CONSTANTS.phone_model,
  });
}
