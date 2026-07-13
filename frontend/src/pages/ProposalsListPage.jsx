import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';


import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProposals } from '../hooks/useProposals.js';
import { updateProposal } from '../services/proposalService.js';
import { buildProposalExport } from '../services/proposalItemService.js';
import { incrementAnalytics } from '../services/analyticsService.js';
import { logActivity } from '../services/activityLogService.js';
import { getAgencyId } from '../lib/supabaseClient.js';
import { api } from '../services/api.js';
import SmartContactCaptureModal from '../components/common/SmartContactCaptureModal.jsx';
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
  
  const { proposals, isLoading: loading, error, deleteProposal, deleteAllProposals, duplicateProposal } = useProposals();
  
  const [editing, setEditing] = useState(null);
  const [shareProposal, setShareProposal] = useState(null);
  
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
          onView={(p) => navigate(`/proposals/wizard?id=${encodeURIComponent(p.id)}&step=5`)}
          onEdit={(p) => navigate(`/proposals/wizard?id=${encodeURIComponent(p.id)}&step=1`)}
          onDuplicate={async (p) => {
            try {
              await duplicateProposal(p.id);
              logActivity('proposal', `Duplicated proposal: "${p.name}"`, p.client_name);
              toast.success('Proposal duplicated');
            } catch (e) { toast.error(e.message || 'Failed to duplicate'); }
          }}
          onDelete={async (p) => {
            if (localStorage.getItem('voyanta_current_user_role') === 'Editor') {
              toast.error('Access Denied: Your Editor role cannot delete proposals. Contact an Admin.');
              return;
            }
            if (!window.confirm(`Delete "${p.name}"?`)) return;
            try {
              await deleteProposal(p.id);
              logActivity('proposal', `Deleted proposal: "${p.name}"`, p.client_name);
              toast.success('Proposal deleted');
            } catch (e) { toast.error(e.message || 'Failed to delete'); }
          }}
          onDeleteAll={async () => {
            if (localStorage.getItem('voyanta_current_user_role') === 'Editor') {
              toast.error('Access Denied: Your Editor role cannot delete proposals. Contact an Admin.');
              return;
            }
            if (!window.confirm(`Are you sure you want to delete ALL ${proposals.length} proposals? This action cannot be undone.`)) return;
            try {
              toast.info('Deleting all proposals...');
              await deleteAllProposals();
              logActivity('proposal', 'Deleted all proposals in library');
              toast.success('All proposals deleted successfully');
            } catch (e) { toast.error(e.message || 'Failed to delete all proposals'); }
          }}
          onShare={(p) => {
            logActivity('proposal', `Opened share link options for proposal: "${p.name}"`, p.client_name);
            setShareProposal(p);
          }}
          onExport={async (p) => {
            try {
              toast.info('Generating PDF...');
              const style = p.preferences?.branding?.template_style || 'classic';
              const localStorageDump = {};
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('voyanta_')) {
                  localStorageDump[k] = localStorage.getItem(k);
                }
              }
              const blob = await api.post('/api/pdf/generate', {
                proposal_id: p.id,
                name: p.name || 'proposal',
                style,
                local_storage: localStorageDump
              }, { responseType: 'blob', timeout: 60000 });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url;
              a.download = `${(p.name || 'proposal').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
              document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
              incrementAnalytics('download', p.id);
              logActivity('pdf', `Generated and downloaded PDF for "${p.name}"`, p.client_name);
              toast.success('PDF downloaded successfully');
            } catch (e) { toast.error(e.message || 'PDF download failed'); }
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
            } catch (e) { toast.error(e.message || 'Failed to update'); }
          }}
        />
      )}
      {shareProposal && (
        <ShareModal proposal={shareProposal} onClose={() => setShareProposal(null)} />
      )}
    </div>
  );
}

// Tiny Portal helper for rendering into a non-React node owned by Stitch HTML.
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient.js';
import { settingsService } from '../services/resourceService.js'; 

function Portal({ node, children }) { return createPortal(children, node); }

function ProposalsListPanel({ proposals, loading, error, highlightId, onView, onEdit, onDuplicate, onDelete, onDeleteAll, onShare, onExport }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    setPage(0);
  }, [searchQuery, statusFilter]);

  const filtered = proposals.filter(p => {
    if (statusFilter !== 'ALL' && (p.status || 'Draft').toUpperCase() !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.client_name || p.client || '').toLowerCase().includes(q) || (p.destination || '').toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="flex flex-col h-full" data-testid="proposals-list">
      <div className="px-xl py-lg flex flex-col lg:flex-row justify-between items-start lg:items-center gap-md mb-md">
        <div>
          <h1 className="text-3xl font-extrabold text-primary mb-1">Proposal Library</h1>
          <h2 className="text-base font-semibold text-on-surface-variant m-0">Manage and organize your client proposals in one place.</h2>
        </div>
        <div className="flex flex-wrap items-center gap-md w-full lg:w-auto justify-end">
          <div className="relative flex-1 min-w-[260px] sm:w-80 md:w-96">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search proposals by name, client, or destination..."
              className="pl-10 pr-4 py-2.5 text-sm bg-surface rounded-xl border border-outline-variant text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary w-full shadow-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 text-sm bg-surface rounded-xl border border-outline-variant text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer shadow-sm"
          >
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="APPROVED">Won (Approved)</option>
            <option value="CANCELLED">Lost (Cancelled)</option>
          </select>
          <span className="text-label-sm font-label-sm text-primary uppercase tracking-widest bg-primary-container px-md py-xs rounded-full whitespace-nowrap">
            {loading ? 'Loading…' : `${filtered.length} of ${proposals.length} Proposals`}
          </span>
          {proposals.length > 0 && onDeleteAll && (
            <button
              onClick={onDeleteAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-error/10 hover:bg-error/20 text-error font-label-sm font-bold uppercase tracking-wider rounded-xl border border-error/20 transition-colors cursor-pointer shadow-sm"
              title="Delete all proposals in the library"
            >
              <span className="material-symbols-outlined text-[16px]">delete_forever</span>
              Delete All ({proposals.length})
            </button>
          )}
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

      {!loading && proposals.length > 0 && filtered.length === 0 && (
        <div className="px-xl py-xxl text-center text-on-surface-variant font-body-md">
          No proposals matching your search or filter.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <>
          <div className="px-xl pb-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-lg items-start">
            {paginated.map((p, i) => (
               <ProposalCard 
                 key={p.id} proposal={p} highlightId={highlightId} index={page * pageSize + i}
                 onView={onView} onEdit={onEdit} onDuplicate={onDuplicate} 
                 onDelete={onDelete} onShare={onShare} onExport={onExport} 
               />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="px-xl py-md flex items-center justify-between border-t border-outline-variant bg-surface-container-lowest mt-auto">
              <span className="text-xs font-semibold text-on-surface-variant">
                Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-bold text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span> Prev
                </button>
                <span className="px-3 py-1 text-xs font-extrabold text-primary font-mono">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-bold text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors flex items-center gap-1"
                >
                  Next <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProposalCard({ proposal: p, highlightId, onView, onEdit, onDuplicate, onDelete, onShare, onExport, index }) {
  const isHighlight = highlightId === p.id;
  const toast = useToast();
  
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

        {/* One-click outcome actions if status is not Won/Lost */}
        {(!p.status || !['approved', 'cancelled'].includes(p.status.toLowerCase())) && (
          <div className="flex gap-xs my-sm" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  await updateProposal(p.id, { status: 'Approved' });
                  logActivity('proposal', `Marked proposal "${p.name}" as WON (Approved)`, p.client_name);
                  toast.success('Marked proposal as WON! 🥳');
                  window.dispatchEvent(new CustomEvent('voyanta:proposals-updated'));
                } catch (err) {
                  toast.error('Failed to update status');
                }
              }}
              className="flex-1 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-label-xs font-bold uppercase tracking-wider border border-emerald-200 flex items-center justify-center gap-xs transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Won
            </button>
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  await updateProposal(p.id, { status: 'Cancelled' });
                  logActivity('proposal', `Marked proposal "${p.name}" as LOST (Cancelled)`, p.client_name);
                  toast.success('Marked proposal as LOST');
                  window.dispatchEvent(new CustomEvent('voyanta:proposals-updated'));
                } catch (err) {
                  toast.error('Failed to update status');
                }
              }}
              className="flex-1 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-label-xs font-bold uppercase tracking-wider border border-rose-200 flex items-center justify-center gap-xs transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">cancel</span>
              Lost
            </button>
          </div>
        )}

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
      </div>

      <div className="absolute top-4 right-4 z-30 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-4 group-hover:translate-x-0">
         <div className="flex flex-col gap-1 bg-white/95 backdrop-blur-xl rounded-2xl p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-outline-variant">
           <IconBtn icon="edit"       testid="edit-icon"      onClick={(e) => { e.stopPropagation(); onEdit(p); }} title="Edit in wizard" />
           <IconBtn icon="content_copy" testid="duplicate-icon" onClick={(e) => { e.stopPropagation(); onDuplicate(p); }} title="Duplicate" />
           <IconBtn icon="share"      testid="share-icon"     onClick={(e) => { e.stopPropagation(); onShare(p); }} title="Share" />
           <IconBtn icon="download"   testid="export-icon"    onClick={(e) => { e.stopPropagation(); onExport(p); }} title="Download PDF" />
           <div className="w-full h-px bg-outline-variant my-1" />
           <IconBtn icon="delete"     testid="delete-icon"    onClick={(e) => { e.stopPropagation(); onDelete(p); }} title="Delete" className="text-error hover:bg-error-container hover:text-error" />
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
    case 'approved':
    case 'accepted': return 'bg-emerald-500/90 text-white';
    case 'cancelled':
    case 'declined': return 'bg-rose-500/90 text-white';
    case 'sent':     return 'bg-blue-500/90 text-white';
    case 'draft':    return 'bg-white/20 text-white';
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
              {['Draft', 'Sent', 'Approved', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
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

function ShareModal({ proposal, onClose }) {
  const [copied, setCopied] = useState(false);
  const [smartContact, setSmartContact] = useState(null);

  const webViewUrl = `${window.location.origin}/view/${proposal.share_token || 'demo'}`;
  const previewUrl = `${window.location.origin}/proposals/wizard?id=${encodeURIComponent(proposal.id)}&step=7`;
  const text = `Hi! Here is the travel proposal for ${proposal.name}. View and approve it here: ${webViewUrl}`;
  const clientPhone = proposal.client_phone || proposal.phone || proposal.brief?.phone || '';
  const clientEmail = proposal.client_email || proposal.email || proposal.brief?.email || '';
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[24px] p-xl shadow-2xl w-full max-w-md m-4 relative animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-lg">
          <h3 className="font-headline-sm text-primary">Share Proposal</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container-low flex items-center justify-center">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <p className="font-body-md text-on-surface-variant mb-xl">
          Share <strong>{proposal.name}</strong> with your client using the options below.
        </p>

        <div className="flex flex-col gap-md">
          <button
            onClick={() => {
              navigator.clipboard.writeText(webViewUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-md p-md bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl transition-colors w-full text-left cursor-pointer group"
          >
            <div className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <span className="material-symbols-outlined">{copied ? 'check' : 'link'}</span>
            </div>
            <div>
              <div className="font-label-md font-bold text-on-surface">{copied ? 'Link Copied!' : 'Copy Client Web View Link'}</div>
              <div className="font-label-sm text-on-surface-variant">Copy direct public web view link to send anywhere</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              incrementAnalytics('whatsapp', proposal.id);
              setSmartContact({
                mode: 'whatsapp',
                initialPhone: clientPhone,
                initialEmail: clientEmail,
                clientName: proposal.client_name || proposal.name || 'Client',
                clientId: proposal.client_id || null,
                proposalId: proposal.id,
                proposalObj: proposal,
                shareText: text,
                shareSubject: `Travel Proposal: ${proposal.name}`
              });
            }}
            className="flex items-center gap-md p-md bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-xl transition-colors w-full text-left cursor-pointer group"
          >
            <div className="w-10 h-10 bg-[#25D366] text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </div>
            <div>
              <div className="font-label-md font-bold text-on-surface">WhatsApp Client Portal Link</div>
              <div className="font-label-sm text-on-surface-variant">Send directly to client number</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              incrementAnalytics('email', proposal.id);
              setSmartContact({
                mode: 'email',
                initialPhone: clientPhone,
                initialEmail: clientEmail,
                clientName: proposal.client_name || proposal.name || 'Client',
                clientId: proposal.client_id || null,
                proposalId: proposal.id,
                proposalObj: proposal,
                shareText: text,
                shareSubject: `Travel Proposal: ${proposal.name}`
              });
            }}
            className="flex items-center gap-md p-md bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-colors w-full text-left cursor-pointer group"
          >
            <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <span className="material-symbols-outlined">mail</span>
            </div>
            <div>
              <div className="font-label-md font-bold text-on-surface">Email Client Portal Link</div>
              <div className="font-label-sm text-on-surface-variant">Compose email with public portal link</div>
            </div>
          </button>
          
          <a href={previewUrl} className="flex items-center gap-md p-md bg-surface-container-low hover:bg-surface-container-high border border-outline-variant rounded-xl transition-colors no-underline group">
            <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <span className="material-symbols-outlined">picture_as_pdf</span>
            </div>
            <div>
              <div className="font-label-md font-bold text-on-surface">View & Export PDF</div>
              <div className="font-label-sm text-on-surface-variant">Open preview to generate PDF</div>
            </div>
          </a>
        </div>
      </div>

      {smartContact && (
        <SmartContactCaptureModal
          isOpen={true}
          onClose={() => setSmartContact(null)}
          {...smartContact}
        />
      )}
    </div>
  );
}
