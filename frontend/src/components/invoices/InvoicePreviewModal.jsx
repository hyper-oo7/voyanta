import { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { updateInvoice, INVOICE_STATUSES, generateRemainingBalanceInvoice } from '../../services/invoiceService.js';
import { UpiQrGenerator, formatCurrency } from './UpiQrGenerator.jsx';
import { ReceiptPreviewModal } from './ReceiptPreviewModal.jsx';
import { InvoiceShareModal } from './InvoiceShareModal.jsx';
import { translateCommonTermsOffline } from '../../lib/i18n.js';

export function InvoicePreviewModal({ invoice, onClose, onUpdate }) {
  const toast = useToast();
  const printRef = useRef(null);
  
  const [current, setCurrent] = useState(invoice || {});
  const t = (str) => translateCommonTermsOffline(str, current.language || 'en');
  const [theme, setTheme] = useState(invoice?.theme_style || 'safari');
  const [saving, setSaving] = useState(false);
  
  // Modals
  const [showReceipt, setShowReceipt] = useState(false);
  const [showShare, setShowShare] = useState(false);
  
  // Custom columns support
  const [columns, setColumns] = useState(() => {
    return current?.custom_columns || [
      { id: 'description', label: 'Description / Item', type: 'text', width: 'w-1/2' },
      { id: 'qty', label: 'Qty / Days', type: 'number', width: 'w-20 text-center' },
      { id: 'rate', label: 'Rate', type: 'number', width: 'w-28 text-right' },
      { id: 'amount', label: 'Amount', type: 'number', width: 'w-32 text-right' }
    ];
  });
  const [newColName, setNewColName] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);

  const recalcTotals = (state, newItems = null, newTaxes = null, newTaxRate = undefined) => {
    const items = newItems || state.items || [];
    const sub = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
    let taxes = newTaxes || state.taxes;
    let tax = 0;
    let taxRate = newTaxRate !== undefined ? Number(newTaxRate) : Number(state.tax_rate || 5);

    if (Array.isArray(taxes) && taxes.length > 0) {
      taxes = taxes.map(t => {
        const r = t.rate !== undefined ? Number(t.rate) : taxRate;
        return { ...t, rate: r, amount: Math.round((sub * r) / 100) };
      });
      tax = taxes.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      taxRate = taxes.length === 1 ? Number(taxes[0].rate || 0) : taxRate;
    } else {
      tax = Math.round((sub * taxRate) / 100);
      taxes = [{ id: 'tax-1', name: 'GST / Tax', rate: taxRate, amount: tax }];
    }
    const tot = sub + tax;
    const rem = Math.max(0, tot - Number(state.paid_amount || 0));
    let status = state.status;
    if (rem === 0 && tot > 0) status = 'Paid';
    else if (Number(state.paid_amount) > 0 && rem > 0) status = 'Partially Paid';

    return {
      ...state,
      items,
      taxes,
      tax_rate: taxRate,
      subtotal: sub,
      tax_amount: tax,
      total_amount: tot,
      remaining_balance: rem,
      status
    };
  };

  const handleFieldChange = (key, val) => {
    setCurrent(s => {
      if (key === 'taxes') return recalcTotals(s, null, val);
      if (key === 'tax_rate') {
        const nextTaxes = Array.isArray(s.taxes) && s.taxes.length > 0 ? s.taxes.map(t => ({ ...t, rate: Number(val) })) : null;
        return recalcTotals({ ...s, tax_rate: Number(val) }, null, nextTaxes, Number(val));
      }
      if (key === 'paid_amount') {
        const next = { ...s, paid_amount: Number(val) };
        return recalcTotals(next);
      }
      return { ...s, [key]: val };
    });
  };

  const handleItemChange = (index, field, val) => {
    setCurrent(s => {
      const items = [...(s.items || [])];
      const item = { ...items[index], [field]: val };
      if (field === 'qty' || field === 'rate') {
        item.amount = Number(item.qty || 0) * Number(item.rate || 0);
      }
      items[index] = item;
      return recalcTotals(s, items);
    });
  };

  const handleAddItem = () => {
    setCurrent(s => {
      const items = [...(s.items || []), {
        id: `item_${Date.now()}`,
        description: 'New Concierge Service / Package Item',
        qty: 1,
        rate: 1000,
        amount: 1000
      }];
      return recalcTotals(s, items);
    });
  };

  const handleDeleteItem = (index) => {
    setCurrent(s => {
      const items = (s.items || []).filter((_, i) => i !== index);
      return recalcTotals(s, items);
    });
  };

  const handleAddColumn = (e) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    const colId = newColName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (columns.some(c => c.id === colId)) {
      toast.error('Column already exists');
      return;
    }
    const newCol = { id: colId, label: newColName, type: 'text', width: 'w-32' };
    const nextCols = [...columns.slice(0, -1), newCol, columns[columns.length - 1]];
    setColumns(nextCols);
    setCurrent(s => ({ ...s, custom_columns: nextCols }));
    setNewColName('');
    setShowAddCol(false);
    toast.success(`Added column "${newColName}"`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateInvoice(current.id, { ...current, theme_style: theme, custom_columns: columns });
      toast.success('Invoice saved successfully');
      if (onUpdate) onUpdate(updated);
    } catch (err) {
      toast.error('Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateBalanceInvoice = async () => {
    if (!window.confirm(`Generate a new invoice for the remaining balance of ${formatCurrency(current.remaining_balance, current.currency)}?`)) return;
    try {
      const child = await generateRemainingBalanceInvoice(current);
      toast.success(`Generated split invoice #${child.invoice_number}`);
      if (onUpdate) onUpdate(current);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to generate split invoice');
    }
  };

  const handlePrint = () => {
    if (!printRef.current) {
      window.print();
      return;
    }
    const clone = printRef.current.cloneNode(true);
    
    // Convert all form controls (input, textarea, select) to static divs so browser print never renders scrollbars, arrows, or horizontal clipping
    const origFormElements = printRef.current.querySelectorAll('input, textarea, select');
    const cloneFormElements = clone.querySelectorAll('input, textarea, select');
    
    cloneFormElements.forEach((el, idx) => {
      const orig = origFormElements[idx];
      if (!orig) return;
      if (el.type === 'file' || el.type === 'button' || el.type === 'submit' || el.type === 'checkbox') {
        el.remove();
        return;
      }
      const val = orig.value || orig.innerText || '';
      const staticDiv = document.createElement('div');
      staticDiv.className = el.className;
      staticDiv.style.cssText = 'white-space: pre-wrap !important; word-break: break-word !important; overflow: visible !important; height: auto !important; min-height: 1.2em !important; border: none !important; background: transparent !important; display: block !important; width: 100% !important; font-family: inherit !important; font-size: inherit !important; font-weight: inherit !important; color: inherit !important; line-height: 1.5 !important;';
      staticDiv.innerText = val;
      if (el.parentNode) el.parentNode.replaceChild(staticDiv, el);
    });

    // Remove print:hidden elements from clone
    clone.querySelectorAll('.print\\:hidden, .no-print, [type="file"]').forEach(el => el.remove());

    const htmlContent = clone.innerHTML;
    const title = `Invoice_${current?.invoice_number || '0001'}`;
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');

    let iframe = document.getElementById('voyanta-print-iframe');
    if (iframe) document.body.removeChild(iframe);
    iframe = document.createElement('iframe');
    iframe.id = 'voyanta-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        ${styles}
        <style>
          @page { size: A4; margin: 0 !important; }
          body { background: #ffffff !important; color: #000000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 12mm !important; margin: 0 !important; font-family: sans-serif; }
          .print\\:hidden, .no-print { display: none !important; }
          .print\\:bg-white { background: #ffffff !important; }
          .print\\:text-black { color: #000000 !important; }
          .print\\:border-none { border: none !important; }
          .print\\:border-black { border-color: #000000 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:overflow-visible { overflow: visible !important; }
          .overflow-x-auto, .overflow-y-auto, .overflow-hidden { overflow: visible !important; }
          table { width: 100% !important; border-collapse: collapse !important; table-layout: auto !important; }
          th, td { padding: 8px 10px !important; word-break: break-word !important; white-space: normal !important; }
        </style>
      </head>
      <body class="bg-white text-slate-900">
        <div class="max-w-4xl mx-auto bg-white">
          ${htmlContent}
        </div>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        window.print();
      }
    }, 600);
  };

  // Theme styling dictionaries
  const themeStyles = {
    safari: {
      headerBg: 'bg-[#0b1c30] text-white',
      accent: 'text-[#d97706]',
      border: 'border-[#0b1c30]/20',
      font: 'font-serif',
      cardBg: 'bg-[#f8fafc]',
      tableHeader: 'bg-[#0b1c30] text-white font-serif tracking-wide',
      badge: 'bg-[#d97706]/20 text-[#d97706] border-[#d97706]/40',
      totalBox: 'bg-[#0b1c30]/5 border-2 border-[#0b1c30]'
    },
    minimal: {
      headerBg: 'bg-white text-slate-900 border-b-2 border-slate-900',
      accent: 'text-slate-900',
      border: 'border-slate-300',
      font: 'font-sans',
      cardBg: 'bg-white border border-slate-200 shadow-sm',
      tableHeader: 'bg-slate-100 text-slate-900 font-sans font-bold border-b border-slate-300',
      badge: 'bg-slate-200 text-slate-900 border-slate-400',
      totalBox: 'bg-slate-50 border border-slate-300'
    },
    editorial: {
      headerBg: 'bg-[#1e1b4b] text-white',
      accent: 'text-[#f43f5e]',
      border: 'border-[#1e1b4b]/20',
      font: 'font-serif',
      cardBg: 'bg-[#fff1f2]/30 border border-[#f43f5e]/20',
      tableHeader: 'bg-[#1e1b4b] text-white font-serif italic tracking-wider',
      badge: 'bg-[#f43f5e]/20 text-[#f43f5e] border-[#f43f5e]/40',
      totalBox: 'bg-[#fff1f2] border-2 border-[#f43f5e]'
    },
    executive: {
      headerBg: 'bg-[#0f172a] text-white',
      accent: 'text-[#38bdf8]',
      border: 'border-slate-800',
      font: 'font-mono',
      cardBg: 'bg-slate-50 border border-slate-300 shadow-sm',
      tableHeader: 'bg-[#0f172a] text-[#38bdf8] font-mono tracking-widest uppercase text-xs',
      badge: 'bg-[#38bdf8]/20 text-[#0369a1] border-[#38bdf8]',
      totalBox: 'bg-slate-900 text-white border border-[#38bdf8]'
    },
    coastal: {
      headerBg: 'bg-[#0c4a6e] text-white',
      accent: 'text-[#0ea5e9]',
      border: 'border-[#0c4a6e]/20',
      font: 'font-sans',
      cardBg: 'bg-[#f0f9ff] border border-[#0ea5e9]/30 shadow-sm',
      tableHeader: 'bg-[#0c4a6e] text-white font-sans uppercase tracking-wider text-xs',
      badge: 'bg-[#0ea5e9]/20 text-[#0c4a6e] border-[#0ea5e9]/50',
      totalBox: 'bg-[#e0f2fe] border-2 border-[#0c4a6e]'
    },
    luxury: {
      headerBg: 'bg-[#18181b] text-[#fef08a]',
      accent: 'text-[#eab308]',
      border: 'border-[#eab308]/30',
      font: 'font-serif',
      cardBg: 'bg-[#fafaf9] border border-[#eab308]/30 shadow-md',
      tableHeader: 'bg-[#18181b] text-[#fef08a] font-serif tracking-widest uppercase text-xs',
      badge: 'bg-[#eab308]/20 text-[#a16207] border-[#eab308]',
      totalBox: 'bg-[#18181b] text-[#fef08a] border border-[#eab308]'
    },
    vibrant: {
      headerBg: 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white',
      accent: 'text-purple-600',
      border: 'border-purple-300',
      font: 'font-sans',
      cardBg: 'bg-purple-50/50 border border-purple-200 shadow-sm',
      tableHeader: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-sans font-bold uppercase tracking-wider text-xs',
      badge: 'bg-purple-100 text-purple-700 border-purple-300',
      totalBox: 'bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-400'
    }
  };
  const activeTheme = themeStyles[theme] || themeStyles.safari;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 md:p-6 overflow-y-auto animate-fade-in print:p-0 print:bg-white print:static">
      <div className="bg-surface-container-lowest w-full max-w-5xl rounded-3xl shadow-2xl border border-outline-variant flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full">
        
        {/* UI Toolbar (Hidden on Print) */}
        <div className="p-4 bg-surface-container-low border-b border-outline-variant flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg">
              ₹
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-on-surface m-0 flex items-center gap-2">
                <span>Invoice #{current.invoice_number}</span>
                <span className="text-xs font-sans px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  {current.status}
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant m-0">Client: {current.client_name}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Theme Selector */}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface"
              title="Design Aesthetic"
            >
              <option value="safari">🎨 Safari Luxury Theme</option>
              <option value="minimal">🎨 Modern Minimal Theme</option>
              <option value="editorial">🎨 Editorial Classic Theme</option>
              <option value="executive">🎨 Executive Bold Theme</option>
              <option value="coastal">🎨 Azure Coastal Theme</option>
            </select>

            {/* Currency Selector */}
            <select
              value={current.currency || 'INR'}
              onChange={(e) => handleFieldChange('currency', e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-black text-primary"
            >
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
              <option value="AUD">$ AUD</option>
              <option value="CAD">$ CAD</option>
              <option value="AED">AED</option>
              <option value="SGD">$ SGD</option>
            </select>

            {/* Language Selector */}
            <select
              value={current.language || 'en'}
              onChange={(e) => handleFieldChange('language', e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface"
              title="Language"
            >
              <option value="en">English</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="bn">Bangla (বাংলা)</option>
              <option value="gu">Gujarati (ગુજરાતી)</option>
              <option value="mr">Marathi (मराठी)</option>
              <option value="es">Spanish (Español)</option>
              <option value="fr">French (Français)</option>
            </select>

            {/* Status Dropdown */}
            <select
              value={current.status || 'Sent'}
              onChange={(e) => handleFieldChange('status', e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-sm cursor-pointer outline-none"
            >
              {INVOICE_STATUSES.map(s => <option key={s.id} value={s.id} className="bg-white text-black font-medium">{s.label}</option>)}
            </select>

            {/* Receipt Button if Paid/Partially Paid */}
            {(current.status === 'Paid' || current.status === 'Partially Paid') && (
              <button
                type="button"
                onClick={() => setShowReceipt(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs uppercase tracking-wider shadow hover:bg-emerald-700 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">receipt</span> Receipt
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowShare(true)}
              className="px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface font-bold text-xs hover:bg-surface-container transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">share</span> Share / Email
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface font-bold text-xs hover:bg-surface-container transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">print</span> Print PDF
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">save</span> {saving ? 'Saving...' : 'Save'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-surface-container-lowest print:p-0 print:overflow-visible">
          <div ref={printRef} className="max-w-4xl mx-auto bg-white rounded-2xl border border-outline-variant shadow-lg p-8 md:p-12 space-y-8 print:shadow-none print:border-none print:p-4 print:max-w-none text-slate-900 relative overflow-hidden">
            
            {/* Watermark Overlay */}
            {(current?.branding?.watermark_text || current?.watermark_text) && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 opacity-[0.05] print:opacity-[0.08]">
                <span className="text-7xl md:text-9xl font-black uppercase tracking-widest text-slate-900 -rotate-45 select-none whitespace-nowrap">
                  {current?.branding?.watermark_text || current?.watermark_text}
                </span>
              </div>
            )}

            {/* Header Section */}
            <div className={`p-8 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10 ${activeTheme.headerBg} print:bg-white print:text-black print:p-0 print:border-b-2 print:border-black print:pb-6`}>
              <div className="flex items-center gap-4">
                {current?.branding?.logo_url ? (
                  <img src={current.branding.logo_url} alt="Logo" className="max-h-16 max-w-[180px] object-contain rounded bg-white p-1" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-2xl tracking-tighter print:bg-black print:text-white">
                    {(current?.branding?.agency_name || 'V').charAt(0)}
                  </div>
                )}
                <div>
                  <h1 className={`text-2xl md:text-3xl font-black tracking-tight m-0 ${activeTheme.font}`}>
                    {current?.branding?.agency_name || 'Voyanta Luxury Travel'}
                  </h1>
                  <p className="text-xs opacity-80 m-0 mt-0.5">{current?.branding?.contact_email} | {current?.branding?.contact_phone}</p>
                  {current?.branding?.address && <p className="text-[11px] opacity-70 m-0 mt-0.5">{current.branding.address}</p>}
                  {(current?.branding?.gst_number || current?.gst_number) && <p className="text-[11px] font-mono font-bold m-0 mt-0.5">GSTIN: {current?.branding?.gst_number || current?.gst_number}</p>}
                  {(current?.branding?.trade_code || current?.trade_code) && <p className="text-[11px] font-mono m-0">Reg/Trade Code: {current?.branding?.trade_code || current?.trade_code}</p>}
                  {(current?.branding?.trademarks || current?.trademarks) && <p className="text-[10px] italic opacity-80 m-0 mt-0.5">{current?.branding?.trademarks || current?.trademarks}</p>}
                </div>
              </div>

              <div className="text-left md:text-right">
                <div className="text-xs font-extrabold uppercase tracking-widest opacity-70">{t('Official Invoice')}</div>
                <div className={`text-2xl md:text-3xl font-black mt-1 ${activeTheme.font}`}>#{current.invoice_number}</div>
                <div className="mt-2 text-xs flex flex-col gap-0.5 opacity-90 font-mono">
                  <span>{t('Issue Date')}: <input type="date" value={current.issue_date || ''} onChange={e => handleFieldChange('issue_date', e.target.value)} className="bg-transparent border-b border-current px-1 py-0 text-xs font-bold outline-none print:border-none" /></span>
                  <span>{t('Due Date')}: <input type="date" value={current.due_date || ''} onChange={e => handleFieldChange('due_date', e.target.value)} className="bg-transparent border-b border-current px-1 py-0 text-xs font-bold outline-none print:border-none" /></span>
                </div>
              </div>
            </div>

            {/* Client & Billing Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-200 print:bg-white print:border-none print:p-0">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">{t('Billed To')}</span>
                <input
                  type="text"
                  value={current.client_name || ''}
                  onChange={e => handleFieldChange('client_name', e.target.value)}
                  className="text-lg font-black text-slate-900 w-full bg-transparent border-b border-slate-300 focus:border-black outline-none font-serif mb-1 print:border-none"
                  placeholder="Client Name"
                />
                <input
                  type="email"
                  value={current.client_email || ''}
                  onChange={e => handleFieldChange('client_email', e.target.value)}
                  className="text-xs font-medium text-slate-600 w-full bg-transparent border-b border-slate-200 focus:border-black outline-none block mb-1 print:border-none"
                  placeholder="Client Email"
                />
                <input
                  type="text"
                  value={current.client_phone || ''}
                  onChange={e => handleFieldChange('client_phone', e.target.value)}
                  className="text-xs font-mono text-slate-500 w-full bg-transparent border-b border-slate-200 focus:border-black outline-none block print:border-none"
                  placeholder="Client Phone"
                />
              </div>

              <div className="md:text-right flex flex-col justify-between">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Destination / Itinerary</span>
                  <input
                    type="text"
                    value={current.destination || ''}
                    onChange={e => handleFieldChange('destination', e.target.value)}
                    className="text-base font-bold text-slate-800 w-full md:text-right bg-transparent border-b border-slate-300 focus:border-black outline-none print:border-none"
                    placeholder="e.g. Serengeti Safari Package"
                  />
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Payment Status</span>
                  <div className="text-sm font-black uppercase text-slate-900 mt-0.5">{current.status}</div>
                </div>
              </div>
            </div>

            {/* Interactive Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between print:hidden">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 m-0">Line Items & Breakdown</h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCol(!showAddCol)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors flex items-center gap-1"
                  >
                    + Add Column
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1 rounded-lg bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors flex items-center gap-1"
                  >
                    + Add Row
                  </button>
                </div>
              </div>

              {showAddCol && (
                <form onSubmit={handleAddColumn} className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-2 print:hidden animate-fade-in">
                  <input
                    type="text"
                    placeholder="Column Name (e.g. HSN Code, Tax %, Discount)"
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold"
                  />
                  <button type="submit" className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs">Add</button>
                  <button type="button" onClick={() => setShowAddCol(false)} className="px-2 py-1.5 text-xs font-bold text-slate-500">Cancel</button>
                </form>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200 print:border-slate-300">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 print:bg-slate-200">
                      {columns.map(col => (
                        <th key={col.id} className={`py-3 px-4 text-[11px] font-black uppercase tracking-wider text-slate-600 ${col.width || ''}`}>
                          {col.label}
                        </th>
                      ))}
                      <th className="py-3 px-3 w-10 text-right print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(current.items || []).map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors group">
                        {columns.map(col => {
                          const val = item[col.id] ?? '';
                          return (
                            <td key={col.id} className="py-3 px-4">
                              {col.id === 'amount' ? (
                                <span className="font-bold font-mono text-sm text-slate-900 block text-right">
                                  {formatCurrency(item.amount || 0, current.currency)}
                                </span>
                              ) : col.type === 'number' || col.id === 'qty' || col.id === 'rate' ? (
                                <input
                                  type="number"
                                  value={val}
                                  onChange={e => handleItemChange(idx, col.id, e.target.value)}
                                  className={`w-full bg-transparent border-b border-transparent group-hover:border-slate-300 focus:border-black outline-none text-xs font-mono font-medium ${col.id === 'rate' ? 'text-right' : 'text-center'} print:border-none`}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={val}
                                  onChange={e => handleItemChange(idx, col.id, e.target.value)}
                                  className="w-full bg-transparent border-b border-transparent group-hover:border-slate-300 focus:border-black outline-none text-xs font-semibold text-slate-800 print:border-none"
                                  placeholder="Enter item description..."
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 px-3 text-right print:hidden">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100 p-1"
                            title="Delete Row"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals & UPI Payment Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
              
              {/* Left Column: UPI Pay Now Box */}
              <div>
                <UpiQrGenerator
                  upiId={current?.upi_id || current?.branding?.upi_id}
                  payeeName={current?.upi_payee_name || current?.branding?.agency_name}
                  amount={current?.remaining_balance > 0 ? current.remaining_balance : current.total_amount}
                  currency={current.currency}
                  invoiceNumber={current.invoice_number}
                  showPayButtons={true}
                  className="max-w-sm mx-auto md:mx-0 border-slate-300 print:border-slate-400"
                />
              </div>

              {/* Right Column: Financial Calculation Breakdown */}
              <div className="space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-center print:bg-white print:border-none print:p-0">
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span>{t('Subtotal')}:</span>
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(current.subtotal || 0, current.currency)}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span className="flex items-center gap-1">
                    {t('Tax')} (%):
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.5"
                      value={current.tax_rate ?? 5}
                      onChange={e => handleFieldChange('tax_rate', e.target.value)}
                      className="w-14 px-1 py-0.5 rounded border border-slate-300 text-xs font-mono text-center bg-white print:border-none"
                    />
                  </span>
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(current.tax_amount || 0, current.currency)}</span>
                </div>

                <div className="pt-3 border-t border-slate-300 flex items-center justify-between text-base font-black text-slate-900">
                  <span>{t('Total')}:</span>
                  <span className="text-xl font-mono text-primary print:text-black">{formatCurrency(current.total_amount || 0, current.currency)}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold pt-2 border-t border-slate-200">
                  <span className="flex items-center gap-1">
                    {t('Paid Amount')} ({current.currency}):
                    <input
                      type="number"
                      min="0"
                      value={current.paid_amount ?? 0}
                      onChange={e => handleFieldChange('paid_amount', e.target.value)}
                      className="w-24 px-1.5 py-0.5 rounded border border-slate-300 text-xs font-mono text-right bg-white font-bold print:border-none"
                    />
                  </span>
                  <span className="font-mono font-bold text-emerald-600 print:text-black">{formatCurrency(current.paid_amount || 0, current.currency)}</span>
                </div>

                <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-sm font-black text-slate-900">
                  <span>{t('Remaining Balance')}:</span>
                  <span className="font-mono text-rose-600 print:text-black">{formatCurrency(current.remaining_balance || 0, current.currency)}</span>
                </div>

                {/* Installment Button if Partially Paid */}
                {current.status === 'Partially Paid' && Number(current.remaining_balance) > 0 && (
                  <div className="pt-3 print:hidden">
                    <button
                      type="button"
                      onClick={handleGenerateBalanceInvoice}
                      className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider shadow transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">call_split</span>
                      Generate Remaining Balance Invoice
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Terms & Notes Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200 text-xs text-slate-600">
              <div>
                <span className="font-extrabold uppercase tracking-wider text-slate-400 block mb-1">{t('Remarks')}</span>
                <textarea
                  rows={2}
                  value={current.notes || ''}
                  onChange={e => handleFieldChange('notes', e.target.value)}
                  className="w-full bg-transparent border border-slate-200 rounded-lg p-2 text-xs font-medium focus:border-black outline-none print:border-none print:p-0"
                  placeholder="Thank you for booking..."
                />
              </div>
              <div>
                <span className="font-extrabold uppercase tracking-wider text-slate-400 block mb-1">{t('Terms & Conditions')}</span>
                <textarea
                  rows={2}
                  value={current.terms || ''}
                  onChange={e => handleFieldChange('terms', e.target.value)}
                  className="w-full bg-transparent border border-slate-200 rounded-lg p-2 text-[11px] font-mono focus:border-black outline-none print:border-none print:p-0"
                  placeholder="1. Payment due upon receipt..."
                />
              </div>
            </div>

            {/* Audit Log Footer */}
            <div className="pt-4 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span>Voyanta Concierge Engine — Invoice ID: #{current.invoice_number || current.id}</span>
              <span>Last Modified: {new Date(current.updated_at || Date.now()).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Child Modals */}
      {showReceipt && (
        <ReceiptPreviewModal
          invoice={current}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {showShare && (
        <InvoiceShareModal
          invoice={current}
          onClose={() => setShowShare(false)}
          onDownloadPdf={handlePrint}
          onShared={() => {
            // Re-fetch or update activity log visually
            toast.success('Activity log updated');
          }}
        />
      )}
    </div>
  );
}
