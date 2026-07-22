type MaxBackButton = {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
};

type MaxWebApp = {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  platform?: 'ios' | 'android' | 'desktop' | 'web' | string;
  version?: string;
  deviceName?: string;
  openLink?(url: string): void;
  openMaxLink?(url: string): void;
  enableClosingConfirmation?(): void;
  disableClosingConfirmation?(): void;
  BackButton?: MaxBackButton;
};

declare global {
  interface Window { WebApp?: MaxWebApp }
}

export type MaxBridge = {
  available: boolean;
  initData: string;
  startParam: string | null;
  platform: string | null;
  version: string | null;
  openLink(url: string): void;
  openMaxLink(url: string): void;
  setUnsavedChanges(enabled: boolean): void;
  setBackHandler(handler: (() => void) | null): () => void;
};

export function createMaxBridge(source: Window = window): MaxBridge {
  const app = source.WebApp;
  return {
    available: Boolean(app),
    initData: app?.initData ?? '',
    startParam: app?.initDataUnsafe?.start_param ?? null,
    platform: app?.platform ?? null,
    version: app?.version ?? null,
    openLink: (url) => app?.openLink ? app.openLink(url) : source.open(url, '_blank', 'noopener'),
    openMaxLink: (url) => app?.openMaxLink ? app.openMaxLink(url) : source.open(url, '_blank', 'noopener'),
    setUnsavedChanges: (enabled) => enabled
      ? app?.enableClosingConfirmation?.()
      : app?.disableClosingConfirmation?.(),
    setBackHandler: (handler) => {
      if (!app?.BackButton) return () => undefined;
      if (!handler) {
        app.BackButton.hide();
        return () => undefined;
      }
      app.BackButton.show();
      app.BackButton.onClick(handler);
      return () => {
        app.BackButton?.offClick(handler);
        app.BackButton?.hide();
      };
    }
  };
}
