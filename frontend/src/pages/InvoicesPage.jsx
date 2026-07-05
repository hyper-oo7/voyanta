import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { fetchInvoices, createInvoice, deleteInvoice, INVOICE_STATUSES } from '../services/invoiceService.js';
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
      const [invs, stg] = await Promise.all([
        fetchInvoices().catch(() => []),
        settingsService.get().catch(() => ({}))
      ]);
      setInvoices(invs || []);
      setSettings(stg || {});
    } catch (err) {
      toast.error('Failed to load invoices directory');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Financial KPIs
  const totalBilled = useMemo(() => invoices.reduce((acc, i) => acc + (Number(i.total_amount) || 0), 0), [invoices]);
  const totalCollected = useMemo(() => invoices.reduce((acc, i) => acc + (Number(i.paid_amount) || 0), 0), [invoices]);
  const totalOutstanding = useMemo(() => invoices.reduce((acc, i) => acc + (Number(i.remaining_balance) || 0), 0), [invoices]);

  const activeRemindersCount = useMemo(() => {
    return invoices.filter(i => {
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
  }, [invoices]);

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
            <span className="material-symbols-outlined text-[18px] animate-bounce">notifications_active</span>
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

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant">
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
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant text-xs font-black uppercase tracking-widest text-on-surface-variant">
                <th className="py-4 px-6">Invoice #</th>
                <th className="py-4 px-6">Client / Contact</th>
                <th className="py-4 px-6">Destination</th>
                <th className="py-4 px-6">Date & Due</th>
                <th className="py-4 px-6">Amount</th>
                <th className="py-4 px-6">Paid</th>
                <th className="py-4 px-6">Remaining</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
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
                  <tr key={inv.id} className="hover:bg-surface-container-low/50 transition-colors group">
                    <td className="py-4 px-6 font-mono font-black text-primary text-sm">
                      #{inv.invoice_number}
                      {inv.parent_invoice_id && <span className="block text-[10px] text-amber-600 font-sans font-bold">Split Installment</span>}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-sm text-on-surface">{inv.client_name || 'Client'}</div>
                      {inv.client_email && <div className="text-[11px] text-on-surface-variant font-mono">{inv.client_email}</div>}
                    </td>
                    <td className="py-4 px-6 font-semibold text-primary">
                      {inv.destination || '—'}
                    </td>
                    <td className="py-4 px-6 text-on-surface-variant">
                      <div>{inv.issue_date || new Date(inv.created_at || Date.now()).toLocaleDateString()}</div>
                      <div className="text-[10px] opacity-70">Due: {inv.due_date || 'Immediate'}</div>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-on-surface text-sm">
                      {formatCurrency(inv.total_amount || 0, inv.currency)}
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-emerald-600 text-sm">
                      {formatCurrency(inv.paid_amount || 0, inv.currency)}
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-rose-600 text-sm">
                      {formatCurrency(inv.remaining_balance || 0, inv.currency)}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                        inv.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800' :
                        inv.status === 'Cancelled' || inv.status === 'Refunded' ? 'bg-rose-100 text-rose-800' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {inv.status || 'Sent'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveInvoice(inv)}
                          className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow hover:bg-primary/90 transition-colors inline-flex items-center gap-1"
                          title="Open / Edit Invoice"
                        >
                          <span className="material-symbols-outlined text-[15px]">open_in_new</span> Edit
                        </button>

                        {(inv.status === 'Paid' || inv.status === 'Partially Paid') && (
                          <button
                            type="button"
                            onClick={() => setReceiptInvoice(inv)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition-colors inline-flex items-center gap-1 shadow"
                            title="View Receipt Badge"
                          >
                            <span className="material-symbols-outlined text-[15px]">verified</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setShareInvoice(inv)}
                          className="p-1.5 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors"
                          title="Share via WhatsApp or Email"
                        >
                          <span className="material-symbols-outlined text-[18px]">share</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(inv.id)}
                          className="p-1.5 rounded-xl text-on-surface-variant hover:bg-error-container/20 hover:text-error transition-colors"
                          title="Delete Invoice"
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
