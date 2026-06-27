// Proposal Builder Hub — the page agents land on after the Client Brief.
// Reuses dashboard chrome. Shows: active proposal header, item list grouped by
// kind, quick-jump buttons to Hotels / Flights / Activities / Templates, and
// links to Cost Calculator + Preview.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';


import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useProposalBuilder } from '../context/ProposalBuilderContext.jsx';
import { fetchProposalById, fetchProposals, updateProposal } from '../services/proposalService.js';
import { listItems, removeItem, buildProposalExport } from '../services/proposalItemService.js';
import { templatesService } from '../services/resourceService.js';
import { addItem } from '../services/proposalItemService.js';
import { formatINR } from '../lib/currency.js';


export default function AiItineraryGeneratorPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { signOut, isDemo, user } = useAuth();
  const { activeId, setActiveId } = useProposalBuilder();
  const [proposals, setProposals] = useState([]);
  const [proposal, setProposal] = useState(null);
  const [items, setItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pick up ?id= from URL → set as active
  useEffect(() => {
    const idFromUrl = params.get('id');
    if (idFromUrl && idFromUrl !== activeId) setActiveId(idFromUrl);
  }, [params, activeId, setActiveId]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, tpls] = await Promise.all([fetchProposals(), templatesService.list()]);
      setProposals(list); setTemplates(tpls);
      if (activeId) {
        const [p, its] = await Promise.all([fetchProposalById(activeId), listItems(activeId)]);
        setProposal(p); setItems(its);
      } else { setProposal(null); setItems([]); }
    } catch (e) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [activeId, toast]);

  useEffect(() => { reload(); }, [reload]);

  const [mountNode, setMountNode] = useState(null);

  // Mutate dashboard chrome
  useEffect(() => {
    const canvas = document.querySelector('main .max-w-7xl'); if (!canvas) return;
    document.querySelectorAll('aside a').forEach((a) => {
      const lab = a.querySelector('.font-label-md'); if (!lab) return;
      const t = lab.textContent.trim();
      a.className = (t === 'Proposals' || t === 'New Proposal')
        ? 'flex items-center gap-md bg-surface-container-high text-primary font-semibold border-l-4 border-primary rounded-r-lg py-md px-lg transition-transform scale-[0.98]'
        : 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
    });
    const h2 = canvas.querySelector('h2'); if (h2) h2.textContent = 'Proposal Builder';
    const p  = h2?.parentElement?.querySelector('p'); if (p) p.textContent = 'Assemble your proposal from the supplier libraries.';
    const cta = canvas.querySelector('button.bg-primary');
    if (cta) {
      cta.style.display = 'inline-flex';
      cta.innerHTML = '<span class="material-symbols-outlined">visibility</span> Preview';
      cta.onclick = () => navigate('/proposals/preview');
    }
    canvas.querySelectorAll(':scope > div.grid, :scope > .bento-grid').forEach((n) => n.remove());
    let mount = canvas.querySelector('#builder-mount');
    if (!mount) { mount = document.createElement('div'); mount.id = 'builder-mount'; canvas.appendChild(mount); }
    setMountNode(mount);
  });

  // Sign-out
  useEffect(() => {
    const card = document.querySelector('aside .px-lg.pt-xl div.flex.items-center.gap-md'); if (!card) return;
    const onClick = async () => { await signOut(); navigate('/login'); };
    card.style.cursor = 'pointer'; card.addEventListener('click', onClick);
    const name = card.querySelector('p.font-label-md');
    const role = card.querySelector('p.font-label-sm');
    if (name) name.textContent = user?.user_metadata?.full_name || (isDemo ? 'Demo User' : 'Voyanta Agent');
    if (role) role.textContent = isDemo ? 'Demo Session' : (user?.email || 'Premium Agent');
    return () => card.removeEventListener('click', onClick);
  }, [signOut, navigate, isDemo, user]);

  const onApplyTemplate = async (tplId) => {
    if (!activeId) { toast.error('Open a proposal first'); return; }
    const t = templates.find((x) => x.id === tplId); if (!t) return;
    try {
      await addItem(activeId, { kind: 'custom', label: `Template: ${t.name}`, qty: 1, unit_price: Number(t.price_from || 0), currency: t.currency || 'INR', meta: { template_id: t.id, days: t.days } });
      toast.success('Template applied'); reload();
    } catch (e) { toast.error(e.message); }
  };

  const onChangeStatus = async (status) => {
    if (!activeId) return;
    try { await updateProposal(activeId, { status }); reload(); toast.success(`Marked ${status}`); }
    catch (e) { toast.error(e.message); }
  };

  const onExport = async () => {
    if (!activeId) return;
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

  const total = items.reduce((s, it) => s + (Number(it.qty)||0)*(Number(it.unit_price)||0), 0);
  const grouped = {}; items.forEach((it) => (grouped[it.kind] ||= []).push(it));

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      {mountNode && createPortal(
        <div className="space-y-lg" data-testid="builder">
          <div className="glass-card p-lg rounded-xl flex items-center gap-md flex-wrap">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Active Proposal</span>
            <select value={activeId || ''} onChange={(e) => setActiveId(e.target.value || null)} data-testid="builder-active-select"
              className="flex-1 min-w-[240px] px-md py-sm bg-white border border-outline-variant rounded-lg font-body-md">
              <option value="">— none —</option>
              {proposals.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.status}</option>)}
            </select>
            <button onClick={() => navigate('/proposals/brief')} className="px-lg py-sm border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low" data-testid="builder-new">+ New Brief</button>
          </div>

          {!activeId && !loading && (
            <div className="glass-card p-xl rounded-xl text-center" data-testid="builder-empty">
              <span className="material-symbols-outlined text-[48px] text-primary">draft</span>
              <p className="font-headline-sm mt-md">No active proposal</p>
              <p className="font-body-md text-on-surface-variant">Pick one above or create a new client brief.</p>
            </div>
          )}

          {activeId && proposal && (
            <>
              <div className="glass-card p-lg rounded-xl flex items-center gap-md flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <p className="font-headline-sm">{proposal.name}</p>
                  <p className="font-body-sm text-on-surface-variant">{proposal.client_name || '—'} · {proposal.destination || '—'}</p>
                </div>
                <select value={proposal.status} onChange={(e) => onChangeStatus(e.target.value)}
                  data-testid="builder-status"
                  className="px-md py-sm bg-white border border-outline-variant rounded-lg font-label-md">
                  {['Draft','Sent','Accepted','Declined'].map((s) => <option key={s}>{s}</option>)}
                </select>
                <button onClick={onExport} data-testid="builder-export"
                  className="px-lg py-sm bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[18px]">download</span>Export JSON
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
                {[
                  { label: 'Add Hotels',     icon: 'hotel',    route: '/libraries/hotels' },
                  { label: 'Add Flights',    icon: 'flight',   route: '/flights' },
                  { label: 'Add Activities', icon: 'tour',     route: '/activities' },
                  { label: 'Cost Calculator',icon: 'calculate',route: '/cost-calculator' },
                ].map((q) => (
                  <button key={q.route} onClick={() => navigate(q.route)} data-testid={`quick-${q.icon}`}
                    className="glass-card p-lg rounded-xl text-left hover:bg-surface-container-low transition-colors flex items-center gap-md">
                    <span className="material-symbols-outlined text-[28px] text-primary">{q.icon}</span>
                    <span className="font-label-md">{q.label}</span>
                    <span className="material-symbols-outlined ml-auto text-on-surface-variant">chevron_right</span>
                  </button>
                ))}
              </div>

              <div className="glass-card rounded-xl overflow-hidden">
                <div className="px-lg py-md border-b border-outline-variant flex items-center gap-md">
                  <h4 className="font-headline-sm text-headline-sm text-primary flex-1">Items</h4>
                  <select onChange={(e) => { if (e.target.value) { onApplyTemplate(e.target.value); e.target.value=''; } }}
                    data-testid="apply-template-select"
                    className="px-md py-sm border border-outline-variant rounded-lg font-label-md bg-white">
                    <option value="">Apply template…</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <span className="font-headline-sm text-primary" data-testid="builder-total">{formatINR(total)}</span>
                </div>
                {Object.keys(grouped).length === 0 && (
                  <p className="px-lg py-xl text-center text-on-surface-variant" data-testid="items-empty">No items yet — pick from Hotels / Flights / Activities.</p>
                )}
                {Object.entries(grouped).map(([kind, list]) => (
                  <div key={kind} className="border-t border-outline-variant">
                    <p className="px-lg py-sm font-label-sm uppercase tracking-widest text-on-surface-variant bg-surface-container-low">{kind} ({list.length})</p>
                    {list.map((it) => (
                      <div key={it.id} className="flex items-center px-lg py-md gap-md hover:bg-surface-container-low" data-testid={`builder-item-${it.id}`}>
                        <span className="font-body-md flex-1 truncate">{it.label}</span>
                        <span className="font-label-sm text-on-surface-variant">×{it.qty} @ {formatINR(it.unit_price)}</span>
                        <button onClick={async () => { await removeItem(it.id); reload(); }} className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error-container">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>,
        mountNode
      )}
    </div>
  );
}
