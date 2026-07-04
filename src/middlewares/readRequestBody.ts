import type { IncomingMessage } from 'node:http';

const DEFAULT_BODY_LIMIT_BYTES = 256 * 1024;

export async function readRequestBody(
  request: IncomingMessage,
  limitBytes = DEFAULT_BODY_LIMIT_BYTES
): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > limitBytes) {
      throw new Error('Request body is too large.');
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8');
}
