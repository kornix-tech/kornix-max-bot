import type { IncomingMessage, ServerResponse } from 'node:http';

export type HttpHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void> | void;

export type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null;
