import { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { updateProposal } from '../../services/proposalService.js';
import { updateInvoice } from '../../services/invoiceService.js';
import { upsertClientFromProposal } from '../../services/crmService.js';

export default function SmartContactCaptureModal({
  isOpen,
  onClose,
  mode = 'whatsapp', // 'whatsapp' | 'email'
  initialPhone = '',
  initialEmail = '',
  clientName = 'Client',
  clientId = null,
  proposalId = null,
  proposalObj = null,
  invoiceId = null,
  invoiceObj = null,
  shareText = '',
  shareSubject = 'Voyanta Notification',
  onContactSaved = null
}) {
  const toast = useToast();
  const [phone, setPhone] = useState(initialPhone || '');
  const [email, setEmail] = useState(initialEmail || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPhone(initialPhone || proposalObj?.client_phone || proposalObj?.phone || proposalObj?.brief?.phone || invoiceObj?.client_phone || '');
      setEmail(initialEmail || proposalObj?.client_email || proposalObj?.email || proposalObj?.brief?.email || invoiceObj?.client_email || '');
    }
  }, [isOpen, initialPhone, initialEmail, proposalObj, invoiceObj]);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    if (e) e.preventDefault();

    if (mode === 'whatsapp') {
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      if (!cleanPhone || cleanPhone.length < 7) {
        toast.error('Please enter a valid WhatsApp phone number with country code (e.g. 919876543210)');
        return;
      }

      setIsSaving(true);
      try {
        // 1. Sync to Client CRM if possible
        if (clientId || proposalObj?.client_id || invoiceObj?.client_id) {
          try {
            await upsertClientFromProposal({
              id: clientId || proposalObj?.client_id || invoiceObj?.client_id,
              name: clientName || proposalObj?.client_name || invoiceObj?.client_name || 'Client',
              phone: cleanPhone,
              email: email || undefined
            });
          } catch {}
        }

        // 2. Sync to Proposal if applicable
        if (proposalId || proposalObj?.id) {
          const pid = proposalId || proposalObj?.id;
          try {
            await updateProposal(pid, {
              phone: cleanPhone,
              client_phone: cleanPhone,
              brief: { ...(proposalObj?.brief || {}), phone: cleanPhone }
            });
          } catch {}
        }

        // 3. Sync to Invoice if applicable
        if (invoiceId || invoiceObj?.id) {
          const iid = invoiceId || invoiceObj?.id;
          try {
            await updateInvoice(iid, { client_phone: cleanPhone });
          } catch {}
        }

        if (onContactSaved) onContactSaved({ phone: cleanPhone, email });

        // Launch WhatsApp
        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone.replace(/^[+]/, '')}&text=${encodeURIComponent(shareText)}`;
        window.open(waUrl, '_blank');
        toast.success('Opened in WhatsApp and client contact saved!');
        onClose();
      } catch (err) {
        toast.error('Error saving contact: ' + err.message);
      } finally {
        setIsSaving(false);
      }
    } else {
      // Email / Gmail Mode
      const cleanEmail = email.trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        toast.error('Please enter a valid client email address');
        return;
      }

      setIsSaving(true);
      try {
        // 1. Sync to Client CRM if possible
        if (clientId || proposalObj?.client_id || invoiceObj?.client_id) {
          try {
            await upsertClientFromProposal({
              id: clientId || proposalObj?.client_id || invoiceObj?.client_id,
              name: clientName || proposalObj?.client_name || invoiceObj?.client_name || 'Client',
              email: cleanEmail,
              phone: phone || undefined
            });
          } catch {}
        }

        // 2. Sync to Proposal if applicable
        if (proposalId || proposalObj?.id) {
          const pid = proposalId || proposalObj?.id;
          try {
            await updateProposal(pid, {
              email: cleanEmail,
              client_email: cleanEmail,
              brief: { ...(proposalObj?.brief || {}), email: cleanEmail }
            });
          } catch {}
        }

        // 3. Sync to Invoice if applicable
        if (invoiceId || invoiceObj?.id) {
          const iid = invoiceId || invoiceObj?.id;
          try {
            await updateInvoice(iid, { client_email: cleanEmail });
          } catch {}
        }

        if (onContactSaved) onContactSaved({ phone, email: cleanEmail });

        // Launch Gmail Web Compose
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(cleanEmail)}&su=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(shareText)}`;
        window.open(gmailUrl, '_blank');
        toast.success('Opened Gmail Compose and client email saved!');
        onClose();
      } catch (err) {
        toast.error('Error saving contact: ' + err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const isWa = mode === 'whatsapp';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-2xl w-full max-w-md border border-outline-variant/30 relative" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isWa ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-red-500/10 text-red-500'}`}>
              {isWa ? (
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              ) : (
                <span className="material-symbols-outlined text-[22px]">mail</span>
              )}
            </div>
            <div>
              <h3 className="font-headline-sm text-primary dark:text-white m-0 text-base font-bold">
                {isWa ? 'Share via WhatsApp' : 'Share via Gmail / Email'}
              </h3>
              <p className="text-xs text-on-surface-variant m-0">
                Confirm {clientName}'s contact details
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <span className="material-symbols-outlined text-sm mt-0.5 shrink-0 text-amber-600">info</span>
          <span>
            {isWa ? "We need the client's WhatsApp number to message them directly." : "We need the client's Gmail / email address to compose this message."} This will be automatically saved to their CRM profile and future invoices/proposals!
          </span>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          {isWa ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Client WhatsApp Number (with Country Code) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 919876543210 or +1234567890"
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface font-mono text-sm focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none"
                required
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Include country code without spaces (e.g., 91 for India, 1 for USA).
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Client Gmail / Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. client@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                required
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Will open Google Mail directly in compose mode with your document details.
              </p>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                isWa ? 'bg-[#25D366] hover:bg-[#20bd5a] shadow-[#25D366]/30' : 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
              }`}
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">send</span>
                  {isWa ? 'Save & Open WhatsApp' : 'Save & Open Gmail'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
