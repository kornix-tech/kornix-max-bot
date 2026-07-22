import { randomUUID } from 'node:crypto';
import type { FieldSeasonCatalogFieldDto } from '../kornix/kornixTypes.js';

export type MiniAppDraftItem = {
  id: string;
  type: 'irrigation' | 'precipitation';
  field: FieldSeasonCatalogFieldDto;
  date: string;
  millimeters: number;
  methodCode?: string;
};

export type DraftSubmitResult = {
  status: 'success' | 'partial' | 'failed';
  successfulItemIds: string[];
  failed: Array<{ itemId: string; message: string }>;
};

export type MiniAppDraft = {
  id: string;
  items: MiniAppDraftItem[];
  submitting: boolean;
  lastIdempotencyKey: string | null;
  lastResult: DraftSubmitResult | null;
};

export class MiniAppDraftStore {
  private readonly drafts = new Map<string, MiniAppDraft>();

  current(sessionId: string): MiniAppDraft | null {
    return this.drafts.get(sessionId) ?? null;
  }

  create(sessionId: string): MiniAppDraft {
    const draft: MiniAppDraft = {
      id: randomUUID(),
      items: [],
      submitting: false,
      lastIdempotencyKey: null,
      lastResult: null
    };
    this.drafts.set(sessionId, draft);
    return draft;
  }

  add(sessionId: string, item: Omit<MiniAppDraftItem, 'id'>): MiniAppDraftItem {
    const draft = this.current(sessionId) ?? this.create(sessionId);
    if (draft.items.length >= 50) {
      throw new Error('draft_item_limit');
    }
    const created: MiniAppDraftItem = { ...item, id: randomUUID() };
    draft.items.push(created);
    draft.lastIdempotencyKey = null;
    draft.lastResult = null;
    return created;
  }

  removeItem(sessionId: string, itemId: string): boolean {
    const draft = this.current(sessionId);
    if (!draft) {
      return false;
    }
    const before = draft.items.length;
    draft.items = draft.items.filter((item) => item.id !== itemId);
    return draft.items.length !== before;
  }

  clear(sessionId: string): void {
    this.drafts.delete(sessionId);
  }
}
