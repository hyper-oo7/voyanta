import { useState, useEffect } from 'react';

const PALETTE_COLORS = [
  '#0b1c30', // Navy / Default
  '#1B263B', // Oxford Blue
  '#1a3622', // Forest Green
  '#2c1e16', // Deep Espresso
  '#4a2c2a', // Burgundy
  '#2C3E50', // Midnight
  '#3C4A3E', // Sage Dark
  '#181818', // Obsidian
];

export default function ColorPicker({ value, onChange, label = 'Primary Color', testid }) {
  const defaultColor = '#0b1c30';
  const [hexInput, setHexInput] = useState(value || defaultColor);
  const [recentColors, setRecentColors] = useState([]);

  // Load recently used colors from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('voyanta_recent_colors');
      if (stored) {
        setRecentColors(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Update input state when value prop changes
  useEffect(() => {
    if (value) {
      setHexInput(value);
    }
  }, [value]);

  const updateColor = (newColor) => {
    // Basic hex validation
    let formatted = newColor;
    if (!formatted.startsWith('#')) {
      formatted = '#' + formatted;
    }
    
    // Validate if it is a valid hex color
    const isHex = /^#[0-9A-F]{6}$/i.test(formatted);
    
    setHexInput(newColor);
    
    if (isHex) {
      onChange({ target: { value: formatted } });
      addToRecent(formatted);
    }
  };

  const addToRecent = (color) => {
    if (!color || color === defaultColor) return;
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== color);
      const next = [color, ...filtered].slice(0, 6);
      try {
        localStorage.setItem('voyanta_recent_colors', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-xs" data-testid={testid}>
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      
      {/* Live Preview and Hex Input */}
      <div className="flex items-center gap-sm flex-wrap">
        {/* Live color circle & Native picker clicker */}
        <label className="relative w-10 h-10 rounded-lg border border-outline-variant shadow-sm cursor-pointer overflow-hidden flex-shrink-0 flex items-center justify-center hover:scale-105 transition-transform"
          style={{ backgroundColor: value || defaultColor }}>
          <input
            type="color"
            value={value || defaultColor}
            onChange={(e) => updateColor(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            data-testid={`${testid}-native`}
          />
          <span className="material-symbols-outlined text-white text-[18px] drop-shadow-md select-none pointer-events-none">colorize</span>
        </label>
        
        {/* Hex input field */}
        <input
          type="text"
          value={hexInput}
          onChange={(e) => updateColor(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-md py-md bg-white border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20 uppercase"
          data-testid={`${testid}-input`}
        />

        {/* Reset to default */}
        <button
          type="button"
          onClick={() => updateColor(defaultColor)}
          className="px-md py-md border border-outline-variant hover:bg-surface-container-low rounded-lg font-label-md text-on-surface transition-colors"
          title="Reset to Default Brand Color"
        >
          Default
        </button>
      </div>

      {/* Preset Visual Palette */}
      <div className="mt-xs">
        <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold mb-1">Color Palette</p>
        <div className="flex flex-wrap gap-xs">
          {PALETTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => updateColor(c)}
              className={`w-6 h-6 rounded-full border transition-all hover:scale-110 ${value === c ? 'border-primary scale-110 ring-2 ring-primary/20' : 'border-outline-variant'}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Recently Used Colors */}
      {recentColors.length > 0 && (
        <div className="mt-xs">
          <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold mb-1">Recent Colors</p>
          <div className="flex flex-wrap gap-xs">
            {recentColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateColor(c)}
                className={`w-6 h-6 rounded-full border transition-all hover:scale-110 ${value === c ? 'border-primary scale-110 ring-2 ring-primary/20' : 'border-outline-variant'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
