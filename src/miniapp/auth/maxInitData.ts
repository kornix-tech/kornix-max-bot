import { createHmac, timingSafeEqual } from 'node:crypto';

export type VerifiedMaxUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
};

export type VerifiedMaxInitData = {
  user: VerifiedMaxUser;
  authDate: number;
  queryId: string;
  startParam: string | null;
};

export class MaxInitDataError extends Error {
  constructor(readonly code: 'invalid_init_data' | 'expired_init_data' | 'future_init_data', message: string) {
    super(message);
    this.name = 'MaxInitDataError';
  }
}

export function verifyMaxInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): VerifiedMaxInitData {
  if (!initData || initData.length > 16_384 || !botToken) {
    throw invalid('Стартовые данные MAX отсутствуют или имеют неверный формат.');
  }
  const pairs = parseUniquePairs(initData);
  const hash = required(pairs, 'hash');
  const authDateText = required(pairs, 'auth_date');
  const queryId = required(pairs, 'query_id');
  const userText = required(pairs, 'user');

  if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
    throw invalid('Подпись стартовых данных MAX имеет неверный формат.');
  }
  const launchParams = [...pairs.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secretKey).update(launchParams).digest();
  const received = Buffer.from(hash, 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw invalid('Подпись стартовых данных MAX недействительна.');
  }

  const authDate = Number(authDateText);
  if (!Number.isInteger(authDate) || authDate <= 0) {
    throw invalid('Дата авторизации MAX имеет неверный формат.');
  }
  if (authDate > nowSeconds + 30) {
    throw new MaxInitDataError('future_init_data', 'Дата авторизации MAX находится в будущем.');
  }
  if (nowSeconds - authDate > maxAgeSeconds) {
    throw new MaxInitDataError('expired_init_data', 'Стартовые данные MAX устарели.');
  }

  const user = parseUser(userText);
  return {
    user,
    authDate,
    queryId,
    startParam: pairs.get('start_param') ?? null
  };
}

function parseUniquePairs(initData: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const part of initData.split('&')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      throw invalid('Стартовые данные MAX содержат неверный параметр.');
    }
    const key = part.slice(0, separator);
    if (result.has(key)) {
      throw invalid(`Параметр ${key} передан несколько раз.`);
    }
    try {
      result.set(key, decodeURIComponent(part.slice(separator + 1)));
    } catch {
      throw invalid(`Параметр ${key} содержит неверную URL-кодировку.`);
    }
  }
  return result;
}

function required(pairs: Map<string, string>, key: string): string {
  const value = pairs.get(key);
  if (!value) {
    throw invalid(`Обязательный параметр ${key} отсутствует.`);
  }
  return value;
}

function parseUser(raw: string): VerifiedMaxUser {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw invalid('Данные пользователя MAX содержат неверный JSON.');
  }
  if (typeof value !== 'object' || value === null) {
    throw invalid('Данные пользователя MAX имеют неверный формат.');
  }
  const source = value as Record<string, unknown>;
  if ((typeof source.id !== 'number' && typeof source.id !== 'string') || String(source.id).trim() === '') {
    throw invalid('Идентификатор пользователя MAX отсутствует.');
  }
  return {
    id: String(source.id),
    firstName: optionalString(source.first_name),
    lastName: optionalString(source.last_name),
    username: optionalString(source.username),
    languageCode: optionalString(source.language_code)
  };
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function invalid(message: string): MaxInitDataError {
  return new MaxInitDataError('invalid_init_data', message);
}
