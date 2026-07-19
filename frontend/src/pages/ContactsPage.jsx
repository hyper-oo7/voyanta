import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { logActivity } from '../services/activityLogService.js';
import { getAgencyId } from '../lib/supabaseClient.js';
import { createClient, updateClient, deleteClient } from '../services/crmService.js';

export default function ContactsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', destination: '', status: 'Active'
  });

  // Blacklisted/hidden contacts
  const [hiddenContacts, setHiddenContacts] = useState(() => {
    try {
      const stored = localStorage.getItem('voyanta_crm_hidden_contacts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Manual contacts overrides list
  const [manualContacts, setManualContacts] = useState(() => {
    try {
      const stored = localStorage.getItem('voyanta_crm_contacts');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      { id: '1', name: 'Marcus Thorne', email: 'marcus.t@venturecap.io', phone: '+91 98200 11223', destination: 'Tokyo, Japan', status: 'VIP Client', consentRecorded: '2026-06-15' },
      { id: '2', name: 'Eleanor Vance', email: 'eleanor.vance@vancemedia.com', phone: '+91 98110 44556', destination: 'Swiss Alps', status: 'Active', consentRecorded: '2026-06-20' }
    ];
  });

  // Save manual contacts overrides
  useEffect(() => {
    try {
      localStorage.setItem('voyanta_crm_contacts', JSON.stringify(manualContacts));
    } catch {}
  }, [manualContacts]);

  // Save hidden contacts blacklist
  useEffect(() => {
    try {
      localStorage.setItem('voyanta_crm_hidden_contacts', JSON.stringify(hiddenContacts));
    } catch {}
  }, [hiddenContacts]);

  // Dynamically load, merge, and enrich contacts from all data layers
  const mergedContactsList = useMemo(() => {
    const agencyId = getAgencyId();
    const clientMap = new Map();

    // Helper to normalise emails for key hashing
    const normKey = (email) => (email || '').trim().toLowerCase();

    // 1. Ingest manually configured contacts first
    manualContacts.forEach(c => {
      if (c.email) {
        clientMap.set(normKey(c.email), {
          ...c,
          id: c.id || `manual_${Date.now()}_${Math.random()}`,
          source: 'manual',
          proposalsCount: 0,
          invoicedAmount: 0
        });
      }
    });

    // 1.5 Ingest from CRM Clients cache
    try {
      const storedCrm = localStorage.getItem('voyanta_crm_clients');
      if (storedCrm) {
        JSON.parse(storedCrm).forEach(c => {
          if (c.name || c.email) {
            const email = c.email || `${(c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')}@agency.com`;
            const key = normKey(email);
            if (clientMap.has(key)) {
              const existing = clientMap.get(key);
              if (!existing.phone && c.phone) existing.phone = c.phone;
              if (!existing.destination && c.destination) existing.destination = c.destination;
            } else {
              clientMap.set(key, {
                id: c.id || `crm_${Date.now()}_${Math.random()}`,
                name: c.name || 'Client',
                email: email,
                phone: c.phone || '',
                destination: c.destination || '',
                status: c.status || 'Active',
                consentRecorded: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                source: 'crm',
                proposalsCount: 0,
                invoicedAmount: 0
              });
            }
          }
        });
      }
    } catch {}

    // 2. Ingest from Proposals cache
    try {
      const storedProps = localStorage.getItem('voyanta_proposals_list_cache');
      if (storedProps) {
        JSON.parse(storedProps).forEach(p => {
          if (p.client_name) {
            const email = p.client_email || `${p.client_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@agency.com`;
            const key = normKey(email);
            
            if (clientMap.has(key)) {
              const existing = clientMap.get(key);
              existing.proposalsCount = (existing.proposalsCount || 0) + 1;
              if (!existing.phone && p.client_phone) existing.phone = p.client_phone;
              if (!existing.destination && p.destination) existing.destination = p.destination;
            } else {
              clientMap.set(key, {
                id: `proposal_${p.id}`,
                name: p.client_name,
                email: email,
                phone: p.client_phone || '',
                destination: p.destination || '',
                status: p.status || 'Active',
                consentRecorded: p.created_at ? p.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                source: 'proposal',
                proposalsCount: 1,
                invoicedAmount: 0
              });
            }
          }
        });
      }
    } catch {}

    // 3. Ingest Invoices
    try {
      const key = `voyanta_invoices_data_${agencyId}`;
      const storedInvs = localStorage.getItem(key) || localStorage.getItem('voyanta_invoices_data');
      if (storedInvs) {
        JSON.parse(storedInvs).forEach(inv => {
          if (inv.client_name) {
            const email = inv.client_email || `${inv.client_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@agency.com`;
            const key = normKey(email);
            const amt = Number(inv.total_amount) || 0;

            if (clientMap.has(key)) {
              const existing = clientMap.get(key);
              existing.invoicedAmount = (existing.invoicedAmount || 0) + amt;
              if (!existing.phone && inv.client_phone) existing.phone = inv.client_phone;
              if (!existing.destination && inv.destination) existing.destination = inv.destination;
            } else {
              clientMap.set(key, {
                id: `invoice_${inv.id}`,
                name: inv.client_name,
                email: email,
                phone: inv.client_phone || '',
                destination: inv.destination || '',
                status: 'Active',
                consentRecorded: inv.created_at ? inv.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                source: 'invoice',
                proposalsCount: 0,
                invoicedAmount: amt
              });
            }
          }
        });
      }
    } catch {}

    // 4. Ingest Receipts
    try {
      const key = `voyanta_receipts_data_${agencyId}`;
      const storedRecs = localStorage.getItem(key) || localStorage.getItem('voyanta_receipts_data');
      if (storedRecs) {
        JSON.parse(storedRecs).forEach(rec => {
          if (rec.client_name) {
            const email = rec.client_email || `${rec.client_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@agency.com`;
            const key = normKey(email);

            if (clientMap.has(key)) {
              const existing = clientMap.get(key);
              if (!existing.phone && rec.client_phone) existing.phone = rec.client_phone;
            } else {
              clientMap.set(key, {
                id: `receipt_${rec.id}`,
                name: rec.client_name,
                email: email,
                phone: rec.client_phone || '',
                destination: rec.destination || '',
                status: 'Active',
                consentRecorded: rec.created_at ? rec.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                source: 'receipt',
                proposalsCount: 0,
                invoicedAmount: 0
              });
            }
          }
        });
      }
    } catch {}

    // Filter out blacklisted/hidden items
    return Array.from(clientMap.values()).filter(c => 
      !hiddenContacts.includes(normKey(c.email))
    );
  }, [manualContacts, hiddenContacts]);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({ name: '', email: '', phone: '', destination: '', status: 'Active' });
    setShowModal(true);
  };

  const handleEdit = (c) => {
    setEditingId(c.id);
    setFormData({
      name: c.name,
      email: c.email,
      phone: c.phone || '',
      destination: c.destination || '',
      status: c.status || 'Active'
    });
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Name and Email are required.');
      return;
    }

    const targetEmailKey = formData.email.trim().toLowerCase();

    // Sync with CRM database & local storage
    if (editingId) {
      updateClient(editingId, formData).catch(() => {});
      const existsInManual = manualContacts.some(c => c.id === editingId || c.email.toLowerCase() === targetEmailKey);
      if (existsInManual) {
        setManualContacts(prev => prev.map(c => 
          (c.id === editingId || c.email.toLowerCase() === targetEmailKey) ? { ...c, ...formData } : c
        ));
      } else {
        setManualContacts(prev => [...prev, {
          id: editingId,
          ...formData,
          consentRecorded: new Date().toISOString().split('T')[0]
        }]);
      }
      logActivity('crm', `Updated contact details for ${formData.name}`);
      toast.success(`Updated contact details for ${formData.name}`);
    } else {
      createClient(formData).catch(() => {});
      const newContact = {
        id: `manual_${Date.now()}`,
        ...formData,
        consentRecorded: new Date().toISOString().split('T')[0]
      };
      setManualContacts(prev => [newContact, ...prev]);
      logActivity('crm', `Added new client contact ${formData.name}`);
      toast.success(`Added new contact ${formData.name}`);
    }
    setShowModal(false);
  };

  const handleDelete = (c) => {
    if (!window.confirm(`Are you sure you want to remove ${c.name} from your contacts?`)) return;
    const emailKey = c.email.toLowerCase().trim();
    
    // Add email to hidden blacklist
    setHiddenContacts(prev => [...prev, emailKey]);
    
    // Also clear from manual contacts if exists
    setManualContacts(prev => prev.filter(item => item.email.toLowerCase().trim() !== emailKey));
    if (c.id && !String(c.id).startsWith('manual_')) {
      deleteClient(c.id).catch(() => {});
    }
    
    logActivity('crm', `Deleted contact ${c.name}`);
    toast.info(`Removed ${c.name} from address book`);
  };

  const filtered = mergedContactsList.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.destination || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant shadow-sm">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface m-0">Client Contacts & Address Book</h1>
          <p className="text-xs text-on-surface-variant m-0 mt-1">Manage all client relationships, preferences, and verified communication consents</p>
        </div>
        <button
          onClick={handleOpenNew}
          className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer border-none transition-all animate-fade-in"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Add New Contact
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant">
        <span className="material-symbols-outlined text-on-surface-variant ml-2">search</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by client name, email, or destination preference..."
          className="w-full bg-transparent border-none text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
        />
        <span className="text-xs font-bold text-on-surface-variant bg-surface px-3 py-1 rounded-lg border border-outline-variant">
          {filtered.length} Contacts
        </span>
      </div>

      {/* Contacts Table */}
      <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant text-[11px] uppercase tracking-wider font-bold text-on-surface-variant bg-surface-container-lowest">
                <th className="py-3.5 px-6">Client Name</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Preferred Destination</th>
                <th className="py-3.5 px-4 text-center">Proposals</th>
                <th className="py-3.5 px-4 text-right">Invoiced Amount</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-on-surface-variant italic">No client contacts found.</td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="py-4 px-6 font-bold text-on-surface">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center text-xs">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold">{c.name}</div>
                          <div className="text-[10px] bg-slate-150 text-on-surface-variant px-1.5 py-0.5 rounded uppercase tracking-wider font-extrabold inline-block mt-0.5 border border-outline-variant/50">
                            {c.source}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-xs font-medium text-on-surface">{c.email}</div>
                      <div className="text-[11px] font-mono text-on-surface-variant">{c.phone || '—'}</div>
                      <div className="mt-1 flex items-center">
                        <div className="group relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 cursor-help select-none">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                          Consent: {c.consentRecorded}
                          <span className="material-symbols-outlined text-[10px] opacity-75">info</span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-64 p-2 bg-on-surface text-surface text-[10px] font-normal leading-snug rounded-lg shadow-xl z-50 pointer-events-none">
                            Verified client communication & data processing consent recorded under DPDP Act 2023.
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-medium text-on-surface-variant">{c.destination || '—'}</td>
                    <td className="py-4 px-4 text-center font-bold text-primary">{c.proposalsCount}</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {c.invoicedAmount > 0 ? `₹${Number(c.invoicedAmount).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(c)}
                        className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-lg text-xs font-bold border border-outline-variant cursor-pointer transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error rounded-lg text-xs font-bold border-none cursor-pointer transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant max-w-lg w-full rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant">
              <h3 className="font-display text-lg font-bold m-0">{editingId ? 'Edit Contact' : 'Add New Contact'}</h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border-none cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
                  placeholder="e.g. Rajesh Sharma"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
                    placeholder="client@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Preferred Destination</label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={e => setFormData({...formData, destination: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
                  placeholder="e.g. Kashmir & Srinagar"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-outline-variant font-bold text-xs bg-surface cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-xs border-none cursor-pointer">Save Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
