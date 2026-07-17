import React, { useMemo, useState, useEffect, useRef } from 'react';
import { formatPrice, formatINR, CURRENCIES } from '../../lib/currency.js';
import { addItem } from '../../services/proposalItemService.js';
import { useProposalStore } from '../../store/proposalStore.js';

const cleanPrice = (val) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const KINDS = ['Hotel', 'Flight', 'Activity', 'Transfer', 'Meals', 'Custom', 'Visa', 'Tax', 'Margin', 'Fee', 'Discount'];

const CostingRow = React.memo(function CostingRow({ item, onPatchItem, onRemoveItem, currency = 'INR' }) {
  const [label, setLabel] = useState(item.label || '');
  const [qty, setQty] = useState(item.qty ?? 1);
  const [unitPrice, setUnitPrice] = useState(item.unit_price ?? 0);

  useEffect(() => {
    setLabel(item.label || '');
    setQty(item.qty ?? 1);
    setUnitPrice(item.unit_price ?? 0);
  }, [item.label, item.qty, item.unit_price]);

  return (
    <tr data-testid={`cost-row-${item.id}`}>
      <td className="px-lg py-md font-label-md uppercase text-label-sm tracking-widest">{item.kind}</td>
      <td className="px-lg py-md">
        <input value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            onPatchItem(item.id, { label: e.target.value });
          }}
          onBlur={(e) => onPatchItem(item.id, { label: e.target.value })}
          className="w-full bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none py-xs" />
      </td>
      <td className="px-lg py-md w-[110px]">
        <input type="number" min="0" step="0.5" value={qty}
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
          className="w-full bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none py-xs" />
      </td>
      <td className="px-lg py-md w-[140px]">
        <input type="number" min="0" step="0.01" value={unitPrice}
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
          className="w-full bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none py-xs" />
      </td>
      <td className="px-lg py-md font-label-md text-primary">
        {formatPrice((Number(qty)||0) * (Number(unitPrice)||0), currency)}
      </td>
      <td className="px-lg py-md text-right">
        <button onClick={() => onRemoveItem(item.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error-container">
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </td>
    </tr>
  );
});

export function Step3Costing({ proposal, setProposal, proposalId, items, setItems, onPatchItem, onRemoveItem, addItemsOptimistic, saveDraft, proposalCurrency = 'INR', costingPrefs, setCostingPrefs }) {
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);



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
    <div className="space-y-md" data-testid="step-costing">
      {mixedCurrency && (
        <div className="glass-card p-md rounded-xl flex items-start gap-md border-l-4 border-amber-500" data-testid="costing-currency-warning">
          <span className="material-symbols-outlined text-amber-600">warning</span>
          <div className="flex-1 font-label-md text-on-surface">
            Items are in mixed currencies ({mixedCurrency.join(', ')}). The total below is a numeric sum — set every line to <strong>{proposalCurrency}</strong> for an accurate proposal total.
          </div>
        </div>
      )}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-lg py-md border-b border-outline-variant flex items-center justify-between gap-md flex-wrap bg-surface-container-low">
          <div className="flex items-center gap-md">
            <h3 className="font-headline-sm text-headline-sm text-primary">Cost Breakdown</h3>
            <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1 rounded-lg border border-outline-variant">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">payments</span>
              <select
                value={proposalCurrency || 'INR'}
                onChange={(e) => {
                  const newCur = e.target.value;
                  if (setProposal) setProposal(s => ({ ...s, currency: newCur }));
                  useProposalStore.getState().updateProposal({ currency: newCur });
                }}
                className="bg-transparent font-label-md text-primary font-bold outline-none cursor-pointer"
              >
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1 rounded-lg border border-outline-variant">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">visibility</span>
              <select
                value={proposal?.visibility_mode || 'ITEMIZED'}
                onChange={(e) => {
                  const mode = e.target.value;
                  if (setProposal) setProposal(s => ({ ...s, visibility_mode: mode }));
                  useProposalStore.getState().updateProposal({ visibility_mode: mode });
                }}
                className="bg-transparent font-label-md text-primary font-bold outline-none cursor-pointer"
              >
                <option value="ITEMIZED">Itemized Pricing</option>
                <option value="TOTAL_ONLY">Total Only</option>
                <option value="HIDDEN">Hidden Pricing</option>
              </select>
            </div>
          </div>
          <select onChange={(e) => { if (e.target.value) { onAdd(e.target.value); e.target.value=''; } }}
            data-testid="add-line-select"
            className="px-md py-sm border border-outline-variant rounded-lg font-label-md bg-surface-container-lowest">
            <option value="">+ Add line…</option>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <table className="w-full text-left">
          <thead className="bg-surface-container-low">
            <tr>{['Kind','Label','Qty','Unit Price','Subtotal',''].map((h) => (
              <th key={h} className="px-lg py-md font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {items.length === 0 && <tr><td colSpan={6} className="px-lg py-xl text-center text-on-surface-variant" data-testid="costing-empty">No items yet — add hotels / flights / itinerary or use &ldquo;+ Add line&rdquo;.</td></tr>}
            {items.map((it) => (
              <CostingRow key={it.id} item={it} onPatchItem={onPatchItem} onRemoveItem={onRemoveItem} currency={proposalCurrency} />
            ))}
          </tbody>
        </table>
        <div className="bg-surface-container p-md border-t border-outline-variant flex flex-col md:flex-row gap-lg justify-between items-start md:items-end">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-md flex-1">
             <label className="flex flex-col gap-xs">
               <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Fixed Markup</span>
               <input type="number" step="0.01" value={costingPrefs?.fixed_markup || 0} onChange={updPref('fixed_markup')} className="w-24 px-sm py-xs border border-outline-variant rounded bg-surface-container-lowest text-sm" />
             </label>
             <label className="flex flex-col gap-xs">
               <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">% Markup</span>
               <input type="number" step="0.1" value={costingPrefs?.pct_markup || 0} onChange={updPref('pct_markup')} className="w-24 px-sm py-xs border border-outline-variant rounded bg-surface-container-lowest text-sm" />
             </label>
             <label className="flex flex-col gap-xs">
               <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Discount (Flat)</span>
               <input type="number" step="0.01" value={costingPrefs?.discount || 0} onChange={updPref('discount')} className="w-24 px-sm py-xs border border-outline-variant rounded bg-surface-container-lowest text-sm" />
             </label>
             <div className="flex flex-col gap-xs">
               <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Tax / GST (%)</span>
               <div className="flex items-center gap-1">
                 <input type="number" step="0.1" value={costingPrefs?.tax || 0} onChange={updPref('tax')} className="w-16 px-sm py-xs border border-outline-variant rounded bg-surface-container-lowest text-sm font-bold" />
                 <div className="flex gap-1">
                   {[0, 5, 18].map(rate => (
                     <button
                       key={rate}
                       type="button"
                       onClick={() => setCostingPrefs(s => ({ ...s, tax: rate }))}
                       className={`px-1.5 py-0.5 text-[10px] rounded border ${costingPrefs?.tax === rate ? 'bg-primary text-on-primary font-bold border-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:border-primary'}`}
                     >
                       {rate}%
                     </button>
                   ))}
                 </div>
               </div>
             </div>
           </div>
           <div className="text-right pl-lg">
             <span className="text-sm font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Grand Total ({proposalCurrency})</span>
             <span className="font-display text-headline-lg text-primary" data-testid="costing-total">{formatPrice(grandTotal, proposalCurrency)}</span>
           </div>
        </div>
      </div>
      {Object.keys(byKind).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
          {Object.entries(byKind).map(([k, v]) => (
            <div key={k} className="glass-card p-md rounded-xl">
              <p className="font-label-sm tracking-widest text-on-surface-variant">{k}</p>
              <p className="font-headline-sm text-headline-sm text-primary">{formatPrice(v, proposalCurrency)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
