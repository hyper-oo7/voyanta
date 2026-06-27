import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';


import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchProposals,
  deleteProposal,
  duplicateProposal,
  updateProposal,
  archiveProposal
} from '../services/proposalService.js';
import { buildProposalExport } from '../services/proposalItemService.js';
// Reuse the dashboard's Stitch HTML chrome (sidebar + topbar + table styling)
// so the new Proposals list page matches the existing design language without
// touching any styles.


// Renders inside the dashboard shell. After the Stitch HTML mounts we strip
// everything from the canvas area and inject our own Proposals table.
export default function ProposalsListPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const { signOut, isDemo, user } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // proposal being edited inline

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setProposals(await fetchProposals()); }
    catch (e) { setError(e.message || 'Failed to load proposals'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const [mountNode, setMountNode] = useState(null);

  // After dashboard HTML mounts, mutate the page chrome:
  // 1) Replace the welcome header with "Proposals"
  // 2) Replace the "Create New Proposal" button to navigate to /proposals/brief
  // 3) Hide the dashboard's stat/bento/footer sections; render our own list region
  useEffect(() => {
    const canvas = document.querySelector('main .max-w-7xl'); if (!canvas) return;

    document.querySelectorAll('aside a').forEach((a) => {
      const lab = a.querySelector('.font-label-md'); if (!lab) return;
      const t = lab.textContent.trim();
      a.className = (t === 'Proposals')
        ? 'flex items-center gap-md bg-surface-container-high text-primary font-semibold border-l-4 border-primary rounded-r-lg py-md px-lg transition-transform scale-[0.98]'
        : 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
    });

    const h2 = canvas.querySelector('h2'); if (h2) h2.textContent = 'Proposals';
    const p = h2?.parentElement?.querySelector('p'); if (p) p.textContent = 'View and manage your client proposals.';

    const cta = canvas.querySelector('button.bg-primary');
    if (cta) {
      cta.style.display = 'inline-flex';
      cta.innerHTML = '<span class="material-symbols-outlined text-[20px]">add</span> New Proposal';
      cta.onclick = () => navigate('/proposals/wizard?step=1');
    }

    canvas.querySelectorAll(':scope > div.grid, :scope > .bento-grid').forEach((n) => n.remove());
    let mount = canvas.querySelector('#proposals-list-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'proposals-list-mount';
      canvas.appendChild(mount);
    }
    setMountNode(mount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposals]);

  useEffect(() => {
    const card = document.querySelector('aside .px-lg.pt-xl div.flex.items-center.gap-md'); if (!card) return;
    card.style.cursor = 'pointer';
    const onClick = async () => { await signOut(); navigate('/login'); };
    card.addEventListener('click', onClick);
    const name = card.querySelector('p.font-label-md');
    const role = card.querySelector('p.font-label-sm');
    if (name) name.textContent = user?.user_metadata?.full_name || (isDemo ? 'Demo User' : 'Voyanta Agent');
    if (role) role.textContent = isDemo ? 'Demo Session' : (user?.email || 'Premium Agent');
    return () => card.removeEventListener('click', onClick);
  }, [signOut, navigate, toast, user, isDemo]);

  // Render the list overlay into the mount node
  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      {mountNode && <Portal node={mountNode}>
        <ProposalsListPanel
          proposals={proposals}
          loading={loading}
          error={error}
          highlightId={params.get('highlight')}
          onView={(p) => navigate(`/proposals/wizard?id=${encodeURIComponent(p.id)}&step=7`)}
          onEdit={(p) => navigate(`/proposals/wizard?id=${encodeURIComponent(p.id)}&step=1`)}
          onDuplicate={async (p) => {
            try { await duplicateProposal(p.id); toast.success('Proposal duplicated'); reload(); }
            catch (e) { toast.error(e.message || 'Failed to duplicate'); }
          }}
          onDelete={async (p) => {
            if (!window.confirm(`Delete "${p.name}"?`)) return;
            try { await deleteProposal(p.id); toast.success('Proposal deleted'); reload(); }
            catch (e) { toast.error(e.message || 'Failed to delete'); }
          }}
          onArchive={async (p) => {
            try { await archiveProposal(p.id); toast.success('Proposal archived'); reload(); }
            catch (e) { toast.error(e.message || 'Failed to archive'); }
          }}
          onExport={async (p) => {
            try {
              const json = await buildProposalExport(p.id);
              const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url;
              a.download = `proposal-${p.name || p.id}.json`;
              document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
              toast.success('Proposal Exported');
            } catch (e) { toast.error(e.message || 'Export failed'); }
          }}
        />
      </Portal>}
      {editing && (
        <ProposalDrawer
          proposal={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            try {
              await updateProposal(editing.id, patch);
              toast.success('Proposal updated');
              setEditing(null);
              reload();
            } catch (e) { toast.error(e.message || 'Failed to update'); }
          }}
        />
      )}
    </div>
  );
}

// Tiny Portal helper for rendering into a non-React node owned by Stitch HTML.
import { createPortal } from 'react-dom';
function Portal({ node, children }) { return createPortal(children, node); }

function ProposalsListPanel({ proposals, loading, error, highlightId, onView, onEdit, onDuplicate, onDelete, onArchive, onExport }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col" data-testid="proposals-list">
      <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center">
        <h4 className="font-headline-sm text-headline-sm text-primary">All Proposals</h4>
        <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest" data-testid="proposals-count">
          {loading ? 'Loading…' : `${proposals.length} total`}
        </span>
      </div>
      {error && (
        <div className="px-lg py-md bg-error-container text-on-error-container font-label-md text-label-md" data-testid="proposals-error">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-surface-container">
              <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Proposal Name</th>
              <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Client</th>
              <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Status</th>
              <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Date</th>
              <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {loading && (
              <tr><td colSpan={5} className="px-lg py-xl text-center text-on-surface-variant font-body-md" data-testid="proposals-loading">Loading proposals…</td></tr>
            )}
            {!loading && proposals.length === 0 && (
              <tr><td colSpan={5} className="px-lg py-xl text-center text-on-surface-variant font-body-md" data-testid="proposals-empty">
                No proposals yet. Create one from the Client Brief Form.
              </td></tr>
            )}
            {proposals.map((p) => (
              <tr key={p.id} data-testid={`proposal-row-${p.id}`} className={'hover:bg-surface-container-low transition-colors cursor-pointer ' + (highlightId === p.id ? 'bg-primary-fixed/30' : '')} onClick={() => onView(p)}>
                <td className="px-lg py-md">
                  <button onClick={(e) => { e.stopPropagation(); onView(p); }} data-testid="view-btn" className="font-label-md text-label-md text-primary hover:underline text-left">{p.name}</button>
                </td>
                <td className="px-lg py-md font-body-md text-body-md text-on-surface">{p.client_name || '—'}</td>
                <td className="px-lg py-md">
                  <span className={chipClass(p.status) + ' px-md py-xs text-[11px] font-bold rounded-full uppercase tracking-widest'}>{p.status || 'Draft'}</span>
                </td>
                <td className="px-lg py-md font-body-md text-body-md text-on-surface-variant">{p.date || '—'}</td>
                <td className="px-lg py-md" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-xs">
                    <IconBtn icon="visibility" testid="view-icon"      onClick={() => onView(p)} title="Open" />
                    <IconBtn icon="edit"       testid="edit-icon"      onClick={() => onEdit(p)} title="Edit in wizard" />
                    <IconBtn icon="content_copy" testid="duplicate-icon" onClick={() => onDuplicate(p)} title="Duplicate" />
                    <IconBtn icon="download"   testid="export-icon"    onClick={() => onExport(p)} title="Export JSON" />
                    <IconBtn icon="archive"    testid="archive-icon"   onClick={() => onArchive(p)} title="Archive" />
                    <IconBtn icon="delete"     testid="delete-icon"    onClick={() => onDelete(p)} title="Delete" className="hover:text-error" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IconBtn({ icon, onClick, title, testid, className = '' }) {
  return (
    <button onClick={onClick} title={title} data-testid={testid}
      className={'w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors ' + className}>
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}

function chipClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'accepted': return 'bg-surface-container-highest text-primary';
    case 'sent':     return 'bg-primary-container text-on-primary-container';
    case 'draft':    return 'bg-surface-variant text-on-surface-variant';
    case 'declined': return 'bg-error-container text-on-error-container';
    default:         return 'bg-surface-container text-on-surface-variant';
  }
}

function ProposalDrawer({ proposal, onClose, onSave }) {
  const isView = proposal.mode === 'view';
  const [form, setForm] = useState({
    name: proposal.name || '',
    client_name: proposal.client_name || '',
    destination: proposal.destination || '',
    status: proposal.status || 'Draft',
    travelers: proposal.travelers ?? 1,
    total_cost: proposal.total_cost ?? '',
  });
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[80] flex" data-testid="proposal-drawer">
      <div className="flex-1 bg-on-surface/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-[480px] bg-surface-container-lowest h-full overflow-y-auto border-l border-outline-variant shadow-2xl p-xl">
        <div className="flex items-center justify-between mb-lg">
          <h3 className="font-headline-sm text-headline-sm text-primary">{isView ? 'Proposal Details' : 'Edit Proposal'}</h3>
          <button onClick={onClose} data-testid="drawer-close" className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-md">
          <Field label="Name"        value={form.name}        readOnly={isView} onChange={upd('name')} testid="field-name" />
          <Field label="Client"      value={form.client_name} readOnly={isView} onChange={upd('client_name')} testid="field-client" />
          <Field label="Destination" value={form.destination} readOnly={isView} onChange={upd('destination')} testid="field-destination" />
          <div>
            <label className="font-label-md text-label-md text-on-surface block mb-xs">Status</label>
            <select disabled={isView} value={form.status} onChange={upd('status')} data-testid="field-status"
              className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md text-body-md disabled:opacity-70">
              {['Draft', 'Sent', 'Accepted', 'Declined'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <Field label="Travelers" type="number" value={form.travelers} readOnly={isView} onChange={upd('travelers')} testid="field-travelers" />
          <Field label="Total Cost" type="number" value={form.total_cost} readOnly={isView} onChange={upd('total_cost')} testid="field-total-cost" />
        </div>
        {!isView && (
          <div className="flex gap-md mt-xl">
            <button onClick={onClose} data-testid="drawer-cancel" className="flex-1 py-md border border-outline-variant rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-colors">Cancel</button>
            <button onClick={() => onSave({
              name: form.name,
              client_name: form.client_name,
              destination: form.destination,
              status: form.status,
              travelers: parseInt(form.travelers, 10) || 1,
              total_cost: form.total_cost === '' ? null : Number(form.total_cost),
            })} data-testid="drawer-save"
              className="flex-1 py-md bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-md hover:opacity-90">
              Save Changes
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({ label, value, onChange, readOnly, type = 'text', testid }) {
  return (
    <div>
      <label className="font-label-md text-label-md text-on-surface block mb-xs">{label}</label>
      <input type={type} value={value} onChange={onChange} readOnly={readOnly} data-testid={testid}
        className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md text-body-md input-focus-ring read-only:opacity-70" />
    </div>
  );
}
