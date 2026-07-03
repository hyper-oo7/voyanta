import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ImageUploadInput from './ImageUploadInput.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const UNSPLASH_PRESETS = [
  { label: 'Luxury Resort', url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Safari Sunset', url: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Tropical Beach', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Alpine Mountains', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Fine Dining', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Private Jet', url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80' },
];

const COLOR_PRESETS = [
  '#ffffff', '#fdfbf7', '#0f172a', '#1a1a1a', '#10b981', '#3b82f6', '#d4af37', '#e11d48', '#8b5cf6', '#ea580c'
];

export default function InlineStudioPopover({ target, onClose, branding, setBranding, onApplyOverride }) {
  const toast = useToast();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [editorType, setEditorType] = useState('text'); // 'text', 'image', 'section'
  
  // State for editors
  const [textVal, setTextVal] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [fontSize, setFontSize] = useState('16px');
  const [fontWeight, setFontWeight] = useState('normal');
  const [textAlign, setTextAlign] = useState('left');
  
  const [imageSrc, setImageSrc] = useState('');
  const [objectFit, setObjectFit] = useState('cover');
  const [borderRadius, setBorderRadius] = useState('8px');
  
  const [bgColor, setBgColor] = useState('#ffffff');
  const [padding, setPadding] = useState('24px');

  useEffect(() => {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    
    // Calculate placement to avoid overflowing viewport
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - 380);
    const top = rect.top > 340 ? rect.top - 330 : rect.bottom + 12;
    setPosition({ top: Math.max(12, top), left });
    
    // Determine type
    const tagName = target.tagName.toLowerCase();
    const isImage = tagName === 'img' || target.style.backgroundImage || target.classList.contains('bg-cover');
    const isSection = tagName === 'section' || target.classList.contains('editorial-section') || target.classList.contains('glass-card');
    
    if (isImage) {
      setEditorType('image');
      setImageSrc(target.src || target.getAttribute('src') || '');
      setObjectFit(target.style.objectFit || 'cover');
      setBorderRadius(target.style.borderRadius || '8px');
    } else if (isSection && target.children.length > 2) {
      setEditorType('section');
      setBgColor(target.style.backgroundColor || '#ffffff');
      setPadding(target.style.padding || '24px');
    } else {
      setEditorType('text');
      setTextVal(target.innerText || '');
      const compStyle = window.getComputedStyle(target);
      setTextColor(target.style.color || compStyle.color || '#000000');
      setFontSize(target.style.fontSize || compStyle.fontSize || '16px');
      setFontWeight(target.style.fontWeight || compStyle.fontWeight || 'normal');
      setTextAlign(target.style.textAlign || compStyle.textAlign || 'left');
    }
  }, [target]);

  if (!target) return null;

  const handleApplyText = () => {
    target.innerText = textVal;
    target.style.color = textColor;
    target.style.fontSize = fontSize;
    target.style.fontWeight = fontWeight;
    target.style.textAlign = textAlign;
    
    const elementKey = target.id || target.getAttribute('data-testid') || `el-${Math.random().toString(36).substr(2, 6)}`;
    if (!target.id) target.id = elementKey;
    
    if (onApplyOverride) {
      onApplyOverride(elementKey, {
        type: 'text',
        text: textVal,
        color: textColor,
        fontSize,
        fontWeight,
        textAlign
      });
    }
    toast?.success('Text & typography styling applied!');
    onClose();
  };

  const handleApplyImage = (src = imageSrc) => {
    if (target.tagName.toLowerCase() === 'img') {
      target.src = src;
      target.style.objectFit = objectFit;
      target.style.borderRadius = borderRadius;
    } else {
      target.style.backgroundImage = `url("${src}")`;
      target.style.backgroundSize = objectFit;
      target.style.borderRadius = borderRadius;
    }
    
    const elementKey = target.id || `img-${Math.random().toString(36).substr(2, 6)}`;
    if (!target.id) target.id = elementKey;
    
    if (onApplyOverride) {
      onApplyOverride(elementKey, {
        type: 'image',
        src,
        objectFit,
        borderRadius
      });
    }
    toast?.success('Image customization applied!');
    onClose();
  };

  const handleApplySection = () => {
    target.style.backgroundColor = bgColor;
    target.style.padding = padding;
    
    const elementKey = target.id || `sec-${Math.random().toString(36).substr(2, 6)}`;
    if (!target.id) target.id = elementKey;
    
    if (onApplyOverride) {
      onApplyOverride(elementKey, {
        type: 'section',
        backgroundColor: bgColor,
        padding
      });
    }
    toast?.success('Section styling updated!');
    onClose();
  };

  const handleAiPolish = (tone) => {
    let polished = textVal;
    if (tone === 'luxury') {
      polished = textVal.replace(/tour|trip/gi, 'Exclusive Odyssey').replace(/hotel/gi, '5-Star Sanctuary');
      if (!polished.includes('✨')) polished = `✨ ${polished}`;
    } else if (tone === 'concise') {
      polished = textVal.split('. ')[0] + '.';
    } else if (tone === 'enthusiastic') {
      polished = textVal.endsWith('!') ? textVal : `${textVal} — Unforgettable Memories Await!`;
    }
    setTextVal(polished);
    toast?.info(`Applied ${tone} tone polish! Click Apply to save.`);
  };

  return createPortal(
    <div 
      className="fixed z-[9999] w-[360px] bg-surface border border-outline-variant rounded-2xl shadow-2xl p-4 animate-fade-in no-print"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            {editorType === 'image' ? 'image' : editorType === 'section' ? 'layers' : 'edit_note'}
          </span>
          <span className="font-bold text-sm text-on-surface uppercase tracking-wider">
            {editorType === 'image' ? 'Media Studio' : editorType === 'section' ? 'Section Studio' : 'Inline Text Editor'}
          </span>
        </div>
        <button 
          onClick={onClose} 
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      {/* TEXT EDITOR */}
      {editorType === 'text' && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Content</label>
            {textVal.length > 60 || textVal.includes('\n') ? (
              <textarea 
                rows={3} 
                value={textVal} 
                onChange={(e) => setTextVal(e.target.value)} 
                className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-xs text-on-surface focus:border-primary focus:outline-none"
              />
            ) : (
              <input 
                type="text" 
                value={textVal} 
                onChange={(e) => setTextVal(e.target.value)} 
                className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-xs text-on-surface focus:border-primary focus:outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">✨ AI Tone Polish</label>
            <div className="flex gap-1.5 flex-wrap">
              <button type="button" onClick={() => handleAiPolish('luxury')} className="px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[11px] transition-colors">👑 Luxury</button>
              <button type="button" onClick={() => handleAiPolish('enthusiastic')} className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-bold text-[11px] transition-colors">🔥 Enthusiastic</button>
              <button type="button" onClick={() => handleAiPolish('concise')} className="px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 font-bold text-[11px] transition-colors">✂️ Concise</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Text Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={textColor.startsWith('#') ? textColor : '#000000'} onChange={(e) => setTextColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                <span className="font-mono text-[11px] text-on-surface-variant truncate">{textColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Font Weight</label>
              <select value={fontWeight} onChange={(e) => setFontWeight(e.target.value)} className="w-full px-2 py-1.5 rounded bg-surface-container-lowest border border-outline-variant text-[11px]">
                <option value="normal">Normal</option>
                <option value="600">Semi-Bold (600)</option>
                <option value="bold">Bold (700)</option>
                <option value="800">Extra Bold (800)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Font Size</label>
              <input type="text" value={fontSize} onChange={(e) => setFontSize(e.target.value)} placeholder="16px" className="w-full px-2 py-1.5 rounded bg-surface-container-lowest border border-outline-variant text-[11px]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Alignment</label>
              <div className="flex border border-outline-variant rounded overflow-hidden">
                {['left', 'center', 'right'].map((align) => (
                  <button 
                    key={align} 
                    type="button" 
                    onClick={() => setTextAlign(align)}
                    className={`flex-1 py-1 text-center text-xs ${textAlign === align ? 'bg-primary text-white font-bold' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'}`}
                  >
                    <span className={`material-symbols-outlined text-sm`}>format_align_{align}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={handleApplyText} className="w-full mt-2 py-2.5 bg-primary text-white font-bold text-xs rounded-xl shadow hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-sm">check</span> Apply Typography
          </button>
        </div>
      )}

      {/* IMAGE EDITOR */}
      {editorType === 'image' && (
        <div className="space-y-3">
          <ImageUploadInput 
            value={imageSrc} 
            onChange={(val) => setImageSrc(val)} 
            label="Image Source / URL" 
          />

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1.5">✨ Quick Luxury Presets</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pr-1">
              {UNSPLASH_PRESETS.map((preset) => (
                <button 
                  key={preset.label} 
                  type="button" 
                  onClick={() => { setImageSrc(preset.url); handleApplyImage(preset.url); }}
                  className="p-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-primary/10 hover:border-primary text-[11px] text-left text-on-surface font-medium truncate flex items-center gap-1 transition-all"
                >
                  <span className="material-symbols-outlined text-[14px] text-primary">photo_library</span>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Object Fit</label>
              <select value={objectFit} onChange={(e) => setObjectFit(e.target.value)} className="w-full px-2 py-1.5 rounded bg-surface-container-lowest border border-outline-variant text-[11px]">
                <option value="cover">Cover (Fill & Crop)</option>
                <option value="contain">Contain (Show All)</option>
                <option value="fill">Fill (Stretch)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Corner Radius</label>
              <select value={borderRadius} onChange={(e) => setBorderRadius(e.target.value)} className="w-full px-2 py-1.5 rounded bg-surface-container-lowest border border-outline-variant text-[11px]">
                <option value="0px">Sharp (0px)</option>
                <option value="8px">Rounded (8px)</option>
                <option value="16px">Smooth (16px)</option>
                <option value="9999px">Pill / Circle</option>
              </select>
            </div>
          </div>

          <button onClick={() => handleApplyImage()} className="w-full mt-2 py-2.5 bg-primary text-white font-bold text-xs rounded-xl shadow hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-sm">check</span> Apply Image
          </button>
        </div>
      )}

      {/* SECTION EDITOR */}
      {editorType === 'section' && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1.5">Background Palette</label>
            <div className="flex gap-1.5 flex-wrap">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setBgColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-6 h-6 rounded-full border border-outline-variant shadow-sm transition-transform ${bgColor === color ? 'scale-125 ring-2 ring-primary ring-offset-1' : 'hover:scale-110'}`}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Custom Color</label>
              <input type="color" value={bgColor.startsWith('#') ? bgColor : '#ffffff'} onChange={(e) => setBgColor(e.target.value)} className="w-full h-8 rounded cursor-pointer border-0 bg-transparent" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Padding Density</label>
              <select value={padding} onChange={(e) => setPadding(e.target.value)} className="w-full px-2 py-1.5 rounded bg-surface-container-lowest border border-outline-variant text-[11px]">
                <option value="12px">Compact (12px)</option>
                <option value="24px">Normal (24px)</option>
                <option value="48px">Spacious (48px)</option>
              </select>
            </div>
          </div>

          <button onClick={handleApplySection} className="w-full mt-2 py-2.5 bg-primary text-white font-bold text-xs rounded-xl shadow hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-sm">check</span> Apply Section Styling
          </button>
        </div>
      )}
    </div>
  , document.body);
}
