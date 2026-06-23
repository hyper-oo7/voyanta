// Reactive Cost Calculator built on proposal_items.
// Reuses the dashboard chrome. The Stitch cost-calculator HTML had fixed
// hardcoded sections — we replace the canvas with a live, summing view.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useProposalBuilder } from '../context/ProposalBuilderContext.jsx';
import { listItems, addItem, updateItem, removeItem, buildProposalExport } from '../services/proposalItemService.js';
import { fetchProposalById, fetchProposals } from '../services/proposalService.js';
import { VoyantaDashboard_bodyClass, VoyantaDashboard_extraStyles, VoyantaDashboard_html } from './_html/voyanta_dashboard.js';

const KINDS = ['hotel', 'flight', 'activity', 'transfer', 'visa', 'tax', 'margin', 'custom'];

export default function CostCalculatorPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { signOut, isDemo, user } = useAuth();
  const { activeId, setActiveId } = useProposalBuilder();
  const [proposal, setProposal] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchProposals(); setProposals(list);
      if (activeId) {
        const [p, its] = await Promise.all([fetchProposalById(activeId), listItems(activeId)]);
        setProposal(p); setItems(its);
      } else {
        setProposal(null); setItems([]);
      }
    } catch (e) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [activeId, toast]);

  useEffect(() => { reload(); }, [reload]);

  // Mutate dashboard chrome
  useEffect(() => {
    const root = wrapperRef.current; if (!root) return;
    const canvas = root.querySelector('main .max-w-7xl'); if (!canvas) return;
    root.querySelectorAll('aside a').forEach((a) => {
      const lab = a.querySelector('.font-label-md'); if (!lab) return;
      const t = lab.textContent.trim();
      a.className = (t === 'Cost Calculator')
        ? 'flex items-center gap-md bg-surface-container-high text-primary font-semibold border-l-4 border-primary rounded-r-lg py-md px-lg transition-transform scale-[0.98]'
        : 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
    });
    const h2 = canvas.querySelector('h2'); if (h2) h2.textContent = 'Cost Calculator';
    const p  = h2?.parentElement?.querySelector('p'); if (p) p.textContent = 'Live totals — items added from Hotels / Flights / Activities appear here.';
    const cta = canvas.querySelector('button.bg-primary');
    if (cta) { cta.innerHTML = '<span class="material-symbols-outlined">download</span> Export JSON'; cta.onclick = onExportJson; }
    canvas.querySelectorAll(':scope > div.grid, :scope > .bento-grid').forEach((n) => n.remove());
    let mount = canvas.querySelector('#cost-mount');
    if (!mount) { mount = document.createElement('div'); mount.id = 'cost-mount'; canvas.appendChild(mount); }
  });

  // Sign-out wiring
  useEffect(() => {
    const root = wrapperRef.current; if (!root) return;
    const card = root.querySelector('aside .px-lg.pt-xl div.flex.items-center.gap-md'); if (!card) return;
    const onClick = async () => { await signOut(); navigate('/login'); };
    card.style.cursor = 'pointer'; card.addEventListener('click', onClick);
    const name = card.querySelector('p.font-label-md');
    const role = card.querySelector('p.font-label-sm');
    if (name) name.textContent = user?.user_metadata?.full_name || (isDemo ? 'Demo User' : 'Voyanta Agent');
    if (role) role.textContent = isDemo ? 'Demo Session' : (user?.email || 'Premium Agent');
    return () => card.removeEventListener('click', onClick);
  }, [signOut, navigate, isDemo, user]);

  const onExportJson = async () => {
    if (!activeId) { toast.error('Open a proposal first'); return; }
    try {
      const json = await buildProposalExport(activeId);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `proposal-${json.proposal?.name || activeId}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success('Proposal JSON exported');
    } catch (e) { toast.error(e.message); }
  };

  const totals = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const byKind = {};
  for (const it of items) byKind[it.kind] = (byKind[it.kind] || 0) + (Number(it.qty)||0)*(Number(it.unit_price)||0);

  const onPatch = async (id, patch) => {
    try { await updateItem(id, patch); reload(); } catch (e) { toast.error(e.message); }
  };
  const onDel = async (id) => {
    try { await removeItem(id); reload(); } catch (e) { toast.error(e.message); }
  };
  const addCustom = async (kind) => {
    if (!activeId) { toast.error('Open a proposal first'); return; }
    try { await addItem(activeId, { kind, label: `New ${kind}`, qty: 1, unit_price: 0, currency: 'USD' }); reload(); }
    catch (e) { toast.error(e.message); }
  };

  const mount = wrapperRef.current?.querySelector('#cost-mount');

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <StitchPage styleId="stitch-style-cost-calc" bodyClass={VoyantaDashboard_bodyClass}
        extraStyles={VoyantaDashboard_extraStyles} html={VoyantaDashboard_html} navMap={navMap} />
      {mount && createPortal(
        <div className="space-y-lg" data-testid="cost-calc">
          <div className="glass-card p-lg rounded-xl flex items-center gap-md flex-wrap">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Active Proposal</span>
            <select value={activeId || ''} onChange={(e) => setActiveId(e.target.value || null)} data-testid="active-proposal-select"
              className="flex-1 min-w-[240px] px-md py-sm bg-white border border-outline-variant rounded-lg font-body-md">
              <option value="">— none —</option>
              {proposals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {proposal && <span className="font-label-sm text-on-surface-variant">{items.length} item(s)</span>}
            <button onClick={() => navigate('/proposals/brief')} data-testid="new-prop-btn"
              className="px-lg py-sm border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low">
              + New
            </button>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-lg py-md border-b border-outline-variant flex items-center gap-md">
              <h4 className="font-headline-sm text-headline-sm text-primary flex-1">Line Items</h4>
              <select onChange={(e) => { if (e.target.value) { addCustom(e.target.value); e.target.value = ''; } }}
                data-testid="add-line-select"
                className="px-md py-sm border border-outline-variant rounded-lg font-label-md bg-white">
                <option value="">+ Add line…</option>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <table className="w-full text-left">
              <thead className="bg-surface-container-low">
                <tr>
                  {['Kind','Label','Qty','Unit Price','Subtotal',''].map((h) => (
                    <th key={h} className="px-lg py-md font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {loading && <tr><td colSpan={6} className="px-lg py-xl text-center text-on-surface-variant">Loading…</td></tr>}
                {!loading && !activeId && <tr><td colSpan={6} className="px-lg py-xl text-center text-on-surface-variant" data-testid="cost-no-proposal">Select an active proposal to see line items.</td></tr>}
                {!loading && activeId && items.length === 0 && <tr><td colSpan={6} className="px-lg py-xl text-center text-on-surface-variant" data-testid="cost-empty">No items yet — add hotels / flights / activities from their pages.</td></tr>}
                {items.map((it) => (
                  <tr key={it.id} data-testid={`item-row-${it.id}`}>
                    <td className="px-lg py-md font-label-md uppercase text-label-sm tracking-widest">{it.kind}</td>
                    <td className="px-lg py-md">
                      <input value={it.label} onChange={(e) => setItems((s) => s.map((x) => x.id === it.id ? { ...x, label: e.target.value } : x))}
                        onBlur={(e) => onPatch(it.id, { label: e.target.value })}
                        className="w-full bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none py-xs" />
                    </td>
                    <td className="px-lg py-md w-[110px]">
                      <input type="number" min="0" step="0.5" value={it.qty}
                        onChange={(e) => setItems((s) => s.map((x) => x.id === it.id ? { ...x, qty: e.target.value } : x))}
                        onBlur={(e) => onPatch(it.id, { qty: parseFloat(e.target.value) || 0 })}
                        data-testid={`qty-${it.id}`}
                        className="w-full bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none py-xs" />
                    </td>
                    <td className="px-lg py-md w-[140px]">
                      <input type="number" min="0" step="0.01" value={it.unit_price}
                        onChange={(e) => setItems((s) => s.map((x) => x.id === it.id ? { ...x, unit_price: e.target.value } : x))}
                        onBlur={(e) => onPatch(it.id, { unit_price: parseFloat(e.target.value) || 0 })}
                        data-testid={`price-${it.id}`}
                        className="w-full bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none py-xs" />
                    </td>
                    <td className="px-lg py-md font-label-md text-primary">
                      {(Number(it.qty)||0) * (Number(it.unit_price)||0)} {it.currency}
                    </td>
                    <td className="px-lg py-md text-right">
                      <button onClick={() => onDel(it.id)} data-testid={`del-${it.id}`}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error-container">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="bg-surface-container-low">
                    <td colSpan={4} className="px-lg py-md font-label-md text-on-surface-variant uppercase tracking-widest">Subtotal</td>
                    <td colSpan={2} className="px-lg py-md font-headline-sm text-headline-sm text-primary" data-testid="cost-total">{totals.toFixed(2)} {items[0]?.currency || 'USD'}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {Object.keys(byKind).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
              {Object.entries(byKind).map(([k, v]) => (
                <div key={k} className="glass-card p-md rounded-xl">
                  <p className="font-label-sm uppercase tracking-widest text-on-surface-variant">{k}</p>
                  <p className="font-headline-sm text-headline-sm text-primary">{v.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>,
        mount
      )}
    </div>
  );
}
