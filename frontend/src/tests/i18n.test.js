import { describe, it, expect } from 'vitest';
import { getLabel, SUPPORTED_LANGUAGES, TRANSLATIONS } from '../lib/i18n.js';

describe('i18n translation engine', () => {
  it('supports all 7 required languages', () => {
    const codes = SUPPORTED_LANGUAGES.map(l => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('hi');
    expect(codes).toContain('bn');
    expect(codes).toContain('gu');
    expect(codes).toContain('mr');
    expect(codes).toContain('es');
    expect(codes).toContain('fr');
  });

  it('resolves English labels correctly', () => {
    expect(getLabel('destinationOverview', 'en')).toBe('Destination Overview');
    expect(getLabel('inclusions', 'en')).toBe('Inclusions');
  });

  it('resolves Hindi (hi) labels correctly', () => {
    expect(getLabel('destinationOverview', 'hi')).toBe('गंतव्य अवलोकन और आकर्षण');
    expect(getLabel('inclusions', 'hi')).toBe('शामिल सुविधाएं');
  });

  it('resolves Bangla (bn) labels correctly', () => {
    expect(getLabel('destinationOverview', 'bn')).toBe('গন্তব্য পরিচিতি ও আকর্ষণ');
    expect(getLabel('inclusions', 'bn')).toBe('অন্তর্ভুক্ত বিষয়সমূহ');
  });

  it('resolves Gujarati (gu) labels correctly', () => {
    expect(getLabel('destinationOverview', 'gu')).toBe('સ્થળ પરિચય અને આકર્ષણ');
    expect(getLabel('inclusions', 'gu')).toBe('સમાવિષ્ટ સુવિધાઓ');
  });

  it('resolves Marathi (mr) labels correctly', () => {
    expect(getLabel('destinationOverview', 'mr')).toBe('पर्यटन स्थळ परिचय आणि आकर्षणे');
    expect(getLabel('inclusions', 'mr')).toBe('समाविष्ट बाबी');
  });

  it('falls back to English when label is missing or lang is invalid', () => {
    expect(getLabel('destinationOverview', 'xx')).toBe('Destination Overview');
  });
});
