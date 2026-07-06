import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  MessageSquare, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  MapPin, 
  User, 
  FileText, 
  ExternalLink,
  AlertCircle,
  HelpCircle,
  Mail,
  ArrowRight
} from 'lucide-react';
import { incrementAnalytics } from '../services/analyticsService.js';
import { logActivity } from '../services/activityLogService.js';

export default function ProposalActionRoute() {
  const [params] = useSearchParams();
  
  // URL Parameters
  const initialType = params.get('type') || 'approval';
  const id = params.get('id') || 'PR-9082';
  const client = params.get('client') || 'Valued Client';
  const dest = params.get('dest') || 'Bespoke Luxury Journey';
  const phone = (params.get('phone') || '+919876543210').replace(/[^0-9+]/g, '');
  const name = params.get('name') || 'Curated Itinerary Presentation';
  const agencyName = params.get('agency') || 'Voyanta Luxury Concierge';

  // State
  const [activeTab, setActiveTab] = useState(initialType === 'modification' ? 'modify' : 'review');
  const [signatureName, setSignatureName] = useState(client !== 'Valued Client' ? client : '');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [modifyTopics, setModifyTopics] = useState([]);
  const [modifyNotes, setModifyNotes] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'submitting' | 'approved' | 'modified'
  const [errorMsg, setErrorMsg] = useState('');

  const MODIFICATION_OPTIONS = [
    'Adjust Travel Dates / Duration',
    'Upgrade Hotel / Room Category',
    'Modify Daily Activities & Tours',
    'Dietary Requirements & Dining Notes',
    'Flight Class & Preferences',
    'Other Custom Request'
  ];

  const toggleTopic = (topic) => {
    setModifyTopics(prev => 
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  const handleApproveSubmit = (e) => {
    e.preventDefault();
    if (!signatureName.trim()) {
      setErrorMsg('Please enter your full name as digital sign-off.');
      return;
    }
    if (!agreedTerms) {
      setErrorMsg('Please confirm agreement to the itinerary terms.');
      return;
    }
    setErrorMsg('');
    setStep('submitting');

    setTimeout(() => {
      incrementAnalytics('approval', id, dest, client);
      logActivity('approval', `Client ${client} approved proposal "${name}" for ${dest} (Signed: ${signatureName})`, client, 'proposal', id);
      setStep('approved');
    }, 600);
  };

  const handleModifySubmit = (e) => {
    e.preventDefault();
    if (modifyTopics.length === 0 && !modifyNotes.trim()) {
      setErrorMsg('Please select at least one topic or enter details below.');
      return;
    }
    setErrorMsg('');
    setStep('submitting');

    setTimeout(() => {
      incrementAnalytics('modification', id, dest, client);
      logActivity('modification', `Client ${client} requested changes on "${name}" for ${dest}`, client, 'proposal', id);
      setStep('modified');
    }, 600);
  };

  const getWhatsAppApproveUrl = () => {
    const text = `Hello ${agencyName} team! \n\nWe have reviewed the proposal for *${dest}* (${name}) and are absolutely delighted with the curated itinerary.\n\n*Digital Sign-off:* ${signatureName}\n*Status:* Officially Approved\n\nPlease let us know the next steps to confirm our reservations!`;
    return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  };

  const getWhatsAppModifyUrl = () => {
    const topicsStr = modifyTopics.length > 0 ? `\n*Requested Areas:* ${modifyTopics.join(', ')}` : '';
    const notesStr = modifyNotes ? `\n*Notes & Ideas:* "${modifyNotes}"` : '';
    const text = `Hello ${agencyName} team! \n\nThank you for curating this proposal for *${dest}* (${name}). We love the concept and would like to request a few customizations before finalizing:${topicsStr}${notesStr}\n\nLooking forward to discussing this!`;
    return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  };

  const getEmailApproveUrl = () => {
    const subject = `[Approved] Proposal Confirmation: ${dest} - ${client}`;
    const body = `Hello ${agencyName} team,\n\nWe have reviewed and approved the proposal for ${dest} (${name}).\n\nDigital Sign-off: ${signatureName}\n\nPlease proceed with booking reservations.\n\nBest regards,\n${client}`;
    return `mailto:concierge@voyantatravel.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#08101e] via-[#0b1c30] to-[#0f172a] text-[#f0f6fc] font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[15%] w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12 md:py-16">
        {/* Header Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4 shadow-lg backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-400" style={{ animationDuration: '6s' }} />
            <span>{agencyName} Exclusive Portal</span>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent mb-3">
            {name}
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto font-light">
            Please review your curated itinerary and choose to approve your journey or request custom enhancements.
          </p>
        </div>

        {/* Summary Overview Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 md:p-8 mb-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Prepared For</span>
                <span className="text-base font-semibold text-white mt-0.5 block">{client}</span>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Destination</span>
                <span className="text-base font-semibold text-white mt-0.5 block">{dest}</span>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Reference ID</span>
                <span className="text-base font-semibold text-white mt-0.5 block font-mono">{id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Action Portal */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-2xl">
          {/* Action Tabs Header */}
          {step === 'form' && (
            <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => { setActiveTab('review'); setErrorMsg(''); }}
                className={`py-3.5 px-4 rounded-2xl font-medium text-sm transition-all flex items-center justify-center gap-2.5 ${
                  activeTab === 'review'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve & Secure Booking</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('modify'); setErrorMsg(''); }}
                className={`py-3.5 px-4 rounded-2xl font-medium text-sm transition-all flex items-center justify-center gap-2.5 ${
                  activeTab === 'modify'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Request Customizations</span>
              </button>
            </div>
          )}

          <div className="p-6 md:p-10">
            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3 animate-fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === 'form' && activeTab === 'review' && (
                <motion.form 
                  key="review-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleApproveSubmit}
                  className="space-y-6"
                >
                  <div className="text-center max-w-lg mx-auto mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Ready to embark on this journey?</h3>
                    <p className="text-sm text-slate-400">
                      By signing off below, you confirm your approval of this proposal. We will immediately reserve your dates and prepare final documentation.
                    </p>
                  </div>

                  <div className="space-y-4 max-w-lg mx-auto bg-slate-950/60 p-6 rounded-2xl border border-slate-800/80">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Digital Sign-off (Full Name) *
                      </label>
                      <input
                        type="text"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        placeholder="e.g. Alexander Wright"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-medium"
                      />
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer group pt-2">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 bg-slate-900 cursor-pointer"
                      />
                      <span className="text-xs text-slate-300 group-hover:text-white transition-colors leading-relaxed">
                        I confirm that the travel dates, passenger details, and itinerary inclusions meet our requirements and authorize Voyanta Concierge to initiate reservation procedures.
                      </span>
                    </label>
                  </div>

                  <div className="pt-4 text-center">
                    <button
                      type="submit"
                      className="w-full max-w-lg py-4 px-8 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3 mx-auto"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Confirm Official Approval</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <span className="block text-[11px] text-slate-500 mt-3">
                      🔒 Instant SSL Encrypted Sign-off & Agency Notification
                    </span>
                  </div>
                </motion.form>
              )}

              {step === 'form' && activeTab === 'modify' && (
                <motion.form 
                  key="modify-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleModifySubmit}
                  className="space-y-6"
                >
                  <div className="text-center max-w-lg mx-auto mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">How can we perfect this journey?</h3>
                    <p className="text-sm text-slate-400">
                      Select the areas you would like to refine. Your dedicated curator will tailor the itinerary until it aligns flawlessly with your vision.
                    </p>
                  </div>

                  <div className="space-y-6 max-w-xl mx-auto">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                        Select Customization Topics
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {MODIFICATION_OPTIONS.map((option) => {
                          const isSelected = modifyTopics.includes(option);
                          return (
                            <button
                              type="button"
                              key={option}
                              onClick={() => toggleTopic(option)}
                              className={`p-3.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between ${
                                isSelected
                                  ? 'bg-blue-500/15 border-blue-500 text-white shadow-md shadow-blue-500/10'
                                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                              }`}
                            >
                              <span>{option}</span>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                                isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-700'
                              }`}>
                                {isSelected && '✓'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Specific Notes or Ideas (Optional)
                      </label>
                      <textarea
                        rows={4}
                        value={modifyNotes}
                        onChange={(e) => setModifyNotes(e.target.value)}
                        placeholder="Tell us about specific hotels, preferred flight timings, celebrating an anniversary, or any activities you would love to add..."
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm font-light resize-none"
                      />
                    </div>
                  </div>

                  <div className="pt-4 text-center">
                    <button
                      type="submit"
                      className="w-full max-w-xl py-4 px-8 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3 mx-auto"
                    >
                      <Send className="w-5 h-5" />
                      <span>Send Customization Request</span>
                    </button>
                  </div>
                </motion.form>
              )}

              {step === 'submitting' && (
                <motion.div 
                  key="submitting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-16 text-center"
                >
                  <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
                  <h3 className="text-xl font-bold text-white mb-2">Processing Your Response...</h3>
                  <p className="text-slate-400 text-sm">Securing communication channels with {agencyName}.</p>
                </motion.div>
              )}

              {step === 'approved' && (
                <motion.div 
                  key="approved"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-8 text-center max-w-xl mx-auto"
                >
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/30 animate-bounce" style={{ animationDuration: '2s' }}>
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
                    🎉 Officially Approved & Recorded
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Thank You, {signatureName}!</h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-8">
                    Your approval has been logged in our secure system. To ensure immediate action on flight and suite reservations, connect with your concierge curator directly via WhatsApp or Email below.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a
                      href={getWhatsAppApproveUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#22bf5b] text-white font-bold transition-all shadow-lg shadow-[#25D366]/30 flex items-center justify-center gap-3"
                    >
                      <MessageSquare className="w-5 h-5 fill-current" />
                      <span>Confirm via WhatsApp</span>
                    </a>
                    
                    <a
                      href={getEmailApproveUrl()}
                      className="py-4 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 transition-all flex items-center justify-center gap-3"
                    >
                      <Mail className="w-5 h-5" />
                      <span>Send Email Note</span>
                    </a>
                  </div>
                  
                  <span className="block text-xs text-slate-500 mt-6 font-light">
                    Reference #{id} • A confirmation copy has been sent to your travel advisory desk.
                  </span>
                </motion.div>
              )}

              {step === 'modified' && (
                <motion.div 
                  key="modified"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-8 text-center max-w-xl mx-auto"
                >
                  <div className="w-20 h-20 rounded-full bg-blue-500/20 border-2 border-blue-500 text-blue-400 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold mb-4">
                    ✨ Customization Request Logged
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">We Love Perfecting Your Vision</h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-8">
                    Your preferences have been registered. Connect with your curator via WhatsApp now with your pre-populated modification notes to discuss custom enhancements!
                  </p>

                  <div className="max-w-md mx-auto">
                    <a
                      href={getWhatsAppModifyUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 px-8 rounded-2xl bg-[#25D366] hover:bg-[#22bf5b] text-white font-bold transition-all shadow-lg shadow-[#25D366]/30 flex items-center justify-center gap-3"
                    >
                      <MessageSquare className="w-5 h-5 fill-current" />
                      <span>Discuss Changes on WhatsApp</span>
                    </a>
                  </div>

                  <span className="block text-xs text-slate-500 mt-6 font-light">
                    Your advisory team has been alerted and is reviewing your notes.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer Security Badge */}
        <div className="mt-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Powered by Voyanta Enterprise Document Engine • High-Encryption Concierge Platform</span>
        </div>
      </div>
    </div>
  );
}
