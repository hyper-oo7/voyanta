import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSharedProposalByToken } from '../services/proposalItemService.js';
import { api } from '../services/api.js';
import { formatPrice } from '../lib/currency.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
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

const INDIAN_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', label: 'Marathi', native: 'मਰਾਠੀ' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' }
];

export default function WebViewPage() {
  const { token } = useParams();
  const { user } = useAuth();
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
  const branding = p.preferences?.branding || {};
  const daysList = p.trip_details?.days || [];

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

  // Apply WYSIWYG overrides to the database
  const handleApplyOverride = async (elKey, override) => {
    try {
      const currentOverrides = p.preferences?.overrides || {};
      currentOverrides[elKey] = override;
      const updatedPrefs = {
        ...p.preferences,
        overrides: currentOverrides
      };

      await api.put(`/api/proposals/${p.id}`, {
        ...p,
        preferences: updatedPrefs
      });

      setData(prev => ({
        ...prev,
        proposal: {
          ...prev.proposal,
          preferences: updatedPrefs
        }
      }));
      toast.success('Live view edit saved to database!');
    } catch (err) {
      toast.error('Failed to save edit.');
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
      {user && (
        <div className="bg-primary text-on-primary py-3 px-4 flex items-center justify-between text-xs font-bold shadow-md no-print z-50 sticky top-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
            <span>Agent View: Live Proposal Web View Editor</span>
          </div>
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
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant px-4 py-3 shadow-xs">
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
              <div className="font-bold text-base md:text-lg tracking-tight">
                {branding.company_name || 'Voyanta Luxury Travel'}
              </div>
              <div className="text-xs text-on-surface-variant">
                {getUIText(lang, 'preparedFor')} <span className="font-semibold text-on-surface">{p.client_name || 'Valued Guest'}</span>
              </div>
            </div>
          </div>

          {/* Controls: Theme Toggle & Show Pricing */}
          <div className="flex items-center gap-3 animate-fade-in">
            {/* Pricing Toggle */}
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant">
              <input
                type="checkbox"
                checked={showPricing}
                onChange={(e) => setShowPricing(e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary h-3.5 w-3.5"
              />
              {getUIText(lang, 'showPricing')}
            </label>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high border border-outline-variant transition-colors"
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
            p.heroImages || [
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
              {translateText(p.destination || 'Jaipur & Udaipur', lang)} • {p.travelers || 2} {getUIText(lang, 'travelers')}
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-extrabold text-white tracking-tight drop-shadow-md">
              {p.name || 'Royal Rajasthan Heritage Tour'}
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
                  <ul className="space-y-2 text-sm text-on-surface-variant pl-4 list-disc">
                    {p.inclusions.split('\n').map((item, i) => item.trim() && <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}
              {include.exclusions && p.exclusions && (
                <div id="exclusions-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-4">
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                    <span className="material-symbols-outlined">cancel</span>
                    Exclusions
                  </h3>
                  <ul className="space-y-2 text-sm text-on-surface-variant pl-4 list-disc">
                    {p.exclusions.split('\n').map((item, i) => item.trim() && <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}
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

          {/* Terms & Conditions */}
          {include.terms && p.terms && (
            <div id="terms-sec" className="glass-card rounded-2xl p-6 border border-outline-variant shadow-xs space-y-3 pt-4">
              <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">gavel</span>
                Terms & Conditions
              </h3>
              <div className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap">{p.terms}</div>
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
            destination={p.destination || 'Jaipur'}
            lang={lang}
          />

          {/* LIVE MAP WIDGET */}
          <MapWidget
            destination={p.destination || 'Jaipur'}
            lang={lang}
          />

          {/* COST BREAKDOWN CARD */}
          {showPricing && (
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
      <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-outline-variant p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">shield_lock</span>
            <span className="text-xs text-on-surface-variant hidden sm:inline">
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

            {proposalStatus === 'approved' ? (
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
            try {
              await api.put(`/api/proposals/${p.id}`, {
                ...p,
                preferences: updatedPrefs
              });
              setData(prev => ({
                ...prev,
                proposal: {
                  ...prev.proposal,
                  preferences: updatedPrefs
                }
              }));
              toast.success('Branding update saved to database!');
            } catch (err) {
              toast.error('Failed to update branding.');
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
              {Array.isArray(day.images) && day.images.length > 0 && (
                <div className="h-52 md:h-64 rounded-xl overflow-hidden border border-outline-variant/60 shadow-xs">
                  <MediaCarousel
                    images={day.images}
                    autoPlay={false}
                    className="w-full h-full"
                  />
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
function ItemCard({ item, lang, showPricing, currency }) {
  const isHotel = (item.kind || '').toLowerCase() === 'hotel';

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

        {showPricing && (
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
