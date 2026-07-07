import { describe, it, expect } from 'vitest';
import { generateQrSvg } from '../lib/qrEngine.js';

describe('qrEngine SVG generator', () => {
  it('generates valid SVG string for short text', () => {
    const svg = generateQrSvg('upi://pay?pa=test@okaxis&pn=Test&am=100.00');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('<path d="');
    expect(svg).toContain('</svg>');
  });

  it('adjusts size when specified', () => {
    const svg = generateQrSvg('test data', 200, '#ff0000', '#000000');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="200"');
    expect(svg).toContain('fill="#ff0000"');
  });

  it('handles longer strings without crashing', () => {
    const longString = 'https://voyanta.com/proposal/preview/' + 'a'.repeat(150);
    const svg = generateQrSvg(longString);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});
