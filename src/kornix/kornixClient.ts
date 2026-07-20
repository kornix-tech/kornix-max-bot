import { fetch, type RequestInit, type Response } from 'undici';
import type { Logger } from '../utils/logger.js';
import { kornixEndpoints } from './kornixEndpoints.js';
import type {
  ApiErrorEnvelopeDto,
  FieldSeasonCatalogDto,
  FieldSeasonMapDto,
  KornixApprovalRequestDto,
  KornixApprovalSubmitResponseDto,
  KornixCalculationRunStatusDto,
  KornixClientOptions,
  KornixCurrentContextDto,
  KornixCurrentIrrigationLayerDto,
  KornixManualPrecipitationRequestDto,
  KornixManualPrecipitationResponseDto,
  KornixMethodsResponseDto,
  KornixReadinessDto
} from './kornixTypes.js';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(params: { status: number; code: string; message: string; details?: unknown; requestId: string | undefined }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.requestId = params.requestId;
  }
}

export class NetworkError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export class ValidationError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.cause = cause;
  }
}

type RequestMethod = 'GET' | 'POST';

type RequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  timeoutMs?: number;
};

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest'
};

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new ValidationError('KORNIX API baseUrl is required.');
  }
  return trimmed.replace(/\/+$/, '');
}

function ensurePositiveTimeout(timeoutMs: number): number {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new ValidationError(`KORNIX API timeout must be a positive integer, got: ${timeoutMs}`);
  }
  return timeoutMs;
}

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl}/`).toString();
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelopeDto {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const envelope = value as { error?: unknown };
  if (typeof envelope.error !== 'object' || envelope.error === null) {
    return false;
  }
  const error = envelope.error as { code?: unknown; message?: unknown };
  return typeof error.code === 'string' || typeof error.message === 'string';
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new ValidationError('KORNIX API returned invalid JSON.', error);
  }
}

export class KornixClient {
  readonly baseUrl: string;
  readonly serviceToken: string;
  readonly internalServiceIdentity: string;
  readonly timeoutMs: number;
  private readonly logger: Logger;

  constructor(options: KornixClientOptions, logger: Logger = console) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.serviceToken = options.serviceToken.trim();
    this.internalServiceIdentity = options.internalServiceIdentity.trim();
    this.timeoutMs = ensurePositiveTimeout(options.timeoutMs);
    this.logger = logger;
  }

  getCurrentContext(seasonYear: number): Promise<KornixCurrentContextDto> {
    return this.request<KornixCurrentContextDto>(kornixEndpoints.currentContext(seasonYear));
  }

  getMethods(): Promise<KornixMethodsResponseDto> {
    return this.request<KornixMethodsResponseDto>(kornixEndpoints.methods);
  }

  getReadinessCurrent(seasonYear: number): Promise<KornixReadinessDto> {
    return this.request<KornixReadinessDto>(kornixEndpoints.readinessCurrent(seasonYear));
  }

  getCurrentIrrigationLayer(seasonYear: number): Promise<KornixCurrentIrrigationLayerDto> {
    return this.request<KornixCurrentIrrigationLayerDto>(kornixEndpoints.currentIrrigationLayer(seasonYear));
  }

  getFieldSeasonCatalog(seasonYear: number): Promise<FieldSeasonCatalogDto> {
    return this.request<FieldSeasonCatalogDto>(kornixEndpoints.fieldSeasonCatalog(seasonYear));
  }

  getFieldSeasonMap(calculationRunId: string, methodCode: string, day: string): Promise<FieldSeasonMapDto> {
    return this.request<FieldSeasonMapDto>(kornixEndpoints.fieldSeasonMap(calculationRunId, methodCode, day));
  }

  getCalculationRunStatus(calculationRunId: string): Promise<KornixCalculationRunStatusDto> {
    return this.request<KornixCalculationRunStatusDto>(kornixEndpoints.calculationRunStatus(calculationRunId));
  }

  submitWaterRegimeApproval(payload: KornixApprovalRequestDto): Promise<KornixApprovalSubmitResponseDto> {
    return this.request<KornixApprovalSubmitResponseDto>(kornixEndpoints.waterRegimeApprovals, {
      method: 'POST',
      body: payload
    });
  }

  submitManualPrecipitation(
    payload: KornixManualPrecipitationRequestDto
  ): Promise<KornixManualPrecipitationResponseDto> {
    return this.request<KornixManualPrecipitationResponseDto>(kornixEndpoints.precipitationManual, {
      method: 'POST',
      body: payload
    });
  }

  async request<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    const method = options.method ?? 'GET';
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = performance.now();
    const url = buildUrl(this.baseUrl, path);
    const headers: Record<string, string> = { ...DEFAULT_HEADERS };

    if (this.serviceToken) {
      headers.Authorization = `Bearer ${this.serviceToken}`;
      headers['X-Kornix-Internal-Service'] = this.internalServiceIdentity;
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    this.logger.info('kornix_request_started', { method, path, url });

    try {
      const response = await fetch(url, init);
      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
      this.logger.info('kornix_request_finished', {
        method,
        path,
        status: response.status,
        durationMs
      });

      if (!response.ok) {
        await this.throwApiError(response);
      }

      return (await readJson(response)) as TResponse;
    } catch (error) {
      if (error instanceof ApiError || error instanceof ValidationError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new NetworkError(`KORNIX API request timed out after ${timeoutMs} ms.`, error);
      }
      throw new NetworkError('KORNIX API network request failed.', error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async throwApiError(response: Response): Promise<never> {
    let envelope: ApiErrorEnvelopeDto | null = null;
    try {
      const parsed = await response.json();
      envelope = isErrorEnvelope(parsed) ? parsed : null;
    } catch {
      envelope = null;
    }

    const errorBody = envelope?.error;
    throw new ApiError({
      status: response.status,
      code: errorBody?.code ?? 'http_error',
      message: errorBody?.message ?? `KORNIX API ${response.status}: ${response.statusText || 'HTTP error'}`,
      details: errorBody?.details,
      requestId: errorBody?.requestId
    });
  }
}
