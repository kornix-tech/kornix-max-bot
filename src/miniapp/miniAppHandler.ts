import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppConfig } from '../types/config.js';
import type { HttpHandler } from '../types/http.js';
import type { KornixClient } from '../kornix/kornixClient.js';
import { ApiError } from '../kornix/kornixClient.js';
import type { FieldSeasonCatalogFieldDto } from '../kornix/kornixTypes.js';
import { submitIrrigationOperations, submitPrecipitationOperations } from '../kornix/operationService.js';
import type { Logger } from '../utils/logger.js';
import { readRequestBody } from '../middlewares/readRequestBody.js';
import { verifyMaxInitData, MaxInitDataError } from './auth/maxInitData.js';
import { createSessionToken, verifySessionToken, type MiniAppSession } from './auth/sessionToken.js';
import {
  MiniAppDraftStore,
  type DraftSubmitResult,
  type MiniAppDraft,
  type MiniAppDraftItem
} from './draftStore.js';
import {
  DevelopmentIdentityResolver,
  type MaxIdentityResolver,
  SharedBotIdentityResolver,
  type ResolvedPolivUser
} from './identityResolver.js';
import { FixedWindowRateLimiter } from './rateLimiter.js';

type Options = {
  config: AppConfig;
  kornixClient: KornixClient;
  logger: Logger;
  identityResolver?: MaxIdentityResolver;
  draftStore?: MiniAppDraftStore;
  staticRoot?: string;
};

const STATIC_ROOT = fileURLToPath(new URL('../../dist-miniapp/', import.meta.url));
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

export function createMiniAppHandler(options: Options): HttpHandler {
  const drafts = options.draftStore ?? new MiniAppDraftStore();
  const resolver = options.identityResolver ?? (
    options.config.miniAppDevMode
      ? new DevelopmentIdentityResolver(options.config.miniAppDevMaxUserId, options.config.defaultSeasonYear)
      : new SharedBotIdentityResolver(options.config.defaultSeasonYear)
  );
  const revokedSessions = new Set<string>();
  const authRateLimit = new FixedWindowRateLimiter(10, 60_000);
  const submitRateLimit = new FixedWindowRateLimiter(5, 60_000);
  const staticRoot = options.staticRoot ?? STATIC_ROOT;

  return async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (!options.config.miniAppEnabled) {
        json(response, 404, errorBody('miniapp_disabled', 'Mini App отключено.'));
        return;
      }
      if (url.pathname.startsWith('/miniapp/api/')) {
        await handleApi(request, response, url);
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        json(response, 405, errorBody('method_not_allowed', 'Метод не поддерживается.'));
        return;
      }
      await serveStatic(response, url.pathname, staticRoot, request.method === 'HEAD');
    } catch (error) {
      if (error instanceof ApiInputError) {
        json(response, 422, errorBody(error.code, error.message));
        return;
      }
      options.logger.error('miniapp_request_failed', {
        message: error instanceof Error ? error.message : String(error)
      });
      json(response, 500, errorBody('internal_error', 'Внутренняя ошибка Mini App.'));
    }
  };

  async function handleApi(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    if (!originAllowed(request, options.config)) {
      json(response, 403, errorBody('origin_forbidden', 'Origin запроса не разрешён.'));
      return;
    }

    if (url.pathname === '/miniapp/api/v1/auth/max' && request.method === 'POST') {
      const clientKey = clientIp(request);
      if (!authRateLimit.allow(clientKey)) {
        json(response, 429, errorBody('rate_limited', 'Слишком много попыток. Повторите позже.'));
        return;
      }
      await authenticate(request, response);
      return;
    }

    const session = readSession(request, options.config.miniAppSessionSecret, revokedSessions);
    if (!session) {
      json(response, 401, errorBody('unauthorized', 'Требуется действующая сессия Mini App.'));
      return;
    }
    if (url.pathname === '/miniapp/api/v1/auth/logout' && request.method === 'POST') {
      revokedSessions.add(session.sessionId);
      drafts.clear(session.sessionId);
      json(response, 200, { ok: true });
      return;
    }

    const identity = await resolver.resolve(session.maxUserId);
    if (url.pathname === '/miniapp/api/v1/me' && request.method === 'GET') {
      json(response, 200, meResponse(identity, options.config.miniAppPolivLinkUrl));
      return;
    }
    if (identity.status !== 'linked') {
      const status = identity.status === 'temporarily_unavailable' ? 503 : 403;
      json(response, status, errorBody(identity.status, identityMessage(identity.status)));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/miniapp/api/v1/status') {
      json(response, 200, await options.kornixClient.getReadinessCurrent(identity.seasonYear));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/miniapp/api/v1/context') {
      json(response, 200, await options.kornixClient.getCurrentContext(identity.seasonYear));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/miniapp/api/v1/methods') {
      json(response, 200, await options.kornixClient.getMethods());
      return;
    }
    if (request.method === 'GET' && url.pathname === '/miniapp/api/v1/readiness') {
      json(response, 200, await options.kornixClient.getReadinessCurrent(identity.seasonYear));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/miniapp/api/v1/fields') {
      json(response, 200, { fields: await visibleFields(options.kornixClient, identity.seasonYear) });
      return;
    }
    const fieldMatch = /^\/miniapp\/api\/v1\/fields\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'GET' && fieldMatch?.[1]) {
      const fieldSeasonId = safeId(fieldMatch[1]);
      const fields = await visibleFields(options.kornixClient, identity.seasonYear);
      const field = fields.find((item) => item.fieldSeasonId === fieldSeasonId);
      if (!field) {
        json(response, 404, errorBody('field_not_found', 'Участок не найден.'));
        return;
      }
      json(response, 200, await fieldDetails(options.kornixClient, identity.seasonYear, field));
      return;
    }

    if (url.pathname === '/miniapp/api/v1/drafts' && request.method === 'POST') {
      json(response, 201, publicDraft(drafts.create(session.sessionId)));
      return;
    }
    if (url.pathname === '/miniapp/api/v1/drafts/current' && request.method === 'GET') {
      json(response, 200, { draft: nullableDraft(drafts.current(session.sessionId)) });
      return;
    }
    if (url.pathname === '/miniapp/api/v1/drafts/current' && request.method === 'DELETE') {
      drafts.clear(session.sessionId);
      json(response, 200, { ok: true });
      return;
    }
    if (url.pathname === '/miniapp/api/v1/drafts/current/items' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const item = await validateDraftItem(body, options.kornixClient, identity.seasonYear);
      try {
        drafts.add(session.sessionId, item);
      } catch (error) {
        if (error instanceof Error && error.message === 'draft_item_limit') {
          json(response, 422, errorBody('draft_item_limit', 'В черновике может быть не более 50 записей.'));
          return;
        }
        throw error;
      }
      json(response, 201, publicDraft(drafts.current(session.sessionId)!));
      return;
    }
    const itemMatch = /^\/miniapp\/api\/v1\/drafts\/current\/items\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'DELETE' && itemMatch?.[1]) {
      const removed = drafts.removeItem(session.sessionId, safeId(itemMatch[1]));
      json(response, removed ? 200 : 404, removed
        ? publicDraft(drafts.current(session.sessionId)!)
        : errorBody('draft_item_not_found', 'Запись черновика не найдена.'));
      return;
    }
    if (url.pathname === '/miniapp/api/v1/drafts/current/submit' && request.method === 'POST') {
      if (!submitRateLimit.allow(session.sessionId)) {
        json(response, 429, errorBody('rate_limited', 'Слишком много отправок. Повторите позже.'));
        return;
      }
      await submitDraft(request, response, session, identity);
      return;
    }
    json(response, 404, errorBody('not_found', 'Маршрут Mini App API не найден.'));
  }

  async function authenticate(request: IncomingMessage, response: ServerResponse): Promise<void> {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(request);
    } catch {
      json(response, 400, errorBody('invalid_json', 'Ожидался корректный JSON.'));
      return;
    }
    let maxUserId: string;
    let startParam: string | null = null;
    let developmentMode = false;
    if (options.config.miniAppDevMode && body.devUserId === options.config.miniAppDevMaxUserId) {
      maxUserId = options.config.miniAppDevMaxUserId;
      developmentMode = true;
    } else {
      if (typeof body.initData !== 'string') {
        json(response, 400, errorBody('invalid_init_data', 'Поле initData обязательно.'));
        return;
      }
      try {
        const verified = verifyMaxInitData(
          body.initData,
          options.config.maxBotToken,
          options.config.miniAppInitDataMaxAgeSeconds
        );
        maxUserId = verified.user.id;
        startParam = verified.startParam;
      } catch (error) {
        if (error instanceof MaxInitDataError) {
          json(response, 401, errorBody(error.code, error.message));
          return;
        }
        throw error;
      }
    }
    const created = createSessionToken(
      maxUserId,
      options.config.miniAppSessionSecret,
      options.config.miniAppSessionTtlSeconds
    );
    const identity = await resolver.resolve(maxUserId);
    json(response, 200, {
      token: created.token,
      expiresAt: created.session.expiresAt,
      identity: meResponse(identity, options.config.miniAppPolivLinkUrl),
      startParam,
      developmentMode
    });
  }

  async function submitDraft(
    request: IncomingMessage,
    response: ServerResponse,
    session: MiniAppSession,
    identity: Extract<ResolvedPolivUser, { status: 'linked' }>
  ): Promise<void> {
    const key = request.headers['idempotency-key']?.toString().trim() ?? '';
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      json(response, 400, errorBody('invalid_idempotency_key', 'Передайте корректный Idempotency-Key.'));
      return;
    }
    const draft = drafts.current(session.sessionId);
    if (!draft) {
      json(response, 409, errorBody('empty_draft', 'Черновик пуст.'));
      return;
    }
    if (draft.lastIdempotencyKey === key && draft.lastResult) {
      json(response, 200, { ...draft.lastResult, replayed: true });
      return;
    }
    if (draft.items.length === 0) {
      json(response, 409, errorBody('empty_draft', 'Черновик пуст.'));
      return;
    }
    if (draft.submitting) {
      json(response, 409, errorBody('submit_in_progress', 'Отправка уже выполняется.'));
      return;
    }
    if (draft.lastResult) {
      json(response, 409, errorBody('draft_already_submitted', 'Черновик уже отправлен. Создайте новый.'));
      return;
    }

    draft.submitting = true;
    const successfulItemIds: string[] = [];
    const failed: DraftSubmitResult['failed'] = [];
    try {
      for (const type of ['irrigation', 'precipitation'] as const) {
        const items = draft.items.filter((item) => item.type === type);
        if (!items.length) {
          continue;
        }
        try {
          const operations = items.map((item) => ({ field: item.field, date: item.date, mm: item.millimeters }));
          const result = type === 'irrigation'
            ? await submitIrrigationOperations(options.kornixClient, identity.seasonYear, operations)
            : await submitPrecipitationOperations(options.kornixClient, identity.seasonYear, operations);
          if (result.accepted) {
            successfulItemIds.push(...items.map((item) => item.id));
          } else {
            failed.push(...items.map((item) => ({ itemId: item.id, message: result.reason })));
          }
        } catch (error) {
          const message = submitErrorMessage(error);
          failed.push(...items.map((item) => ({ itemId: item.id, message })));
        }
      }
      const result: DraftSubmitResult = {
        status: failed.length === 0 ? 'success' : successfulItemIds.length ? 'partial' : 'failed',
        successfulItemIds,
        failed
      };
      draft.items = draft.items.filter((item) => !successfulItemIds.includes(item.id));
      draft.lastIdempotencyKey = key;
      draft.lastResult = result;
      json(response, result.status === 'failed' ? 422 : 200, result);
    } finally {
      draft.submitting = false;
    }
  }
}

async function visibleFields(client: KornixClient, seasonYear: number): Promise<FieldSeasonCatalogFieldDto[]> {
  const context = await client.getCurrentContext(seasonYear);
  if (!context.currentAppliedCalculationRunId) {
    const catalog = await client.getFieldSeasonCatalog(seasonYear);
    return catalog.fields.filter((field) => context.managedScope.fieldSeasonIds.includes(field.fieldSeasonId));
  }
  const map = await client.getFieldSeasonMap(
    context.currentAppliedCalculationRunId,
    context.defaultMethodCode,
    context.serverDate
  );
  const allowed = new Set(context.managedScope.fieldSeasonIds);
  return map.features.filter((feature) => allowed.has(feature.properties.fieldSeasonId)).map((feature) => ({
    fieldId: feature.properties.fieldId,
    fieldSeasonId: feature.properties.fieldSeasonId,
    fieldKey: feature.properties.fieldKey,
    fieldName: feature.properties.fieldName,
    areaHa: feature.properties.areaHa,
    cropName: feature.properties.cropName,
    cropSowingDate: feature.properties.cropSowingDate,
    koef_upper_limit: feature.properties.koef_upper_limit,
    koef_optimum: feature.properties.koef_optimum,
    koef_lower_limit: feature.properties.koef_lower_limit,
    geometry: null
  }));
}

async function fieldDetails(client: KornixClient, seasonYear: number, field: FieldSeasonCatalogFieldDto) {
  const context = await client.getCurrentContext(seasonYear);
  if (!context.currentAppliedCalculationRunId) {
    return { field, status: null, context };
  }
  const map = await client.getFieldSeasonMap(
    context.currentAppliedCalculationRunId,
    context.defaultMethodCode,
    context.serverDate
  );
  return {
    field,
    status: map.features.find((feature) => feature.properties.fieldSeasonId === field.fieldSeasonId)?.properties ?? null,
    context
  };
}

async function validateDraftItem(
  body: Record<string, unknown>,
  client: KornixClient,
  seasonYear: number
): Promise<Omit<MiniAppDraftItem, 'id'>> {
  if (body.type !== 'irrigation' && body.type !== 'precipitation') {
    throw new ApiInputError('invalid_operation_type', 'Тип операции не поддерживается.');
  }
  if (typeof body.fieldId !== 'string') {
    throw new ApiInputError('invalid_field_id', 'Укажите участок.');
  }
  const fieldId = safeId(body.fieldId);
  if (typeof body.date !== 'string' || !validDate(body.date)) {
    throw new ApiInputError('invalid_date', 'Укажите корректную дату YYYY-MM-DD.');
  }
  if (typeof body.millimeters !== 'number' || !Number.isFinite(body.millimeters) || body.millimeters <= 0 || body.millimeters > 500) {
    throw new ApiInputError('invalid_millimeters', 'Количество должно быть больше 0 и не превышать 500 мм.');
  }
  const fields = await visibleFields(client, seasonYear);
  const field = fields.find((item) => item.fieldSeasonId === fieldId);
  if (!field) {
    throw new ApiInputError('field_not_found', 'Участок недоступен.');
  }
  let methodCode: string | undefined;
  if (body.type === 'irrigation' && body.methodCode !== undefined) {
    if (typeof body.methodCode !== 'string' || body.methodCode.length > 128) {
      throw new ApiInputError('invalid_method', 'Метод полива имеет неверный формат.');
    }
    const methods = await client.getMethods();
    if (!methods.methods.some((method) => method.methodCode === body.methodCode)) {
      throw new ApiInputError('invalid_method', 'Метод полива недоступен.');
    }
    methodCode = body.methodCode;
  }
  return {
    type: body.type,
    field,
    date: body.date,
    millimeters: Math.round(body.millimeters * 10) / 10,
    ...(methodCode ? { methodCode } : {})
  };
}

function readSession(request: IncomingMessage, secret: string, revoked: Set<string>): MiniAppSession | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const session = verifySessionToken(header.slice(7), secret);
  return session && !revoked.has(session.sessionId) ? session : null;
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readRequestBody(request, 32 * 1024);
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ApiInputError('invalid_json', 'Ожидался JSON-объект.');
  }
  return parsed as Record<string, unknown>;
}

function originAllowed(request: IncomingMessage, config: AppConfig): boolean {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }
  const allowed = new Set(config.miniAppAllowedOrigins);
  if (config.miniAppPublicUrl) {
    allowed.add(new URL(config.miniAppPublicUrl).origin);
  }
  const forwardedHost = request.headers['x-forwarded-host']?.toString() ?? request.headers.host;
  if (forwardedHost) {
    allowed.add(`https://${forwardedHost}`);
    if (config.nodeEnv === 'development') {
      allowed.add(`http://${forwardedHost}`);
    }
  }
  return allowed.has(origin);
}

function clientIp(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
  return forwarded && forwarded.length <= 64 ? forwarded : request.socket.remoteAddress ?? 'unknown';
}

async function serveStatic(response: ServerResponse, pathname: string, root: string, head: boolean): Promise<void> {
  const requested = pathname === '/miniapp' || pathname === '/miniapp/'
    ? 'index.html'
    : pathname.slice('/miniapp/'.length);
  const rootPath = resolve(root);
  let filePath = resolve(rootPath, requested);
  if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${sep}`)) {
    json(response, 404, errorBody('not_found', 'Файл не найден.'));
    return;
  }
  let body: Buffer;
  try {
    body = await readFile(filePath);
  } catch {
    if (requested.startsWith('assets/')) {
      json(response, 404, errorBody('not_found', 'Файл не найден.'));
      return;
    }
    filePath = resolve(rootPath, 'index.html');
    try {
      body = await readFile(filePath);
    } catch {
      json(response, 503, errorBody('miniapp_not_built', 'Mini App ещё не собрано.'));
      return;
    }
  }
  securityHeaders(response);
  const extension = extname(filePath);
  response.setHeader('Content-Type', MIME[extension] ?? 'application/octet-stream');
  response.setHeader('Cache-Control', requested.startsWith('assets/')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache');
  response.statusCode = 200;
  response.end(head ? undefined : body);
}

function securityHeaders(response: ServerResponse): void {
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://st.max.ru; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; base-uri 'none'; frame-ancestors https://*.max.ru https://max.ru; form-action 'self'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function json(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(payload));
  response.setHeader('Cache-Control', 'no-store');
  response.end(payload);
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

function identityMessage(status: Exclude<ResolvedPolivUser['status'], 'linked'>): string {
  if (status === 'not_linked') return 'Аккаунт MAX не связан с POLIV360.';
  if (status === 'inactive') return 'Аккаунт POLIV360 неактивен.';
  return 'Сервис привязки временно недоступен.';
}

function meResponse(identity: ResolvedPolivUser, linkUrl: string) {
  return identity.status === 'linked'
    ? { status: identity.status, displayName: identity.displayName, seasonYear: identity.seasonYear }
    : { status: identity.status, linkUrl: linkUrl || null };
}

function publicDraft(draft: MiniAppDraft) {
  return {
    id: draft.id,
    items: draft.items.map((item) => ({
      id: item.id,
      type: item.type,
      fieldId: item.field.fieldSeasonId,
      fieldName: item.field.fieldName || item.field.fieldKey,
      fieldKey: item.field.fieldKey,
      date: item.date,
      millimeters: item.millimeters,
      methodCode: item.methodCode ?? null
    })),
    submitting: draft.submitting
  };
}

function nullableDraft(draft: MiniAppDraft | null) {
  return draft ? publicDraft(draft) : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function safeId(value: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new ApiInputError('invalid_id', 'Идентификатор имеет неверный формат.');
  }
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(decoded)) {
    throw new ApiInputError('invalid_id', 'Идентификатор имеет неверный формат.');
  }
  return decoded;
}

function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return 'Backend отклонил доступ к записи.';
    if (error.status === 409) return 'Данные изменились. Обновите контекст и повторите.';
    if (error.status === 422) return error.message;
    return 'Backend POLIV360 временно не выполнил операцию.';
  }
  return 'Не удалось связаться с POLIV360.';
}

class ApiInputError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}
