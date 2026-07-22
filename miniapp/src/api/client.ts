import type {
  AuthResponse,
  Context,
  Draft,
  Field,
  FieldDetails,
  Identity,
  SubmitResult
} from '../types';

let sessionToken = '';

export class ApiClientError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/miniapp/api/v1${path}`, { ...init, headers });
  const body = await response.json() as { error?: { code?: string; message?: string } };
  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      body.error?.code ?? 'request_failed',
      body.error?.message ?? 'Не удалось выполнить запрос.'
    );
  }
  return body as T;
}

export async function authenticate(initData: string, devUserId?: string): Promise<AuthResponse> {
  const body = devUserId ? { initData, devUserId } : { initData };
  const result = await request<AuthResponse>('/auth/max', { method: 'POST', body: JSON.stringify(body) });
  sessionToken = result.token;
  return result;
}

export const api = {
  me: () => request<Identity>('/me'),
  context: () => request<Context>('/context'),
  fields: async () => (await request<{ fields: Field[] }>('/fields')).fields,
  field: (id: string) => request<FieldDetails>(`/fields/${encodeURIComponent(id)}`),
  currentDraft: async () => (await request<{ draft: Draft | null }>('/drafts/current')).draft,
  createDraft: () => request<Draft>('/drafts', { method: 'POST' }),
  addItem: (item: { type: 'irrigation' | 'precipitation'; fieldId: string; date: string; millimeters: number; methodCode?: string }) =>
    request<Draft>('/drafts/current/items', { method: 'POST', body: JSON.stringify(item) }),
  removeItem: (id: string) => request<Draft>(`/drafts/current/items/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  clearDraft: () => request<{ ok: true }>('/drafts/current', { method: 'DELETE' }),
  submitDraft: (idempotencyKey: string) => request<SubmitResult>('/drafts/current/submit', {
    method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: '{}'
  }),
  logout: async () => {
    try {
      await request<{ ok: true }>('/auth/logout', { method: 'POST', body: '{}' });
    } finally {
      sessionToken = '';
    }
  }
};
