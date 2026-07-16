import React, { useState, useEffect, useRef } from 'react';
import { getAgencyId } from '../../lib/supabaseClient.js';

export default function ContactPicker({ onSelect, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState([]);
  const dropdownRef = useRef(null);

  // Load and merge dynamic contacts from all caches (proposals, invoices, receipts, manual crm contacts)
  const loadContacts = () => {
    try {
      const agencyId = getAgencyId();
      const clientMap = new Map();

      // 1. Manual contacts
      try {
        const stored = localStorage.getItem('voyanta_crm_contacts');
        if (stored) {
          JSON.parse(stored).forEach(c => {
            if (c.email) clientMap.set(c.email.toLowerCase(), c);
          });
        }
      } catch {}

      // 2. Proposals
      try {
        const storedProps = localStorage.getItem('voyanta_proposals_list_cache');
        if (storedProps) {
          JSON.parse(storedProps).forEach(p => {
            if (p.client_name) {
              const email = p.client_email || `${p.client_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@agency.com`;
              const key = email.toLowerCase();
              if (!clientMap.has(key)) {
                clientMap.set(key, {
                  name: p.client_name,
                  email: email,
                  phone: p.client_phone || '',
                  destination: p.destination || ''
                });
              }
            }
          });
        }
      } catch {}

      // 3. Invoices
      try {
        const key = `voyanta_invoices_data_${agencyId}`;
        const storedInvs = localStorage.getItem(key) || localStorage.getItem('voyanta_invoices_data');
        if (storedInvs) {
          JSON.parse(storedInvs).forEach(inv => {
            if (inv.client_name) {
              const email = inv.client_email || `${inv.client_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@agency.com`;
              const key = email.toLowerCase();
              if (!clientMap.has(key)) {
                clientMap.set(key, {
                  name: inv.client_name,
                  email: email,
                  phone: inv.client_phone || '',
                  destination: inv.destination || '',
                  address: inv.branding?.address || ''
                });
              }
            }
          });
        }
      } catch {}

      // 4. Receipts
      try {
        const key = `voyanta_receipts_data_${agencyId}`;
        const storedRecs = localStorage.getItem(key) || localStorage.getItem('voyanta_receipts_data');
        if (storedRecs) {
          JSON.parse(storedRecs).forEach(rec => {
            if (rec.client_name) {
              const email = rec.client_email || `${rec.client_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@agency.com`;
              const key = email.toLowerCase();
              if (!clientMap.has(key)) {
                clientMap.set(key, {
                  name: rec.client_name,
                  email: email,
                  phone: rec.client_phone || '',
                  destination: rec.destination || ''
                });
              }
            }
          });
        }
      } catch {}

      const list = Array.from(clientMap.values());
      setContacts(list);
    } catch (err) {
      console.warn('[ContactPicker] Failed to merge contacts:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.destination && c.destination.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = (c) => {
    onSelect(c);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer no-print"
      >
        <span className="material-symbols-outlined text-[16px]">contacts</span>
        Add from Contacts
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-72 bg-surface border border-outline-variant rounded-xl shadow-xl z-[9999] p-2 flex flex-col max-h-60 overflow-hidden font-sans no-print text-on-surface">
          <div className="flex items-center gap-2 bg-surface-container-low px-2 py-1 rounded-lg border border-outline-variant mb-2">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">search</span>
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-on-surface focus:outline-none placeholder:text-on-surface-variant"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/50 max-h-44 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="text-center py-sm text-xs text-on-surface-variant">No contacts found</div>
            ) : (
              filtered.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className="w-full text-left p-2 hover:bg-surface-container-high transition-colors flex flex-col gap-0.5 border-none bg-transparent cursor-pointer"
                >
                  <div className="font-bold text-xs text-on-surface">{c.name}</div>
                  <div className="text-[10px] text-on-surface-variant truncate">{c.email}</div>
                  {c.destination && (
                    <div className="text-[9px] font-semibold text-primary uppercase tracking-wider mt-0.5">{c.destination}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
