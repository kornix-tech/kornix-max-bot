import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { MaxInitDataError, verifyMaxInitData } from '../src/miniapp/auth/maxInitData.js';

const BOT_TOKEN = '123456:TEST_TOKEN_FIXED_VECTOR';
const FIXED_INIT_DATA = 'auth_date=1771409719&query_id=4c0ab423-342b-4e45-aea4-2747dbc500cd&user=%7B%22id%22%3A67890%2C%22first_name%22%3A%22Max%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3Anull%2C%22language_code%22%3A%22ru%22%7D&hash=289fc65950488c7c054671fff181a5b46b0014a9237abea05d584be453431561';

describe('MAX Mini App initData validation', () => {
  it('accepts the fixed official-algorithm vector', () => {
    const result = verifyMaxInitData(FIXED_INIT_DATA, BOT_TOKEN, 300, 1771409800);
    assert.equal(result.user.id, '67890');
    assert.equal(result.user.firstName, 'Max');
  });

  it('rejects invalid signatures, missing hash and duplicate parameters', () => {
    assert.throws(() => verifyMaxInitData(FIXED_INIT_DATA.replace(/.$/, '0'), BOT_TOKEN, 300, 1771409800), MaxInitDataError);
    assert.throws(() => verifyMaxInitData(FIXED_INIT_DATA.replace(/&hash=.*/, ''), BOT_TOKEN, 300, 1771409800), /hash/);
    assert.throws(() => verifyMaxInitData(`${FIXED_INIT_DATA}&auth_date=1771409719`, BOT_TOKEN, 300, 1771409800), /несколько раз/);
  });

  it('rejects expired and future launch data', () => {
    assert.throws(
      () => verifyMaxInitData(FIXED_INIT_DATA, BOT_TOKEN, 30, 1771409800),
      (error: unknown) => error instanceof MaxInitDataError && error.code === 'expired_init_data'
    );
    assert.throws(
      () => verifyMaxInitData(FIXED_INIT_DATA, BOT_TOKEN, 300, 1771409600),
      (error: unknown) => error instanceof MaxInitDataError && error.code === 'future_init_data'
    );
  });

  it('rejects malformed user JSON and missing MAX user ID after a valid signature boundary', () => {
    assert.throws(() => verifyMaxInitData(signed({ auth_date: '1771409719', query_id: 'q1', user: '{bad' }), BOT_TOKEN, 300, 1771409800), /неверный JSON/);
    assert.throws(() => verifyMaxInitData(signed({ auth_date: '1771409719', query_id: 'q1', user: '{}' }), BOT_TOKEN, 300, 1771409800), /Идентификатор/);
  });
});

function signed(values: Record<string, string>): string {
  const launchParams = Object.entries(values).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(launchParams).digest('hex');
  return `${Object.entries(values).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}&hash=${hash}`;
}
