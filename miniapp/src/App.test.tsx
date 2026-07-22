import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const linkedAuth = {
  token: 'session-token', expiresAt: 9999999999, startParam: null, developmentMode: true,
  identity: { status: 'linked', displayName: 'Тест', seasonYear: 2026 }
};
const context = {
  organizationName: 'СП', organizationCode: 'SP', seasonYear: 2026, serverDate: '2026-07-22',
  currentOperationalStatus: 'completed', currentAppliedStatus: 'completed', currentAppliedCalculationRunId: 'run-1',
  lastCalculationFinishedAt: '2026-07-22T10:00:00Z',
  frontendMode: 'current_editable', submitAllowed: true, fieldCount: 1, generatedAt: '2026-07-22T10:00:00Z',
  readinessSummary: { status: 'pass' }, managedScope: { dateFrom: '2026-07-01', dateTo: '2026-07-29', fieldSeasonIds: ['field-1'] }
};
const readiness = { status: 'pass', productionStatus: 'ready', checkedAt: null, currentAppliedCalculationRunId: 'run-1', blockingErrors: [], warnings: [] };
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  delete window.WebApp;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

describe('Mini App interface', () => {
  it('shows loading and then an unlinked-account state outside MAX', async () => {
    let finish: ((value: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    await act(async () => root.render(<App />));
    expect(container.textContent).toContain('Подключаемся к MAX');
    await act(async () => finish?.(new Response(JSON.stringify({ ...linkedAuth, identity: { status: 'not_linked', linkUrl: 'https://poliv360.ru/link' } }), { status: 200 })));
    expect(container.textContent).toContain('Подключите POLIV360');
    expect(container.textContent).toContain('Режим разработки');
  });

  it('renders the dashboard and opens the server-provided field list', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/max')) return response(linkedAuth);
      if (url.endsWith('/context')) return response(context);
      if (url.endsWith('/status')) return response(readiness);
      if (url.endsWith('/drafts/current')) return response({ draft: null });
      if (url.endsWith('/fields')) return response({ fields: [{ fieldId: 'id-1', fieldSeasonId: 'field-1', fieldKey: 'SP:1.1', fieldName: 'Участок 1.1', areaHa: 12, cropName: 'Пшеница', cropSowingDate: null }] });
      return response({ error: { code: 'missing_mock', message: url } }, 500);
    }));
    await act(async () => root.render(<App />));
    await vi.waitFor(() => expect(container.textContent).toContain('Мои участки'));
    expect(container.textContent).toContain('13:00');
    expect(container.textContent).not.toContain('Готовность данных');
    expect(container.textContent).not.toContain('Методы полива');
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes('Мои участки'));
    await act(async () => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await vi.waitFor(() => expect(container.textContent).toContain('Участок 1.1'));
    expect(container.textContent).toContain('Пшеница');
  });

  it('opens irrigation even when the methods request fails', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/max')) return response(linkedAuth);
      if (url.endsWith('/context')) return response(context);
      if (url.endsWith('/status')) return response(readiness);
      if (url.endsWith('/drafts/current')) return response({ draft: null });
      if (url.endsWith('/fields')) return response({ fields: [{ fieldId: 'id-1', fieldSeasonId: 'field-1', fieldKey: 'SP:1.1', fieldName: 'Участок 1.1', areaHa: 12, cropName: 'Пшеница', cropSowingDate: null }] });
      if (url.endsWith('/methods')) return response({ error: { code: 'unavailable', message: 'Справочник временно недоступен.' } }, 503);
      return response({ error: { code: 'missing_mock', message: url } }, 500);
    }));
    await act(async () => root.render(<App />));
    await vi.waitFor(() => expect(container.textContent).toContain('Добавить полив'));
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes('Добавить полив'));
    await act(async () => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await vi.waitFor(() => expect(container.querySelector('input[type="number"]')).not.toBeNull());
  });

  it('shows a server signature error without exposing raw launch data', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({ error: { code: 'invalid_init_data', message: 'Подпись недействительна.' } }, 401)));
    await act(async () => root.render(<App />));
    await vi.waitFor(() => expect(container.textContent).toContain('Подпись недействительна'));
    expect(container.textContent).not.toContain('initData=');
  });
});
