export type MaxWebhookEvent = {
  eventType?: string;
  eventId?: string;
  timestamp?: number;
  payload?: unknown;
};

export type MaxWebhookVerification = {
  isValid: boolean;
  reason?: string;
};

export type MaxWebhookHandler = {
  verify(rawBody: string, headers: Record<string, string | string[] | undefined>): MaxWebhookVerification;
  parse(rawBody: string): MaxWebhookEvent | null;
};
