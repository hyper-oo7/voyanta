import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { fetchProposalsFlat } from '../../services/proposalService.js';
import { fetchInvoices, createInvoiceFromProposal, createInvoice } from '../../services/invoiceService.js';
import { settingsService } from '../../services/resourceService.js';
import { InvoicePreviewModal } from '../invoices/InvoicePreviewModal.jsx';
import { formatCurrency } from '../invoices/UpiQrGenerator.jsx';

export function Client360Modal({ client, onClose }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('proposals'); // 'proposals', 'invoices', 'details'
  
  const [proposals, setProposals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  // Active modal for invoice preview/editor
  const [activeInvoice, setActiveInvoice] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allProps, allInvs, stg] = await Promise.all([
        fetchProposalsFlat().catch(() => []),
        fetchInvoices().catch(() => []),
        settingsService.get().catch(() => ({}))
      ]);

      setSettings(stg || {});

      // Match proposals for this client
      const cName = (client?.name || '').trim().toLowerCase();
      const cEmail = (client?.email || '').trim().toLowerCase();

      const matchedProps = (Array.isArray(allProps) ? allProps : []).filter(p => {
        const pName = (p?.client_name || p?.clientName || '').trim().toLowerCase();
        const pEmail = (p?.client_email || p?.clientEmail || '').trim().toLowerCase();
        return (cName && pName === cName) || (cEmail && pEmail === cEmail) || p?.client_id === client?.id;
      });
      setProposals(matchedProps);

      // Match invoices for this client
      const matchedInvs = (Array.isArray(allInvs) ? allInvs : []).filter(inv => {
        const iName = (inv?.client_name || '').trim().toLowerCase();
        const iEmail = (inv?.client_email || '').trim().toLowerCase();
        return (cName && iName === cName) || (cEmail && iEmail === cEmail) || inv?.client_id === client?.id || inv?.client_id === client?.name;
      });
      setInvoices(matchedInvs);
    } catch (err) {
      toast.error('Failed to load Client 360 data');
    } finally {
      setLoading(false);
    }
  }, [client, toast]);

  useEffect(() => {
    loadData();
    const handleSettings = (e) => { if (e.detail) setSettings(e.detail); };
    window.addEventListener('voyanta:settings-updated', handleSettings);
    return () => window.removeEventListener('voyanta:settings-updated', handleSettings);
  }, [loadData]);

  const handleGenerateFromProposal = async (proposal) => {
    try {
      const newInv = await createInvoiceFromProposal(proposal, settings);
      setInvoices(prev => [newInv, ...prev]);
      setActiveInvoice(newInv);
      toast.success(`Generated Invoice #${newInv.invoice_number}`);
    } catch (err) {
      toast.error(err.message || 'Failed to generate invoice from proposal');
    }
  };

  const handleCreateStandaloneInvoice = async () => {
    try {
      const newInv = await createInvoice({
        client_id: client?.id || client?.name,
        client_name: client?.name || 'Valued Client',
        client_email: client?.email || '',
        client_phone: client?.phone || '',
        destination: client?.destination || 'Custom Concierge Service',
        items: [
          {
            id: `item_${Date.now()}`,
            description: `Travel Concierge Services for ${client?.name || 'Client'}`,
            qty: 1,
            rate: 25000,
            amount: 25000
          }
        ],
        subtotal: 25000,
        tax_rate: settings?.default_tax_rate ?? 5,
        tax_amount: Math.round((25000 * (settings?.default_tax_rate ?? 5)) / 100),
        total_amount: Math.round(25000 * (1 + (settings?.default_tax_rate ?? 5) / 100)),
        remaining_balance: Math.round(25000 * (1 + (settings?.default_tax_rate ?? 5) / 100)),
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
      toast.success(`Created Standalone Invoice #${newInv.invoice_number}`);
    } catch (err) {
      toast.error('Failed to create standalone invoice');
    }
  };

  const totalBilled = invoices.reduce((acc, inv) => acc + (Number(inv.total_amount) || 0), 0);
  const totalReceived = invoices.reduce((acc, inv) => acc + (Number(inv.paid_amount) || 0), 0);
  const totalOutstanding = invoices.reduce((acc, inv) => acc + (Number(inv.remaining_balance) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-6 overflow-y-auto animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-5xl rounded-3xl shadow-2xl border border-outline-variant flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header Drawer Banner */}
        <div className="p-6 bg-gradient-to-r from-[#0b1c30] to-[#1e3a5f] text-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-black text-2xl uppercase tracking-wider shadow-inner">
              {(client?.name || 'C').charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-serif font-bold m-0">{client?.name || 'Client Profile'}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/30 border border-primary/50 text-xs font-bold uppercase tracking-wider text-amber-300">
                  {client?.status || 'Active Client'}
                </span>
              </div>
              <p className="text-xs text-white/80 m-0 mt-1 flex items-center gap-3">
                {client?.email && <span>✉️ {client.email}</span>}
                {client?.phone && <span>📞 {client.phone}</span>}
                {client?.destination && <span>✈️ {client.destination}</span>}
              </p>
            </div>
          </div>

          {/* Quick Financial Overview */}
          <div className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-white/70 block">Total Billed</span>
              <span className="text-sm font-mono font-bold text-white">{formatCurrency(totalBilled, settings?.default_currency || 'INR')}</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-white/70 block">Received</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{formatCurrency(totalReceived, settings?.default_currency || 'INR')}</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-white/70 block">Outstanding</span>
              <span className={`text-sm font-mono font-bold ${totalOutstanding > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {formatCurrency(totalOutstanding, settings?.default_currency || 'INR')}
              </span>
            </div>
          </div>

          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 transition-colors">
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-outline-variant bg-surface-container-low px-6 pt-3 gap-6">
          <button
            onClick={() => setActiveTab('proposals')}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'proposals' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">description</span>
            Linked Proposals ({proposals.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'invoices' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            Invoices & Receipts ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            Client Notes & CRM Details
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-surface">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
              <span className="text-sm font-semibold text-on-surface-variant">Loading client history & financial records...</span>
            </div>
          ) : activeTab === 'proposals' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-serif font-bold text-on-surface m-0">Proposals for {client?.name}</h3>
                  <p className="text-xs text-on-surface-variant m-0">Select any proposal below to instantly generate a branded PDF invoice.</p>
                </div>
              </div>

              {proposals.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-surface-container-lowest border border-outline-variant/60 max-w-md mx-auto">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">description</span>
                  <h4 className="text-sm font-bold text-on-surface m-0">No Proposals Found</h4>
                  <p className="text-xs text-on-surface-variant mt-1">
                    No proposals currently match this client&apos;s name (`{client?.name}`) or email (`{client?.email}`).
                  </p>
                  <button
                    onClick={handleCreateStandaloneInvoice}
                    className="mt-4 px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span> Create Standalone Invoice Instead
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {proposals.map(prop => {
                    const hasInvoice = invoices.some(i => i.proposal_id === prop.id);
                    return (
                      <div key={prop.id} className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-on-surface m-0 line-clamp-1">{prop.name || prop.title || 'Luxury Itinerary Proposal'}</h4>
                            <span className="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-bold uppercase tracking-wider text-primary">
                              {prop.status || 'Draft'}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant m-0 mt-1 flex items-center gap-2">
                            <span>✈️ {prop.destination || client?.destination || 'Global'}</span>
                            <span>📅 {new Date(prop.created_at || Date.now()).toLocaleDateString()}</span>
                          </p>
                          <div className="mt-3 text-sm font-mono font-black text-primary">
                            {formatCurrency(prop.total_price || prop.budget || prop.totalAmount || 0, settings?.default_currency || 'INR')}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-outline-variant/50 flex items-center justify-between">
                          {hasInvoice ? (
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px]">check_circle</span> Invoice Generated
                            </span>
                          ) : <span className="text-[11px] text-on-surface-variant">Ready for Billing</span>}

                          <button
                            type="button"
                            onClick={() => handleGenerateFromProposal(prop)}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-primary to-accent text-on-primary font-extrabold text-xs shadow hover:brightness-110 transition-all flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">bolt</span> Generate Invoice PDF
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'invoices' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-serif font-bold text-on-surface m-0">Invoices & Receipts History</h3>
                  <p className="text-xs text-on-surface-variant m-0">View, edit, print PDF, or record payments for this client.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateStandaloneInvoice}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow hover:bg-primary/90 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span> + New Standalone Invoice
                </button>
              </div>

              {invoices.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-surface-container-lowest border border-outline-variant/60 max-w-md mx-auto">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">receipt_long</span>
                  <h4 className="text-sm font-bold text-on-surface m-0">No Invoices Yet</h4>
                  <p className="text-xs text-on-surface-variant mt-1">
                    No invoices have been created for {client?.name} yet. Click generate from a proposal or create a standalone invoice.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Date / Due</th>
                        <th className="py-3 px-4">Total Amount</th>
                        <th className="py-3 px-4">Paid</th>
                        <th className="py-3 px-4">Remaining Due</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60 text-xs">
                      {invoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-3.5 px-4 font-bold font-mono text-primary">
                            #{inv.invoice_number}
                            {inv.parent_invoice_id && <span className="block text-[10px] text-amber-600 font-sans">Split Installment</span>}
                          </td>
                          <td className="py-3.5 px-4 text-on-surface-variant">
                            <div>{inv.issue_date || new Date(inv.created_at || Date.now()).toLocaleDateString()}</div>
                            <div className="text-[10px] opacity-70">Due: {inv.due_date || 'Immediate'}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-on-surface">
                            {formatCurrency(inv.total_amount || 0, inv.currency)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                            {formatCurrency(inv.paid_amount || 0, inv.currency)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-rose-600">
                            {formatCurrency(inv.remaining_balance || 0, inv.currency)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                              inv.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800' :
                              inv.status === 'Cancelled' || inv.status === 'Refunded' ? 'bg-rose-100 text-rose-800' :
                              'bg-primary/10 text-primary'
                            }`}>
                              {inv.status || 'Sent'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setActiveInvoice(inv)}
                              className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-[11px] shadow hover:bg-primary/90 transition-colors inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">open_in_new</span> Open / Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-2xl bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant space-y-4">
              <h3 className="text-base font-serif font-bold text-on-surface m-0">Client Profile Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-on-surface-variant block">Full Name</span>
                  <div className="p-2.5 rounded-xl bg-surface border border-outline-variant font-semibold text-on-surface mt-1">{client?.name || '—'}</div>
                </div>
                <div>
                  <span className="font-bold text-on-surface-variant block">Email Address</span>
                  <div className="p-2.5 rounded-xl bg-surface border border-outline-variant font-mono text-on-surface mt-1">{client?.email || '—'}</div>
                </div>
                <div>
                  <span className="font-bold text-on-surface-variant block">Phone Number</span>
                  <div className="p-2.5 rounded-xl bg-surface border border-outline-variant font-mono text-on-surface mt-1">{client?.phone || '—'}</div>
                </div>
                <div>
                  <span className="font-bold text-on-surface-variant block">Primary Destination</span>
                  <div className="p-2.5 rounded-xl bg-surface border border-outline-variant font-semibold text-primary mt-1">{client?.destination || '—'}</div>
                </div>
                <div className="md:col-span-2">
                  <span className="font-bold text-on-surface-variant block">Internal CRM Notes & Preferences</span>
                  <div className="p-3 rounded-xl bg-surface border border-outline-variant font-normal text-on-surface mt-1 whitespace-pre-wrap min-h-[80px]">
                    {client?.notes || <span className="italic text-on-surface-variant/50">No preferences or remarks recorded for this client.</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Editor Modal when opened */}
      {activeInvoice && (
        <InvoicePreviewModal
          invoice={activeInvoice}
          onClose={() => setActiveInvoice(null)}
          onUpdate={(updatedInv) => {
            setInvoices(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i));
          }}
        />
      )}
    </div>
  );
}
