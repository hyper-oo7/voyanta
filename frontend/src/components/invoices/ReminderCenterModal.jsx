import { useState, useMemo } from 'react';
import { formatPrice } from '../../lib/currency.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ReminderCenterModal({
  isOpen,
  onClose,
  invoices = [],
  onTriggerReminder = null
}) {
  const toast = useToast();
  const [filter, setFilter] = useState('all'); // 'all' | 'overdue' | 'duesoon'
  const [checkedReminders, setCheckedReminders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('voyanta_checked_reminders') || '{}');
    } catch {
      return {};
    }
  });

  const toggleReminderCheck = (id, forceState = null) => {
    setCheckedReminders(prev => {
      const nextVal = forceState !== null ? forceState : !prev[id];
      const next = { ...prev, [id]: nextVal };
      try { localStorage.setItem('voyanta_checked_reminders', JSON.stringify(next)); } catch {}
      try { window.dispatchEvent(new CustomEvent('voyanta:reminders-updated')); } catch {}
      return next;
    });
  };

  const { overdue, dueSoon, allReminders } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const active = invoices.filter(i => {
      if (i.status === 'Paid' || i.status === 'Cancelled' || i.status === 'Refunded') return false;
      const balance = Number(i.remaining_balance ?? i.total_amount ?? 0);
      return balance > 0;
    });

    const ov = [];
    const ds = [];

    active.forEach(inv => {
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      if (!dueDate || isNaN(dueDate.getTime())) {
        ds.push({ ...inv, reminderType: 'due_soon', daysDiff: 0 });
        return;
      }
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        ov.push({ ...inv, reminderType: 'overdue', daysDiff: Math.abs(diffDays) });
      } else if (diffDays <= 5) {
        ds.push({ ...inv, reminderType: 'due_soon', daysDiff: diffDays });
      }
    });

    return {
      overdue: ov,
      dueSoon: ds,
      allReminders: [...ov, ...ds]
    };
  }, [invoices]);

  if (!isOpen) return null;

  const displayed = filter === 'overdue' ? overdue : filter === 'duesoon' ? dueSoon : allReminders;

  const buildReminderText = (inv) => {
    const cur = inv.currency || 'INR';
    const bal = inv.remaining_balance ?? inv.total_amount ?? 0;
    const upiId = inv.upi_id || inv?.branding?.upi_id || 'voyantatravel@okaxis';
    const payNowLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(inv?.branding?.agency_name || 'Voyanta')}&am=${encodeURIComponent(bal)}&cu=INR`;
    const upi = `\n\n💸 *Instant UPI Payment*: \`${upiId}\`\n⚡ *ONE-CLICK PAY NOW*: ${payNowLink}`;
    const payLink = inv.payment_link ? `\n🔗 *Secure Payment Link*: ${inv.payment_link}` : '';
    
    return `Dear ${inv.client_name || 'Valued Client'},\n\nWe hope you are looking forward to your upcoming journey! This is a gentle reminder regarding *Invoice #${inv.invoice_number || 'INV'}* for the remaining balance of *${formatPrice(bal, cur)}* which is ${inv.reminderType === 'overdue' ? `overdue by ${inv.daysDiff} days` : `due on ${inv.due_date}`}.${upi}${payLink}\n\nPlease let us know if you have any questions or if you have already completed this transfer.\n\nWarm regards,\n*Dedicated Concierge Team*`;
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[28px] p-6 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-outline-variant/30 relative" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-2xl animate-pulse">notifications_active</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-primary dark:text-white m-0 text-lg font-extrabold">
                  Zero-Cost Smart Reminders Engine
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  $0.00 / mo · 100% Free
                </span>
              </div>
              <p className="text-xs text-on-surface-variant m-0 mt-0.5">
                Automated billing reminders dispatched directly via native WhatsApp & Gmail with zero API costs.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'all' ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            All Actionable ({allReminders.length})
          </button>
          <button
            onClick={() => setFilter('overdue')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filter === 'overdue' ? 'bg-red-500 text-white shadow-sm' : 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            Overdue ({overdue.length})
          </button>
          <button
            onClick={() => setFilter('duesoon')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filter === 'duesoon' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            Due Soon ({dueSoon.length})
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {displayed.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">check_circle</span>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 m-0">All Outstanding Invoices are On Track!</h4>
              <p className="text-xs text-slate-400 mt-1">No overdue balances or urgent reminders required right now.</p>
            </div>
          ) : (
            displayed.map((inv) => {
              const isOverdue = inv.reminderType === 'overdue';
              const cur = inv.currency || 'INR';
              const bal = inv.remaining_balance ?? inv.total_amount ?? 0;
              const msgText = buildReminderText(inv);
              const subject = `Urgent Billing Reminder: Invoice #${inv.invoice_number || 'INV'} - Voyanta Travel`;
              const isChecked = !!checkedReminders[inv.id];

              return (
                <div
                  key={inv.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800/80 hover:shadow-md ${
                    isChecked ? 'border-emerald-500/40 bg-emerald-500/[0.04] opacity-80' :
                    isOverdue ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-amber-500/30 bg-amber-500/[0.02]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleReminderCheck(inv.id)}
                      className="mt-1 w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                      title="Check to mark reminder as sent/done"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isChecked && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 flex items-center gap-1">
                            ✓ Sent / Done
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          isOverdue ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}>
                          {isOverdue ? `⚠️ Overdue by ${inv.daysDiff} Days` : `⏳ Due in ${inv.daysDiff} Days`}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-500">#{inv.invoice_number || 'INV'}</span>
                      </div>
                      <div className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {inv.client_name || 'Client Name'}
                        {inv.client_phone && <span className="text-xs font-normal text-slate-400">({inv.client_phone})</span>}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-4">
                        <span>Due: <strong className="text-slate-700 dark:text-slate-300">{inv.due_date || 'N/A'}</strong></span>
                        <span>Balance: <strong className="text-red-500 font-display text-sm">{formatPrice(bal, cur)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        toggleReminderCheck(inv.id, true);
                        if (onTriggerReminder) {
                          onTriggerReminder({
                            mode: 'whatsapp',
                            invoice: inv,
                            text: msgText,
                            subject
                          });
                        }
                      }}
                      className="px-3.5 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all transform hover:scale-105 active:scale-95 shadow-sm"
                      title="Send WhatsApp Reminder (marks as checked)"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                      WhatsApp
                    </button>

                    <button
                      onClick={() => {
                        toggleReminderCheck(inv.id, true);
                        if (onTriggerReminder) {
                          onTriggerReminder({
                            mode: 'email',
                            invoice: inv,
                            text: msgText,
                            subject
                          });
                        }
                      }}
                      className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all transform hover:scale-105 active:scale-95 shadow-sm"
                      title="Send Gmail Reminder (marks as checked)"
                    >
                      <span className="material-symbols-outlined text-base">mail</span>
                      Gmail
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-emerald-500">lock_open</span>
            <span>Reminders open directly in your browser or phone app—no Twilio / SMS fees.</span>
          </div>
          <button onClick={onClose} className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors">
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
