import { describe, expect, it, vi } from 'vitest';
import { createMaxBridge } from './maxBridge';

describe('MAX Bridge adapter', () => {
  it('is safe outside MAX', () => {
    const open = vi.fn();
    const bridge = createMaxBridge({ open } as unknown as Window);
    expect(bridge.available).toBe(false);
    expect(bridge.initData).toBe('');
    bridge.openLink('https://poliv360.ru');
    expect(open).toHaveBeenCalledOnce();
  });

  it('reads launch data and cleans up BackButton listeners', () => {
    const onClick = vi.fn();
    const offClick = vi.fn();
    const show = vi.fn();
    const hide = vi.fn();
    const source = {
      WebApp: {
        initData: 'signed',
        initDataUnsafe: { start_param: 'field_1' },
        platform: 'android',
        BackButton: { onClick, offClick, show, hide }
      }
    } as unknown as Window;
    const bridge = createMaxBridge(source);
    const handler = vi.fn();
    const cleanup = bridge.setBackHandler(handler);
    expect(bridge.initData).toBe('signed');
    expect(bridge.startParam).toBe('field_1');
    expect(show).toHaveBeenCalledOnce();
    cleanup();
    expect(offClick).toHaveBeenCalledWith(handler);
    expect(hide).toHaveBeenCalledOnce();
  });
});
