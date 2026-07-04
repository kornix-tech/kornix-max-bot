import type { ServerResponse } from 'node:http';
import type { JsonBody } from '../types/http.js';

export function sendJson(response: ServerResponse, statusCode: number, body: JsonBody): void {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload)
  });
  response.end(payload);
}

export function sendNotFound(response: ServerResponse): void {
  sendJson(response, 404, { error: { code: 'not_found', message: 'Route not found.' } });
}

export function sendMethodNotAllowed(response: ServerResponse): void {
  sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed.' } });
}
