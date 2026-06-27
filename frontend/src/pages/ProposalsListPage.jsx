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
    <div className="flex flex-col h-full" data-testid="proposals-list">
      <div className="px-xl py-lg flex justify-between items-center mb-md">
        <div>
          <h4 className="font-headline-md text-primary mb-xs">Proposal Library</h4>
          <p className="text-on-surface-variant font-body-md">Manage and organize your client proposals in one place.</p>
        </div>
        <div className="flex items-center gap-md">
          <span className="text-label-sm font-label-sm text-primary uppercase tracking-widest bg-primary-container px-md py-xs rounded-full">
            {loading ? 'Loading…' : `${proposals.length} Active Proposals`}
          </span>
        </div>
      </div>
      
      {error && (
        <div className="mx-xl mb-lg px-lg py-md bg-error-container text-on-error-container font-label-md rounded-xl" data-testid="proposals-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="px-xl py-xl text-center text-on-surface-variant font-body-md flex items-center justify-center gap-sm" data-testid="proposals-loading">
          <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          Loading proposals…
        </div>
      )}

      {!loading && proposals.length === 0 && (
        <div className="px-xl py-xl text-center flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-3xl mx-xl p-2xl bg-surface-container-lowest/50 backdrop-blur-sm">
          <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-lg shadow-sm">
            <span className="material-symbols-outlined text-[40px] text-primary">description</span>
          </div>
          <h3 className="text-headline-sm text-on-surface mb-xs">No proposals yet</h3>
          <p className="text-on-surface-variant font-body-lg mb-xl max-w-md">Create your first stunning client proposal using our intuitive wizard.</p>
          <button onClick={() => window.location.href = '/proposals/wizard?step=1'} className="px-xl py-md bg-primary text-white rounded-xl font-label-md hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg flex items-center gap-sm">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create New Proposal
          </button>
        </div>
      )}

      {!loading && proposals.length > 0 && (
        <div className="px-xl pb-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-lg items-start">
          {proposals.map((p, i) => (
             <ProposalCard 
               key={p.id} proposal={p} highlightId={highlightId} index={i}
               onView={onView} onEdit={onEdit} onDuplicate={onDuplicate} 
               onDelete={onDelete} onArchive={onArchive} onExport={onExport} 
             />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCard({ proposal: p, highlightId, onView, onEdit, onDuplicate, onDelete, onArchive, onExport, index }) {
  const isHighlight = highlightId === p.id;
  
  const fallbackImages = [
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&q=80&w=800', 
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800', 
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=80&w=800', 
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80&w=800', 
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=800'  
  ];
  const finalCover = p.preferences?.branding?.cover_image_url || fallbackImages[index % fallbackImages.length];

  const tags = [];
  if (p.budget_max > 5000) tags.push('LUXURY');
  if (p.travelers > 4) tags.push('GROUP');
  if (p.destination?.toLowerCase().match(/mountain|hike|trek|safari|camp/)) tags.push('ADVENTURE');
  if (tags.length === 0) tags.push('LEISURE');

  const avatars = [
    `https://i.pravatar.cc/150?u=${p.id}-1`,
    `https://i.pravatar.cc/150?u=${p.id}-2`
  ];

  return (
    <div 
      className={`group relative flex flex-col bg-surface rounded-[24px] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] transition-all duration-400 border-2 ${isHighlight ? 'border-primary ring-4 ring-primary/20' : 'border-outline-variant hover:border-primary/40'} cursor-pointer hover:-translate-y-2`}
      onClick={() => onView(p)}
    >
      <div className="relative h-56 w-full overflow-hidden bg-surface-container-low">
        <img src={finalCover} alt={p.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
        
        <div className="absolute top-4 right-4">
           <span className={chipClass(p.status) + ' px-3 py-1.5 text-[11px] font-bold rounded-full uppercase tracking-widest backdrop-blur-md shadow-sm border border-white/20'}>
             {p.status || 'Draft'}
           </span>
        </div>

        <div className="absolute top-4 left-4 flex gap-xs flex-wrap max-w-[70%]">
          {tags.map(t => (
            <span key={t} className="px-2.5 py-1 bg-black/40 backdrop-blur-md text-white text-[10px] font-bold rounded-md uppercase tracking-widest border border-white/20">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="p-xl flex flex-col flex-1 bg-white relative z-10 -mt-4 rounded-t-[24px]">
        <div className="mb-lg">
          <h3 className="font-headline-sm text-on-surface line-clamp-2 mb-2 group-hover:text-primary transition-colors leading-tight">{p.name}</h3>
          <p className="text-body-md text-on-surface-variant flex flex-col gap-1">
            <span className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">person</span> {p.client_name || 'No Client'}
            </span>
            {p.destination && (
              <span className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">location_on</span> {p.destination}
              </span>
            )}
          </p>
        </div>

        <div className="flex-1" />

        <div className="flex items-center justify-between pt-md border-t border-outline-variant mt-sm">
          <div className="flex -space-x-2">
            {avatars.map((url, i) => (
              <img key={i} src={url} alt="collaborator" className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-sm relative z-10 hover:z-20 transition-transform hover:scale-110" />
            ))}
            <div className="w-8 h-8 rounded-full border-2 border-white bg-surface-container-highest flex items-center justify-center shadow-sm relative z-0">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">add</span>
            </div>
          </div>
          
          <div className="text-label-sm text-on-surface-variant flex items-center gap-xs bg-surface-container-lowest px-2 py-1 rounded-md">
            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
            {p.date ? new Date(p.date).toLocaleDateString() : 'Just now'}
          </div>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-4 group-hover:translate-x-0">
           <div className="flex flex-col gap-1 bg-white/95 backdrop-blur-xl rounded-2xl p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-outline-variant">
             <IconBtn icon="edit"       testid="edit-icon"      onClick={(e) => { e.stopPropagation(); onEdit(p); }} title="Edit in wizard" />
             <IconBtn icon="content_copy" testid="duplicate-icon" onClick={(e) => { e.stopPropagation(); onDuplicate(p); }} title="Duplicate" />
             <IconBtn icon="download"   testid="export-icon"    onClick={(e) => { e.stopPropagation(); onExport(p); }} title="Export JSON" />
             <IconBtn icon="archive"    testid="archive-icon"   onClick={(e) => { e.stopPropagation(); onArchive(p); }} title="Archive" />
             <div className="w-full h-px bg-outline-variant my-1" />
             <IconBtn icon="delete"     testid="delete-icon"    onClick={(e) => { e.stopPropagation(); onDelete(p); }} title="Delete" className="text-error hover:bg-error-container hover:text-error" />
           </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ icon, onClick, title, testid, className = '' }) {
  return (
    <button onClick={onClick} title={title} data-testid={testid}
      className={'w-9 h-9 inline-flex items-center justify-center rounded-xl hover:bg-surface-container-high text-on-surface transition-colors ' + className}>
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
  );
}

function chipClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'accepted': return 'bg-emerald-500/90 text-white';
    case 'sent':     return 'bg-blue-500/90 text-white';
    case 'draft':    return 'bg-white/20 text-white';
    case 'declined': return 'bg-error/90 text-white';
    default:         return 'bg-white/20 text-white';
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
