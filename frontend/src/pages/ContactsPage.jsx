import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { logActivity } from '../services/activityLogService.js';

const INITIAL_CONTACTS = [
  { id: '1', name: 'Marcus Thorne', email: 'marcus.t@venturecap.io', phone: '+91 98200 11223', whatsapp: '+91 98200 11223', destination: 'Tokyo, Japan', proposalsCount: 3, status: 'VIP Client', consentRecorded: '2026-06-15' },
  { id: '2', name: 'Eleanor Vance', email: 'eleanor.vance@vancemedia.com', phone: '+91 98110 44556', whatsapp: '+91 98110 44556', destination: 'Swiss Alps', proposalsCount: 2, status: 'Active', consentRecorded: '2026-06-20' },
  { id: '3', name: 'Rajesh & Priya Sharma', email: 'rajesh.sharma@gmail.com', phone: '+91 99001 77889', whatsapp: '+91 99001 77889', destination: 'Kashmir & Srinagar', proposalsCount: 4, status: 'Repeat Client', consentRecorded: '2026-06-28' },
  { id: '4', name: 'Aarav Mehta', email: 'aarav.mehta@techlabs.in', phone: '+91 97112 33445', whatsapp: '+91 97112 33445', destination: 'Maldives', proposalsCount: 1, status: 'Lead', consentRecorded: '2026-07-01' }
];

export default function ContactsPage() {
  const toast = useToast();
  const [contacts, setContacts] = useState(() => {
    try {
      const stored = localStorage.getItem('voyanta_crm_contacts');
      if (stored) return JSON.parse(stored);
    } catch {}
    return INITIAL_CONTACTS;
  });

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', whatsapp: '', destination: '', status: 'Lead'
  });

  useEffect(() => {
    try {
      localStorage.setItem('voyanta_crm_contacts', JSON.stringify(contacts));
    } catch {}
  }, [contacts]);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({ name: '', email: '', phone: '', whatsapp: '', destination: '', status: 'Lead' });
    setShowModal(true);
  };

  const handleEdit = (c) => {
    setEditingId(c.id);
    setFormData({
      name: c.name,
      email: c.email,
      phone: c.phone,
      whatsapp: c.whatsapp,
      destination: c.destination,
      status: c.status
    });
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Name and Email are required.');
      return;
    }

    if (editingId) {
      setContacts(prev => prev.map(c => c.id === editingId ? { ...c, ...formData } : c));
      logActivity('crm', `Updated contact details for ${formData.name}`);
      toast.success(`Updated contact ${formData.name}`);
    } else {
      const newContact = {
        id: Date.now().toString(),
        ...formData,
        proposalsCount: 0,
        consentRecorded: new Date().toISOString().split('T')[0]
      };
      setContacts(prev => [newContact, ...prev]);
      logActivity('crm', `Added new client contact ${formData.name}`);
      toast.success(`Added contact ${formData.name} with consent recorded`);
    }
    setShowModal(false);
  };

  const handleDelete = (id, name) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    logActivity('crm', `Removed contact ${name}`);
    toast.info(`Removed ${name} from address book`);
  };

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.destination.toLowerCase().includes(search.toLowerCase())
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
          className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer border-none transition-all"
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
                <th className="py-3.5 px-4">Status & Consent</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 text-sm">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-surface-container-lowest transition-colors">
                  <td className="py-4 px-6 font-bold text-on-surface">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center text-xs">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold">{c.name}</div>
                        <div className="text-xs text-on-surface-variant">{c.status}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-xs font-medium text-on-surface">{c.email}</div>
                    <div className="text-[11px] text-on-surface-variant">{c.phone}</div>
                  </td>
                  <td className="py-4 px-4 font-medium text-on-surface-variant">{c.destination || '—'}</td>
                  <td className="py-4 px-4 text-center font-bold text-primary">{c.proposalsCount}</td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Consent: {c.consentRecorded}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(c)}
                      className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-lg text-xs font-bold border border-outline-variant cursor-pointer transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error rounded-lg text-xs font-bold border-none cursor-pointer transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
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
                    onChange={e => setFormData({...formData, phone: e.target.value, whatsapp: e.target.value})}
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
