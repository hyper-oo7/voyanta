import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSharedProposalByToken } from '../services/proposalItemService.js';
import { api } from '../services/api.js';
import { formatPrice } from '../lib/currency.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuthStore } from '../store/authStore.js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MULTILINGUAL_DEMO_PROPOSALS,
  getUIText,
  translateText,
} from '../utils/translator.js';
import MediaCarousel from '../components/MediaCarousel.jsx';
import WeatherWidget from '../components/WeatherWidget.jsx';
import MapWidget from '../components/MapWidget.jsx';
import TemplateRenderer, { ALL as ALL_SECTIONS, SECTIONS } from '../components/TemplateRenderer.jsx';
import InlineStudioPopover from '../components/common/InlineStudioPopover.jsx';
import ImageSearchPicker from '../components/common/ImageSearchPicker.jsx';
import GoogleTranslateWidget from '../components/GoogleTranslateWidget.jsx';
import { createInvoiceFromProposal } from '../services/invoiceService.js';
import { logActivity } from '../services/activityLogService.js';

const INDIAN_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', label: 'Marathi', native: 'मਰਾਠी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' }
];

export default function WebViewPage() {
  const { token } = useParams();
  const { user } = useAuthStore();
  const isClientMode = typeof window !== 'undefined' && (window.location.search.includes('mode=client') || window.location.search.includes('view=client'));
  const isAgentView = Boolean(user && !isClientMode);
  const [lang, setLang] = useState('en');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [showPricing, setShowPricing] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  // Live Overrides & Edit Mode states
  const [isInteractiveStudio, setIsInteractiveStudio] = useState(false);
  const [studioTarget, setStudioTarget] = useState(null);
  const [showShareDropdown, setShowShareDropdown] = useState(false);

  // Accordion Expand/Collapse state
  const [allExpanded, setAllExpanded] = useState(true);

  // Client Action & Modals state
  const [actionLoading, setActionLoading] = useState(false);
  const [proposalStatus, setProposalStatus] = useState('pending');
  const [dpdpReceipt, setDpdpReceipt] = useState(null);

  // Approve Modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [clientFullName, setClientFullName] = useState('');
  const [dpdpConsent, setDpdpConsent] = useState(false);

  // Modify Modal state
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modifyCategories, setModifyCategories] = useState({
    hotels: false,
    flights: false,
    dates: false,
    budget: false,
  });
  const [feedbackNotes, setFeedbackNotes] = useState('');

  // Confetti trigger
  const [showConfetti, setShowConfetti] = useState(false);

  const toast = useToast();

  // Activity click, details modal, and stock photo picker states
  const [selectedActivityBlock, setSelectedActivityBlock] = useState(null);
  const [selectedActivityDayIdx, setSelectedActivityDayIdx] = useState(null);
  const [showStockPicker, setShowStockPicker] = useState(false);

  const markProposalSent = () => {
    try {
      if (!p?.id) return;
      const cacheKey = 'voyanta_proposals_list_cache';
      const cachedList = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      let updated = false;
      const newList = cachedList.map((item) => {
        if (String(item.id) === String(p.id) && (item.status === 'Draft' || !item.status || item.status === 'pending')) {
          updated = true;
          return { ...item, status: 'Sent' };
        }
        return item;
      });
      if (updated) {
        localStorage.setItem(cacheKey, JSON.stringify(newList));
        window.dispatchEvent(new CustomEvent('voyanta:proposals-updated'));
      }
    } catch {}
  };

  const handleActivityClick = (block, dayIdx) => {
    setSelectedActivityBlock(block);
    setSelectedActivityDayIdx(dayIdx);
  };

  const updateActivityImage = async (dayIdx, blockId, newImageUrl) => {
    try {
      const nextDays = (data?.proposal?.itinerary?.days || []).map((d, dIdx) => {
        if (dIdx !== dayIdx) return d;
        const nextContent = (d.content || []).map(b => {
          if (b.id !== blockId) return b;
          return {
            ...b,
            data: {
              ...b.data,
              image_url: newImageUrl,
              photos: newImageUrl ? [newImageUrl] : []
            }
          };
        });
        return { ...d, content: nextContent };
      });

      const updatedProposal = {
        ...data.proposal,
        itinerary: {
          ...data.proposal.itinerary,
          days: nextDays
        }
      };

      const localKey = `voyanta_proposal_${p.id}`;
      localStorage.setItem(localKey, JSON.stringify(updatedProposal));

      setData(prev => ({
        ...prev,
        proposal: updatedProposal
      }));

      if (!isDemo && p.id) {
        await api.put(`/api/proposals/${p.id}`, updatedProposal);
        toast.success('Activity image updated successfully!');
      } else {
        toast.success('Activity image updated locally!');
      }
    } catch (err) {
      console.error("Failed to update activity image:", err);
      toast.error("Failed to update image: " + err.message);
    }
  };

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    let mounted = true;
    const effectiveToken = token || 'demo';

    fetchSharedProposalByToken(effectiveToken)
      .then((res) => {
        if (mounted && res && res.proposal) {
          setData(res);
          setLoading(false);
          setIsDemo(false);
          if (res.proposal.status === 'approved') setProposalStatus('approved');
          else if (res.proposal.status === 'changes_requested') setProposalStatus('changes_requested');

          const mode = (res.proposal?.visibility_mode || 'ITEMIZED').toUpperCase();
          if (mode === 'HIDDEN') setShowPricing(false);
          else setShowPricing(true);

          const branding = res.proposal?.preferences?.branding;
          if (branding?.theme_color) {
            document.documentElement.style.setProperty('--color-primary', branding.theme_color);
          }
        } else {
          throw new Error('Fallback to demo');
        }
      })
      .catch(() => {
        if (mounted) {
          // Fallback to high-fidelity multilingual demo proposal
          const demoProposal = MULTILINGUAL_DEMO_PROPOSALS[lang] || MULTILINGUAL_DEMO_PROPOSALS.en;
          const total = demoProposal.items.reduce(
            (acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
            0
          );
          setData({
            proposal: demoProposal,
            items: demoProposal.items,
            totals: { subtotal: total, currency: demoProposal.currency || 'INR' },
          });
          setIsDemo(true);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [token, lang]);

  const p = data?.proposal || {};
  const items = data?.items || [];
  const visibilityMode = (p.visibility_mode || data?.visibility_mode || 'ITEMIZED').toUpperCase();
  const branding = p.preferences?.branding || {};
  const daysList = (p.itinerary && Array.isArray(p.itinerary.days) && p.itinerary.days.length > 0)
    ? p.itinerary.days
    : (p.trip_details && Array.isArray(p.trip_details.days) && p.trip_details.days.length > 0
      ? p.trip_details.days
      : (Array.isArray(p.days) ? p.days : []));

  const include = p.preferences?.include_sections || ALL_SECTIONS;
  const sectionOrder = p.preferences?.section_order || SECTIONS;
  const style = p.preferences?.template_style || branding.template_style || 'classic';
  const customBlocks = p.preferences?.custom_blocks || [];

  // Apply live overrides to DOM
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = p.preferences?.overrides || {};
        for (const [key, val] of Object.entries(saved)) {
          const el = document.getElementById(key) || document.querySelector(`[data-testid="${key}"]`) || (val.selector ? document.querySelector(val.selector) : null);
          if (el) {
            if (val.type === 'text') {
              if (val.text !== undefined) el.innerText = val.text;
              if (val.color) el.style.color = val.color;
              if (val.fontSize) el.style.fontSize = val.fontSize;
              if (val.fontWeight) el.style.fontWeight = val.fontWeight;
              if (val.textAlign) el.style.textAlign = val.textAlign;
            } else if (val.type === 'image') {
              if (el.tagName.toLowerCase() === 'img') el.src = val.src;
              else el.style.backgroundImage = `url("${val.src}")`;
              if (val.objectFit) el.style.objectFit = val.objectFit;
              if (val.borderRadius) el.style.borderRadius = val.borderRadius;
            } else if (val.type === 'section') {
              if (val.backgroundColor) el.style.backgroundColor = val.backgroundColor;
              if (val.padding) el.style.padding = val.padding;
            }
          }
        }
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [data, p.preferences?.overrides]);

  // Apply WYSIWYG overrides to the database and local cache
  const handleApplyOverride = async (elKey, override) => {
    try {
      const currentOverrides = p.preferences?.overrides || {};
      currentOverrides[elKey] = override;
      const updatedPrefs = {
        ...p.preferences,
        overrides: currentOverrides
      };

      // 1. Always save to local storage cache immediately
      try {
        const localKey = `voyanta_proposal_${p.id}`;
        const updatedProposalObj = {
          ...p,
          preferences: updatedPrefs
        };
        localStorage.setItem(localKey, JSON.stringify(updatedProposalObj));

        // Also update proposals list cache
        const cacheKey = 'voyanta_proposals_list_cache';
        const cachedList = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        const newList = cachedList.map(item => {
          if (String(item.id) === String(p.id)) {
            return { ...item, preferences: updatedPrefs };
          }
          return item;
        });
        localStorage.setItem(cacheKey, JSON.stringify(newList));
      } catch (err) {
        console.warn('Failed to update local storage overrides:', err);
      }

      // 2. Optimistically update frontend state
      setData(prev => ({
        ...prev,
        proposal: {
          ...prev.proposal,
          preferences: updatedPrefs
        }
      }));

      // 3. Make database server call if not in demo session
      if (!isDemo && p.id) {
        await api.put(`/api/proposals/${p.id}`, {
          ...p,
          preferences: updatedPrefs
        });
        toast.success('Live view edit saved to server database!');
      } else {
        toast.success('Live view edit saved locally!');
      }
    } catch (err) {
      console.warn('Failed to save edit to server, kept local overrides:', err);
      toast.info('Live view edit saved locally (server unavailable).');
    }
  };

  // Click & hover handlers for live editor mode
  const handleWebviewClick = (e) => {
    if (!isInteractiveStudio) return;
    e.preventDefault();
    e.stopPropagation();
    let el = e.target;
    while (el && el.id !== 'webview-render-root' && el.tagName.toLowerCase() !== 'body') {
      const tag = el.tagName.toLowerCase();
      if (['h1','h2','h3','h4','h5','h6','p','span','a','li','img','section'].includes(tag) || el.classList.contains('editorial-section') || el.classList.contains('card') || el.classList.contains('glass-card')) {
        setStudioTarget(el);
        return;
      }
      el = el.parentElement;
    }
    setStudioTarget(e.target);
  };

  const handleWebviewMouseOver = (e) => {
    if (!isInteractiveStudio) return;
    const el = e.target;
    if (el && el.id !== 'webview-render-root' && el !== e.currentTarget) {
      el.style.outline = '2px dashed #3b82f6';
      el.style.outlineOffset = '2px';
    }
  };

  const handleWebviewMouseOut = (e) => {
    if (!isInteractiveStudio) return;
    const el = e.target;
    if (el && el.id !== 'webview-render-root' && el !== e.currentTarget) {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }
  };

  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!clientFullName.trim()) {
      toast.error('Please enter your full legal name.');
      return;
    }
    if (!dpdpConsent) {
      toast.error('You must check the DPDP Act 2023 consent checkbox to proceed.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post(`/api/public/proposals/${token || 'demo'}/action`, {
        action: 'Approve',
        client_name: clientFullName.trim(),
        dpdp_consent: true,
      });

      setProposalStatus('approved');
      if (res.audit_receipt) setDpdpReceipt(res.audit_receipt);

      // Sync status to local storage so CRM and Dashboard StatCards reflect approval
      syncProposalStatusToCRM(p.id, 'approved', clientFullName.trim());

      try {
        const inv = await createInvoiceFromProposal(p, branding);
        if (inv) {
          toast.success(`🎉 Client invoice #${inv.invoice_number || 'INV'} auto-created!`);
          window.dispatchEvent(new CustomEvent('voyanta:invoices-updated'));
        }
      } catch (invErr) {
        console.warn('Failed to auto-create invoice from proposal approval:', invErr);
      }

      setShowApproveModal(false);
      setShowConfetti(true);
      toast.success('Proposal approved successfully! Recorded under DPDP Act 2023.');
      setTimeout(() => setShowConfetti(false), 5000);
    } catch (err) {
      toast.error(err.message || 'Failed to submit approval.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleModifySubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post(`/api/public/proposals/${token || 'demo'}/action`, {
        action: 'Request Changes',
        client_name: p.client_name || 'Client',
        client_notes: feedbackNotes,
        modifications: modifyCategories,
      });

      setProposalStatus('changes_requested');
      syncProposalStatusToCRM(p.id, 'changes_requested');

      setShowModifyModal(false);
      toast.info('Modification request sent! The agency has been notified.');
    } catch (err) {
      toast.error(err.message || 'Failed to submit modification request.');
    } finally {
      setActionLoading(false);
    }
  };

  function syncProposalStatusToCRM(proposalId, newStatus, signerName = '') {
    try {
      const cacheKey = 'voyanta_proposals_list_cache';
      const cachedList = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      let updated = false;
      const newList = cachedList.map((item) => {
        if (String(item.id) === String(proposalId)) {
          updated = true;
          return { ...item, status: newStatus, approved_by: signerName || item.approved_by };
        }
        return item;
      });
      if (updated) {
        localStorage.setItem(cacheKey, JSON.stringify(newList));
      }

      // Sync Client Deal status in CRM cache
      const clientCacheKey = 'voyanta_clients_list_cache';
      const clientsList = JSON.parse(localStorage.getItem(clientCacheKey) || '[]');
      let clientUpdated = false;
      const crmStatus = newStatus === 'approved' ? 'Won' : (newStatus === 'changes_requested' ? 'Modification Requested' : newStatus);
      const updatedClients = clientsList.map((client) => {
        if (String(client.id) === String(p?.client_id) || (client.name && p?.client_name && client.name.toLowerCase().trim() === p.client_name.toLowerCase().trim())) {
          clientUpdated = true;
          const activity = client.activity || [];
          return {
            ...client,
            deal_status: crmStatus,
            status: crmStatus,
            activity: [
              {
                id: crypto.randomUUID(),
                type: newStatus === 'approved' ? 'deal_won' : 'modification_requested',
                description: newStatus === 'approved' ? `Proposal "${p?.name || 'Trip'}" approved by ${signerName || p?.client_name || 'Client'}` : `Modifications requested for "${p?.name || 'Trip'}"`,
                timestamp: new Date().toISOString()
              },
              ...activity
            ]
          };
        }
        return client;
      });
      if (clientUpdated) {
        localStorage.setItem(clientCacheKey, JSON.stringify(updatedClients));
      }

      // Log to Activity Logs service (Supabase DB + Local Storage)
      logActivity(
        newStatus === 'approved' ? 'approval' : 'modification',
        newStatus === 'approved'
          ? `Proposal "${p?.name || 'Trip'}" approved by ${signerName || p?.client_name || 'Client'}`
          : `Client requested modifications for "${p?.name || 'Trip'}"`,
        signerName || p?.client_name || 'Client',
        'proposal',
        p?.id || proposalId
      );

      // Trigger In-App Notification (saved to both notification keys for full compatibility)
      try {
        const newNotif = {
          id: crypto.randomUUID(),
          title: newStatus === 'approved' ? '🎉 Proposal Approved!' : '📝 Modification Requested',
          message: newStatus === 'approved'
            ? `${signerName || p?.client_name || 'Client'} approved proposal "${p?.name || 'Trip'}" and an invoice was auto-created.`
            : `${p?.client_name || 'Client'} requested modifications for "${p?.name || 'Trip'}".`,
          time: 'Just now',
          read: false,
          type: newStatus === 'approved' ? 'success' : 'warning',
          timestamp: new Date().toISOString()
        };

        const list1 = JSON.parse(localStorage.getItem('voyanta_notifications') || '[]');
        localStorage.setItem('voyanta_notifications', JSON.stringify([newNotif, ...list1]));

        const list2 = JSON.parse(localStorage.getItem('voyanta_notifications_list') || '[]');
        localStorage.setItem('voyanta_notifications_list', JSON.stringify([newNotif, ...list2]));
      } catch {}

      window.dispatchEvent(new CustomEvent('voyanta:crm-updated'));
      window.dispatchEvent(new CustomEvent('voyanta:proposals-updated'));
      window.dispatchEvent(new CustomEvent('voyanta:notifications-updated'));
      window.dispatchEvent(new CustomEvent('voyanta:activity-log-updated'));
      window.dispatchEvent(new CustomEvent('voyanta:analytics-updated'));
    } catch (e) {
      console.warn('Failed to sync CRM local cache:', e);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface font-body-md text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-4xl mb-4 text-primary">
          progress_activity
        </span>
        Loading travel proposal...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface pb-36 transition-colors duration-300">
      {/* Agent Live Editor Control Bar */}
      {isAgentView && (
        <div className="bg-primary text-on-primary py-3 px-4 flex items-center justify-between text-xs font-bold shadow-md no-print z-50 sticky top-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
            <span>Agent View: Live Proposal Web View Editor</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsInteractiveStudio(!isInteractiveStudio);
                  setStudioTarget(null);
                }}
                className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1 transition-all ${
                  isInteractiveStudio
                    ? 'bg-white text-primary border-white animate-pulse shadow-md'
                    : 'bg-primary-container text-on-primary-container border-primary-container hover:bg-primary-container/95'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">edit_document</span>
                {isInteractiveStudio ? 'Exit Editor Mode' : 'Toggle Live Editor Mode'}
              </button>
              <span className="text-[10px] text-on-primary/75 font-normal">(Click any text, image, or section to customize live)</span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowShareDropdown(!showShareDropdown)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 transition-all border-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
                Share with Client
                <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
              </button>
              {showShareDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-800 border border-outline-variant rounded-xl shadow-xl z-[999] py-2 overflow-hidden text-on-surface text-left font-sans">
                  <button
                    type="button"
                    onClick={async () => {
                      setShowShareDropdown(false);
                      markProposalSent();
                      const url = `${window.location.origin}/view/${p.share_token || 'demo'}?mode=client`;
                      await navigator.clipboard.writeText(url);
                      toast.success('🌐 Client proposal link copied!');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer font-bold text-xs text-on-surface"
                  >
                    <span className="material-symbols-outlined text-primary text-[18px]">content_copy</span>
                    Copy Client Link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowShareDropdown(false);
                      markProposalSent();
                      const url = `${window.location.origin}/view/${p.share_token || 'demo'}?mode=client`;
                      const msg = `Hi! Here is the travel proposal for ${p.name || 'your trip'}. View and approve it here: ${url}`;
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer font-bold text-xs text-on-surface"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" className="text-[#25D366] shrink-0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    Share via WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowShareDropdown(false);
                      markProposalSent();
                      const url = `${window.location.origin}/view/${p.share_token || 'demo'}?mode=client`;
                      const subject = `Travel Proposal: ${p.name || 'Your Trip'}`;
                      const body = `Hi! Here is the travel proposal for ${p.name || 'your trip'}. View and approve it here: ${url}`;
                      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer font-bold text-xs text-on-surface"
                  >
                    <span className="material-symbols-outlined text-blue-500 text-[18px]">mail</span>
                    Share via Email
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confetti Celebration Banner */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[100] flex items-start justify-center overflow-hidden">
          <div className="absolute top-10 bg-emerald-600 text-white font-bold px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
            <span className="material-symbols-outlined text-2xl">verified</span>
            Proposal Approved! DPDP Compliance Audit Recorded.
          </div>
        </div>
      )}

      {/* TOP HEADER NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-surface/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-outline-variant/60 dark:border-slate-800 px-4 py-3 shadow-xs transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Agency Branding */}
          <div className="flex items-center gap-3">
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt="Agency Logo"
                className="h-10 w-auto object-contain"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary font-display font-bold text-lg shadow-sm">
                {(branding.company_name || p.name || 'V').charAt(0)}
              </div>
            )}
            <div>
              <div className="font-bold text-base md:text-lg tracking-tight text-slate-900 dark:text-slate-100">
                {branding.company_name || 'Voyanta Luxury Travel'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {getUIText(lang, 'preparedFor')} <span className="font-semibold text-slate-800 dark:text-slate-200">{p.client_name || 'Valued Guest'}</span>
              </div>
            </div>
          </div>

          {/* Controls: Theme Toggle & Show Pricing */}
          <div className="flex items-center gap-3 animate-fade-in">
            {/* Pricing Toggle - only shown when visibility mode is ITEMIZED */}
            {visibilityMode === 'ITEMIZED' && (
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none bg-surface-container-low dark:bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-outline-variant/60 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-xs">
                <input
                  type="checkbox"
                  checked={showPricing}
                  onChange={(e) => setShowPricing(e.target.checked)}
                  className="rounded border-outline text-primary focus:ring-primary h-3.5 w-3.5"
                />
                {getUIText(lang, 'showPricing')}
              </label>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="w-9.5 h-9.5 rounded-full bg-surface-container-low dark:bg-slate-800/80 flex items-center justify-center text-slate-800 dark:text-slate-200 hover:bg-surface-container-high border border-outline-variant/60 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Toggle Dark/Light Theme"
            >
              <span className="material-symbols-outlined text-lg">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Demo Banner */}
      {isDemo && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs py-2 px-4 text-center font-medium">
          {getUIText(lang, 'demoBanner')}
        </div>
      )}

      {/* HERO SECTION WITH CAROUSEL */}
      <section 
        className="relative h-72 md:h-[420px] w-full overflow-hidden"
        onClick={handleWebviewClick}
        onMouseOver={handleWebviewMouseOver}
        onMouseOut={handleWebviewMouseOut}
      >
        <MediaCarousel
          images={
            (Array.isArray(p.heroImages) && p.heroImages.length > 0 ? p.heroImages : null) ||
            (branding.cover_image_url ? [branding.cover_image_url] : null) ||
            (p.cover_image_url ? [p.cover_image_url] : null) ||
            (daysList.length > 0 && (daysList[0].images?.[0] || daysList[0].image_url) ? [daysList[0].images?.[0] || daysList[0].image_url] : null) || [
              'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200&q=80',
              'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80',
            ]
          }
          autoPlay={true}
          interval={5000}
          className="w-full h-full"
        />

        {/* Hero Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex flex-col justify-end p-6 md:p-12 pointer-events-none">
          <div className="max-w-7xl mx-auto w-full">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-semibold mb-3 border border-white/20">
              <span className="material-symbols-outlined text-sm">flight_takeoff</span>
              {translateText(p.destination || branding.destination || 'Destination', lang)} • {p.travelers || p.brief?.num_adults || 2} {getUIText(lang, 'travelers')}
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-extrabold text-white tracking-tight drop-shadow-md">
              {p.name || p.client_name || 'Travel Proposal'}
            </h1>
          </div>
        </div>
      </section>

      {/* MAIN TWO-COLUMN BENTO GRID */}
      <main 
        id="webview-render-root"
        className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8"
        onClick={handleWebviewClick}
        onMouseOver={handleWebviewMouseOver}
        onMouseOut={handleWebviewMouseOut}
      >
        {/* LEFT COLUMN: ALL CONFIGURED SECTIONS (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Trip Brief / Executive Summary */}
          {include.brief && p.brief && Object.keys(p.brief).length > 0 && (
            <div id="brief-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4">
              <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">summarize</span>
                Trip Overview & Executive Summary
              </h2>
              <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {typeof p.brief === 'string' ? p.brief : (p.brief.summary || p.brief.description || JSON.stringify(p.brief, null, 2))}
              </div>
            </div>
          )}

          {/* Destination Knowledge */}
          {include.destination_knowledge !== false && (p.destination_knowledge || p.preferences?.destination_knowledge) && (
            <div id="destination-knowledge-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4">
              <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">travel_explore</span>
                Destination Guide & Climate Insights
              </h2>
              <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {typeof (p.destination_knowledge || p.preferences?.destination_knowledge) === 'string'
                  ? (p.destination_knowledge || p.preferences?.destination_knowledge)
                  : JSON.stringify(p.destination_knowledge || p.preferences?.destination_knowledge, null, 2)}
              </div>
            </div>
          )}

          {/* Highlights Section */}
          {include.highlights && p.highlights && (
            <div id="highlights-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4">
              <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
                Highlights
              </h2>
              <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{p.highlights}</div>
            </div>
          )}

          {/* ITINERARY OVERVIEW */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">calendar_month</span>
                {getUIText(lang, 'itineraryOverview')}
              </h2>
              <button
                onClick={() => setAllExpanded(!allExpanded)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant no-print"
              >
                <span className="material-symbols-outlined text-sm">
                  {allExpanded ? 'unfold_less' : 'unfold_more'}
                </span>
                {allExpanded ? getUIText(lang, 'collapseAll') : getUIText(lang, 'expandAll')}
              </button>
            </div>

            {/* Collapsible Accordions */}
            <div className="space-y-4">
              {daysList.map((day, idx) => (
                <ItineraryDayAccordionCard
                  key={idx}
                  day={day}
                  dayNumber={idx + 1}
                  lang={lang}
                  defaultExpanded={allExpanded}
                  onActivityClick={handleActivityClick}
                />
              ))}
            </div>
          </div>

          {/* INCLUDED ITEMS (Hotels, Flights, Transits) */}
          {include.hotels && items && items.length > 0 && (
            <div className="space-y-4 pt-4">
              <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">hotel_class</span>
                {getUIText(lang, 'includedInTrip')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    lang={lang}
                    showPricing={showPricing}
                    currency={data?.totals?.currency || 'INR'}
                    visibilityMode={visibilityMode}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inclusions & Exclusions */}
          {((include.inclusions && p.inclusions) || (include.exclusions && p.exclusions)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {include.inclusions && p.inclusions && (
                <div id="inclusions-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4">
                  <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <span className="material-symbols-outlined">check_circle</span>
                    Inclusions
                  </h3>
                  <ul className="space-y-2.5 text-sm text-on-surface-variant">
                    {p.inclusions.split('\n').map((item, i) => {
                      const clean = item.replace(/^[-•*+]\s*/, '').trim();
                      return clean ? (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-emerald-500 text-base mt-0.5 shrink-0">check_circle</span>
                          <span className="leading-relaxed">{clean}</span>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              )}
              {include.exclusions && p.exclusions && (
                <div id="exclusions-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4">
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                    <span className="material-symbols-outlined">cancel</span>
                    Exclusions
                  </h3>
                  <ul className="space-y-2.5 text-sm text-on-surface-variant">
                    {p.exclusions.split('\n').map((item, i) => {
                      const clean = item.replace(/^[-•*+]\s*/, '').trim();
                      return clean ? (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-rose-500 text-base mt-0.5 shrink-0">cancel</span>
                          <span className="leading-relaxed">{clean}</span>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* What to Pack Section */}
          {include.what_to_pack !== false && (p.what_to_pack || p.preferences?.what_to_pack || p.packing_guidelines) && (
            <div id="what-to-pack-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4 pt-4">
              <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">backpack</span>
                What to Pack & Packing Guidelines
              </h3>
              <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {typeof (p.what_to_pack || p.preferences?.what_to_pack || p.packing_guidelines) === 'string'
                  ? (p.what_to_pack || p.preferences?.what_to_pack || p.packing_guidelines)
                  : JSON.stringify(p.what_to_pack || p.preferences?.what_to_pack || p.packing_guidelines, null, 2)}
              </div>
            </div>
          )}

          {/* Important Notes Section */}
          {include.important_notes !== false && (p.important_notes || p.preferences?.important_notes) && (
            <div id="important-notes-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4 pt-4">
              <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">notification_important</span>
                Important Notes & Advisories
              </h3>
              <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {typeof (p.important_notes || p.preferences?.important_notes) === 'string'
                  ? (p.important_notes || p.preferences?.important_notes)
                  : JSON.stringify(p.important_notes || p.preferences?.important_notes, null, 2)}
              </div>
            </div>
          )}

          {/* Visa & Documentation Guidelines Section */}
          {include.visa_guidelines !== false && (p.visa_guidelines || p.preferences?.visa_guidelines) && (
            <div id="visa-guidelines-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4 pt-4">
              <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">badge</span>
                Visa & Travel Documentation
              </h3>
              <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {typeof (p.visa_guidelines || p.preferences?.visa_guidelines) === 'string'
                  ? (p.visa_guidelines || p.preferences?.visa_guidelines)
                  : JSON.stringify(p.visa_guidelines || p.preferences?.visa_guidelines, null, 2)}
              </div>
            </div>
          )}

          {/* Photo Gallery Section */}
          {include.gallery !== false && (p.gallery || p.preferences?.gallery) && Array.isArray(p.gallery || p.preferences?.gallery) && (p.gallery || p.preferences?.gallery).length > 0 && (
            <div id="gallery-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4 pt-4">
              <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">photo_library</span>
                Trip Photo Gallery
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(p.gallery || p.preferences?.gallery).map((img, i) => (
                  <div key={i} className="aspect-video rounded-xl overflow-hidden border border-outline-variant shadow-xs">
                    <img src={typeof img === 'string' ? img : img.url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Blocks */}
          {customBlocks && customBlocks.length > 0 && (
            <div className="space-y-6 pt-4">
              {customBlocks.map((cb) => {
                if (!include[cb.id]) return null;
                const contentVal = cb.content || '';
                return (
                  <div key={cb.id} id={cb.id} className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4">
                    <h3 className="text-xl font-display font-bold text-on-surface">{cb.label}</h3>
                    {cb.type === 'text' ? (
                      <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{contentVal}</div>
                    ) : cb.type === 'list' ? (
                      <ul className="space-y-2 text-sm text-on-surface-variant pl-4 list-disc">
                        {contentVal.split('\n').map((item, i) => item.trim() && <li key={i}>{item}</li>)}
                      </ul>
                    ) : cb.type === 'image' && contentVal ? (
                      <img src={contentVal} className="w-full max-h-96 object-cover rounded-xl" alt={cb.label} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Terms of Payment */}
          {(p.terms_of_payment || p.preferences?.branding?.terms_of_payment || branding?.terms_of_payment) && (
            <div id="payment-terms-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4 pt-4">
              <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">payments</span>
                Terms of Payment
              </h3>
              <ul className="space-y-2.5 text-sm text-on-surface-variant">
                {(p.terms_of_payment || p.preferences?.branding?.terms_of_payment || branding?.terms_of_payment).split('\n').map((item, i) => {
                  const clean = item.replace(/^[-•*+]\s*/, '').trim();
                  return clean ? (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5 shrink-0">check_circle</span>
                      <span className="leading-relaxed">{clean}</span>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          )}

          {/* Terms & Conditions */}
          {include.terms && p.terms && (
            <div id="terms-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4 pt-4">
              <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">gavel</span>
                Terms & Conditions
              </h3>
              <ul className="space-y-2.5 text-sm text-on-surface-variant">
                {p.terms.split('\n').map((item, i) => {
                  const clean = item.replace(/^[-•*+]\s*/, '').trim();
                  return clean ? (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-primary/70 text-base mt-0.5 shrink-0">arrow_right</span>
                      <span className="leading-relaxed">{clean}</span>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          )}

          {/* Dynamically Extracted / Custom Extra Sections (What to Pack, Visa Info, Important Notes, etc.) */}
          {p.extra_sections && Object.entries(p.extra_sections).length > 0 && (
            <div className="space-y-6 pt-4">
              {Object.entries(p.extra_sections).map(([secKey, secContent]) => {
                if (!secContent) return null;
                const formattedTitle = secKey
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase());
                return (
                  <div key={secKey} className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4">
                    <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">menu_book</span>
                      {formattedTitle}
                    </h3>
                    <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                      {typeof secContent === 'string' ? secContent : JSON.stringify(secContent, null, 2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom Agency Branding Fields */}
          {Array.isArray(branding.custom_fields) && branding.custom_fields.length > 0 && (
            <div className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4 pt-4">
              <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">feed</span>
                Additional Information & Agency Terms
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {branding.custom_fields.map((cf, idx) => (
                  <div key={idx} className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary block">{cf.label}</span>
                    <span className="text-on-surface-variant leading-relaxed whitespace-pre-wrap">{cf.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact Details & Socials */}
          {include.contacts && (branding.email || branding.phone || branding.address) && (
            <div id="contacts-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4 pt-4">
              <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">contact_support</span>
                Contact Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {branding.email && (
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-primary text-base">mail</span>
                    <a href={`mailto:${branding.email}`} className="hover:underline">{branding.email}</a>
                  </div>
                )}
                {branding.phone && (
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-primary text-base">call</span>
                    <a href={`tel:${branding.phone}`} className="hover:underline">{branding.phone}</a>
                  </div>
                )}
                {branding.address && (
                  <div className="flex items-center gap-2 text-on-surface-variant sm:col-span-2">
                    <span className="material-symbols-outlined text-primary text-base">location_on</span>
                    <span>{branding.address}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Social Links */}
          {include.socials && (branding.social_instagram || branding.social_facebook || branding.social_linkedin) && (
            <div id="socials-sec" className="flex justify-center gap-6 py-6 border-t border-outline-variant/40">
              {branding.social_instagram && (
                <a href={branding.social_instagram} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  Instagram
                </a>
              )}
              {branding.social_facebook && (
                <a href={branding.social_facebook} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  Facebook
                </a>
              )}
              {branding.social_linkedin && (
                <a href={branding.social_linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  LinkedIn
                </a>
              )}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN SIDEBAR: WEATHER, MAP & PRICING SUMMARY (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* WEATHER WIDGET */}
          <WeatherWidget
            destination={p.destination || branding.destination || 'Destination'}
            lang={lang}
          />

          {/* LIVE MAP WIDGET */}
          <MapWidget
            destination={p.destination || branding.destination || 'Destination'}
            lang={lang}
          />

          {/* COST BREAKDOWN CARD */}
          {showPricing && visibilityMode !== 'HIDDEN' && (
            <div className="glass-card rounded-2xl p-6 border border-outline-variant shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                <span className="font-display font-bold text-lg text-on-surface">
                  {getUIText(lang, 'totalCost')}
                </span>
                <span className="material-symbols-outlined text-primary">payments</span>
              </div>

              <div className="flex justify-between items-end pt-2">
                <span className="text-sm text-on-surface-variant font-medium">
                  {getUIText(lang, 'subtotal')}
                </span>
                <span className="text-3xl font-display font-extrabold text-primary">
                  {formatPrice(data?.totals?.subtotal || 0, data?.totals?.currency || 'INR')}
                </span>
              </div>

              {!isAgentView && proposalStatus === 'pending' && (
                <div className="pt-4 border-t border-outline-variant/60 flex flex-col gap-2.5">
                  <button
                    onClick={() => setShowApproveModal(true)}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">verified</span>
                    {getUIText(lang, 'approveProposal')}
                  </button>
                  <button
                    onClick={() => setShowModifyModal(true)}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl border border-outline font-semibold text-sm text-on-surface hover:bg-surface-container transition-all"
                  >
                    {getUIText(lang, 'requestChanges')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DPDP Compliance Audit Receipt card if approved */}
          {dpdpReceipt && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs space-y-2 text-emerald-800 dark:text-emerald-300">
              <div className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">verified_user</span>
                DPDP Act 2023 Compliance Recorded
              </div>
              <div>Audit Receipt ID: <span className="font-mono">{dpdpReceipt.audit_id}</span></div>
              <div>Timestamp: <span className="font-mono">{dpdpReceipt.recorded_at}</span></div>
            </div>
          )}
        </div>
      </main>

      {/* STICKY CLIENT ACTIONS BAR WITH INDIAN LANGUAGE TRANSLATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-outline-variant p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] z-50 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">shield_lock</span>
            <span className="text-xs font-medium text-on-surface-variant hidden sm:inline">
              Secured under DPDP Act 2023 Compliance
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Google Translate programmatic select dropdown restricted to Indian languages */}
            <div className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full border border-outline-variant shadow-xs">
              <span className="material-symbols-outlined text-primary text-[18px]">translate</span>
              <select
                value={lang}
                onChange={(e) => {
                  const newLang = e.target.value;
                  setLang(newLang);
                  
                  // Trigger Google Translate programmatically
                  const googleSelect = document.querySelector('.goog-te-combo');
                  if (googleSelect) {
                    googleSelect.value = newLang;
                    googleSelect.dispatchEvent(new Event('change'));
                  }
                }}
                className="bg-transparent border-none text-xs font-bold text-on-surface focus:outline-none cursor-pointer"
              >
                {INDIAN_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-surface text-on-surface">
                    {l.native}
                  </option>
                ))}
              </select>
            </div>

            {isAgentView ? (
              <div className="bg-primary/10 border border-primary/20 text-primary px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 no-print">
                <span className="material-symbols-outlined text-base">info</span>
                Viewing as Agent
              </div>
            ) : proposalStatus === 'approved' ? (
              <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base">check_circle</span>
                {getUIText(lang, 'approvedStatus')}
              </div>
            ) : proposalStatus === 'changes_requested' ? (
              <div className="bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base">pending_actions</span>
                {getUIText(lang, 'changesRequestedStatus')}
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowModifyModal(true)}
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-full border border-outline font-semibold text-sm text-on-surface hover:bg-surface-container transition-all"
                >
                  {getUIText(lang, 'requestChanges')}
                </button>
                <button
                  onClick={() => setShowApproveModal(true)}
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">verified</span>
                  {getUIText(lang, 'approveProposal')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* POPUP STUDIO POPOVER FOR AGENT WEB VIEW EDITING */}
      {isInteractiveStudio && studioTarget && (
        <InlineStudioPopover 
          target={studioTarget} 
          onClose={() => setStudioTarget(null)} 
          branding={branding} 
          setBranding={async (fnOrVal) => {
            const next = typeof fnOrVal === 'function' ? fnOrVal(branding) : fnOrVal;
            const updatedPrefs = {
              ...p.preferences,
              branding: next
            };
            
            // 1. Always save to local storage cache
            try {
              const localKey = `voyanta_proposal_${p.id}`;
              const updatedProposalObj = {
                ...p,
                preferences: updatedPrefs
              };
              localStorage.setItem(localKey, JSON.stringify(updatedProposalObj));

              const cacheKey = 'voyanta_proposals_list_cache';
              const cachedList = JSON.parse(localStorage.getItem(cacheKey) || '[]');
              const newList = cachedList.map(item => {
                if (String(item.id) === String(p.id)) {
                  return { ...item, preferences: updatedPrefs };
                }
                return item;
              });
              localStorage.setItem(cacheKey, JSON.stringify(newList));
            } catch (err) {
              console.warn('Failed to update local storage branding:', err);
            }

            // 2. Update frontend state
            setData(prev => ({
              ...prev,
              proposal: {
                ...prev.proposal,
                preferences: updatedPrefs
              }
            }));

            // 3. Make database server call if not in demo session
            try {
              if (!isDemo && p.id) {
                await api.put(`/api/proposals/${p.id}`, {
                  ...p,
                  preferences: updatedPrefs
                });
                toast.success('Branding update saved to database!');
              } else {
                toast.success('Branding update saved locally!');
              }
            } catch (err) {
              console.warn('Failed to save branding to database, kept local copy:', err);
              toast.info('Branding saved locally (server unavailable).');
            }
          }}
          onApplyOverride={handleApplyOverride}
        />
      )}

      {/* MODAL 1: DPDP ACT COMPLIANT APPROVAL MODAL */}
      <AnimatePresence>
        {showApproveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
                  <h3 className="text-xl font-display font-bold text-on-surface">
                    {getUIText(lang, 'approveModalTitle')}
                  </h3>
                </div>
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="p-1 rounded-full text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleApproveSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                    {getUIText(lang, 'fullNameLabel')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientFullName}
                    onChange={(e) => setClientFullName(e.target.value)}
                    placeholder={getUIText(lang, 'fullNamePlaceholder')}
                    className="w-full rounded-xl border border-outline bg-surface-container px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* DPDP Consent Checkbox */}
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-surface-variant/40 border border-outline-variant/60 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={dpdpConsent}
                    onChange={(e) => setDpdpConsent(e.target.checked)}
                    className="mt-1 rounded border-outline text-primary focus:ring-primary h-4 w-4"
                  />
                  <span className="text-xs text-on-surface leading-relaxed">
                    {getUIText(lang, 'dpdpConsentLabel')}
                  </span>
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowApproveModal(false)}
                    className="px-5 py-2.5 rounded-full border border-outline text-xs font-semibold hover:bg-surface-container"
                  >
                    {getUIText(lang, 'cancelBtn')}
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-xs shadow-md hover:shadow-lg transition-all"
                  >
                    {actionLoading ? getUIText(lang, 'processing') : getUIText(lang, 'confirmApproveBtn')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 2: REQUEST CHANGES MODAL */}
      <AnimatePresence>
        {showModifyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-2xl">edit_note</span>
                  <h3 className="text-xl font-display font-bold text-on-surface">
                    {getUIText(lang, 'modifyModalTitle')}
                  </h3>
                </div>
                <button
                  onClick={() => setShowModifyModal(false)}
                  className="p-1 rounded-full text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleModifySubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wider">
                    {getUIText(lang, 'modifyCategoriesLabel')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container border border-outline-variant/60 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modifyCategories.hotels}
                        onChange={(e) =>
                          setModifyCategories({ ...modifyCategories, hotels: e.target.checked })
                        }
                        className="rounded text-primary focus:ring-primary"
                      />
                      {getUIText(lang, 'modifyCategoryHotels')}
                    </label>
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container border border-outline-variant/60 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modifyCategories.flights}
                        onChange={(e) =>
                          setModifyCategories({ ...modifyCategories, flights: e.target.checked })
                        }
                        className="rounded text-primary focus:ring-primary"
                      />
                      {getUIText(lang, 'modifyCategoryFlights')}
                    </label>
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container border border-outline-variant/60 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modifyCategories.dates}
                        onChange={(e) =>
                          setModifyCategories({ ...modifyCategories, dates: e.target.checked })
                        }
                        className="rounded text-primary focus:ring-primary"
                      />
                      {getUIText(lang, 'modifyCategoryDates')}
                    </label>
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container border border-outline-variant/60 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modifyCategories.budget}
                        onChange={(e) =>
                          setModifyCategories({ ...modifyCategories, budget: e.target.checked })
                        }
                        className="rounded text-primary focus:ring-primary"
                      />
                      {getUIText(lang, 'modifyCategoryBudget')}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                    {getUIText(lang, 'feedbackNotesLabel')}
                  </label>
                  <textarea
                    rows={4}
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    placeholder={getUIText(lang, 'feedbackNotesPlaceholder')}
                    className="w-full rounded-xl border border-outline bg-surface-container p-3 text-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModifyModal(false)}
                    className="px-5 py-2.5 rounded-full border border-outline text-xs font-semibold hover:bg-surface-container"
                  >
                    {getUIText(lang, 'cancelBtn')}
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all"
                  >
                    {actionLoading ? getUIText(lang, 'processing') : getUIText(lang, 'submitChangesBtn')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACTIVITY DETAIL & IMAGE CAROUSEL WINDOW MODAL */}
      <AnimatePresence>
        {selectedActivityBlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 no-print"
            onClick={() => setSelectedActivityBlock(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Media Carousel */}
              <div className="h-64 w-full relative bg-zinc-900 flex-shrink-0">
                <MediaCarousel
                  images={
                    selectedActivityBlock.data?.image_url
                      ? [selectedActivityBlock.data.image_url]
                      : ['https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200&q=80']
                  }
                  autoPlay={false}
                  className="w-full h-full"
                />
                <button
                  onClick={() => setSelectedActivityBlock(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/85 transition-colors border-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              {/* Detail Content */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded uppercase tracking-wider">
                    {selectedActivityBlock.type}
                  </span>
                  {selectedActivityBlock.data?.duration && (
                    <span className="text-xs text-on-surface-variant font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      {selectedActivityBlock.data.duration}
                    </span>
                  )}
                </div>

                <h3 className="font-display font-bold text-xl md:text-2xl text-on-surface">
                  {selectedActivityBlock.data?.name || 'Activity details'}
                </h3>

                {selectedActivityBlock.data?.location && (
                  <p className="text-xs text-on-surface-variant font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
                    {selectedActivityBlock.data.location}
                  </p>
                )}

                <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                  {selectedActivityBlock.data?.description || 'No detailed description available.'}
                </div>

                {/* Agent Edit Tools */}
                {user && isInteractiveStudio && (
                  <div className="pt-4 border-t border-outline-variant/60 flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() => setShowStockPicker(true)}
                      className="px-4 py-2 rounded-full bg-primary text-on-primary font-bold text-xs shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 border-none cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                      Add / Edit Image
                    </button>
                    {selectedActivityBlock.data?.image_url && (
                      <button
                        onClick={() => updateActivityImage(selectedActivityDayIdx, selectedActivityBlock.id, '')}
                        className="px-4 py-2 rounded-full bg-red-50 text-red-600 border border-red-200 font-bold text-xs hover:bg-red-100 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Remove Image
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STOCK IMAGE PICKER DIALOG */}
      {showStockPicker && (
        <ImageSearchPicker
          defaultQuery={selectedActivityBlock?.data?.name || ''}
          onSelect={(photo) => {
            if (selectedActivityBlock && selectedActivityDayIdx !== null) {
              updateActivityImage(selectedActivityDayIdx, selectedActivityBlock.id, photo.url);
              setSelectedActivityBlock(prev => ({
                ...prev,
                data: {
                  ...prev.data,
                  image_url: photo.url
                }
              }));
            }
            setShowStockPicker(false);
          }}
          onClose={() => setShowStockPicker(false)}
        />
      )}
    </div>
  );
}

// Subcomponent: Collapsible Itinerary Day Accordion Card
function ItineraryDayAccordionCard({ day, dayNumber, lang, defaultExpanded }) {
  const [open, setOpen] = useState(defaultExpanded);

  useEffect(() => {
    setOpen(defaultExpanded);
  }, [defaultExpanded]);

  return (
    <div className="border border-outline-variant rounded-2xl overflow-hidden bg-surface transition-all shadow-xs hover:shadow-sm">
      {/* Accordion Header (Always visible) */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-surface-container-low transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm shrink-0">
            {getUIText(lang, 'dayBadge')} {dayNumber}
          </div>
          <div>
            <h3 className="font-display font-bold text-base md:text-lg text-on-surface leading-tight">
              {day.title || `Day ${dayNumber}`}
            </h3>
          </div>
        </div>
        <span
          className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Collapsible Body */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 text-sm text-on-surface-variant leading-relaxed border-t border-outline-variant/40 space-y-4">
              <p>{day.description || 'No description provided.'}</p>

              {/* Day Block Image Carousel */}
              {(() => {
                const dayImages = Array.isArray(day.images) && day.images.length > 0
                  ? day.images
                  : (Array.isArray(day.photos) && day.photos.length > 0
                    ? day.photos
                    : (day.image_url ? [day.image_url] : []));
                if (dayImages.length === 0) return null;
                return (
                  <div className="h-52 md:h-64 rounded-xl overflow-hidden border border-outline-variant/60 shadow-xs">
                    <MediaCarousel
                      images={dayImages}
                      autoPlay={dayImages.length > 1}
                      interval={4500}
                      className="w-full h-full"
                    />
                  </div>
                );
              })()}

              {/* Render Day Content Blocks */}
              {Array.isArray(day.content) && day.content.length > 0 && (
                <div className="space-y-4 pt-2">
                  {day.content.map(block => {
                    if (block.type === 'heading') {
                      return <h4 key={block.id} className="text-base font-bold text-on-surface mt-4">{block.data?.text}</h4>;
                    }
                    if (block.type === 'text') {
                      return <p key={block.id} className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{block.data?.text}</p>;
                    }
                    if (block.type === 'image' && block.data?.url) {
                      return <img key={block.id} src={block.data.url} alt="" className="rounded-xl w-full max-h-72 object-cover my-2 shadow-xs border border-outline-variant/30" />;
                    }
                    if (block.type === 'gallery' && block.data?.urls) {
                      const urls = block.data.urls.split('\n').map(u => u.trim()).filter(Boolean);
                      if (urls.length === 0) return null;
                      return (
                        <div key={block.id} className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-2">
                          {urls.map((u, idx) => (
                            <img key={idx} src={u} alt="" className="rounded-lg aspect-[4/3] object-cover shadow-xs border border-outline-variant/30" />
                          ))}
                        </div>
                      );
                    }
                    if (['hotel', 'activity', 'flight', 'transfer', 'meal', 'meals', 'cruise', 'destination', 'custom'].includes(block.type)) {
                      const isActivity = block.type === 'activity';
                      const blockImages = Array.isArray(block.data?.images) && block.data.images.length > 0
                        ? block.data.images
                        : (Array.isArray(block.data?.photos) && block.data.photos.length > 0
                          ? block.data.photos
                          : (block.data?.image_url || block.data?.cover_image ? [block.data?.image_url || block.data?.cover_image] : []));
                      return (
                        <div 
                          key={block.id} 
                          onClick={() => { if (isActivity && onActivityClick) onActivityClick(block, dayNumber - 1); }}
                          className={`flex items-stretch gap-4 p-4 rounded-xl my-2 border border-outline-variant/60 bg-surface-container-low shadow-xs ${isActivity ? 'cursor-pointer hover:border-primary hover:shadow-md hover:scale-[1.005] transition-all group' : ''}`}
                        >
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                                {block.type}
                              </span>
                            </div>
                            <h4 className={`text-sm font-bold text-on-surface ${isActivity ? 'group-hover:text-primary transition-colors' : ''}`}>
                              {block.data?.name || block.data?.venue || 'Untitled element'}
                            </h4>
                            {block.data?.details && <p className="text-xs text-on-surface-variant mt-0.5">{block.data.details}</p>}
                            {block.data?.description && <p className="text-xs text-on-surface-variant/80 mt-1 line-clamp-2">{block.data.description}</p>}
                          </div>
                          {blockImages.length > 0 && (
                            <div className="w-24 md:w-32 flex-shrink-0 rounded-lg overflow-hidden border border-outline-variant/40 flex relative">
                              {blockImages.length > 1 ? (
                                <MediaCarousel images={blockImages} autoPlay={true} interval={4000} className="w-full h-full" />
                              ) : (
                                <img src={blockImages[0]} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponent: Included Hotel / Flight Item Card
function ItemCard({ item, lang, showPricing, currency, visibilityMode = 'ITEMIZED' }) {
  const isHotel = (item.kind || '').toLowerCase() === 'hotel';
  const showItemRate = showPricing && (visibilityMode || 'ITEMIZED').toUpperCase() === 'ITEMIZED';

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-outline-variant shadow-xs flex flex-col justify-between">
      {/* Media Carousel for Hotel or single image banner */}
      <div className="h-44 w-full relative overflow-hidden bg-surface-variant">
        <MediaCarousel
          images={
            item.images || [
              'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
            ]
          }
          autoPlay={isHotel}
          interval={4000}
          className="w-full h-full"
        />
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
          {item.kind || 'Included'}
        </div>
      </div>

      <div className="p-4 flex flex-col justify-between flex-1">
        <div>
          <h3 className="font-display font-bold text-base text-on-surface mb-1">
            {item.name}
          </h3>
          <p className="text-xs text-on-surface-variant">
            {item.qty || 1} {isHotel ? 'Nights' : 'Unit(s)'} included
          </p>
        </div>

        {showItemRate && (
          <div className="mt-4 pt-3 border-t border-outline-variant/40 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium">Estimated Price</span>
            <span className="font-bold text-primary text-base">
              {formatPrice((item.qty || 1) * (item.unit_price || 0), currency)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
