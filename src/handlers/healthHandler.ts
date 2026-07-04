import type { HttpHandler } from '../types/http.js';
import { sendJson } from '../utils/http.js';

export const healthHandler: HttpHandler = (_request, response) => {
  sendJson(response, 200, { status: 'ok' });
};
