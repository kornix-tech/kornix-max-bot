import { describe, expect, it } from 'vitest';
import { backView } from './navigation';

describe('navigation', () => {
  it('returns from confirmation to the draft', () => expect(backView('confirm')).toBe('draft'));
  it('returns from a field to the list', () => expect(backView('field')).toBe('fields'));
  it('returns primary screens to home', () => {
    for (const view of ['irrigation', 'precipitation', 'methods', 'draft', 'result'] as const) {
      expect(backView(view)).toBe('home');
    }
  });
});
