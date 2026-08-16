import { describe, it, expect } from 'vitest';
import { scuraColore } from './colorUtils';

describe('scuraColore', () => {
  it('con frazione 0 restituisce lo stesso colore', () => {
    expect(scuraColore('#4f46e5', 0)).toBe('#4f46e5');
  });

  it('con frazione 1 restituisce nero puro', () => {
    expect(scuraColore('#4f46e5', 1)).toBe('#000000');
  });

  it('con frazione intermedia scurisce proporzionalmente ogni canale', () => {
    expect(scuraColore('#ffffff', 0.5)).toBe('#808080');
  });
});
