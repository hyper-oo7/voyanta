import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StitchPage from './StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useProposalBuilder } from '../context/ProposalBuilderContext.jsx';
import DynamicTable from './DynamicTable.jsx';
import ImportModal from './ImportModal.jsx';
import EditItemDrawer from './EditItemDrawer.jsx';
import { addItem } from '../services/proposalItemService.js';
import { VoyantaDashboard_bodyClass, VoyantaDashboard_extraStyles, VoyantaDashboard_html } from '../pages/_html/voyanta_dashboard.js';

// Unified shell for resource modules (Hotels / Flights / Activities / Templates):
//   - Reuses dashboard's Stitch chrome (sidebar + topbar + canvas)
//   - Strips dashboard sample content from the canvas
//   - Injects: optional toolbar (e.g. flights search form), DynamicTable, Import button
//   - "Add to Proposal" bulk action when a proposal is active
//
// Concrete pages (HotelLibraryPage, FlightsPage, AssetsLibraryPage, TemplatesPage)
// just configure resource + service + sidebarLabel + (optional) toolbar.

export default function ResourceModulePage({
  resource, service, title, subtitle, sidebarLabel,
  itemKind = 'custom', toLabel = (r) => r.name || r.airline || 'Item', toUnitPrice = (r) => Number(r.price ?? r.price_per_night ?? r.cost ?? 0),
  filterRows, renderToolbar,
}) {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { signOut, isDemo, user } = useAuth();
  const { activeId } = useProposalBuilder() || {};
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selection, setSelection] = useState(new Set());
  const [adding, setAdding] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await service.list()); }
    catch (e) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [service, toast]);

  useEffect(() => { reload(); }, [reload]);

  // Mutate the dashboard chrome once the Stitch HTML mounts
  useEffect(() => {
    const root = wrapperRef.current; if (!root) return;
    const canvas = root.querySelector('main .max-w-7xl');
    if (!canvas) return;

    // Sidebar active highlight
    root.querySelectorAll('aside a').forEach((a) => {
      const lab = a.querySelector('.font-label-md'); if (!lab) return;
      const t = lab.textContent.trim();
      a.className = (t === sidebarLabel)
        ? 'flex items-center gap-md bg-surface-container-high text-primary font-semibold border-l-4 border-primary rounded-r-lg py-md px-lg transition-transform scale-[0.98]'
        : 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
    });

    // Title
    const h2 = canvas.querySelector('h2'); if (h2) h2.textContent = title;
    const p  = h2?.parentElement?.querySelector('p'); if (p) p.textContent = subtitle || '';

    // Replace primary CTA → opens Import modal
    const cta = canvas.querySelector('button.bg-primary');
    if (cta) {
      cta.innerHTML = '<span class="material-symbols-outlined">upload</span> Import';
      cta.onclick = () => setImportOpen(true);
    }

    // Wipe sample stat-grid + bento blocks; create a single mount node
    canvas.querySelectorAll(':scope > div.grid, :scope > .bento-grid').forEach((n) => n.remove());
    let mount = canvas.querySelector('#resource-mount');
    if (!mount) { mount = document.createElement('div'); mount.id = 'resource-mount'; canvas.appendChild(mount); }
  }, [title, subtitle, sidebarLabel]);

  // User card label + sign-out
  useEffect(() => {
    const root = wrapperRef.current; if (!root) return;
    const card = root.querySelector('aside .px-lg.pt-xl div.flex.items-center.gap-md'); if (!card) return;
    card.style.cursor = 'pointer';
    const onClick = async () => { await signOut(); navigate('/login'); };
    card.addEventListener('click', onClick);
    const name = card.querySelector('p.font-label-md');
    const role = card.querySelector('p.font-label-sm');
    if (name) name.textContent = user?.user_metadata?.full_name || (isDemo ? 'Demo User' : (user?.email || 'Voyanta Agent'));
    if (role) role.textContent = isDemo ? 'Demo Session' : (user?.email || 'Premium Agent');
    return () => card.removeEventListener('click', onClick);
  }, [signOut, navigate, isDemo, user]);

  const onAddToProposal = async () => {
    if (!activeId) { toast.error('Open a proposal first (Dashboard → Create New Proposal)'); return; }
    if (!selection.size) return;
    setAdding(true);
    try {
      const picked = rows.filter((r) => selection.has(r.id));
      for (const r of picked) {
        await addItem(activeId, {
          kind: itemKind, ref_id: r.id, label: toLabel(r),
          qty: 1, unit_price: toUnitPrice(r), currency: r.currency || 'USD',
          meta: { source: resource },
        });
      }
      toast.success(`Added ${picked.length} ${resource} to proposal`);
      setSelection(new Set());
    } catch (e) { toast.error(e.message || 'Failed to add'); }
    finally { setAdding(false); }
  };

  const mount = wrapperRef.current?.querySelector('#resource-mount');
  const visibleRows = filterRows ? filterRows(rows) : rows;

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <StitchPage
        styleId={`stitch-style-${resource}`}
        bodyClass={VoyantaDashboard_bodyClass}
        extraStyles={VoyantaDashboard_extraStyles}
        html={VoyantaDashboard_html}
        navMap={navMap}
      />
      {mount && createPortal(
        <div className="space-y-md" data-testid={`resource-${resource}`}>
          {renderToolbar?.()}
          {activeId && selection.size > 0 && (
            <div className="flex items-center gap-md p-md bg-primary-container text-on-primary-container rounded-lg" data-testid="bulk-bar">
              <span className="font-label-md">{selection.size} selected</span>
              <button onClick={onAddToProposal} disabled={adding} data-testid="add-to-proposal-btn"
                className="px-lg py-sm bg-primary text-on-primary rounded-lg font-label-md ml-auto hover:opacity-90 disabled:opacity-60">
                {adding ? 'Adding…' : 'Add to Active Proposal'}
              </button>
            </div>
          )}
          <DynamicTable
            rows={visibleRows} loading={loading}
            selection={selection} onSelectionChange={setSelection}
            emptyMessage={`No ${resource} yet — click Import to upload a supplier file.`}
            onEditRow={(r) => setEditing(r)}
            onRowAction={(r) => (
              <button data-testid={`del-${r.id}`} title="Delete"
                onClick={async () => {
                  if (!confirm(`Delete this ${resource.slice(0,-1)}?`)) return;
                  try { await service.remove(r.id); toast.success('Deleted'); reload(); }
                  catch (e) { toast.error(e.message); }
                }}
                className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error-container hover:text-on-error-container">
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            )}
          />
        </div>,
        mount
      )}
      {importOpen && (
        <ImportModal resource={resource} onClose={() => setImportOpen(false)} onImported={reload} />
      )}
      {editing && (
        <EditItemDrawer record={editing} resource={resource} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} service={service} />
      )}
    </div>
  );
}
