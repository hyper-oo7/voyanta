import { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency } from './UpiQrGenerator.jsx';
import { logActivity } from '../../services/activityLogService.js';
import SmartContactCaptureModal from '../common/SmartContactCaptureModal.jsx';

export function ReceiptShareModal({ invoice, receiptNumber, paidAmount, datePaid, clientName, agencyName, notes, onClose, onDownloadPdf }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [smartContact, setSmartContact] = useState(null);

  const clientPhone = (invoice?.client_phone || '').replace(/[^0-9]/g, '');
  const clientEmail = invoice?.client_email || '';
  const currency = invoice?.currency || 'INR';
  const amountFormatted = formatCurrency(paidAmount || 0, currency);
  
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
    return `Hello ${clientName || 'Valued Client'},\n\nGreetings from *${agencyName}*! ✨\n\nWe have received your payment of *${amountFormatted}* on *${datePaid}*.\n\n*Receipt Number:* #${receiptNumber}\n*For Service/Package:* ${notes || 'Travel Concierge'}\n\nThank you for choosing ${agencyName}. Your booking details and official payment receipt are attached / available online:\n👉 ${docLink}\n\nWarm regards,\n*${agencyName} Concierge Team*${socialsWaText}`;
  });

  // Default Email Subject & Body
  const [emailSubject, setEmailSubject] = useState(`Official Payment Receipt #${receiptNumber} - ${agencyName}`);
  const [emailBody, setEmailBody] = useState(() => {
    return `Dear ${clientName || 'Valued Client'},\n\nWe hope this email finds you well.\n\nPlease find your official payment receipt #${receiptNumber} for your travel package "${notes || 'Travel Concierge'}" from ${agencyName}.\n\n--- PAYMENT RECEIPT SUMMARY ---\nReceipt Number: #${receiptNumber}\nAmount Paid: ${amountFormatted}\nDate Paid: ${datePaid}\nPayment Status: Verified / Paid\n\n📄 VIEW DETAILS & RECEIPT:\nYou can view your live interactive receipt and payment details online here:\n${docLink}\n(Note: Official PDF document is attached or downloadable via the portal).\n\nThank you for choosing ${agencyName}.\n\nSincerely,\n${agencyName} Concierge Team${socialsEmailText}`;
  });

  // Rich HTML Email for Clipboard
  const richHtmlText = `
    <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; line-height: 1.6;">
      <p>Dear ${clientName || 'Valued Client'},</p>
      <p>We hope this email finds you well.</p>
      <p>Please find your official payment receipt <strong>#${receiptNumber}</strong> from ${agencyName}.</p>
      <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 20px 0;" />
      <h3 style="color: #0f172a; margin-bottom: 12px;">Receipt Details</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 6px 0; font-weight: bold; width: 150px;">Receipt Number:</td>
          <td style="padding: 6px 0; font-family: monospace;">#${receiptNumber}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold;">Amount Paid:</td>
          <td style="padding: 6px 0; font-family: monospace; color: #059669; font-weight: bold;">${amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold;">Date Paid:</td>
          <td style="padding: 6px 0;">${datePaid}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold;">Status:</td>
          <td style="padding: 6px 0;"><span style="background-color: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold;">SUCCESS / PAID</span></td>
        </tr>
      </table>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${docLink}" style="background-color: #059669; color: #ffffff; padding: 12px 30px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.2); font-size: 14px;">📄 View Digital Receipt</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 20px 0;" />
      <p>Sincerely,<br /><strong>${agencyName} Concierge Team</strong></p>
    </div>
  `;

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
        action_type: 'receipt_shared_whatsapp',
        entity_type: 'invoice',
        entity_id: invoice?.id,
        description: `Shared Receipt #${receiptNumber} via WhatsApp`
      });
    } catch {}

    setSmartContact({
      mode: 'whatsapp',
      initialPhone: clientPhone || '',
      initialEmail: clientEmail || '',
      clientName: clientName || 'Client',
      clientId: invoice?.client_id || null,
      invoiceId: invoice?.id,
      invoiceObj: invoice,
      shareText: waText,
      shareSubject: emailSubject,
      onContactSaved: () => {}
    });
  };

  const handleSendEmail = async () => {
    try {
      await logActivity({
        action_type: 'receipt_shared_email',
        entity_type: 'invoice',
        entity_id: invoice?.id,
        description: `Shared Receipt #${receiptNumber} via Email`
      });
    } catch {}

    setSmartContact({
      mode: 'email',
      initialPhone: clientPhone || '',
      initialEmail: clientEmail || '',
      clientName: clientName || 'Client',
      clientId: invoice?.client_id || null,
      invoiceId: invoice?.id,
      invoiceObj: invoice,
      shareText: emailBody,
      shareSubject: emailSubject,
      onContactSaved: () => {}
    });
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied text to clipboard');
  };

  const handleCopyRichEmail = async () => {
    try {
      const typeHtml = 'text/html';
      const typePlain = 'text/plain';
      const blobHtml = new Blob([richHtmlText], { type: typeHtml });
      const blobPlain = new Blob([emailBody], { type: typePlain });
      const data = [new ClipboardItem({ [typeHtml]: blobHtml, [typePlain]: blobPlain })];
      await navigator.clipboard.write(data);
      toast.success('Rich Receipt Email copied! Paste (Ctrl+V) directly into Gmail/Outlook.');
    } catch (err) {
      navigator.clipboard.writeText(emailBody);
      toast.success('Copied text receipt to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-xl rounded-3xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-650 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">verified</span>
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-on-surface m-0">Share Receipt #{receiptNumber}</h3>
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
                <span className="font-mono font-extrabold">{clientPhone || 'No phone recorded (will open generic web prompt)'}</span>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-on-surface-variant mb-1.5">Formatted WhatsApp Message</label>
                <textarea
                  rows={6}
                  value={waText}
                  onChange={e => setWaText(e.target.value)}
                  className="w-full p-3 rounded-xl border border-outline bg-surface-container-lowest text-xs font-medium text-on-surface focus:ring-2 focus:ring-emerald-500/20 outline-none leading-relaxed"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-xl">attach_file</span>
                  <div>
                    <h5 className="font-bold text-emerald-950 m-0">📎 Attach Receipt PDF to WhatsApp</h5>
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
                  onClick={() => handleCopyText(waText)}
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
                <label className="block text-xs font-extrabold uppercase tracking-wider text-on-surface-variant mb-1.5">Email Body Preview</label>
                <textarea
                  rows={4}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  className="w-full p-3 rounded-xl border border-outline bg-surface-container-lowest text-xs font-medium text-on-surface focus:ring-2 focus:ring-primary/20 outline-none leading-relaxed"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/50 text-[11px] text-emerald-950 font-medium">
                💡 <strong>Free Email Enhancement Enabled:</strong> Click "Copy Rich Email (with Button)" below and paste directly inside your Gmail compose window to insert a beautifully formatted payment receipt message complete with an interactive, styled receipt link.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyRichEmail}
                  className="px-4 py-2 rounded-xl border border-emerald-500 bg-emerald-50 text-emerald-800 font-bold text-xs hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">draw</span> Copy Rich Email (with Button)
                </button>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="px-6 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">mail</span> Open Gmail Draft
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
