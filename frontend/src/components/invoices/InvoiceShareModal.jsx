import { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency } from './UpiQrGenerator.jsx';
import { logActivity } from '../../services/activityLogService.js';
import SmartContactCaptureModal from '../common/SmartContactCaptureModal.jsx';

export function InvoiceShareModal({ invoice, onClose, onShared, onDownloadPdf }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [smartContact, setSmartContact] = useState(null);

  const clientPhone = (invoice?.client_phone || '').replace(/[^0-9]/g, '');
  const clientEmail = invoice?.client_email || '';
  const agencyName = invoice?.branding?.agency_name || 'Voyanta Luxury Travel';
  const amountFormatted = formatCurrency(invoice?.total_amount || 0, invoice?.currency);
  const upiId = invoice?.upi_id || invoice?.branding?.upi_id || 'voyantatravel@okaxis';
  
  const payNowLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(agencyName)}&am=${encodeURIComponent(invoice?.total_amount || 0)}&cu=INR`;
  const docLink = `${window.location.origin}/invoices?view=${invoice?.id || ''}`;

  const settings = JSON.parse(localStorage.getItem('voyanta_settings') || '{}');
  const socials = [
    { name: 'Website', url: settings.social_website },
    { name: 'Instagram', url: settings.social_instagram },
    { name: 'Facebook', url: settings.social_facebook },
    { name: 'LinkedIn', url: settings.social_linkedin },
    { name: 'Twitter/X', url: settings.social_twitter },
    { name: 'YouTube', url: settings.social_youtube }
  ].filter(s => s.url && s.url.trim() !== '');

  const socialsWaText = socials.length > 0 
    ? `\n\n🌐 *Connect With Us:*\n` + socials.map(s => `• ${s.name}: ${s.url.startsWith('http') ? s.url : 'https://'+s.url}`).join('\n')
    : '';

  const socialsEmailText = socials.length > 0
    ? `\n\n--- CONNECT WITH US ---\n` + socials.map(s => `${s.name}: ${s.url.startsWith('http') ? s.url : 'https://'+s.url}`).join('\n')
    : '';

  // Default WhatsApp text
  const [waText, setWaText] = useState(() => {
    return `Hello ${invoice?.client_name || 'Valued Client'},\n\nGreetings from *${agencyName}*! ✨\n\nWe have generated your official Invoice *#${invoice?.invoice_number}* for your upcoming travel concierge experience (*${invoice?.destination || 'Luxury Package'}*).\n\n*Amount Due:* ${amountFormatted}\n*Due Date:* ${invoice?.due_date || 'Upon receipt'}\n\n━━━━━━━━━━━━━━━━━━━━━━\n⚡ *[ INSTANT ONE-CLICK UPI PAY NOW ]* ⚡\n👉 Click to Open GPay / PhonePe / Paytm:\n${payNowLink}\n━━━━━━━━━━━━━━━━━━━━━━\n\n*Instant UPI Payment ID:* \`${upiId}\`\n\nYou can also pay directly via any UPI app using our verified VPA.\n\nThank you for choosing ${agencyName}. Please let us know if you have any questions!\n\nWarm regards,\n*${agencyName} Concierge Team*${socialsWaText}`;
  });

  // Default Email Subject & Body
  const [emailSubject, setEmailSubject] = useState(`Official Invoice #${invoice?.invoice_number} - ${agencyName}`);
  const [emailBody, setEmailBody] = useState(() => {
    return `Dear ${invoice?.client_name || 'Valued Client'},\n\nWe hope this email finds you well.\n\nPlease find your official invoice #${invoice?.invoice_number} for ${invoice?.destination || 'your travel package'} from ${agencyName}.\n\n--- INVOICE SUMMARY ---\nInvoice Number: #${invoice?.invoice_number}\nTotal Amount: ${amountFormatted}\nPayment Status: ${invoice?.status || 'Sent'}\nDue Date: ${invoice?.due_date || 'Immediate'}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ [ BUTTON: INSTANT ONE-CLICK UPI PAY NOW ] ⚡\n👉 Click link to Open GPay / PhonePe / Paytm:\n${payNowLink}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n--- PAYMENT VPA ---\nYou can make an instant zero-fee transfer to our verified UPI ID: ${upiId}\n\n📄 VIEW & ATTACHED DOCUMENTS:\nAccess your live interactive Invoice & Payment Receipt portal online (with direct pay button): ${docLink}\n(Note: Official PDF document is attached to this email or downloadable via portal).\n\nThank you for choosing ${agencyName}.\n\nSincerely,\n${agencyName} Concierge Team${socialsEmailText}`;
  });

  const handleDownloadPdf = () => {
    if (onDownloadPdf) {
      toast.success('Opening clean document print window...');
      onDownloadPdf();
    } else {
      toast.info('Opening document preview for clean PDF export...');
      window.open(docLink, '_blank');
    }
  };

  const handleOpenWhatsApp = async () => {
    try {
      await logActivity({
        action_type: 'invoice_shared_whatsapp',
        entity_type: 'invoice',
        entity_id: invoice?.id,
        description: `Shared Invoice #${invoice?.invoice_number} via WhatsApp`
      });
    } catch {}

    setSmartContact({
      mode: 'whatsapp',
      initialPhone: clientPhone || invoice?.client_phone || '',
      initialEmail: clientEmail || '',
      clientName: invoice?.client_name || 'Client',
      clientId: invoice?.client_id || null,
      invoiceId: invoice?.id,
      invoiceObj: invoice,
      shareText: waText,
      shareSubject: emailSubject,
      onContactSaved: () => {
        if (onShared) onShared();
      }
    });
  };

  const handleSendEmail = async () => {
    try {
      await logActivity({
        action_type: 'invoice_shared_email',
        entity_type: 'invoice',
        entity_id: invoice?.id,
        description: `Shared Invoice #${invoice?.invoice_number} via Email`
      });
    } catch {}

    setSmartContact({
      mode: 'email',
      initialPhone: clientPhone || invoice?.client_phone || '',
      initialEmail: clientEmail || '',
      clientName: invoice?.client_name || 'Client',
      clientId: invoice?.client_id || null,
      invoiceId: invoice?.id,
      invoiceObj: invoice,
      shareText: emailBody,
      shareSubject: emailSubject,
      onContactSaved: () => {
        if (onShared) onShared();
      }
    });
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-xl rounded-3xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">share</span>
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-on-surface m-0">Share Invoice #{invoice?.invoice_number}</h3>
              <p className="text-xs text-on-surface-variant m-0">Send directly via WhatsApp or Email</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant bg-surface-container-lowest px-6 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'whatsapp' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">chat</span> WhatsApp
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'email' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">mail</span> Email Client
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {activeTab === 'whatsapp' ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                <span className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">phone_iphone</span>
                  Recipient Phone:
                </span>
                <span className="font-mono font-extrabold">{invoice?.client_phone || 'No phone recorded (will open generic web prompt)'}</span>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-on-surface-variant mb-1.5">Formatted WhatsApp Message</label>
                <textarea
                  rows={8}
                  value={waText}
                  onChange={e => setWaText(e.target.value)}
                  className="w-full p-3 rounded-xl border border-outline bg-surface-container-lowest text-xs font-medium text-on-surface focus:ring-2 focus:ring-emerald-500/20 outline-none leading-relaxed"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-xl">attach_file</span>
                  <div>
                    <h5 className="font-bold text-emerald-950 m-0">📎 Attach Invoice / Receipt PDF to WhatsApp</h5>
                    <p className="text-[11px] text-emerald-800 m-0 mt-0.5">
                      Download PDF below, then attach it using the paperclip 📎 icon in your WhatsApp chat.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="px-3 py-1.5 rounded-xl bg-white text-emerald-700 font-bold border border-emerald-300 hover:bg-emerald-100 transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span> Download PDF
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopy(waText)}
                  className="px-4 py-2 rounded-xl border border-outline-variant text-on-surface font-bold text-xs hover:bg-surface-container transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span> Copy Text
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span> Open in WhatsApp
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">To (Client Email)</label>
                <input
                  type="email"
                  value={clientEmail}
                  readOnly
                  className="w-full px-3 py-2 rounded-xl border border-outline bg-surface-container text-xs font-mono text-on-surface"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline bg-surface-container-lowest text-xs font-bold text-on-surface"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-on-surface-variant mb-1.5">Email Body</label>
                <textarea
                  rows={6}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  className="w-full p-3 rounded-xl border border-outline bg-surface-container-lowest text-xs font-medium text-on-surface focus:ring-2 focus:ring-primary/20 outline-none leading-relaxed"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-xl">attach_file</span>
                  <div>
                    <h5 className="font-bold text-on-surface m-0">📎 Attach Invoice / Receipt PDF</h5>
                    <p className="text-[11px] text-on-surface-variant m-0 mt-0.5">
                      Download PDF below, then attach it directly to your Gmail / Outlook draft.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="px-3 py-1.5 rounded-xl bg-white text-primary font-bold border border-primary/30 hover:bg-primary/10 transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span> Download PDF
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopy(`${emailSubject}\n\n${emailBody}`)}
                  className="px-4 py-2 rounded-xl border border-outline-variant text-on-surface font-bold text-xs hover:bg-surface-container transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span> Copy Email
                </button>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="px-6 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">mail</span> Send via Gmail / Mail Client
                </button>
              </div>
            </div>
          )}
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
