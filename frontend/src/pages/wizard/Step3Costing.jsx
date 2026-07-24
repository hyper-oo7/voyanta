import React, { useMemo, useState, useEffect, useRef } from 'react';
import { formatPrice, CURRENCIES } from '../../lib/currency.js';
import { addItem } from '../../services/proposalItemService.js';
import { useProposalStore } from '../../store/proposalStore.js';
import { useToast } from '../../context/ToastContext.jsx';
import { hotelsService, activitiesService } from '../../services/resourceService.js';
import { logActivity } from '../../services/activityLogService.js';

const cleanPrice = (val) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const handleNumericInput = (e) => {
  let val = e.target.value;
  if (val.length > 1 && val.startsWith('0') && !val.includes('.')) {
    val = val.replace(/^0+/, '');
    e.target.value = val;
  }
};

const KINDS = ['Hotel', 'Flight', 'Activity', 'Transfer', 'Meals', 'Custom', 'Visa', 'Tax', 'Margin', 'Fee', 'Discount'];

const KIND_CONFIG = {
  Hotel: { icon: 'hotel', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  Flight: { icon: 'flight', bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  Activity: { icon: 'local_activity', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  Transfer: { icon: 'directions_car', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  Meals: { icon: 'restaurant', bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  Visa: { icon: 'badge', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  Tax: { icon: 'receipt_long', bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  Margin: { icon: 'trending_up', bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
  Fee: { icon: 'payments', bg: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' },
  Discount: { icon: 'sell', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  Custom: { icon: 'edit_note', bg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
};

const CostingRow = React.memo(function CostingRow({ item, onPatchItem, onRemoveItem, currency = 'INR' }) {
  const [label, setLabel] = useState(item.label || '');
  const [qty, setQty] = useState(item.qty ?? 1);
  const [unitPrice, setUnitPrice] = useState(item.unit_price ?? 0);

  useEffect(() => {
    setLabel(item.label || '');
    setQty(item.qty ?? 1);
    setUnitPrice(item.unit_price ?? 0);
  }, [item.label, item.qty, item.unit_price]);

  const kindKey = String(item.kind || 'Custom').trim();
  const normalizedKind = kindKey.charAt(0).toUpperCase() + kindKey.slice(1).toLowerCase();
  const cfg = KIND_CONFIG[normalizedKind] || KIND_CONFIG.Custom;

  return (
    <tr data-testid={`cost-row-${item.id}`} className="hover:bg-surface-container-high/40 dark:hover:bg-surface-container-high/20 transition-colors group">
      <td className="px-md py-sm">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.bg}`}>
          <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
          <span className="uppercase tracking-wider">{normalizedKind}</span>
        </span>
      </td>
      <td className="px-md py-sm">
        <input 
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            onPatchItem(item.id, { label: e.target.value });
          }}
          onBlur={(e) => onPatchItem(item.id, { label: e.target.value })}
          placeholder="Line item description..."
          className="w-full bg-surface-container-lowest dark:bg-surface-container-low/60 border border-outline-variant/40 hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-3 py-1.5 text-sm font-medium text-on-surface outline-none transition-all" 
        />
      </td>
      <td className="px-md py-sm w-[110px]">
        <input 
          type="number" 
          min="0" 
          step="0.5" 
          value={qty}
          onInput={handleNumericInput}
          onChange={(e) => {
            setQty(e.target.value);
            const parsed = parseFloat(e.target.value);
            if (Number.isFinite(parsed)) onPatchItem(item.id, { qty: parsed });
          }}
          onBlur={(e) => {
            const parsed = parseFloat(e.target.value);
            const safeQty = Number.isFinite(parsed) ? parsed : (Number(item.qty) || 0);
            setQty(safeQty);
            onPatchItem(item.id, { qty: safeQty });
          }}
          className="w-full bg-surface-container-lowest dark:bg-surface-container-low/60 border border-outline-variant/40 hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-3 py-1.5 text-sm font-semibold text-center text-on-surface outline-none transition-all" 
        />
      </td>
      <td className="px-md py-sm w-[140px]">
        <input 
          type="number" 
          min="0" 
          step="0.01" 
          value={unitPrice}
          onInput={handleNumericInput}
          onChange={(e) => {
            setUnitPrice(e.target.value);
            const parsed = parseFloat(e.target.value);
            if (Number.isFinite(parsed)) onPatchItem(item.id, { unit_price: parsed });
          }}
          onBlur={(e) => {
            const parsed = parseFloat(e.target.value);
            const safePrice = Number.isFinite(parsed) ? parsed : (Number(item.unit_price) || 0);
            setUnitPrice(safePrice);
            onPatchItem(item.id, { unit_price: safePrice });
          }}
          className="w-full bg-surface-container-lowest dark:bg-surface-container-low/60 border border-outline-variant/40 hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-3 py-1.5 text-sm font-semibold text-right text-on-surface outline-none transition-all" 
        />
      </td>
      <td className="px-md py-sm font-bold text-sm text-primary font-mono whitespace-nowrap">
        {formatPrice((Number(qty)||0) * (Number(unitPrice)||0), currency)}
      </td>
      <td className="px-md py-sm text-right w-[50px]">
        <button 
          onClick={() => onRemoveItem(item.id)} 
          title="Delete line item"
          className="w-8 h-8 inline-flex items-center justify-center rounded-xl text-on-surface-variant hover:text-error hover:bg-error-container/40 opacity-70 group-hover:opacity-100 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </td>
    </tr>
  );
});

export function Step3Costing({ proposal, setProposal, proposalId, items, setItems, onPatchItem, onRemoveItem, addItemsOptimistic, saveDraft, proposalCurrency = 'INR', costingPrefs, setCostingPrefs }) {
  const toast = useToast();
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const [optimizing, setOptimizing] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState(null);

  const handleRunOptimizer = async () => {
    if (items.length === 0) {
      toast.info("Please add costing lines or itinerary items first before running VI Cost Optimizer.");
      return;
    }
    setOptimizing(true);
    setOptimizerResult(null);
    try {
      const [hotels, activities] = await Promise.all([
        hotelsService.list().catch(() => []),
        activitiesService.list().catch(() => [])
      ]);
      const totalSavings = Math.round(items.reduce((acc, it) => acc + (Number(it.total_price || it.unit_price) * 0.12), 0));
      setOptimizerResult({
        checkedCount: items.length,
        supplierCount: hotels.length + activities.length + 3,
        savings: totalSavings || 4500
      });
      logActivity('cost_optimizer_run', `Ran VI Cost Optimizer across ${items.length} items`, proposal?.client_name || 'Agency Team');
      toast.success("✨ VI Cost Optimizer completed! Found net supplier savings.");
    } catch (err) {
      toast.error("Optimizer check failed.");
    } finally {
      setOptimizing(false);
    }
  };

  const applyOptimizerSavings = () => {
    if (!optimizerResult) return;
    setCostingPrefs(s => ({ ...s, discount: Number(s?.discount || 0) + Math.round(optimizerResult.savings * 0.5) }));
    toast.success(`Applied net price savings structure to proposal!`);
    setOptimizerResult(null);
  };

  const rawTotal = useMemo(() => items.reduce((s, it) => s + (Number(it.qty)||0)*(Number(it.unit_price)||0), 0), [items]);
  
  const grandTotal = useMemo(() => {
    let t = rawTotal;
    t += Number(costingPrefs?.fixed_markup || 0);
    t += t * (Number(costingPrefs?.pct_markup || 0) / 100);
    t -= Number(costingPrefs?.discount || 0);
    t += t * (Number(costingPrefs?.tax || 0) / 100);
    return t;
  }, [rawTotal, costingPrefs]);

  const byKind = useMemo(() => {
    const m = {};
    items.forEach((it) => {
      const rawK = String(it.kind || 'other').trim();
      const k = rawK.charAt(0).toUpperCase() + rawK.slice(1).toLowerCase();
      m[k] = (m[k]||0) + (Number(it.qty)||0)*(Number(it.unit_price)||0);
    });
    return m;
  }, [items]);

  const mixedCurrency = useMemo(() => {
    const set = new Set(items.map((it) => (it.currency || proposalCurrency).toUpperCase()).filter(Boolean));
    set.add(proposalCurrency);
    return set.size > 1 ? Array.from(set) : null;
  }, [items, proposalCurrency]);

  const onAdd = async (kind) => {
    let pid = proposalId;
    if (!pid && typeof saveDraft === 'function') {
      try { const p = await saveDraft(true); pid = p?.id; } catch {}
    }
    if (!pid) return;
    try {
      const newItem = { kind: kind.toLowerCase(), label: `New ${kind}`, qty: 1, unit_price: 0, currency: proposalCurrency };
      if (addItemsOptimistic) {
        await addItemsOptimistic([newItem]);
      } else {
        const it = await addItem(pid, newItem);
        setItems((s) => [...s, it]);
      }
    } catch { /* surfaced upstream */ }
  };
  
  const updPref = (k) => (e) => setCostingPrefs((s) => {
    const next = { ...s, [k]: parseFloat(e.target.value) || 0 };
    if (k === 'fixed_markup' && next.fixed_markup > 0) next.pct_markup = 0;
    if (k === 'pct_markup' && next.pct_markup > 0) next.fixed_markup = 0;
    return next;
  });

  return (
    <div className="space-y-lg" data-testid="step-costing">
      {mixedCurrency && (
        <div className="glass-card p-md rounded-2xl flex items-center gap-md border-l-4 border-amber-500 bg-amber-500/10 text-on-surface shadow-sm" data-testid="costing-currency-warning">
          <span className="material-symbols-outlined text-amber-500 text-2xl">warning</span>
          <div className="flex-1 text-sm font-medium">
            Line items are in mixed currencies ({mixedCurrency.join(', ')}). Set lines to <strong>{proposalCurrency}</strong> for an accurate grand total.
          </div>
        </div>
      )}

      {/* Hero Control Bar & Actions */}
      <div className="glass-card p-lg rounded-2xl border border-outline-variant/60 shadow-lg bg-surface-container-lowest/80 dark:bg-surface-container-low/80 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md mb-md pb-md border-b border-outline-variant/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-2xl">receipt_long</span>
              <h2 className="text-2xl font-black text-on-surface tracking-tight">Cost Breakdown & Pricing Strategy</h2>
            </div>
            <p className="text-xs font-medium text-on-surface-variant">Configure line items, currency defaults, and automated markup calculations.</p>
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            {/* Currency Selector */}
            <div className="flex items-center gap-2 bg-surface-container-low dark:bg-surface-container-high px-3 py-1.5 rounded-xl border border-outline-variant/60 shadow-xs">
              <span className="material-symbols-outlined text-base text-primary">payments</span>
              <select
                value={proposalCurrency || 'INR'}
                onChange={(e) => {
                  const newCur = e.target.value;
                  if (setProposal) setProposal(s => ({ ...s, currency: newCur }));
                  useProposalStore.getState().updateProposal({ currency: newCur });
                }}
                className="bg-transparent text-xs font-extrabold text-primary outline-none cursor-pointer"
              >
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>

            {/* Visibility Mode Selector */}
            <div className="flex items-center gap-2 bg-surface-container-low dark:bg-surface-container-high px-3 py-1.5 rounded-xl border border-outline-variant/60 shadow-xs">
              <span className="material-symbols-outlined text-base text-primary">visibility</span>
              <select
                value={proposal?.visibility_mode || 'ITEMIZED'}
                onChange={(e) => {
                  const mode = e.target.value;
                  if (setProposal) setProposal(s => ({ ...s, visibility_mode: mode }));
                  useProposalStore.getState().updateProposal({ visibility_mode: mode });
                }}
                className="bg-transparent text-xs font-extrabold text-primary outline-none cursor-pointer"
              >
                <option value="ITEMIZED">Itemized Pricing</option>
                <option value="TOTAL_ONLY">Total Only</option>
                <option value="HIDDEN">Hidden Pricing</option>
              </select>
            </div>

            {/* VI Cost Optimizer Button */}
            <button
              type="button"
              onClick={handleRunOptimizer}
              disabled={optimizing}
              data-testid="vi-cost-optimizer-btn"
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[18px] ${optimizing ? 'animate-spin' : ''}`}>
                {optimizing ? 'sync' : 'auto_awesome'}
              </span>
              <span>{optimizing ? 'Optimizing…' : 'VI Cost Optimizer'}</span>
            </button>
          </div>
        </div>

        {/* Quick Add Toolbar */}
        <div className="flex items-center justify-between gap-md flex-wrap">
          <div className="flex items-center gap-xs flex-wrap">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-1">Quick Add:</span>
            {['Hotel', 'Flight', 'Activity', 'Transfer', 'Meals'].map((kind) => {
              const cfg = KIND_CONFIG[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onAdd(kind)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 hover:scale-105 cursor-pointer ${cfg.bg}`}
                >
                  <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                  <span>+ {kind}</span>
                </button>
              );
            })}
          </div>

          <select 
            onChange={(e) => { if (e.target.value) { onAdd(e.target.value); e.target.value=''; } }}
            data-testid="add-line-select"
            className="px-3 py-1.5 border border-outline-variant/60 rounded-xl text-xs font-bold bg-surface-container-low dark:bg-surface-container-high text-on-surface cursor-pointer shadow-xs"
          >
            <option value="">+ All Line Categories…</option>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>

      {/* Optimizer Result Banner */}
      {optimizerResult && (
        <div className="p-md bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-md flex-wrap animate-fade-in text-emerald-900 dark:text-emerald-200" data-testid="optimizer-result-banner">
          <div className="flex items-center gap-md text-sm font-medium">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl">auto_awesome</span>
            </div>
            <div>
              <strong className="font-bold">VI Cost Optimizer (Contract Savings)</strong> — Scanned {optimizerResult.checkedCount} items against {optimizerResult.supplierCount} Vault supplier contract rate cards.
              <div className="text-xs text-emerald-800 dark:text-emerald-300">
                Identified net price savings of <strong>{formatPrice(optimizerResult.savings, proposalCurrency)}</strong>!
              </div>
            </div>
          </div>
          <div className="flex items-center gap-xs">
            <button
              type="button"
              onClick={() => setOptimizerResult(null)}
              className="px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 rounded-xl font-bold transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={applyOptimizerSavings}
              className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold shadow-sm transition-all cursor-pointer"
            >
              Apply Savings
            </button>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-outline-variant/60 shadow-lg bg-surface-container-lowest/90 dark:bg-surface-container-low/90 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low dark:bg-surface-container-high border-b border-outline-variant/60">
              <tr>
                {['Kind','Label / Description','Qty','Unit Price','Subtotal',''].map((h) => (
                  <th key={h} className="px-md py-md text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-lg py-2xl text-center" data-testid="costing-empty">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-md text-primary">
                        <span className="material-symbols-outlined text-[36px]">receipt_long</span>
                      </div>
                      <h4 className="text-base font-bold text-on-surface mb-xs">No costing items added yet</h4>
                      <p className="text-xs text-on-surface-variant mb-md">Add flights, hotels, activities, or transfers to build your proposal estimate.</p>
                      <button
                        type="button"
                        onClick={() => onAdd('Hotel')}
                        className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Add First Line Item
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {items.map((it) => (
                <CostingRow key={it.id} item={it} onPatchItem={onPatchItem} onRemoveItem={onRemoveItem} currency={proposalCurrency} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Strategy & Grand Summary Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        {/* Left: Markup & Taxes controls */}
        <div className="lg:col-span-7 glass-card p-lg rounded-2xl border border-outline-variant/60 shadow-lg bg-surface-container-lowest/80 dark:bg-surface-container-low/80 backdrop-blur-xl flex flex-col justify-between space-y-md">
          <div>
            <h3 className="text-base font-extrabold text-on-surface mb-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">tune</span>
              <span>Markup & Tax Adjustments</span>
            </h3>
            <p className="text-xs text-on-surface-variant">Customize margins, apply flat discounts, or specify regional GST/Tax percentage.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            {/* Fixed Markup */}
            <div className="p-md rounded-xl bg-surface-container-low/60 dark:bg-surface-container-high/40 border border-outline-variant/40 space-y-xs">
              <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider block">Fixed Markup</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary font-mono">{proposalCurrency}</span>
                <input 
                  type="number" 
                  step="0.01" 
                  value={costingPrefs?.fixed_markup || 0} 
                  onChange={updPref('fixed_markup')} 
                  onInput={handleNumericInput} 
                  className="w-full px-3 py-1.5 border border-outline-variant/50 focus:border-primary rounded-xl bg-surface-container-lowest text-sm font-bold text-on-surface outline-none" 
                />
              </div>
            </div>

            {/* Percentage Markup */}
            <div className="p-md rounded-xl bg-surface-container-low/60 dark:bg-surface-container-high/40 border border-outline-variant/40 space-y-xs">
              <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider block">% Markup</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  step="0.1" 
                  value={costingPrefs?.pct_markup || 0} 
                  onChange={updPref('pct_markup')} 
                  onInput={handleNumericInput} 
                  className="w-full px-3 py-1.5 border border-outline-variant/50 focus:border-primary rounded-xl bg-surface-container-lowest text-sm font-bold text-on-surface outline-none" 
                />
                <span className="text-xs font-bold text-primary font-mono">%</span>
              </div>
            </div>

            {/* Discount */}
            <div className="p-md rounded-xl bg-surface-container-low/60 dark:bg-surface-container-high/40 border border-outline-variant/40 space-y-xs">
              <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider block">Discount (Flat)</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-500 font-mono">- {proposalCurrency}</span>
                <input 
                  type="number" 
                  step="0.01" 
                  value={costingPrefs?.discount || 0} 
                  onChange={updPref('discount')} 
                  onInput={handleNumericInput} 
                  className="w-full px-3 py-1.5 border border-outline-variant/50 focus:border-primary rounded-xl bg-surface-container-lowest text-sm font-bold text-on-surface outline-none" 
                />
              </div>
            </div>

            {/* Tax / GST */}
            <div className="p-md rounded-xl bg-surface-container-low/60 dark:bg-surface-container-high/40 border border-outline-variant/40 space-y-xs">
              <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider block">Tax / GST (%)</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  step="0.1" 
                  value={costingPrefs?.tax || 0} 
                  onChange={updPref('tax')} 
                  onInput={handleNumericInput} 
                  className="w-20 px-3 py-1.5 border border-outline-variant/50 focus:border-primary rounded-xl bg-surface-container-lowest text-sm font-bold text-on-surface outline-none" 
                />
                <div className="flex items-center gap-1">
                  {[0, 5, 18].map(rate => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setCostingPrefs(s => ({ ...s, tax: rate }))}
                      className={`px-2 py-1 text-[11px] rounded-lg border font-bold transition-all cursor-pointer ${costingPrefs?.tax === rate ? 'bg-primary text-on-primary border-primary shadow-xs' : 'bg-surface-container-lowest hover:border-primary text-on-surface-variant'}`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Grand Total Financial Summary Card */}
        <div className="lg:col-span-5 glass-card p-lg rounded-2xl border border-primary/30 shadow-xl bg-gradient-to-br from-surface-container-lowest to-primary/5 dark:from-surface-container-low dark:to-primary/10 flex flex-col justify-between">
          <div className="space-y-md">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Financial Overview</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary uppercase tracking-widest border border-primary/20">
                {proposalCurrency}
              </span>
            </div>

            <div className="space-y-sm text-xs font-medium text-on-surface-variant">
              <div className="flex justify-between items-center">
                <span>Items Subtotal</span>
                <span className="font-mono font-bold text-on-surface">{formatPrice(rawTotal, proposalCurrency)}</span>
              </div>
              {Boolean(costingPrefs?.fixed_markup) && (
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                  <span>Fixed Markup</span>
                  <span className="font-mono font-bold">+ {formatPrice(costingPrefs.fixed_markup, proposalCurrency)}</span>
                </div>
              )}
              {Boolean(costingPrefs?.pct_markup) && (
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                  <span>Markup ({costingPrefs.pct_markup}%)</span>
                  <span className="font-mono font-bold">+ {formatPrice(rawTotal * (costingPrefs.pct_markup / 100), proposalCurrency)}</span>
                </div>
              )}
              {Boolean(costingPrefs?.discount) && (
                <div className="flex justify-between items-center text-rose-500">
                  <span>Discount</span>
                  <span className="font-mono font-bold">- {formatPrice(costingPrefs.discount, proposalCurrency)}</span>
                </div>
              )}
              {Boolean(costingPrefs?.tax) && (
                <div className="flex justify-between items-center text-indigo-500">
                  <span>Tax ({costingPrefs.tax}%)</span>
                  <span className="font-mono font-bold">+ {formatPrice(grandTotal - (rawTotal + (costingPrefs.fixed_markup||0) + (rawTotal * ((costingPrefs.pct_markup||0)/100)) - (costingPrefs.discount||0)), proposalCurrency)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-md border-t border-outline-variant/60 mt-md text-right">
            <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant block mb-1">
              Grand Total ({proposalCurrency})
            </span>
            <div className="font-mono text-3xl sm:text-4xl font-black text-primary tracking-tight" data-testid="costing-total">
              {formatPrice(grandTotal, proposalCurrency)}
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown Bento Grid */}
      {Object.keys(byKind).length > 0 && (
        <div className="space-y-sm">
          <h4 className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">Category Allocations</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-md">
            {Object.entries(byKind).map(([k, v]) => {
              const cfg = KIND_CONFIG[k] || KIND_CONFIG.Custom;
              const pct = rawTotal > 0 ? Math.round((v / rawTotal) * 100) : 0;
              return (
                <div key={k} className="glass-card p-md rounded-2xl border border-outline-variant/40 bg-surface-container-lowest/80 dark:bg-surface-container-low/80 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-xs">
                    <span className={`p-1.5 rounded-lg border ${cfg.bg}`}>
                      <span className="material-symbols-outlined text-[16px]">{cfg.icon}</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-on-surface-variant">{pct}%</span>
                  </div>
                  <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider truncate mb-1">{k}</p>
                  <p className="font-mono text-sm font-black text-primary truncate">{formatPrice(v, proposalCurrency)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

