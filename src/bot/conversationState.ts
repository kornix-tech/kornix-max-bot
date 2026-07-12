import type { FieldSeasonCatalogFieldDto } from '../kornix/kornixTypes.js';
import type { MaxId } from '../max/maxTypes.js';

export type InputKind = 'water' | 'rain';

export type PendingFieldInput = {
  kind: InputKind;
  field: FieldSeasonCatalogFieldDto;
  date: string;
  mm: number;
};

export type ConversationState = {
  lastFields: FieldSeasonCatalogFieldDto[];
  selectedField: FieldSeasonCatalogFieldDto | null;
  awaitingInput: InputKind | null;
  inputDate: string | null;
  pendingInput: PendingFieldInput | null;
};

export class ConversationStateStore {
  private readonly states = new Map<string, ConversationState>();

  get(userId: MaxId, chatId: MaxId | null): ConversationState {
    const key = this.key(userId, chatId);
    const existing = this.states.get(key);
    if (existing) {
      return existing;
    }
    const created: ConversationState = {
      lastFields: [],
      selectedField: null,
      awaitingInput: null,
      inputDate: null,
      pendingInput: null
    };
    this.states.set(key, created);
    return created;
  }

  clear(userId: MaxId, chatId: MaxId | null): void {
    this.states.delete(this.key(userId, chatId));
  }

  private key(userId: MaxId, chatId: MaxId | null): string {
    return chatId === null ? `user:${userId}` : `chat:${chatId}:user:${userId}`;
  }
}
