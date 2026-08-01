import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useProposalStore } from '../store/proposalStore.js';
import QuickIntakeModal from '../components/canvas/QuickIntakeModal.jsx';
import TemplateGalleryModal from '../components/canvas/TemplateGalleryModal.jsx';
import TemplateRenderer from '../components/TemplateRenderer.jsx';
import { Step2Itinerary } from './wizard/Step2Itinerary.jsx';

export default function UnifiedItineraryCanvas() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const {
    proposal, client, branding, costingPrefs, viewMode, setViewMode,
    showTemplateGallery, setShowTemplateGallery,
    showQuickIntake, setShowQuickIntake,
    activeTemplateSlug, setTemplateSlug,
    setClient, setCostingPrefs, updateProposal
  } = useProposalStore();

  const [activeTab, setActiveTab] = useState('proposal');

  const p = proposal || {
    destination: 'Himachal Pradesh',
    duration_days: 3,
    total_price: 50000,
    price_per_person: 25000,
    currency: 'INR',
    days: [
      { day_number: 1, title: 'Day 1: Arrival in Manali & Old Manali Stroll', description: 'Check-in and evening café stroll in Old Manali.', sub_destination: 'Manali', activities: [{ name: 'Hadimba Temple', timing: '10:00 AM' }] },
      { day_number: 2, title: 'Day 2: Solang Valley & Atal Tunnel Excursion', description: 'Paragliding and Atal Tunnel drive.', sub_destination: 'Solang Valley', activities: [{ name: 'Solang Paragliding', timing: '09:30 AM' }] },
      { day_number: 3, title: 'Day 3: Kasol & Departure', description: 'Kasol riverfront walk and departure.', sub_destination: 'Kasol', activities: [{ name: 'Parvati Riverfront', timing: '11:00 AM' }] }
    ],
    inclusions: ['Private AC Vehicle', 'Hotel with Breakfast & Dinner', 'All Taxes & Tolls'],
    exclusions: ['Airfare / Train', 'Personal Expenses'],
    extra_sections: { what_to_pack: 'Comfortable walking shoes, sunscreen SPF 50+, casual attire.' }
  };

  const currentClient = client || { customer_name: 'Rahul Sharma', destination: 'Himachal', budget: '25000' };

  const finalTotal = Number(p.total_price) || (Number(p.price_per_person) ? Number(p.price_per_person) * (Number(p.num_travelers) || 2) : 0) || (Number(currentClient?.budget) ? Number(currentClient.budget) * (Number(p.num_travelers) || 2) : 50000);
  const pricePerPerson = Number(p.price_per_person) || Math.round(finalTotal / (Number(p.num_travelers) || 2)) || 25000;

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body">
      {/* ─── Top Canvas Toolbar Bar (Non-sticky: scrolls up naturally) ───────────── */}
      <header className="bg-surface-container-high/90 backdrop-blur-md border-b border-outline-variant px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Trip Title & Client Meta */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/proposals')}
            className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-headline text-on-surface line-clamp-1">
                {p.destination || 'Custom Proposal'} — {currentClient.customer_name || 'Valued Traveler'}
              </h1>
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-bold rounded-md uppercase">
                {p.duration_days || 3} Days
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Full Budget: ₹{finalTotal.toLocaleString()} · ₹{pricePerPerson.toLocaleString()}/head
            </p>
          </div>
        </div>

        {/* Center: Proposal/Preview Mode Toggle, Quick Intake, 96-Template Selector & Visibility Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Proposal vs Preview View Switcher Button */}
          <div className="flex items-center p-0.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab('proposal')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'proposal'
                  ? 'bg-surface text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">edit_note</span>
              Proposal
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-surface text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              Preview
            </button>
          </div>

          {/* Itemized vs Total Only Toggle */}
          <div className="flex items-center p-0.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-medium">
            <button
              onClick={() => setCostingPrefs({ ...costingPrefs, visibility_mode: 'ITEMIZED' })}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                costingPrefs.visibility_mode !== 'TOTAL_ONLY'
                  ? 'bg-surface text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Itemized
            </button>
            <button
              onClick={() => setCostingPrefs({ ...costingPrefs, visibility_mode: 'TOTAL_ONLY' })}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                costingPrefs.visibility_mode === 'TOTAL_ONLY'
                  ? 'bg-surface text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Total Only
            </button>
          </div>

          {/* Quick 1-Shot Intake Button */}
          <button
            onClick={() => setShowQuickIntake(true)}
            className="px-3 py-1.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:bg-primary/90 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            1-Shot Quick Intake
          </button>

          {/* 96-Template Architecture Switcher */}
          <button
            onClick={() => setShowTemplateGallery(true)}
            className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-highest text-on-surface text-xs font-semibold rounded-xl border border-outline-variant transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-primary text-[16px]">palette</span>
            <span>Theme: <strong>{activeTemplateSlug.toUpperCase()}</strong></span>
            <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded">96</span>
          </button>
        </div>

        {/* Right: Web View New Window, Copy Client Link & PDF Print */}
        <div className="flex items-center gap-2">
          {/* Open Web View Microsite in New Window */}
          <button
            onClick={() => {
              const token = p.share_token || p.id || 'demo';
              window.open(`/view/${token}`, '_blank');
            }}
            className="px-3 py-1.5 bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
            title="Open Interactive Web View Studio in New Window to edit & preview"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Open Web View Studio
          </button>

          {/* Copy Client Mode Link */}
          <button
            onClick={() => {
              const token = p.share_token || p.id || 'demo';
              const clientUrl = `${window.location.origin}/view/${token}?mode=client`;
              navigator.clipboard.writeText(clientUrl);
              alert('Copied Client Web Link to clipboard!\nSend this link to your client: ' + clientUrl);
            }}
            className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-highest text-on-surface border border-outline-variant text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
            title="Copy client-ready link to share via WhatsApp/Email"
          >
            <span className="material-symbols-outlined text-primary text-[16px]">link</span>
            Copy Client Link
          </button>

          {/* Download / Print PDF */}
          <button
            onClick={() => window.print()}
            className="p-2 bg-surface-container hover:bg-surface-container-highest text-on-surface rounded-xl border border-outline-variant transition-colors"
            title="Download / Print PDF"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
          </button>
        </div>
      </header>

      {/* ─── Full Width Canvas Container View ────────────────────────────────────────── */}
      <main className="flex-1 bg-background p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'proposal' ? (
            <motion.div
              key="proposal-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl mx-auto space-y-6"
            >
              {/* Section 1: Client & Trip Details Card */}
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold font-headline text-lg text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">person</span> Client & Trip Parameters
                  </h3>
                  <span className="text-xs text-primary font-semibold">1-Shot Editable</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-on-surface-variant mb-1">Client Name</label>
                    <input
                      type="text"
                      value={currentClient.customer_name}
                      onChange={(e) => setClient({ customer_name: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-xl text-xs text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-on-surface-variant mb-1">Destination</label>
                    <input
                      type="text"
                      value={currentClient.destination}
                      onChange={(e) => setClient({ destination: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-xl text-xs text-on-surface font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Rich WYSIWYG Day-by-Day Itinerary Editor */}
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
                  <h3 className="font-bold font-headline text-lg text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">edit_note</span> Rich WYSIWYG Itinerary Editor
                  </h3>
                  <span className="text-xs text-primary font-semibold">Block Drag-and-Drop Enabled</span>
                </div>

                <Step2Itinerary
                  proposal={p}
                  setProposal={(upd) => {
                    const nextP = typeof upd === 'function' ? upd(p) : { ...p, ...upd };
                    updateProposal(nextP);
                  }}
                  items={p.items || []}
                  setItems={() => {}}
                  addItemsOptimistic={() => {}}
                  saveDraft={() => {}}
                />
              </div>

              {/* Section 3: Full-Budget Costing & Margin Table */}
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold font-headline text-lg text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">payments</span> Full-Budget Costing & Margins
                  </h3>
                  <span className="text-xs text-emerald-400 font-bold uppercase">{costingPrefs.visibility_mode}</span>
                </div>

                <div className="p-4 bg-surface border border-outline-variant rounded-xl space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-outline-variant/30">
                    <span className="text-on-surface-variant">Net Trip Subtotal (Hotels + Transfers + Activities):</span>
                    <span className="font-bold text-on-surface">₹{(finalTotal * 0.82).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-outline-variant/30">
                    <span className="text-on-surface-variant">Agency Margin ({costingPrefs.pct_markup || 15}%):</span>
                    <span className="font-bold text-primary">+₹{(finalTotal * 0.13).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-outline-variant/30">
                    <span className="text-on-surface-variant">GST / Taxes (5%):</span>
                    <span className="font-bold text-on-surface">+₹{(finalTotal * 0.05).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 text-sm font-bold text-primary">
                    <span>Final Client Package Total:</span>
                    <span>₹{finalTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto w-full"
            >
              <div className="bg-surface border border-outline-variant rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[calc(100vh-140px)]">
                {/* Live View Bar Header */}
                <div className="px-5 py-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between text-xs">
                  <span className="font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">description</span>
                    Layout Preview: <strong className="text-on-surface">{activeTemplateSlug.toUpperCase()}</strong>
                  </span>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const token = p.share_token || p.id || 'demo';
                        window.open(`/view/${token}`, '_blank');
                      }}
                      className="text-primary hover:underline font-bold text-xs flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      Open Web View Studio
                    </button>
                    <span className="text-[11px] text-emerald-400 font-bold px-2.5 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                      Live Dynamic Sync
                    </span>
                  </div>
                </div>

                {/* Renderer Viewport */}
                <div className="flex-1 p-6 bg-surface-container-lowest overflow-y-auto">
                  <TemplateRenderer 
                    style={activeTemplateSlug}
                    data={{
                      proposal: p,
                      totals: { subtotal: finalTotal, currency: 'INR' },
                      items_by_kind: {}
                    }}
                    branding={branding}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ─── Modals ────────────────────────────────────────────────────────── */}
      <QuickIntakeModal isOpen={showQuickIntake} onClose={() => setShowQuickIntake(false)} />
      <TemplateGalleryModal isOpen={showTemplateGallery} onClose={() => setShowTemplateGallery(false)} />
    </div>
  );
}
