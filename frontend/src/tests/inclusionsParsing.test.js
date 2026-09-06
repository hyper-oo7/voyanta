import { describe, it, expect } from 'vitest';

const safeList = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(item => {
      if (item == null) return '';
      if (typeof item === 'string') return item;
      if (typeof item === 'number' || typeof item === 'boolean') return String(item);
      return item.text || item.content || item.name || item.title || item.label || JSON.stringify(item);
    }).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split('\n').map(s => s.trim()).filter(Boolean);
  }
  if (typeof raw === 'object') {
    if (raw.content) return safeList(raw.content);
    if (raw.items) return safeList(raw.items);
    if (raw.inclusions) return safeList(raw.inclusions);
    if (raw.exclusions) return safeList(raw.exclusions);
    return Object.values(raw).map(v => typeof v === 'string' ? v : JSON.stringify(v)).filter(Boolean);
  }
  return [String(raw)];
};

describe('safeList resilient parser for inclusions, exclusions and terms', () => {
  it('handles array of strings without calling .split', () => {
    const arrayInput = ['Airport pickup & drop', 'Daily Breakfast', 'Sightseeing in private cab'];
    const result = safeList(arrayInput);
    expect(result).toEqual(['Airport pickup & drop', 'Daily Breakfast', 'Sightseeing in private cab']);
  });

  it('handles multiline string input', () => {
    const stringInput = 'Airport pickup\nDaily Breakfast\nSightseeing in private cab';
    const result = safeList(stringInput);
    expect(result).toEqual(['Airport pickup', 'Daily Breakfast', 'Sightseeing in private cab']);
  });

  it('handles null, undefined, and empty values gracefully', () => {
    expect(safeList(null)).toEqual([]);
    expect(safeList(undefined)).toEqual([]);
    expect(safeList('')).toEqual([]);
  });

  it('handles object with items or content properties', () => {
    const objInput = { items: ['Item 1', 'Item 2'] };
    expect(safeList(objInput)).toEqual(['Item 1', 'Item 2']);
  });
});
