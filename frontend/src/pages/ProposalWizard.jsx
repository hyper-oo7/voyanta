// Proposal Wizard — the canonical proposal workflow.
//
// Single connected flow:  Client → Hotels → Flights → Activities → Costing → Branding → Preview.
// Reuses DynamicTable + ImportModal + proposal_items services so no UI is redesigned.
// All wizard fields persist via the existing proposals row (extras into `brief` jsonb)
// and proposal_items (selected hotels/flights/activities + manual lines).
//
// Routing:  /proposals/wizard?id=<uuid>&step=<1..7>
// Step is reflected in the URL so deep-links into a particular step Just Work.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import StitchPage from '../components/StitchPage.jsx';
import DynamicTable from '../components/DynamicTable.jsx';
import ImportModal from '../components/ImportModal.jsx';
import navMap from '../lib/navMap.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useProposalBuilder } from '../context/ProposalBuilderContext.jsx';
import { COUNTRY_CODES, DEFAULT_COUNTRY } from '../lib/countries.js';
import {
  fetchProposalById, createProposal, updateProposal,
} from '../services/proposalService.js';
import { hotelsService, flightsService, activitiesService } from '../services/resourceService.js';
import {
  listItems, addItem, removeItem, updateItem, buildProposalExport,
} from '../services/proposalItemService.js';
import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';
import TemplateRenderer, { ALL as ALL_SECTIONS, ExportOptionsBar } from '../components/TemplateRenderer.jsx';
import LogoUploader from '../components/LogoUploader.jsx';
import { FONT_CATALOG } from '../lib/fonts.js';
import { VoyantaDashboard_bodyClass, VoyantaDashboard_extraStyles, VoyantaDashboard_html } from './_html/voyanta_dashboard.js';

const STEPS = [
  { n: 1, key: 'client',    label: 'Client Info' },
  { n: 2, key: 'hotels',    label: 'Hotels' },
  { n: 3, key: 'flights',   label: 'Flights' },
  { n: 4, key: 'activities',label: 'Activities' },
  { n: 5, key: 'costing',   label: 'Costing' },
  { n: 6, key: 'branding',  label: 'Branding' },
  { n: 7, key: 'preview',   label: 'Preview' },
];

export default function ProposalWizard() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { signOut, isDemo, user } = useAuth();
  const { setActiveId } = useProposalBuilder() || {};

  const idParam   = params.get('id') || '';
  const stepParam = Math.max(1, Math.min(7, parseInt(params.get('step') || '1', 10) || 1));

  const [proposal, setProposal] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local form state — initialised from proposal when it loads
  const [client, setClient] = useState({
    customer_name: '', phone: '', country: DEFAULT_COUNTRY, email: '',
    destination: '', start_date: '', end_date: '',
    num_adults: 1, num_children: 0, budget: '', special_notes: '',
  });
  const [branding, setBranding] = useState({
    agency_name: 'Voyanta', logo_url: '', address: '',
    contact_email: '', contact_phone: '', website: '',
    social_facebook: '', social_instagram: '', social_linkedin: '',
    cover_image_url: '', highlights: '',
    inclusions: '', exclusions: '', terms_of_payment: '',
    primary_color: '#0b1c30', template_style: 'elegant', font_family: '',
  });

  // Pre-load agency-level branding on first wizard open (only if proposal has no branding yet).
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      try {
        const { data } = await supabase.from('agencies').select('*').eq('id', DEFAULT_AGENCY_ID).maybeSingle();
        if (!data) return;
        const social = data.social_links || {};
        setBranding((b) => ({
          ...b,
          agency_name: b.agency_name || data.name || 'Voyanta',
          logo_url:    b.logo_url    || data.logo_url || '',
          address:     b.address     || data.address || '',
          contact_email: b.contact_email || data.contact_email || '',
          contact_phone: b.contact_phone || data.contact_phone || '',
          website:     b.website     || data.website || '',
          primary_color: b.primary_color || data.primary_color || '#0b1c30',
          font_family: b.font_family || data.font_family || '',
          social_facebook:  b.social_facebook  || social.facebook  || '',
          social_instagram: b.social_instagram || social.instagram || '',
          social_linkedin:  b.social_linkedin  || social.linkedin  || '',
        }));
      } catch { /* ignore */ }
    })();
  }, []);

  // Load proposal + items when id changes
  const reload = useCallback(async (pid) => {
    setLoading(true);
    try {
      if (pid) {
        const [p, its] = await Promise.all([fetchProposalById(pid), listItems(pid)]);
        if (p) {
          setProposal(p); setActiveId?.(p.id);
          setItems(its);
          const b = p.brief || {};
          setClient({
            customer_name: p.client_name || '',
            phone:    b.phone     || '',
            country:  b.country   || DEFAULT_COUNTRY,
            email:    b.email     || '',
            destination: p.destination || '',
            start_date:  p.start_date || '',
            end_date:    p.end_date   || '',
            num_adults:   b.num_adults   ?? p.travelers ?? 1,
            num_children: b.num_children ?? 0,
            budget: p.budget_max ?? '',
            special_notes: b.special_notes || '',
          });
          if (p.preferences?.branding) setBranding((s) => ({ ...s, ...p.preferences.branding }));
        }
      } else { setProposal(null); setItems([]); }
    } catch (e) { toast.error(e.message || 'Failed to load proposal'); }
    finally { setLoading(false); }
  }, [setActiveId, toast]);

  useEffect(() => { reload(idParam); }, [idParam, reload]);

  // Mutate dashboard chrome
  useEffect(() => {
    const root = wrapperRef.current; if (!root) return;
    const canvas = root.querySelector('main .max-w-7xl'); if (!canvas) return;
    root.querySelectorAll('aside a').forEach((a) => {
      const lab = a.querySelector('.font-label-md'); if (!lab) return;
      const t = lab.textContent.trim();
      a.className = (t === 'New Proposal' || t === 'Proposals')
        ? 'flex items-center gap-md bg-surface-container-high text-primary font-semibold border-l-4 border-primary rounded-r-lg py-md px-lg transition-transform scale-[0.98]'
        : 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
    });
    const h2 = canvas.querySelector('h2'); if (h2) h2.textContent = proposal ? proposal.name : 'New Proposal';
    const p  = h2?.parentElement?.querySelector('p'); if (p) p.textContent = 'Guided proposal builder.';
    const cta = canvas.querySelector('button.bg-primary');
    if (cta) {
      cta.innerHTML = '<span class="material-symbols-outlined">close</span> Exit';
      cta.onclick = () => navigate('/proposals');
    }
    canvas.querySelectorAll(':scope > div.grid, :scope > .bento-grid').forEach((n) => n.remove());
    let mount = canvas.querySelector('#wizard-mount');
    if (!mount) { mount = document.createElement('div'); mount.id = 'wizard-mount'; canvas.appendChild(mount); }
  });

  // Sign-out wiring + name labels
  useEffect(() => {
    const root = wrapperRef.current; if (!root) return;
    const card = root.querySelector('aside .px-lg.pt-xl div.flex.items-center.gap-md'); if (!card) return;
    card.style.cursor = 'pointer';
    const onClick = async () => { await signOut(); navigate('/login'); };
    card.addEventListener('click', onClick);
    const name = card.querySelector('p.font-label-md');
    const role = card.querySelector('p.font-label-sm');
    if (name) name.textContent = user?.user_metadata?.full_name || (isDemo ? 'Demo User' : 'Voyanta Agent');
    if (role) role.textContent = isDemo ? 'Demo Session' : (user?.email || 'Premium Agent');
    return () => card.removeEventListener('click', onClick);
  }, [signOut, navigate, isDemo, user]);

  // ---- Persistence helpers ------------------------------------------------
  const buildPayload = useCallback(() => {
    const c = client;
    const travelers = (parseInt(c.num_adults, 10) || 0) + (parseInt(c.num_children, 10) || 0);
    return {
      name: c.destination ? `${c.destination} — ${c.customer_name || 'Trip'}` : (c.customer_name || 'Untitled Proposal'),
      client_name: c.customer_name || 'New Client',
      destination: c.destination || null,
      start_date: c.start_date || null,
      end_date: c.end_date || null,
      travelers: travelers || 1,
      budget_max: c.budget === '' ? null : Number(c.budget),
      currency: 'INR',
      brief: {
        phone: c.phone, country: c.country, email: c.email,
        num_adults: parseInt(c.num_adults, 10) || 0,
        num_children: parseInt(c.num_children, 10) || 0,
        special_notes: c.special_notes,
      },
      preferences: { ...(proposal?.preferences || {}), branding },
      status: proposal?.status || 'Draft',
    };
  }, [client, branding, proposal]);

  const saveDraft = useCallback(async (silent = false) => {
    setSaving(true);
    try {
      const payload = buildPayload();
      let p;
      if (proposal?.id) p = await updateProposal(proposal.id, payload);
      else { p = await createProposal(payload); setActiveId?.(p.id); setParams({ id: p.id, step: String(stepParam) }, { replace: true }); }
      setProposal((prev) => ({ ...(prev || {}), ...p }));
      if (!silent) toast.success('Draft saved');
      return p;
    } catch (e) { if (!silent) toast.error(e.message || 'Save failed'); throw e; }
    finally { setSaving(false); }
  }, [buildPayload, proposal, setActiveId, setParams, stepParam, toast]);

  // ---- Step navigation ---------------------------------------------------
  const goStep = (n, idOverride) => setParams({ id: idOverride ?? proposal?.id ?? '', step: String(n) }, { replace: false });

  const onNext = async () => {
    let pid = proposal?.id;
    if (stepParam === 1 || stepParam === 6) {
      try { const p = await saveDraft(true); pid = p?.id || pid; }
      catch { return; }
    }
    if (!pid && stepParam !== 1) { toast.error('Save the client info first'); return; }
    goStep(Math.min(7, stepParam + 1), pid);
  };
  const onPrev = () => goStep(Math.max(1, stepParam - 1));

  // ---- Items helpers used by 2/3/4/5 -------------------------------------
  const sanitizeCurrency = (v) => /^[A-Z]{3}$/.test(String(v || '').toUpperCase()) ? String(v).toUpperCase() : (proposal?.currency || 'INR');
  const nights = useMemo(() => {
    const a = proposal?.start_date || client.start_date;
    const b = proposal?.end_date   || client.end_date;
    if (!a || !b) return 1;
    const ms = new Date(b).getTime() - new Date(a).getTime();
    const n = Math.round(ms / (1000 * 60 * 60 * 24));
    return n > 0 ? n : 1;
  }, [proposal?.start_date, proposal?.end_date, client.start_date, client.end_date]);
  const travelers = useMemo(() => {
    const t = (parseInt(client.num_adults, 10) || 0) + (parseInt(client.num_children, 10) || 0);
    return t > 0 ? t : (proposal?.travelers || 1);
  }, [client.num_adults, client.num_children, proposal?.travelers]);

  const defaultQtyFor = (kind) => kind === 'hotel' ? nights : (kind === 'flight' || kind === 'activity' ? travelers : 1);

  const addItemsToProposal = async (kind, rows, toLabel, toUnit) => {
    if (!proposal?.id) { toast.error('Save the client info first'); return; }
    try {
      const qty = defaultQtyFor(kind);
      for (const r of rows) {
        await addItem(proposal.id, {
          kind, ref_id: r.id, label: toLabel(r),
          qty, unit_price: toUnit(r),
          currency: sanitizeCurrency(r.currency),
          meta: { source: kind + 's', auto_qty_basis: kind === 'hotel' ? 'nights' : (kind === 'flight' || kind === 'activity' ? 'travelers' : 'one') },
        });
      }
      const its = await listItems(proposal.id); setItems(its);
      toast.success(`Added ${rows.length} ${kind}(s) · qty ${qty}`);
    } catch (e) { toast.error(e.message); }
  };

  const onRemoveItem = async (id) => {
    try { await removeItem(id); setItems((s) => s.filter((x) => x.id !== id)); toast.success('Removed'); }
    catch (e) { toast.error(e.message); }
  };

  const onPatchItem = async (id, patch) => {
    try { const u = await updateItem(id, patch); setItems((s) => s.map((x) => x.id === id ? u : x)); }
    catch (e) { toast.error(e.message); }
  };

  const mount = wrapperRef.current?.querySelector('#wizard-mount');

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <StitchPage styleId="stitch-style-wizard" bodyClass={VoyantaDashboard_bodyClass}
        extraStyles={VoyantaDashboard_extraStyles} html={VoyantaDashboard_html} navMap={navMap} />
      {mount && createPortal(
        <div className="space-y-lg" data-testid="proposal-wizard">
          <ProgressBar step={stepParam} onJump={(n) => proposal?.id ? goStep(n, proposal.id) : (n === 1 ? null : toast.error('Save client info first'))} />

          {loading ? (
            <div className="glass-card p-xl rounded-xl text-center">Loading…</div>
          ) : (
            <>
              {stepParam === 1 && <Step1 client={client} setClient={setClient} />}
              {stepParam === 2 && <ResourceStep kind="hotel"    service={hotelsService}     resource="hotels"     items={items}
                addItems={(rows) => addItemsToProposal('hotel',  rows, (r) => r.name, (r) => Number(r.price_per_night||0))}
                onRemoveItem={onRemoveItem} />}
              {stepParam === 3 && <ResourceStep kind="flight"   service={flightsService}    resource="flights"    items={items}
                addItems={(rows) => addItemsToProposal('flight', rows, (r) => `${r.airline||'Flight'} ${r.flight_no||''} ${r.origin||''}→${r.destination||''}`.trim(), (r) => Number(r.cost||0))}
                onRemoveItem={onRemoveItem} />}
              {stepParam === 4 && <ResourceStep kind="activity" service={activitiesService} resource="activities" items={items}
                addItems={(rows) => addItemsToProposal('activity', rows, (r) => r.name, (r) => Number(r.price||0))}
                onRemoveItem={onRemoveItem} />}
              {stepParam === 5 && <Step5Costing proposalId={proposal?.id} items={items} setItems={setItems}
                onPatchItem={onPatchItem} onRemoveItem={onRemoveItem}
                proposalCurrency={proposal?.currency || 'USD'} />}
              {stepParam === 6 && <Step6Branding branding={branding} setBranding={setBranding} />}
              {stepParam === 7 && <Step7Preview proposalId={proposal?.id} branding={branding} />}
            </>
          )}

          <div className="glass-card p-md rounded-xl flex items-center gap-md sticky bottom-0 z-10" data-testid="wizard-footer">
            <button onClick={onPrev} disabled={stepParam === 1} data-testid="wizard-prev"
              className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low disabled:opacity-50">Previous</button>
            <button onClick={() => saveDraft(false)} disabled={saving} data-testid="wizard-save"
              className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <span className="flex-1" />
            <span className="font-label-sm text-on-surface-variant uppercase tracking-widest mr-md">
              Step {stepParam} / 7
            </span>
            {stepParam < 7 && (
              <button onClick={onNext} disabled={saving} data-testid="wizard-next"
                className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60 flex items-center gap-xs">
                Continue to {STEPS[stepParam].label}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>,
        mount
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Progress indicator
// ───────────────────────────────────────────────────────────────────────────
function ProgressBar({ step, onJump }) {
  return (
    <div className="glass-card rounded-xl p-md flex items-center gap-xs overflow-x-auto" data-testid="wizard-progress">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-xs flex-shrink-0">
          <button onClick={() => onJump(s.n)} data-testid={`step-${s.n}`}
            className={'px-md py-xs rounded-full font-label-sm transition-all ' +
              (step === s.n ? 'bg-primary text-on-primary' :
               step > s.n  ? 'bg-surface-container-highest text-primary' :
                             'bg-surface-container-low text-on-surface-variant')}>
            <span className="material-symbols-outlined text-[14px] mr-xs align-middle">{step > s.n ? 'check' : 'circle'}</span>
            {s.n}. {s.label}
          </button>
          {i < STEPS.length - 1 && <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Step 1 — Client Information
// ───────────────────────────────────────────────────────────────────────────
function Step1({ client, setClient }) {
  const upd = (k) => (e) => setClient((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div className="glass-card rounded-xl p-lg space-y-md" data-testid="step-1">
      <h3 className="font-headline-sm text-headline-sm text-primary">Client Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <Field label="Customer Name *" value={client.customer_name} onChange={upd('customer_name')} testid="customer-name" />
        <div className="flex gap-xs">
          <div>
            <label className="font-label-md text-label-md text-on-surface block mb-xs">Country Code</label>
            <select value={client.country} onChange={upd('country')} data-testid="country-code"
              className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md">
              {COUNTRY_CODES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <Field label="Phone Number" value={client.phone} onChange={upd('phone')} testid="phone" extraClass="flex-1" />
        </div>
        <Field label="Email" type="email" value={client.email} onChange={upd('email')} testid="email" />
        <Field label="Destination" value={client.destination} onChange={upd('destination')} testid="destination" />
        <Field label="Start Date" type="date" value={client.start_date} onChange={upd('start_date')} testid="start-date" />
        <Field label="End Date"   type="date" value={client.end_date}   onChange={upd('end_date')}   testid="end-date" />
        <Field label="Adults"   type="number" value={client.num_adults}   onChange={upd('num_adults')}   testid="adults" />
        <Field label="Children" type="number" value={client.num_children} onChange={upd('num_children')} testid="children" />
        <Field label="Budget (max)" type="number" value={client.budget} onChange={upd('budget')} testid="budget" />
      </div>
      <div>
        <label className="font-label-md text-label-md text-on-surface block mb-xs">Special Notes</label>
        <textarea value={client.special_notes} onChange={upd('special_notes')} rows={3} data-testid="special-notes"
          className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', testid, extraClass = '' }) {
  return (
    <label className={'flex flex-col gap-xs ' + extraClass}>
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <input type={type} value={value ?? ''} onChange={onChange} data-testid={testid}
        className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Steps 2/3/4 — Resource picker (Hotels / Flights / Activities)
// Reuses DynamicTable + ImportModal. Shows already-added items with delete.
// ───────────────────────────────────────────────────────────────────────────
function ResourceStep({ kind, service, resource, items, addItems, onRemoveItem }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState(new Set());
  const [importOpen, setImportOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await service.list()); } catch { /* surfaced by caller */ }
    finally { setLoading(false); }
  }, [service]);

  useEffect(() => { reload(); }, [reload]);

  const onAdd = async () => {
    const picked = rows.filter((r) => selection.has(r.id));
    if (!picked.length) return;
    await addItems(picked);
    setSelection(new Set());
  };

  const ofKind = items.filter((it) => it.kind === kind);

  return (
    <div className="space-y-md" data-testid={`step-${kind}`}>
      <div className="glass-card p-md rounded-xl flex items-center gap-md flex-wrap">
        <h3 className="font-headline-sm text-headline-sm text-primary flex-1 capitalize">{resource} inventory</h3>
        <button onClick={() => setImportOpen(true)} data-testid={`import-${resource}-btn`}
          className="px-lg py-sm border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">upload</span> Import
        </button>
        {selection.size > 0 && (
          <button onClick={onAdd} data-testid={`add-${kind}s-to-proposal`}
            className="px-lg py-sm bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90">
            Add {selection.size} to proposal
          </button>
        )}
      </div>

      <DynamicTable
        rows={rows} loading={loading}
        selection={selection} onSelectionChange={setSelection}
        emptyMessage={`No ${resource} yet — click Import to upload a supplier file.`}
      />

      {ofKind.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden" data-testid={`${kind}-selected`}>
          <div className="px-lg py-md border-b border-outline-variant flex items-center gap-md">
            <h4 className="font-headline-sm text-headline-sm text-primary flex-1">Selected for this proposal · {ofKind.length}</h4>
          </div>
          <ul className="divide-y divide-outline-variant">
            {ofKind.map((it) => (
              <li key={it.id} className="flex items-center px-lg py-md gap-md" data-testid={`selected-${it.id}`}>
                <span className="font-body-md flex-1 truncate">{it.label}</span>
                <span className="font-label-sm text-on-surface-variant">{it.unit_price} {it.currency}</span>
                <button onClick={() => onRemoveItem(it.id)} title="Remove"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error-container">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {importOpen && <ImportModal resource={resource} onClose={() => setImportOpen(false)} onImported={reload} />}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Step 5 — Costing
// ───────────────────────────────────────────────────────────────────────────
const KINDS = ['transfer', 'visa', 'tax', 'margin', 'custom'];

function Step5Costing({ proposalId, items, setItems, onPatchItem, onRemoveItem, proposalCurrency = 'INR' }) {
  const total = useMemo(() => items.reduce((s, it) => s + (Number(it.qty)||0)*(Number(it.unit_price)||0), 0), [items]);
  const byKind = useMemo(() => {
    const m = {}; items.forEach((it) => { m[it.kind] = (m[it.kind]||0) + (Number(it.qty)||0)*(Number(it.unit_price)||0); });
    return m;
  }, [items]);
  const mixedCurrency = useMemo(() => {
    const set = new Set(items.map((it) => (it.currency || proposalCurrency).toUpperCase()).filter(Boolean));
    set.add(proposalCurrency);
    return set.size > 1 ? Array.from(set) : null;
  }, [items, proposalCurrency]);

  const onAdd = async (kind) => {
    if (!proposalId) return;
    try {
      const it = await addItem(proposalId, { kind, label: `New ${kind}`, qty: 1, unit_price: 0, currency: proposalCurrency });
      setItems((s) => [...s, it]);
    } catch { /* surfaced upstream */ }
  };

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
        <div className="px-lg py-md border-b border-outline-variant flex items-center gap-md flex-wrap">
          <h3 className="font-headline-sm text-headline-sm text-primary flex-1">Cost Breakdown</h3>
          <select onChange={(e) => { if (e.target.value) { onAdd(e.target.value); e.target.value=''; } }}
            data-testid="add-line-select"
            className="px-md py-sm border border-outline-variant rounded-lg font-label-md bg-white">
            <option value="">+ Add line…</option>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <span className="font-headline-sm text-primary" data-testid="costing-total">{total.toFixed(2)} {proposalCurrency}</span>
        </div>
        <table className="w-full text-left">
          <thead className="bg-surface-container-low">
            <tr>{['Kind','Label','Qty','Unit Price','Subtotal',''].map((h) => (
              <th key={h} className="px-lg py-md font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {items.length === 0 && <tr><td colSpan={6} className="px-lg py-xl text-center text-on-surface-variant" data-testid="costing-empty">No items yet — add hotels / flights / activities or use &ldquo;+ Add line&rdquo;.</td></tr>}
            {items.map((it) => (
              <tr key={it.id} data-testid={`cost-row-${it.id}`}>
                <td className="px-lg py-md font-label-md uppercase text-label-sm tracking-widest">{it.kind}</td>
                <td className="px-lg py-md">
                  <input value={it.label}
                    onChange={(e) => setItems((s) => s.map((x) => x.id === it.id ? { ...x, label: e.target.value } : x))}
                    onBlur={(e) => onPatchItem(it.id, { label: e.target.value })}
                    className="w-full bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none py-xs" />
                </td>
                <td className="px-lg py-md w-[110px]">
                  <input type="number" min="0" step="0.5" value={it.qty}
                    onChange={(e) => setItems((s) => s.map((x) => x.id === it.id ? { ...x, qty: e.target.value } : x))}
                    onBlur={(e) => onPatchItem(it.id, { qty: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none py-xs" />
                </td>
                <td className="px-lg py-md w-[140px]">
                  <input type="number" min="0" step="0.01" value={it.unit_price}
                    onChange={(e) => setItems((s) => s.map((x) => x.id === it.id ? { ...x, unit_price: e.target.value } : x))}
                    onBlur={(e) => onPatchItem(it.id, { unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none py-xs" />
                </td>
                <td className="px-lg py-md font-label-md text-primary">
                  {((Number(it.qty)||0) * (Number(it.unit_price)||0)).toFixed(2)} {it.currency || proposalCurrency}
                </td>
                <td className="px-lg py-md text-right">
                  <button onClick={() => onRemoveItem(it.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error-container">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
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
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Step 6 — Branding
// ───────────────────────────────────────────────────────────────────────────
function Step6Branding({ branding, setBranding }) {
  const toast = useToast();
  const upd = (k) => (e) => setBranding((s) => ({ ...s, [k]: e.target.value }));
  const aiDraft = (field, label) => () => {
    // Stubbed AI helper — wiring to Emergent LLM is planned for a follow-up.
    toast.info(`AI ${label} draft coming soon — for now, type your own.`);
  };
  return (
    <div className="glass-card rounded-xl p-lg space-y-md" data-testid="step-branding">
      <h3 className="font-headline-sm text-headline-sm text-primary">Agency Branding & Template</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        <div>
          <label className="font-label-md text-label-md text-on-surface block mb-xs">Template Style</label>
          <select value={branding.template_style} onChange={upd('template_style')} data-testid="brand-tpl-style"
            className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md">
            <option value="elegant">Elegant (cream, serif)</option>
            <option value="dark">Dark Premium</option>
            <option value="light">Light & Friendly</option>
          </select>
        </div>
        <div>
          <label className="font-label-md text-label-md text-on-surface block mb-xs">Font Family</label>
          <select value={branding.font_family} onChange={upd('font_family')} data-testid="brand-font"
            className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md"
            style={{ fontFamily: branding.font_family || undefined }}>
            <option value="">— Template default —</option>
            {FONT_CATALOG.map((f) => (
              <option key={f.key} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>
        </div>
        <Field label="Primary Color" type="color" value={branding.primary_color} onChange={upd('primary_color')} testid="brand-color" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <LogoUploader value={branding.logo_url} onChange={(v) => setBranding((s) => ({ ...s, logo_url: v }))} label="Agency Logo" testid="brand-logo-uploader" folder="logos" />
        <LogoUploader value={branding.cover_image_url} onChange={(v) => setBranding((s) => ({ ...s, cover_image_url: v }))} label="Cover Image" testid="brand-cover-uploader" folder="covers" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <Field label="Agency Name" value={branding.agency_name} onChange={upd('agency_name')} testid="brand-name" />
        <Field label="Address"     value={branding.address}     onChange={upd('address')}     testid="brand-address" />
        <Field label="Contact Email" type="email" value={branding.contact_email} onChange={upd('contact_email')} testid="brand-email" />
        <Field label="Contact Phone" value={branding.contact_phone} onChange={upd('contact_phone')} testid="brand-phone" />
        <Field label="Website" value={branding.website} onChange={upd('website')} testid="brand-website" />
        <Field label="Facebook"  value={branding.social_facebook}  onChange={upd('social_facebook')}  testid="brand-fb" />
        <Field label="Instagram" value={branding.social_instagram} onChange={upd('social_instagram')} testid="brand-ig" />
        <Field label="LinkedIn"  value={branding.social_linkedin}  onChange={upd('social_linkedin')}  testid="brand-li" />
      </div>
      <Textarea label="Highlights" value={branding.highlights} onChange={upd('highlights')} testid="brand-highlights" placeholder="Bullet points of the trip's standout moments…" />
      <TextareaWithAI label="What's Included" value={branding.inclusions} onChange={upd('inclusions')} testid="brand-inclusions" onAI={aiDraft('inclusions', 'inclusions')} />
      <TextareaWithAI label="What's Excluded" value={branding.exclusions} onChange={upd('exclusions')} testid="brand-exclusions" onAI={aiDraft('exclusions', 'exclusions')} />
      <TextareaWithAI label="Terms of Payment" value={branding.terms_of_payment} onChange={upd('terms_of_payment')} testid="brand-terms" onAI={aiDraft('terms_of_payment', 'terms')} />
      <p className="font-label-sm text-on-surface-variant">Branding is stored on this proposal and used in the preview & export. Defaults are inherited from your Agency Branding page.</p>
    </div>
  );
}

function TextareaWithAI({ label, value, onChange, testid, onAI }) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="flex items-center justify-between font-label-md text-label-md text-on-surface">
        <span>{label}</span>
        <button type="button" onClick={onAI} data-testid={`${testid}-ai`}
          className="inline-flex items-center gap-xs px-md py-xs bg-primary/10 text-primary rounded-full font-label-sm hover:bg-primary/15">
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          Draft with AI
        </button>
      </span>
      <textarea value={value ?? ''} onChange={onChange} rows={3} data-testid={testid}
        className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

function Textarea({ label, value, onChange, testid, placeholder = '' }) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <textarea value={value ?? ''} onChange={onChange} rows={3} placeholder={placeholder} data-testid={testid}
        className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Step 7 — Preview / Generate
// ───────────────────────────────────────────────────────────────────────────
function Step7Preview({ proposalId, branding }) {
  const toast = useToast();
  const [json, setJson] = useState(null);
  const [include, setInclude] = useState(ALL_SECTIONS);
  const [exportOpen, setExportOpen] = useState(false);
  const [style, setStyle] = useState(branding?.template_style || 'elegant');
  const [generating, setGenerating] = useState(false);

  useEffect(() => { setStyle(branding?.template_style || 'elegant'); }, [branding?.template_style]);

  useEffect(() => {
    (async () => { if (!proposalId) return; try { setJson(await buildProposalExport(proposalId)); } catch (e) { toast.error(e.message); } })();
  }, [proposalId, toast]);

  const buildEnvelope = useCallback(() => {
    if (!json) return null;
    return { ...json, presentation: { style, include }, branding };
  }, [json, style, include, branding]);

  const onDownloadJson = () => {
    const envelope = buildEnvelope(); if (!envelope) return;
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `proposal-${json.proposal?.name || proposalId}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success('Proposal JSON exported');
  };

  const onGeneratePdf = async () => {
    const envelope = buildEnvelope(); if (!envelope) return;
    setGenerating(true);
    try {
      // Relative URL — resolves to same external host (kubernetes ingress
      // routes /api/* to the FastAPI backend which proxies to the Node service).
      const res = await fetch('/api/pdf/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(envelope),
      });
      if (!res.ok) throw new Error(`PDF service responded ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      const safe = String(json.proposal?.name || 'proposal').replace(/[^a-z0-9._-]+/gi, '-');
      a.download = `${safe}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success('PDF generated');
    } catch (e) { toast.error(e.message || 'PDF generation failed'); }
    finally { setGenerating(false); }
  };

  const onPrint = () => {
    // Trigger native print of the preview area only (print CSS targets .a4-paper).
    window.print();
  };

  if (!proposalId) return <div className="glass-card p-xl rounded-xl text-center text-on-surface-variant" data-testid="preview-no-proposal">Save the client step first.</div>;
  if (!json) return <div className="glass-card p-xl rounded-xl text-center">Building preview…</div>;

  // Merge wizard's working branding into the JSON so the preview reflects in-flight edits.
  const merged = { ...json, proposal: { ...json.proposal, preferences: { ...(json.proposal?.preferences || {}), branding: { ...(json.proposal?.preferences?.branding || {}), ...branding } } } };

  return (
    <div className="space-y-md" data-testid="step-preview">
      <div className="glass-card p-md rounded-xl flex items-center gap-md flex-wrap no-print">
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Template</span>
        <select value={style} onChange={(e) => setStyle(e.target.value)} data-testid="preview-style"
          className="px-md py-sm bg-white border border-outline-variant rounded-lg font-body-md">
          <option value="elegant">Elegant (cream, serif)</option>
          <option value="dark">Dark Premium</option>
          <option value="light">Light & Friendly</option>
        </select>
        <span className="font-label-sm text-on-surface-variant flex-1" data-testid="preview-total">{Number(json.totals.subtotal||0).toFixed(2)} {json.totals.currency}</span>
        <button onClick={() => setExportOpen(true)} data-testid="open-export-modal"
          className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">tune</span> Sections
        </button>
        <button onClick={onDownloadJson} data-testid="export-json"
          className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">code</span> Export JSON
        </button>
        <button onClick={onPrint} data-testid="print-preview"
          className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">print</span> Print
        </button>
        <button onClick={onGeneratePdf} disabled={generating} data-testid="generate-pdf"
          className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60 flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          {generating ? 'Generating…' : 'Generate PDF'}
        </button>
      </div>

      <A4Preview data-testid="proposal-preview">
        <TemplateRenderer style={style} data={merged} include={include} />
      </A4Preview>

      {exportOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-surface/30 backdrop-blur-sm no-print"
             data-testid="export-modal" onClick={(e) => e.target === e.currentTarget && setExportOpen(false)}>
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-xl shadow-2xl border border-outline-variant p-lg space-y-md">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-primary">Choose sections to include</h3>
              <button onClick={() => setExportOpen(false)} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-low" data-testid="export-modal-close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <ExportOptionsBar value={include} onChange={setInclude} />
            <div className="flex justify-end gap-md">
              <button onClick={() => setInclude(ALL_SECTIONS)} className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low" data-testid="export-select-all">Select all</button>
              <button onClick={() => setExportOpen(false)} className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90" data-testid="export-apply">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// A4 paper wrapper that gives the preview visible page margins (Google-Docs feel)
// and applies print CSS so users can ⌘P / Ctrl-P directly from the preview.
function A4Preview({ children }) {
  return (
    <div className="a4-host overflow-auto py-lg" data-testid="a4-preview">
      <div className="a4-paper mx-auto shadow-2xl rounded-md overflow-hidden bg-white">
        {children}
      </div>
      <style>{`
        .a4-host { background: linear-gradient(180deg, #e9eef5 0%, #dfe5ee 100%); border-radius: 12px; padding: 32px 0; }
        .a4-paper { width: 210mm; min-height: 297mm; box-shadow: 0 20px 60px rgba(11,28,48,0.18); }
        @media print {
          @page { size: A4; margin: 0; }
          html, body, #root { background: white !important; }
          body * { visibility: hidden; }
          [data-testid="a4-preview"], [data-testid="a4-preview"] * { visibility: visible; }
          [data-testid="a4-preview"] { position: absolute; left: 0; top: 0; padding: 0; background: white; }
          .a4-paper { box-shadow: none !important; width: 210mm; min-height: 297mm; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
