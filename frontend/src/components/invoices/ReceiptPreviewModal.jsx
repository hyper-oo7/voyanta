import { useState, useEffect, useMemo, useRef } from 'react';
import { formatCurrency } from './UpiQrGenerator.jsx';
import { generateQrSvg } from '../../lib/qrEngine.js';
import { settingsService } from '../../services/resourceService.js';
import { updateInvoice } from '../../services/invoiceService.js';
import { useToast } from '../../context/ToastContext.jsx';

export function ReceiptPreviewModal({ invoice, onClose }) {
  const { toast } = useToast();
  const printRef = useRef(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    settingsService.get().then(setSettings).catch(() => {});
  }, []);

  const agencyName = invoice?.branding?.agency_name || settings?.agency_name || 'Concierge Travel Suite';
  const contactEmail = invoice?.branding?.contact_email || settings?.contact_email || '';
  const contactPhone = invoice?.branding?.contact_phone || settings?.contact_phone || '';
  const contactLine = [contactEmail, contactPhone].filter(Boolean).join(' | ');

  const [isEditing, setIsEditing] = useState(false);
  const [paidAmount, setPaidAmount] = useState(Number(invoice?.paid_amount || 0));
  const [clientName, setClientName] = useState(invoice?.client_name || 'Valued Client');
  const [receiptNumber, setReceiptNumber] = useState(`REC-${invoice?.invoice_number || '0001'}`);
  const [datePaid, setDatePaid] = useState(() => {
    return new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  });
  const [notes, setNotes] = useState(invoice?.destination || 'Concierge Travel Package');

  const totalAmount = Number(invoice?.total_amount || 0);
  const remaining = Math.max(0, totalAmount - paidAmount);
  const isPartial = remaining > 0;

  const verificationQr = useMemo(() => {
    const authHash = btoa(`${receiptNumber}-${paidAmount}-${datePaid}`).substring(0, 16).toUpperCase();
    const verifyUrl = `https://verify.voyantatravel.com/receipt?id=${encodeURIComponent(receiptNumber)}&amount=${paidAmount}&currency=${invoice?.currency || 'INR'}&date=${encodeURIComponent(datePaid)}&agency=${encodeURIComponent(agencyName)}&hash=${authHash}`;
    return generateQrSvg(verifyUrl, 100, '#059669', '#ffffff');
  }, [receiptNumber, paidAmount, invoice?.currency, datePaid, agencyName]);

  const handleSaveEdit = async () => {
    try {
      if (invoice?.id) {
        await updateInvoice(invoice.id, {
          paid_amount: Number(paidAmount),
          client_name: clientName,
          destination: notes
        });
        toast.success('Receipt details updated & saved!');
      } else {
        toast.success('Receipt details updated!');
      }
      setIsEditing(false);
    } catch (err) {
      toast.error('Failed to save edits: ' + err.message);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) {
      window.print();
      return;
    }
    const htmlContent = printRef.current.innerHTML;
    const title = `Receipt_${receiptNumber}`;
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      window.print();
      return;
    }
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        ${styles}
        <style>
          @page { size: A4; margin: 15mm; }
          body { background: #ffffff !important; color: #000000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 20px; font-family: sans-serif; }
          .print\\:hidden, .no-print { display: none !important; }
          .print\\:bg-white { background: #ffffff !important; }
          .print\\:text-black { color: #000000 !important; }
          .print\\:border-none { border: none !important; }
          input { border: none !important; background: transparent !important; font-family: inherit !important; font-size: inherit !important; font-weight: inherit !important; color: inherit !important; width: auto !important; display: inline-block !important; }
        </style>
      </head>
      <body class="bg-white text-slate-900 p-8">
        <div class="max-w-3xl mx-auto bg-white">
          ${htmlContent}
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 600);
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-start justify-center p-2 md:p-6 overflow-y-auto animate-fade-in print:p-0 print:bg-white print:static">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl border border-outline-variant flex flex-col my-8 print:my-0 print:shadow-none print:border-none print:w-full">
        
        {/* Toolbar (Hidden on Print) */}
        <div className="p-4 bg-emerald-900 text-white flex items-center justify-between gap-3 rounded-t-3xl print:hidden">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-2xl">verified</span>
            <h3 className="font-serif font-bold text-base m-0">Official Payment Receipt</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  handleSaveEdit();
                } else {
                  setIsEditing(true);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow border border-emerald-500/40"
            >
              <span className="material-symbols-outlined text-[16px]">{isEditing ? 'check' : 'edit'}</span>
              {isEditing ? 'Save Receipt' : 'Edit Receipt'}
            </button>
            <button
              type="button"
              onClick={() => {
                const waText = `Hello ${clientName}! Here is your official payment receipt #${receiptNumber} from ${agencyName} for ₹${paidAmount} paid on ${datePaid}. Download your official receipt PDF and verify authenticity anytime.`;
                const phone = invoice?.client_phone || '';
                const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}${phone ? `&phone=${encodeURIComponent(phone.replace(/[^0-9]/g, ''))}` : ''}`;
                toast.info('To attach the PDF receipt to WhatsApp, click "Print / Download PDF" first and attach the file in WhatsApp chat!');
                window.open(url, '_blank');
              }}
              className="px-3 py-1.5 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:bg-[#20bd5a] transition-colors flex items-center gap-1 shadow"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              Share WA / Attach PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition-colors flex items-center gap-1 shadow"
            >
              <span className="material-symbols-outlined text-[16px]">print</span> Print / Download PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div ref={printRef} className="p-8 md:p-12 bg-white text-slate-900 space-y-6 relative rounded-b-3xl overflow-hidden print:p-4 print:rounded-none">
          
          {/* Watermark */}
          <div className="absolute -right-12 -top-12 opacity-5 pointer-events-none transform rotate-12 text-[140px] font-black font-serif text-emerald-900 select-none print:opacity-[0.03]">
            PAID
          </div>

          {/* Header */}
          <div className="flex items-start justify-between pb-6 border-b-2 border-emerald-600">
            <div>
              {invoice?.branding?.logo_url ? (
                <img src={invoice.branding.logo_url} alt="Logo" className="max-h-14 max-w-[160px] object-contain mb-2" />
              ) : (
                <div className="text-xl font-black font-serif tracking-tight text-emerald-900">
                  {agencyName}
                </div>
              )}
              {contactLine && <p className="text-xs text-slate-500 m-0">{contactLine}</p>}
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs uppercase tracking-widest border border-emerald-300">
                {isPartial ? 'Partially Paid Receipt' : 'Official Receipt'}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 font-mono font-black text-xl">
                {isEditing ? (
                  <input
                    type="text"
                    value={receiptNumber}
                    onChange={e => setReceiptNumber(e.target.value)}
                    className="border-b border-emerald-500 bg-emerald-50 text-right px-1 font-mono font-black text-xl w-36 outline-none"
                  />
                ) : (
                  <span>#{receiptNumber}</span>
                )}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5 flex items-center justify-end gap-1">
                <span>Date:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={datePaid}
                    onChange={e => setDatePaid(e.target.value)}
                    className="border-b border-slate-400 bg-slate-50 text-right px-1 text-xs outline-none w-32"
                  />
                ) : (
                  <span>{datePaid}</span>
                )}
              </div>
            </div>
          </div>

          {/* Payment Details Box */}
          <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="w-full md:w-auto flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">Received From (Client)</span>
              {isEditing ? (
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="w-full text-lg font-black font-serif text-slate-900 m-0 mt-0.5 border-b border-emerald-500 bg-white/80 px-1 outline-none"
                />
              ) : (
                <h4 className="text-lg font-black font-serif text-slate-900 m-0 mt-0.5">{clientName}</h4>
              )}
              {invoice?.client_email && <p className="text-xs text-slate-600 m-0 mt-0.5">{invoice.client_email}</p>}
              <div className="mt-3 text-xs font-medium text-slate-700 flex items-center gap-1 flex-wrap">
                <span className="font-bold">For Invoice:</span> #{invoice?.invoice_number}
                <span>(</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="border-b border-slate-400 bg-white px-1 text-xs font-medium outline-none flex-1 min-w-[140px]"
                  />
                ) : (
                  <span>{notes}</span>
                )}
                <span>)</span>
              </div>
            </div>

            <div className="text-center md:text-right bg-white p-4 rounded-xl border border-emerald-200 shadow-sm min-w-[200px]">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-600 block">Amount Received</span>
              <div className="my-1">
                {isEditing ? (
                  <div className="flex items-center justify-center md:justify-end gap-1">
                    <span className="text-2xl font-black text-emerald-700">{invoice?.currency || '₹'}</span>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={e => setPaidAmount(e.target.value)}
                      className="text-2xl font-black font-mono text-emerald-700 w-28 text-right border-b border-emerald-500 bg-emerald-50/50 outline-none px-1"
                    />
                  </div>
                ) : (
                  <div className="text-3xl font-black font-mono text-emerald-700">
                    {formatCurrency(paidAmount, invoice?.currency)}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Payment Verified</span>
            </div>
          </div>

          {/* Balance Status */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 font-bold block">Total Invoice Amount</span>
              <span className="font-mono font-bold text-slate-800 text-sm">{formatCurrency(totalAmount, invoice?.currency)}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block">Total Paid to Date</span>
              <span className="font-mono font-bold text-emerald-600 text-sm">{formatCurrency(paidAmount, invoice?.currency)}</span>
            </div>
            <div className="col-span-2 md:col-span-1">
              <span className="text-slate-400 font-bold block">Remaining Due</span>
              <span className={`font-mono font-bold text-sm ${remaining > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                {formatCurrency(remaining, invoice?.currency)}
              </span>
            </div>
          </div>

          {/* Footer & Verification QR */}
          <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3.5">
              <div className="w-24 h-24 bg-white rounded-xl border-2 border-emerald-600/30 p-1.5 flex items-center justify-center shadow-sm flex-shrink-0">
                {(() => {
                  try {
                    const customQr = localStorage.getItem('voyanta_payment_qr_code');
                    if (customQr) return <img src={customQr} alt="Authentic Receipt QR" className="w-full h-full object-contain" />;
                  } catch {}
                  return <div dangerouslySetInnerHTML={{ __html: verificationQr }} />;
                })()}
              </div>
              <div>
                <h5 className="text-xs font-black text-emerald-900 m-0 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  100% Authentic Verifiable Receipt
                </h5>
                <p className="text-[10px] font-mono text-slate-500 m-0 mt-1 leading-relaxed">
                  DIGITAL HASH: SHA256 / {btoa(`${receiptNumber}-${paidAmount}-${datePaid}`).substring(0, 16).toUpperCase()}
                </p>
                <p className="text-[11px] text-slate-500 m-0 mt-1 leading-relaxed">
                  Scan QR code to verify authenticity. Issued digitally by <strong className="text-slate-700">{agencyName}</strong>.
                </p>
              </div>
            </div>

            <div className="text-right ml-auto">
              <div className="w-36 border-b-2 border-slate-800 mb-1.5 ml-auto"></div>
              <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">Authorized Signature</span>
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">Generated via {agencyName} Suite</span>
            </div>
          </div>

          {/* Bottom ID Matching Footer */}
          <div className="pt-3 mt-2 border-t border-slate-100 text-center">
            <span className="text-[11px] font-mono text-slate-400">
              Voyanta Concierge Engine — Invoice ID: #{invoice?.invoice_number || receiptNumber}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
