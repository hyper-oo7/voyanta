import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { fetchInvoices, createInvoice, deleteInvoice, INVOICE_STATUSES } from '../services/invoiceService.js';
import { fetchClients, updateClient, TRIP_STATUSES } from '../services/crmService.js';
import { getAgencyId } from '../lib/supabaseClient.js';
import { settingsService } from '../services/resourceService.js';
import { InvoicePreviewModal } from '../components/invoices/InvoicePreviewModal.jsx';
import { ReceiptPreviewModal } from '../components/invoices/ReceiptPreviewModal.jsx';
import { InvoiceShareModal } from '../components/invoices/InvoiceShareModal.jsx';
import { formatCurrency } from '../components/invoices/UpiQrGenerator.jsx';
import ReminderCenterModal from '../components/invoices/ReminderCenterModal.jsx';
import SmartContactCaptureModal from '../components/common/SmartContactCaptureModal.jsx';

export default function InvoicesPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [shareInvoice, setShareInvoice] = useState(null);
  const [showReminders, setShowReminders] = useState(false);
  const [smartContactProps, setSmartContactProps] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invs, stg, cList] = await Promise.all([
        fetchInvoices().catch(() => []),
        settingsService.get().catch(() => ({})),
        fetchClients({ pageSize: 1000 }).catch(() => ({ data: [] }))
      ]);
      const clients = cList.data || [];
      const enriched = (invs || []).map(inv => {
        const matchingClient = clients.find(c =>
          (c.name && inv.client_name && c.name.trim().toLowerCase() === inv.client_name.trim().toLowerCase()) ||
          (c.email && inv.client_email && c.email.trim().toLowerCase() === inv.client_email.trim().toLowerCase()) ||
          (c.id && (String(c.id) === `inv_client_${inv.id}` || `crm_${c.id}` === String(inv.id)))
        );
        return {
          ...inv,
          crm_status: matchingClient?.status || inv.crm_status || (inv.status === 'Paid' ? 'Booked' : 'Proposal Sent')
        };
      });

      // Auto-include CRM clients who have 'Approved', 'Booked', or 'Proposal Sent' status if not in invoices
      clients.forEach(c => {
        if (['Approved', 'Booked', 'Proposal Sent'].includes(c.status)) {
          const hasInv = enriched.some(inv =>
            (inv.client_name && c.name && inv.client_name.trim().toLowerCase() === c.name.trim().toLowerCase()) ||
            (inv.client_email && c.email && inv.client_email.trim().toLowerCase() === c.email.trim().toLowerCase()) ||
            String(inv.id) === `crm_${c.id}` || String(inv.id) === `inv_client_${c.id}`
          );
          if (!hasInv) {
            enriched.push({
              id: `crm_${c.id}`,
              invoice_number: `INV-${1000 + (Math.abs(String(c.id).split('').reduce((a,b)=>a+b.charCodeAt(0),0)) % 9000)}`,
              client_name: c.name || 'Client',
              client_email: c.email || '',
              client_phone: c.phone || '',
              destination: c.destination || '',
              total_amount: Number(c.budget || c.total_amount || 0),
              paid_amount: c.status === 'Booked' ? Number(c.budget || c.total_amount || 0) : 0,
              remaining_balance: c.status === 'Booked' ? 0 : Number(c.budget || c.total_amount || 0),
              status: c.status === 'Booked' ? 'Paid' : (c.status === 'Approved' ? 'Sent' : 'Draft'),
              crm_status: c.status,
              created_at: c.updated_at || c.created_at || new Date().toISOString(),
              taxes: [{ id: 'tax-1', name: 'GST / Tax', rate: 5, amount: Math.round(Number(c.budget || 0) * 0.05) }],
              is_auto_linked: true
            });
          }
        }
      });

      setInvoices(enriched);
      setSettings(stg || {});
    } catch (err) {
      toast.error('Failed to load invoices directory');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
    window.addEventListener('voyanta:crm-updated', loadData);
    window.addEventListener('voyanta:invoices-updated', loadData);
    return () => {
      window.removeEventListener('voyanta:crm-updated', loadData);
      window.removeEventListener('voyanta:invoices-updated', loadData);
    };
  }, [loadData]);

  useEffect(() => {
    if (invoices.length > 0 && !activeInvoice && !receiptInvoice && !shareInvoice) {
      const params = new URLSearchParams(window.location.search);
      const viewId = params.get('view');
      if (viewId) {
        const target = invoices.find(i => String(i.id) === String(viewId) || String(i.invoice_number) === String(viewId));
        if (target) {
          setActiveInvoice(target);
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [invoices, activeInvoice, receiptInvoice, shareInvoice]);

  const [remindersTick, setRemindersTick] = useState(0);
  useEffect(() => {
    const handleUpd = () => setRemindersTick(t => t + 1);
    window.addEventListener('voyanta:reminders-updated', handleUpd);
    window.addEventListener('storage', handleUpd);
    return () => {
      window.removeEventListener('voyanta:reminders-updated', handleUpd);
      window.removeEventListener('storage', handleUpd);
    };
  }, []);

  // Financial KPIs
  const totalBilled = useMemo(() => invoices.reduce((acc, i) => {
    if (i.status === 'Cancelled' || i.status === 'Refunded') return acc;
    return acc + (Number(i.total_amount) || 0);
  }, 0), [invoices]);

  const totalCollected = useMemo(() => invoices.reduce((acc, i) => {
    if (i.status === 'Cancelled' || i.status === 'Refunded') return acc;
    const paid = i.status === 'Paid' ? (Number(i.total_amount) || Number(i.paid_amount) || 0) : (Number(i.paid_amount) || 0);
    return acc + paid;
  }, 0), [invoices]);

  const totalOutstanding = useMemo(() => invoices.reduce((acc, i) => {
    if (i.status === 'Cancelled' || i.status === 'Refunded' || i.status === 'Paid') return acc;
    const rem = Number(i.remaining_balance !== undefined ? i.remaining_balance : (Number(i.total_amount || 0) - Number(i.paid_amount || 0)));
    return acc + Math.max(0, rem);
  }, 0), [invoices]);

  const activeRemindersCount = useMemo(() => {
    let checkedMap = {};
    try {
      checkedMap = JSON.parse(localStorage.getItem('voyanta_checked_reminders') || '{}');
    } catch {}
    return invoices.filter(i => {
      if (checkedMap[i.id]) return false;
      if (i.status === 'Paid' || i.status === 'Cancelled' || i.status === 'Refunded') return false;
      const bal = Number(i.remaining_balance ?? i.total_amount ?? 0);
      if (bal <= 0) return false;
      if (!i.due_date) return false;
      const dueDate = new Date(i.due_date);
      const now = new Date();
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 5;
    }).length;
  }, [invoices, remindersTick]);

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (statusFilter !== 'ALL') {
      list = list.filter(i => (i.status || 'Sent').toLowerCase() === statusFilter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        (i.invoice_number && i.invoice_number.toLowerCase().includes(q)) ||
        (i.client_name && i.client_name.toLowerCase().includes(q)) ||
        (i.client_email && i.client_email.toLowerCase().includes(q)) ||
        (i.destination && i.destination.toLowerCase().includes(q))
      );
    }
    return list;
  }, [invoices, statusFilter, searchQuery]);

  const handleCreateNew = async () => {
    try {
      const newInv = await createInvoice({
        client_name: 'New Client / Organization',
        client_email: '',
        client_phone: '',
        destination: 'Custom Travel Package',
        items: [
          {
            id: `item_${Date.now()}`,
            description: 'Concierge Travel Planning & Booking Services',
            qty: 1,
            rate: 50000,
            amount: 50000
          }
        ],
        subtotal: 50000,
        tax_rate: settings?.default_tax_rate ?? 5,
        tax_amount: Math.round((50000 * (settings?.default_tax_rate ?? 5)) / 100),
        total_amount: Math.round(50000 * (1 + (settings?.default_tax_rate ?? 5) / 100)),
        remaining_balance: Math.round(50000 * (1 + (settings?.default_tax_rate ?? 5) / 100)),
        currency: settings?.default_currency || 'INR',
        upi_id: settings?.upi_id || 'voyantatravel@okaxis',
        upi_payee_name: settings?.upi_payee_name || settings?.agency_name || 'Voyanta Travel',
        branding: {
          agency_name: settings?.agency_name || 'Voyanta Luxury Travel',
          logo_url: settings?.logo_url || '',
          contact_email: settings?.contact_email || '',
          contact_phone: settings?.contact_phone || '',
          address: settings?.address || '',
          upi_id: settings?.upi_id || 'voyantatravel@okaxis'
        }
      });
      setInvoices(prev => [newInv, ...prev]);
      setActiveInvoice(newInv);
      toast.success(`Created standalone invoice #${newInv.invoice_number}`);
    } catch (err) {
      toast.error('Failed to create new invoice');
    }
  };

  const handleCrmStatusChange = async (inv, newStatus) => {
    try {
      const updatedList = invoices.map(item => item.id === inv.id ? { ...item, crm_status: newStatus } : item);
      setInvoices(updatedList);

      const agencyId = getAgencyId();
      const key = `voyanta_invoices_data_${agencyId}`;
      const stored = localStorage.getItem(key) || localStorage.getItem('voyanta_invoices_data');
      if (stored) {
        const parsed = JSON.parse(stored).map(item => item.id === inv.id ? { ...item, crm_status: newStatus } : item);
        localStorage.setItem(key, JSON.stringify(parsed));
      }

      const cList = await fetchClients({ page: 0, pageSize: 1000 });
      const matchingClient = (cList?.data || []).find(c =>
        (c.name && inv.client_name && c.name.trim().toLowerCase() === inv.client_name.trim().toLowerCase()) ||
        (c.email && inv.client_email && c.email.trim().toLowerCase() === inv.client_email.trim().toLowerCase()) ||
        (c.id && String(c.id) === `inv_client_${inv.id}`)
      );
      if (matchingClient && matchingClient.id) {
        await updateClient(matchingClient.id, { status: newStatus }).catch(() => {});
      } else {
        try {
          const crmStored = JSON.parse(localStorage.getItem('voyanta_crm_clients') || '[]');
          const crmUpdated = crmStored.map(c => 
            ((c.name && inv.client_name && c.name.trim().toLowerCase() === inv.client_name.trim().toLowerCase()) ||
             (c.email && inv.client_email && c.email.trim().toLowerCase() === inv.client_email.trim().toLowerCase()))
              ? { ...c, status: newStatus } : c
          );
          localStorage.setItem('voyanta_crm_clients', JSON.stringify(crmUpdated));
        } catch {}
      }
      toast.success(`CRM status synced to ${newStatus}`);
    } catch (e) {
      toast.error('Failed to update CRM status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await deleteInvoice(id);
      setInvoices(prev => prev.filter(i => i.id !== id));
      toast.success('Invoice deleted');
    } catch (err) {
      toast.error('Failed to delete invoice');
    }
  };

  const defaultCurr = settings?.default_currency || 'INR';

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-surface space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-black text-on-surface tracking-tight m-0 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">account_balance_wallet</span>
            Invoices & UPI Billing Hub
          </h1>
          <p className="text-sm text-on-surface-variant m-0 mt-1">
            Manage client billing, instant UPI deep links, cryptographic receipts, and revenue analytics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowReminders(true)}
            className="px-5 py-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold text-xs uppercase tracking-wider border border-amber-500/30 transition-all flex items-center gap-2 relative shadow-sm"
          >
            <span className={`material-symbols-outlined text-[18px] ${activeRemindersCount > 0 ? 'animate-bounce' : ''}`}>notifications_active</span>
            🔔 Reminders ({activeRemindersCount})
            {activeRemindersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
            )}
          </button>
          <button
            onClick={handleCreateNew}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-accent text-on-primary font-extrabold text-xs uppercase tracking-wider shadow-lg hover:brightness-110 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            + Create New Invoice
          </button>
        </div>
      </div>

      {/* Financial KPI Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#0b1c30] to-[#162e4d] text-white shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between opacity-80 text-xs font-bold uppercase tracking-wider">
            <span>Total Billed Revenue</span>
            <span className="material-symbols-outlined text-amber-400">trending_up</span>
          </div>
          <div className="text-2xl md:text-3xl font-black font-mono my-2 text-white">
            {formatCurrency(totalBilled, defaultCurr)}
          </div>
          <div className="text-[11px] opacity-70">Across all {invoices.length} billing records</div>
        </div>

        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-900 to-emerald-800 text-white shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between opacity-80 text-xs font-bold uppercase tracking-wider">
            <span>Collected / Verified</span>
            <span className="material-symbols-outlined text-emerald-300">verified</span>
          </div>
          <div className="text-2xl md:text-3xl font-black font-mono my-2 text-emerald-200">
            {formatCurrency(totalCollected, defaultCurr)}
          </div>
          <div className="text-[11px] opacity-70">Paid directly or via instant UPI</div>
        </div>

        <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-950 to-rose-900 text-white shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between opacity-80 text-xs font-bold uppercase tracking-wider">
            <span>Outstanding Balance</span>
            <span className="material-symbols-outlined text-rose-400">pending</span>
          </div>
          <div className="text-2xl md:text-3xl font-black font-mono my-2 text-rose-300">
            {formatCurrency(totalOutstanding, defaultCurr)}
          </div>
          <div className="text-[11px] opacity-70">Pending collection from clients</div>
        </div>

        <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            <span>Billing Activity</span>
            <span className="material-symbols-outlined text-primary">receipt_long</span>
          </div>
          <div className="text-2xl md:text-3xl font-black font-mono my-2 text-on-surface">
            {invoices.length}
          </div>
          <div className="text-[11px] text-primary font-bold">100% Offline-Resilient Sync</div>
        </div>
      </div>

      {/* Breakout Wrapper for Filters Box & Table */}
      <div className="-mx-6 lg:-mx-12 xl:-mx-16 space-y-6">
        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant mx-6 lg:mx-12 xl:mx-16">
          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', ...INVOICE_STATUSES.map(s => s.id)].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors ${
                  statusFilter === st
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/60'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
            <input
              type="text"
              placeholder="Search invoice #, client, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-xl overflow-hidden mx-6 lg:mx-12 xl:mx-16">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-xs font-black uppercase tracking-widest text-on-surface-variant">
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Client / Contact</th>
                  <th className="py-3 px-3">Actions</th>
                  <th className="py-3 px-3">Destination</th>
                  <th className="py-3 px-3">Date & Due</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Paid</th>
                  <th className="py-3 px-3">Remaining</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
                        <span className="text-sm font-semibold">Loading billing directory...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                        <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">receipt_long</span>
                        <p className="text-base font-bold text-on-surface">No Invoices Found</p>
                        <p className="text-xs text-on-surface-variant">No billing records match your search query or filter. Click &ldquo;Create New Invoice&rdquo; to start billing.</p>
                        <button onClick={handleCreateNew} className="mt-2 px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs uppercase tracking-wider">
                          + Create First Invoice
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => (
                    <tr key={inv.id} onClick={() => setActiveInvoice(inv)} className="hover:bg-surface-container-low/50 transition-colors group cursor-pointer">
                      <td className="py-3 px-3 font-mono font-black text-primary text-sm">
                        #{inv.invoice_number}
                        {inv.parent_invoice_id && <span className="block text-[10px] text-amber-600 font-sans font-bold">Split Installment</span>}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-sm text-on-surface flex items-center gap-2">
                          <span>{inv.client_name || 'Client'}</span>
                        </div>
                        {inv.client_email && <div className="text-[11px] text-on-surface-variant font-mono">{inv.client_email}</div>}
                      </td>
                      <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setActiveInvoice(inv); }}
                            className="px-2.5 py-1 rounded-xl bg-primary text-on-primary font-bold text-xs shadow hover:bg-primary/90 transition-colors inline-flex items-center gap-1"
                            title="Open / Edit Invoice"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setReceiptInvoice(inv); }}
                            className="px-2.5 py-1 rounded-xl bg-surface-container text-on-surface font-bold text-xs hover:bg-surface-container-high transition-colors inline-flex items-center gap-1"
                            title="Preview / Print Receipt"
                          >
                            <span className="material-symbols-outlined text-[14px]">receipt</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShareInvoice(inv); }}
                            className="px-2.5 py-1 rounded-xl bg-surface-container text-on-surface font-bold text-xs hover:bg-surface-container-high transition-colors inline-flex items-center gap-1"
                            title="Share Payment Link / UPI QR"
                          >
                            <span className="material-symbols-outlined text-[14px]">share</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }}
                            className="px-2 py-1 rounded-xl text-error hover:bg-error/10 transition-colors inline-flex items-center"
                            title="Delete Invoice"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-on-surface">{inv.destination || '—'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-on-surface font-mono">{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '—'}</div>
                        {inv.due_date && <div className="text-[10px] text-error font-semibold font-mono">Due: {new Date(inv.due_date).toLocaleDateString()}</div>}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-on-surface">
                        {formatCurrency(Number(inv.total_amount) || 0, inv.currency || defaultCurr)}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency((inv.status === 'Paid' ? (Number(inv.total_amount) || Number(inv.paid_amount) || 0) : (Number(inv.paid_amount) || 0)), inv.currency || defaultCurr)}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                        {inv.status === 'Paid'
                          ? formatCurrency(0, inv.currency || defaultCurr)
                          : formatCurrency(inv.remaining_balance !== undefined ? inv.remaining_balance : (Number(inv.total_amount || 0) - Number(inv.paid_amount || 0)), inv.currency || defaultCurr)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1.5 items-start">
                          <select
                            value={inv.crm_status || 'Proposal Sent'}
                            onChange={(e) => handleCrmStatusChange(inv, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={`appearance-none cursor-pointer px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border outline-none transition-all ${
                              inv.crm_status === 'Approved' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                              inv.crm_status === 'Booked' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                              inv.crm_status === 'Inquiry' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                              'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                            }`}
                            title="Linked CRM Status (Click to change)"
                          >
                            {(TRIP_STATUSES || [{ id: 'Inquiry', label: 'Inquiry' }, { id: 'Proposal Sent', label: 'Proposal Sent' }, { id: 'Approved', label: 'Approved' }, { id: 'Booked', label: 'Booked' }]).map(s => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                            inv.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800' :
                            inv.status === 'Cancelled' || inv.status === 'Refunded' ? 'bg-rose-100 text-rose-800' :
                            'bg-surface-container text-on-surface-variant'
                          }`} title="Invoice Payment Status">
                            Inv: {inv.status || 'Sent'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeInvoice && (
        <InvoicePreviewModal
          invoice={activeInvoice}
          onClose={() => setActiveInvoice(null)}
          onUpdate={(updated) => {
            setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i));
          }}
        />
      )}

      {receiptInvoice && (
        <ReceiptPreviewModal
          invoice={receiptInvoice}
          onClose={() => setReceiptInvoice(null)}
        />
      )}

      {shareInvoice && (
        <InvoiceShareModal
          invoice={shareInvoice}
          onClose={() => setShareInvoice(null)}
          onDownloadPdf={() => {
            const inv = shareInvoice;
            setShareInvoice(null);
            setActiveInvoice(inv);
          }}
          onTriggerSmartContact={(props) => {
            setShareInvoice(null);
            setSmartContactProps(props);
          }}
        />
      )}

      <ReminderCenterModal
        isOpen={showReminders}
        onClose={() => setShowReminders(false)}
        invoices={invoices}
        onTriggerReminder={({ mode, invoice, text, subject }) => {
          setShowReminders(false);
          setSmartContactProps({
            mode,
            initialPhone: invoice.client_phone || '',
            initialEmail: invoice.client_email || '',
            clientName: invoice.client_name || 'Client',
            clientId: invoice.client_id || null,
            invoiceId: invoice.id,
            invoiceObj: invoice,
            shareText: text,
            shareSubject: subject,
            onContactSaved: (updated) => {
              setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, client_phone: updated.phone || i.client_phone, client_email: updated.email || i.client_email } : i));
            }
          });
        }}
      />

      {smartContactProps && (
        <SmartContactCaptureModal
          isOpen={true}
          onClose={() => setSmartContactProps(null)}
          {...smartContactProps}
        />
      )}
    </div>
  );
}
