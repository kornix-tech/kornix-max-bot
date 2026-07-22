import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiClientError, authenticate } from './api/client';
import { createMaxBridge } from './max/maxBridge';
import { backView, type View } from './state/navigation';
import type {
  AuthResponse,
  Context,
  Draft,
  Field,
  FieldDetails,
  Identity,
  SubmitResult
} from './types';

type BootState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; auth: AuthResponse };

export default function App() {
  const bridge = useMemo(() => createMaxBridge(), []);
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });
  const [view, setView] = useState<View>('home');
  const [context, setContext] = useState<Context | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fieldDetails, setFieldDetails] = useState<FieldDetails | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadHome = useCallback(async () => {
    const [nextContext, nextDraft] = await Promise.all([
      api.context(), api.currentDraft()
    ]);
    setContext(nextContext);
    setDraft(nextDraft);
  }, []);

  useEffect(() => {
    let active = true;
    const devUserId = !bridge.available && import.meta.env.DEV
      ? (import.meta.env.VITE_MAX_DEV_USER_ID || 'miniapp-dev-user')
      : undefined;
    authenticate(bridge.initData, devUserId)
      .then(async (auth) => {
        if (!active) return;
        setBoot({ status: 'ready', auth });
        if (auth.identity.status === 'linked') await loadHome();
      })
      .catch((error) => active && setBoot({ status: 'error', message: errorMessage(error) }));
    return () => { active = false; };
  }, [bridge, loadHome]);

  useEffect(() => {
    if (view === 'home') return bridge.setBackHandler(null);
    return bridge.setBackHandler(() => setView((current) => backView(current)));
  }, [bridge, view]);

  useEffect(() => {
    bridge.setUnsavedChanges(Boolean(draft?.items.length));
    return () => bridge.setUnsavedChanges(false);
  }, [bridge, draft?.items.length]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function openFields() {
    await run(async () => {
      setFields(await api.fields());
      setView('fields');
    });
  }

  async function openField(field: Field) {
    await run(async () => {
      setFieldDetails(await api.field(field.fieldSeasonId));
      setView('field');
    });
  }

  async function openForm(type: 'irrigation' | 'precipitation', preferred?: Field) {
    await run(async () => {
      const nextFields = fields.length ? fields : await api.fields();
      setFields(preferred ? [preferred, ...nextFields.filter((item) => item.fieldSeasonId !== preferred.fieldSeasonId)] : nextFields);
      setView(type);
    });
  }

  if (boot.status === 'loading') return <Loading text="Подключаемся к MAX…" />;
  if (boot.status === 'error') {
    return <StatusPage title="Не удалось подключиться" text={boot.message} action="Повторить" onAction={() => location.reload()} />;
  }
  const identity = boot.auth.identity;
  if (identity.status !== 'linked') {
    return <Unlinked identity={identity} onOpen={(url) => bridge.openLink(url)} development={boot.auth.developmentMode} />;
  }

  return (
    <div className="app-shell">
      {boot.auth.developmentMode && <div className="dev-banner">Режим разработки</div>}
      <header className="topbar">
        {view !== 'home' && <button className="icon-button" onClick={() => setView(backView(view))} aria-label="Назад">←</button>}
        <div><span className="eyebrow">POLIV360</span><h1>{titleFor(view)}</h1></div>
        {view !== 'draft' && draft?.items.length ? (
          <button className="draft-badge" onClick={() => setView('draft')} aria-label="Открыть изменения">{draft.items.length}</button>
        ) : <span />}
      </header>
      <main>
        {message && <div className="notice error" role="alert">{message}</div>}
        {busy && <div className="progress" aria-label="Загрузка" />}
        {view === 'home' && <Home context={context} draft={draft} onFields={openFields} onForm={openForm} />}
        {view === 'fields' && <Fields fields={fields} onSelect={openField} />}
        {view === 'field' && fieldDetails && <FieldCard details={fieldDetails} onForm={openForm} />}
        {(view === 'irrigation' || view === 'precipitation') && (
          <OperationForm
            type={view}
            fields={fields}
            context={context}
            disabled={busy}
            onSubmit={(item) => run(async () => {
              const nextDraft = await api.addItem(item);
              setDraft(nextDraft);
              setView('draft');
            })}
          />
        )}
        {view === 'draft' && <DraftView draft={draft} disabled={busy} onRemove={(id) => run(async () => setDraft(await api.removeItem(id)))} onAdd={() => openForm('irrigation')} onClear={() => run(async () => { await api.clearDraft(); setDraft(null); setView('home'); })} onConfirm={() => setView('confirm')} />}
        {view === 'confirm' && <Confirmation draft={draft} disabled={busy} onBack={() => setView('draft')} onSubmit={() => run(async () => {
          const nextResult = await api.submitDraft(crypto.randomUUID());
          setResult(nextResult);
          setDraft(await api.currentDraft());
          setView('result');
        })} />}
        {view === 'result' && result && <Result result={result} onHome={() => { setResult(null); setView('home'); void loadHome(); }} />}
      </main>
    </div>
  );
}

function Home(props: {
  context: Context | null;
  draft: Draft | null;
  onFields(): void;
  onForm(type: 'irrigation' | 'precipitation'): void;
}) {
  return (
    <>
      <section className="hero-card">
        <span className="eyebrow">Сезон {props.context?.seasonYear ?? '—'}</span>
        <h2>{props.context?.organizationName ?? props.context?.organizationCode ?? 'Ваше хозяйство'}</h2>
        <p>{props.context?.fieldCount ?? '—'} участков · данные на {formatDate(props.context?.serverDate)} (последний расчёт: {formatDateTimeMoscow(props.context?.lastCalculationFinishedAt)} МСК)</p>
      </section>
      <section className="metric-grid" aria-label="Сводка">
        <Metric label="Подготовлено" value={`${props.draft?.items.length ?? 0} изменений`} />
      </section>
      <section className="action-grid">
        <button className="action-card" onClick={props.onFields}><span>▦</span><b>Мои участки</b><small>Статус и данные</small></button>
        <button className="action-card" onClick={() => props.onForm('irrigation')}><span>◉</span><b>Добавить полив</b><small>Факт или план</small></button>
        <button className="action-card" onClick={() => props.onForm('precipitation')}><span>⌁</span><b>Добавить осадки</b><small>Ручные данные</small></button>
      </section>
    </>
  );
}

function Fields({ fields, onSelect }: { fields: Field[]; onSelect(field: Field): void }) {
  if (!fields.length) return <Empty text="Доступные участки не найдены." />;
  return <section className="list">{fields.map((field) => (
    <button className="list-card" key={field.fieldSeasonId} onClick={() => onSelect(field)}>
      <div><b>{field.fieldName || field.fieldKey}</b><span>{field.cropName ?? 'Культура не указана'} · {formatArea(field.areaHa)}</span></div><span>›</span>
    </button>
  ))}</section>;
}

function FieldCard({ details, onForm }: { details: FieldDetails; onForm(type: 'irrigation' | 'precipitation', field: Field): void }) {
  const status = details.status;
  const moisture = percentage(status?.soil_water_content_mm, status?.soil_field_capacity_water_mm);
  return <>
    <section className="hero-card field-hero"><span className="eyebrow">Участок</span><h2>{details.field.fieldName || details.field.fieldKey}</h2><p>{details.field.cropName ?? 'Культура не указана'} · {formatArea(details.field.areaHa)}</p></section>
    <section className="details-card">
      <Row label="Статус" value={statusLabel(status?.latestStatus)} />
      <Row label="Влага в почве" value={moisture === null ? 'Нет данных' : `${moisture}% НВ`} />
      <Row label="Водный стресс" value={status?.water_stress_coefficient === 1 ? 'нет' : formatNumber(status?.water_stress_coefficient, 2)} />
      <Row label="Рекомендация" value={status?.recommended_irrigation_mm ? `${formatNumber(status.recommended_irrigation_mm)} мм` : 'Полив не требуется'} />
      <Row label="Дата данных" value={formatDate(status?.day)} />
    </section>
    <div className="sticky-actions"><button onClick={() => onForm('irrigation', details.field)}>Добавить полив</button><button className="secondary" onClick={() => onForm('precipitation', details.field)}>Добавить осадки</button></div>
  </>;
}

function OperationForm(props: {
  type: 'irrigation' | 'precipitation';
  fields: Field[];
  context: Context | null;
  disabled: boolean;
  onSubmit(item: { type: 'irrigation' | 'precipitation'; fieldId: string; date: string; millimeters: number; methodCode?: string }): void;
}) {
  const [fieldId, setFieldId] = useState(props.fields[0]?.fieldSeasonId ?? '');
  const [date, setDate] = useState(props.context?.serverDate ?? new Date().toISOString().slice(0, 10));
  const [millimeters, setMillimeters] = useState('');
  const [methodCode, setMethodCode] = useState(props.context?.defaultMethodCode ?? '');
  const mm = Number(millimeters.replace(',', '.'));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!fieldId || !date || !Number.isFinite(mm) || mm <= 0 || mm > 500) return;
    props.onSubmit({ type: props.type, fieldId, date, millimeters: mm, ...(props.type === 'irrigation' && methodCode ? { methodCode } : {}) });
  }
  return <form className="form-card" onSubmit={submit}>
    <label>Участок<select value={fieldId} onChange={(event) => setFieldId(event.target.value)} required>{props.fields.map((field) => <option key={field.fieldSeasonId} value={field.fieldSeasonId}>{field.fieldName || field.fieldKey}</option>)}</select></label>
    <label>Дата<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
    <label>Количество, мм<input inputMode="decimal" type="number" min="0.1" max="500" step="0.1" placeholder="Например, 12.5" value={millimeters} onChange={(event) => setMillimeters(event.target.value)} required /></label>
    {props.type === 'irrigation' && props.context?.availableMethods.length ? <label>Метод полива<select value={methodCode} onChange={(event) => setMethodCode(event.target.value)}>{props.context.availableMethods.map((method) => <option key={method.methodCode} value={method.methodCode}>{method.label}</option>)}</select></label> : null}
    <button type="submit" disabled={props.disabled || !fieldId || !date || !Number.isFinite(mm) || mm <= 0 || mm > 500}>Добавить в список</button>
  </form>;
}

function DraftView(props: { draft: Draft | null; disabled: boolean; onRemove(id: string): void; onAdd(): void; onClear(): void; onConfirm(): void }) {
  if (!props.draft?.items.length) return <Empty text="Подготовленных изменений пока нет." />;
  return <>
    <section className="list">{props.draft.items.map((item) => <article className="draft-card" key={item.id}><div><span className={`kind ${item.type}`}>{item.type === 'irrigation' ? 'Полив' : 'Осадки'}</span><h3>{item.fieldName || item.fieldKey}</h3><p>{formatDate(item.date)} · {formatNumber(item.millimeters)} мм</p>{item.methodCode && <small>{item.methodCode}</small>}</div><button className="text-button danger" disabled={props.disabled} onClick={() => props.onRemove(item.id)}>Удалить</button></article>)}</section>
    <div className="stack-actions"><button onClick={props.onConfirm}>Отправить изменения</button><button className="secondary" onClick={props.onAdd}>Добавить ещё</button><button className="text-button danger" onClick={props.onClear}>Отменить всё</button></div>
  </>;
}

function Confirmation({ draft, disabled, onBack, onSubmit }: { draft: Draft | null; disabled: boolean; onBack(): void; onSubmit(): void }) {
  return <section className="confirm-card"><div className="confirm-icon">✓</div><h2>Проверьте изменения</h2><p>Будет записано операций: <b>{draft?.items.length ?? 0}</b>. После подтверждения POLIV360 обновит данные и поставит единый расчёт в очередь.</p><ul>{draft?.items.map((item) => <li key={item.id}>{item.fieldName}: {item.type === 'irrigation' ? 'полив' : 'осадки'} {formatNumber(item.millimeters)} мм, {formatDate(item.date)}</li>)}</ul><button disabled={disabled || !draft?.items.length} onClick={onSubmit}>{disabled ? 'Отправляем…' : 'Подтвердить отправку'}</button><button className="secondary" disabled={disabled} onClick={onBack}>Вернуться к списку</button></section>;
}

function Result({ result, onHome }: { result: SubmitResult; onHome(): void }) {
  const title = result.status === 'success' ? 'Изменения отправлены' : result.status === 'partial' ? 'Отправлено частично' : 'Не удалось отправить';
  return <section className="confirm-card"><div className={`confirm-icon ${result.status}`}>{result.status === 'success' ? '✓' : '!'}</div><h2>{title}</h2><p>Успешно: {result.successfulItemIds.length}. Отклонено: {result.failed.length}.</p>{result.failed.length > 0 && <ul>{result.failed.map((item) => <li key={item.itemId}>{item.message}</li>)}</ul>}<button onClick={onHome}>На главный экран</button></section>;
}

function Unlinked({ identity, onOpen, development }: { identity: Exclude<Identity, { status: 'linked' }>; onOpen(url: string): void; development: boolean }) {
  const unavailable = identity.status === 'temporarily_unavailable';
  return <div className="center-page">{development && <div className="dev-banner">Режим разработки</div>}<div className="logo">P360</div><span className="eyebrow">POLIV360</span><h1>{unavailable ? 'Сервис временно недоступен' : 'Подключите POLIV360'}</h1><p>{unavailable ? 'Не удалось проверить связь аккаунта. Попробуйте позднее.' : 'Ваш аккаунт MAX пока не связан с аккаунтом POLIV360.'}</p>{identity.linkUrl && <button onClick={() => onOpen(identity.linkUrl!)}>Подключить аккаунт</button>}</div>;
}

function Loading({ text }: { text: string }) { return <div className="center-page"><div className="logo pulse">P360</div><span className="eyebrow">POLIV360</span><h1>{text}</h1><div className="loader" /></div>; }
function StatusPage({ title, text, action, onAction }: { title: string; text: string; action: string; onAction(): void }) { return <div className="center-page"><div className="logo">!</div><h1>{title}</h1><p>{text}</p><button onClick={onAction}>{action}</button></div>; }
function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) { return <article className="metric-card"><span>{label}</span><b className={tone}>{value}</b></article>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><b>{value}</b></div>; }
function Empty({ text }: { text: string }) { return <div className="empty"><div>○</div><p>{text}</p></div>; }
function titleFor(view: View) { return ({ home: 'Обзор', fields: 'Мои участки', field: 'Участок', irrigation: 'Добавить полив', precipitation: 'Добавить осадки', draft: 'Изменения', confirm: 'Подтверждение', result: 'Результат' } as const)[view]; }
function formatDate(value?: string | null) { if (!value) return '—'; const [year, month, day] = value.slice(0, 10).split('-'); return year && month && day ? `${day}.${month}.${year}` : value; }
function formatDateTimeMoscow(value?: string | null) {
  if (!value) return 'Нет данных';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Нет данных' : new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}
function formatArea(value: number | null) { return value === null ? 'площадь не указана' : `${formatNumber(value)} га`; }
function formatNumber(value?: number | null, digits = 1) { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value) : 'Нет данных'; }
function percentage(value?: number | null, capacity?: number | null) { return typeof value === 'number' && typeof capacity === 'number' && capacity > 0 ? Math.round(value / capacity * 100) : null; }
function statusLabel(value?: string) { return ({ pass: 'Готово', ready: 'Работает', pending: 'Ожидание', degraded: 'Ограничено', fail: 'Ошибка', not_ready: 'Не готово', ok: 'Норма', warning: 'Внимание', critical: 'Критично', no_data: 'Нет данных', completed: 'Завершён' } as Record<string, string>)[value ?? ''] ?? value ?? 'Нет данных'; }
function errorMessage(error: unknown) { if (error instanceof ApiClientError) return error.message; if (error instanceof TypeError) return 'Нет связи с сервисом. Проверьте интернет.'; return error instanceof Error ? error.message : 'Произошла неизвестная ошибка.'; }
