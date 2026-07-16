import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { fetchClients, createClient, updateClient, deleteClient, TRIP_STATUSES } from '../services/crmService.js';
import { fetchInvoices } from '../services/invoiceService.js';
import { useNavigate } from 'react-router-dom';
import { Client360Modal } from '../components/crm/Client360Modal.jsx';
import ContactPicker from '../components/common/ContactPicker.jsx';

const formatCurr = (val, curr = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(Number(val) || 0);

export default function CrmPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [client360, setClient360] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    destination: '',
    status: 'Inquiry',
    notes: ''
  });

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const [res, invs] = await Promise.all([
        fetchClients({ page, pageSize, status: statusFilter === 'ALL' ? null : statusFilter }),
        fetchInvoices().catch(() => [])
      ]);
      const baseClients = res.data || [];
      const clientMap = new Map();
      
      baseClients.forEach(c => {
        const key = (c.name || '').toLowerCase().trim();
        clientMap.set(key, { ...c, invoiced_amount: 0, paid_amount: 0, invoice_count: 0 });
      });

      (invs || []).forEach(inv => {
        if (inv.status === 'Cancelled' || inv.status === 'Refunded') return;
        const key = (inv.client_name || '').toLowerCase().trim();
        if (!key) return;
        const tot = Number(inv.total_amount || 0);
        const pd = inv.status === 'Paid' ? tot : Number(inv.paid_amount || 0);
        
        if (clientMap.has(key)) {
          const ex = clientMap.get(key);
          ex.invoiced_amount += tot;
          ex.paid_amount += pd;
          ex.invoice_count += 1;
          if (!ex.destination && inv.destination) ex.destination = inv.destination;
          clientMap.set(key, ex);
        } else {
          clientMap.set(key, {
            id: `inv_client_${inv.id}`,
            name: inv.client_name,
            email: inv.client_email || '',
            phone: inv.client_phone || '',
            destination: inv.destination || 'Various',
            status: inv.status === 'Paid' ? 'BOOKED' : 'SENT',
            notes: `Auto-linked from Invoice #${inv.invoice_number}`,
            invoiced_amount: tot,
            paid_amount: pd,
            invoice_count: 1,
            created_at: inv.created_at || new Date().toISOString()
          });
        }
      });

      const mergedList = Array.from(clientMap.values());
      setClients(mergedList);
      setTotalCount(mergedList.length);
    } catch (err) {
      toast.error('Failed to load CRM clients');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, toast]);

  useEffect(() => {
    loadClients();
    const handleUpdate = () => loadClients();
    window.addEventListener('voyanta:crm-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('voyanta:crm-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [loadClients]);

  // Client search filtering on current page or re-querying
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.destination && c.destination.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({ name: '', email: '', phone: '', destination: '', status: 'Inquiry', notes: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      destination: client.destination || '',
      status: client.status || 'Inquiry',
      notes: client.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Client name is required');
      return;
    }
    try {
      if (editingClient) {
        await updateClient(editingClient.id, formData);
        toast.success('Client updated successfully');
      } else {
        await createClient(formData);
        toast.success('New client added to CRM');
      }
      setIsModalOpen(false);
      loadClients();
    } catch (err) {
      toast.error('Failed to save client');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    try {
      await deleteClient(id);
      toast.success('Client deleted');
      loadClients();
    } catch (err) {
      toast.error('Failed to delete client');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateClient(id, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      loadClients();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    const found = TRIP_STATUSES.find(s => s.id === status);
    if (!found) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-surface-container text-on-surface-variant">{status}</span>;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${found.color}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
        {found.label}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-16 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-2">
            <span className="material-symbols-outlined text-[16px]">groups</span> Voyanta Concierge CRM
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-primary font-black tracking-tight">
            Client Directory & Pipeline
          </h1>
          <p className="font-body-md text-on-surface-variant text-sm mt-1">
            Track inquiries, manage outgoing travel proposals, and monitor booking conversions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/proposals/wizard')}
            className="px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface font-bold text-xs uppercase tracking-wider hover:border-primary transition-all flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_box</span> New Proposal
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-on-primary font-extrabold text-xs uppercase tracking-wider shadow-lg hover:brightness-110 transition-all flex items-center gap-2 transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span> Add Client
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="glass-card p-4 rounded-2xl border border-outline-variant flex flex-col md:flex-row items-center justify-between gap-4 bg-surface-container-lowest/60">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
          <button
            onClick={() => { setStatusFilter('ALL'); setPage(0); }}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${statusFilter === 'ALL' ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <span>All Clients</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/20">{statusFilter === 'ALL' ? totalCount : ''}</span>
          </button>
          {TRIP_STATUSES.map(s => (
            <button
              key={s.id}
              onClick={() => { setStatusFilter(s.id); setPage(0); }}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${statusFilter === s.id ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input
            type="text"
            placeholder="Search name, email, destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-xs text-on-surface font-medium placeholder:text-on-surface-variant/60"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-on-surface-variant hover:text-primary">
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* CRM Client Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-outline-variant shadow-xl bg-surface-container-lowest/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="py-3.5 px-6 font-label-sm text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">Client Name</th>
                <th className="py-3.5 px-6 font-label-sm text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">Contact Info</th>
                <th className="py-3.5 px-6 font-label-sm text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">Destination</th>
                <th className="py-3.5 px-6 font-label-sm text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">Invoiced & Revenue</th>
                <th className="py-3.5 px-6 font-label-sm text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">Pipeline Status</th>
                <th className="py-3.5 px-6 font-label-sm text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">Notes / Remarks</th>
                <th className="py-3.5 px-6 font-label-sm text-xs font-extrabold uppercase tracking-widest text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
                      <span className="text-sm font-semibold">Loading client directory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-2xl">person_off</span>
                      </div>
                      <p className="text-base font-bold text-on-surface">No clients found</p>
                      <p className="text-xs text-on-surface-variant">No client profiles match your current filter criteria or search query. Click &ldquo;Add Client&rdquo; to create one.</p>
                      <button onClick={handleOpenAdd} className="mt-2 px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs uppercase tracking-wider">
                        + Add First Client
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-surface-container-low/50 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center text-primary font-black text-sm uppercase flex-shrink-0">
                          {(client.name || 'C').charAt(0)}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => setClient360(client)}
                            className="font-bold text-sm text-on-surface hover:text-primary transition-colors text-left flex items-center gap-1.5 m-0 leading-tight group/link"
                          >
                            <span className="group-hover/link:underline">{client.name}</span>
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold flex items-center gap-0.5" title="Open Client 360 & Invoices">
                              ⚡ 360°
                            </span>
                          </button>
                          <span className="text-[10px] font-mono text-on-surface-variant/70 uppercase tracking-wider mt-0.5 block">
                            Added {new Date(client.created_at || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        {client.email ? (
                          <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-xs font-medium text-on-surface hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[15px] text-on-surface-variant">mail</span>
                            {client.email}
                          </a>
                        ) : <span className="text-xs text-on-surface-variant/50 italic">No email</span>}
                        {client.phone && (
                          <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-xs font-mono text-on-surface-variant hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[15px]">call</span>
                            {client.phone}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {client.destination ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-xs font-semibold text-primary border border-outline-variant/50">
                          <span className="material-symbols-outlined text-[14px]">flight_land</span>
                          {client.destination}
                        </span>
                      ) : <span className="text-xs text-on-surface-variant/50 italic">—</span>}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs">
                      {client.invoice_count > 0 ? (
                        <div>
                          <div className="font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurr(client.paid_amount || 0, client.currency || 'INR')} Paid
                          </div>
                          <div className="text-[10px] text-on-surface-variant font-semibold">
                            {formatCurr(client.invoiced_amount || 0, client.currency || 'INR')} Billed ({client.invoice_count} inv)
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-on-surface-variant/40 italic">0 Invoices</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(client.status)}
                        <select
                          value={client.status || 'Inquiry'}
                          onChange={(e) => handleStatusChange(client.id, e.target.value)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-surface-container border border-outline-variant rounded-lg px-1.5 py-1 text-[11px] font-bold text-on-surface cursor-pointer outline-none"
                          title="Change status"
                        >
                          {TRIP_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="py-4 px-6 max-w-xs">
                      <p className="text-xs text-on-surface-variant line-clamp-2 m-0 leading-relaxed font-normal">
                        {client.notes || <span className="italic opacity-50">No notes</span>}
                      </p>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setClient360(client)}
                          className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-on-primary font-bold text-[11px] transition-colors flex items-center gap-1 shadow-xs mr-1"
                          title="View Client 360 & Invoices"
                        >
                          <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                          <span>Invoices</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(client)}
                          className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                          title="Edit Client"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          className="w-8 h-8 rounded-lg hover:bg-error-container/20 flex items-center justify-center text-on-surface-variant hover:text-error transition-colors"
                          title="Delete Client"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {!loading && totalCount > 0 && (
          <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs font-semibold text-on-surface-variant">
              Showing <span className="font-bold text-on-surface">{page * pageSize + 1}</span> to <span className="font-bold text-on-surface">{Math.min((page + 1) * pageSize, totalCount)}</span> of <span className="font-bold text-primary">{totalCount}</span> total clients
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-bold text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span> Prev
              </button>
              <span className="px-3 py-1 text-xs font-extrabold text-primary font-mono">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-bold text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors flex items-center gap-1"
              >
                Next <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal for Add / Edit Client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg rounded-3xl border border-outline-variant shadow-2xl overflow-hidden bg-surface-container-lowest/95 animate-scale-up">
            <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-xl">{editingClient ? 'edit_square' : 'person_add'}</span>
                </div>
                <div>
                  <h3 className="font-display text-lg font-black text-on-surface m-0 leading-tight">
                    {editingClient ? 'Edit Client Profile' : 'Add New Client'}
                  </h3>
                  <p className="text-[11px] font-mono text-on-surface-variant uppercase tracking-widest m-0">
                    Voyanta CRM Directory
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
               <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
                    Client Full Name *
                  </label>
                  <ContactPicker
                    onSelect={(c) => {
                      setFormData({
                        ...formData,
                        name: c.name || '',
                        email: c.email || '',
                        phone: c.phone || '',
                        destination: c.destination || ''
                      });
                    }}
                  />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alistair & Victoria Kensington"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface font-semibold focus:border-primary outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="alistair@kensington.co.uk"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="+44 20 7946 0921"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface font-mono focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Destination Inquiry
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maldives Resort, Amalfi Coast"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Pipeline Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs font-bold text-on-surface focus:border-primary outline-none transition-colors cursor-pointer"
                  >
                    {TRIP_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                  Concierge Remarks & Preferences
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. VIP clients, celebrating 20th anniversary, prefers private over-water villas..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-xs uppercase tracking-wider hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-on-primary font-extrabold text-xs uppercase tracking-wider shadow-lg hover:brightness-110 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  {editingClient ? 'Save Changes' : 'Add to Directory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client 360 Drawer / Modal */}
      {client360 && (
        <Client360Modal
          client={client360}
          onClose={() => setClient360(null)}
        />
      )}
    </div>
  );
}

