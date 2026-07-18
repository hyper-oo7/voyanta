import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HowToUsePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pipeline');

  const tabs = [
    { id: 'pipeline', label: '1. Vault & Matching Pipeline', icon: 'sync_alt' },
    { id: 'ai-copilot', label: '2. VI Copilot Intelligence', icon: 'auto_awesome' },
    { id: 'operations', label: '3. Agency Operations', icon: 'business_center' },
  ];

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body pb-20 selection:bg-primary/20">
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-outline-variant px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80 transition-colors bg-transparent border-none p-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Home
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-lg shadow-sm">
              <span className="material-symbols-outlined text-white text-[18px]">travel_explore</span>
            </div>
            <span className="font-display font-bold text-xl text-primary">Voyanta</span>
          </div>
          <button
            onClick={() => navigate('/login?signup=true')}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium text-xs rounded-xl shadow-md transition-all border-none cursor-pointer"
          >
            Start Free Trial
          </button>
        </div>
      </nav>

      {/* Hero Banner */}
      <header className="relative pt-32 pb-16 bg-gradient-to-b from-primary/5 to-transparent text-center px-4">
        <div className="max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Comprehensive Guide & Docs
          </span>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold text-on-surface mb-6 leading-tight">
            How to Use Voyanta
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed font-medium">
            Learn how to turn supplier contracts into searchable AI knowledge, design stunning proposal flows, optimize pricing margins, and manage clients in a single platform.
          </p>
        </div>
      </header>

      {/* Main Tabs Layout */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-12 border-b border-outline-variant pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all border cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                  : 'bg-surface hover:bg-surface-container-low border-outline-variant text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="space-y-16">
          {activeTab === 'pipeline' && (
            <div className="space-y-12 animate-fade-in">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <h2 className="font-display text-3xl font-bold text-on-surface mb-2">The RAG Knowledge Pipeline</h2>
                <p className="text-sm text-on-surface-variant">How Voyanta extracts rates, reads travel briefs, and populates proposals in real-time.</p>
              </div>

              {/* Step 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm">
                <div className="lg:col-span-5 space-y-4">
                  <div className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-mono">1</span>
                    VAULT CONTRACTING
                  </div>
                  <h3 className="font-display text-2xl font-bold text-on-surface">Upload Supplier & Hotel Contracts</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Drop any PDF rate sheet, contract contract, or messy pricing spreadsheet into <strong className="text-on-surface">My Vault</strong>.
                  </p>
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-xs text-emerald-800 dark:text-emerald-400 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">security</span> Isolated Cloud Storage
                    </p>
                    <p>All documents are privately indexed and securely hosted in Cloudflare R2 storage scoped strictly by your unique Agency ID.</p>
                  </div>
                </div>
                <div className="lg:col-span-7 bg-surface-container-low p-5 rounded-2xl border border-outline-variant font-mono text-[11px] space-y-3">
                  <div className="flex justify-between items-center text-xs border-b border-outline-variant pb-2 font-sans font-bold">
                    <span>📄 Taj_Kashmir_Rates_2026.pdf</span>
                    <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">EXTRACTED</span>
                  </div>
                  <div className="space-y-1 text-on-surface-variant">
                    <div className="flex justify-between"><span className="text-on-surface">Taj Dal View (Luxury Room CP)</span><span>₹24,500 / night</span></div>
                    <div className="flex justify-between"><span className="text-on-surface">Taj Dal View (Luxury Room MAP)</span><span>₹28,200 / night</span></div>
                    <div className="flex justify-between"><span className="text-on-surface">Private Srinagar Airport Transfer</span><span>₹2,500 / pax</span></div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm">
                <div className="lg:col-span-5 space-y-4">
                  <div className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-mono">2</span>
                    SMART QUERYING
                  </div>
                  <h3 className="font-display text-2xl font-bold text-on-surface">Specify Client Brief & Destination</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    In the Proposal Wizard, type the destination, target budget, travel dates, and client requirements. Voyanta instantly maps these to query parameters.
                  </p>
                  <ul className="space-y-2 text-xs text-on-surface-variant">
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm font-black">check</span> Destination: Srinagar, Gulmarg, Pahalgam</li>
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm font-black">check</span> Meal Plan Preference: CP / Breakfast Included</li>
                  </ul>
                </div>
                <div className="lg:col-span-7 bg-surface-container-low p-5 rounded-2xl border border-outline-variant space-y-3 font-sans">
                  <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">psychology</span> Brief Alignment Processor
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white dark:bg-slate-900 border border-outline-variant rounded-xl text-xs">
                      <span className="block text-[10px] text-on-surface-variant uppercase font-bold">Preferences</span>
                      <span className="font-bold text-on-surface">Luxury properties, high floors</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 border border-outline-variant rounded-xl text-xs">
                      <span className="block text-[10px] text-on-surface-variant uppercase font-bold">Client Budget</span>
                      <span className="font-bold text-emerald-600">₹3,00,000 INR max</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm">
                <div className="lg:col-span-5 space-y-4">
                  <div className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-mono">3</span>
                    AUTO-POPULATION
                  </div>
                  <h3 className="font-display text-2xl font-bold text-on-surface">Sidebar Auto-Populates Matching Rates</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    While writing your itinerary in the builder, the Vault sidebar matches keywords (like "Taj Dal View" or "Srinagar") and instantly surfaces the negotiated rate cards.
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Just click <strong className="text-primary">"Insert"</strong> on any suggestion to inject verified prices, saving hours of manual data lookups.
                  </p>
                </div>
                <div className="lg:col-span-7 bg-surface-container-low p-5 rounded-2xl border border-outline-variant flex flex-col gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center justify-between">
                    <span>Proposal Builder Itinerary Editor</span>
                    <span className="text-emerald-500 flex items-center gap-1 animate-pulse">● Live Sidebar suggestions</span>
                  </div>
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <span className="block text-[10px] uppercase tracking-widest text-primary font-bold">Suggested Rate</span>
                      <span className="font-bold text-on-surface">Taj Dal View - Luxury CP Plan</span>
                      <span className="block text-emerald-600 font-bold font-mono">₹24,500 / night</span>
                    </div>
                    <button className="px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-lg border-none cursor-pointer">
                      Insert Rate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai-copilot' && (
            <div className="space-y-12 animate-fade-in">
              <div className="text-center max-w-3xl mx-auto mb-8">
                <h2 className="font-display text-3xl font-bold text-on-surface mb-3">VI Copilot Intelligence</h2>
                <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/5 to-emerald-500/10 border border-primary/20 shadow-md text-left mb-6">
                  <p className="text-sm md:text-base text-on-surface font-semibold leading-relaxed text-center">
                    <span className="text-primary font-bold">Voyanta Intelligence (VI) is a sophisticated cognitive orchestration engine engineered exclusively for boutique luxury travel consultancies.</span>
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2 text-center italic">
                    By synthesizing multi-layered natural language processing with your agency&apos;s proprietary historical data, Vault contracts, and pricing rules, VI eliminates manual operational friction and elevates every itinerary into a high-converting, bespoke hospitality experience.
                  </p>
                </div>
                <p className="text-sm text-on-surface-variant">Below is a comprehensive operational walkthrough detailing how travel advisors and onboarding specialists can leverage each VI capability to optimize margins and streamline proposal workflow.</p>
              </div>

              {/* Step by Step Guide Cards */}
              <div className="space-y-8">
                
                {/* 1. VI Vault */}
                <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm flex flex-col space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-primary/10 text-primary rounded-2xl flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-2xl">storage</span>
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-on-surface">1. VI Vault (Your Agency&apos;s Memory)</h3>
                      <p className="text-xs text-primary font-bold uppercase tracking-wider">How to teach VI your rates & rules</p>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    <strong>In simple words:</strong> Stop typing hotel prices and daily itineraries manually every time. When you drop a file or rate sheet into My Vault, VI reads it, remembers the prices, and auto-suggests them right when you build proposals.
                  </p>
                  
                  <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant text-xs space-y-4">
                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-primary">cloud_upload</span>
                        Step 1: What files to upload
                      </div>
                      <p className="text-on-surface-variant pl-5">
                        Upload supplier rate contracts (in <code>.pdf</code>, <code>.xlsx</code>, <code>.docx</code>, or <code>.csv</code>), hotel flyers, email quotes saved as files, or standard agency packing guidelines.
                      </p>
                    </div>

                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-primary">view_list</span>
                        Step 2: Required Columns & Content for Hotel Sheets
                      </div>
                      <p className="text-on-surface-variant pl-5 mb-1">
                        For contract rates to sync, your Excel or PDF must clearly mention:
                      </p>
                      <ul className="list-disc pl-10 space-y-1 text-on-surface-variant">
                        <li><code>Hotel Name</code> (e.g. Taj Lake Palace, Udaipur)</li>
                        <li><code>Room Category</code> (e.g. Luxury Lake View Room, Palace Room)</li>
                        <li><code>Net Price / Contract Rate</code> (must be a number, e.g. 45000)</li>
                        <li><code>Season / Validity Dates</code> (e.g. Validity: Oct 01, 2026 - Mar 31, 2027)</li>
                      </ul>
                    </div>

                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-primary">edit_document</span>
                        Step 3: Uploading Supplier Documents, Packing Guidelines & Custom Rules
                      </div>
                      <p className="text-on-surface-variant pl-5">
                        When you upload supplier documents, PDF itineraries, or rate sheets into <strong>My Vault</strong>, our advanced Voyanta Intelligence pipeline automatically extracts destinations, sub-destinations, hotel categories, activities, and custom sections (such as <i>What to Pack</i>, <i>Important Notes</i>, and <i>Visa Requirements</i>).
                        <br /><br />
                        These rules and rate structures are strictly isolated to your account. Whenever you initiate a proposal for a matching destination (e.g., Kashmir or Srinagar), VI automatically retrieves your stored packing checklists, supplier rate cards, and inclusions to populate your wizard steps without requiring any manual tag formatting.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. VI Cost Optimizer */}
                <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm flex flex-col space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-2xl">trending_up</span>
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-on-surface">2. VI Cost Optimizer (Margin Booster)</h3>
                      <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">How to automatically find cheaper supplier rates</p>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    <strong>In simple words:</strong> When three different suppliers quote rates for the same hotel or tour, VI instantly checks if a cheaper direct negotiated contract exists in your Vault so you maximize net profit on every booking.
                  </p>
                  
                  <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant text-xs space-y-4">
                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-emerald-600">checklist</span>
                        Required Inputs Before Use
                      </div>
                      <p className="text-on-surface-variant pl-5">
                        You must have supplier rate cards uploaded in <strong>My Vault</strong>, and your current proposal must have costing lines or itinerary items added.
                      </p>
                    </div>

                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-emerald-600">play_circle</span>
                        Step-by-Step Actions
                      </div>
                      <ol className="list-decimal pl-10 space-y-1 text-on-surface-variant">
                        <li>Navigate to <strong>Step 3 (Costing & Pricing)</strong> inside the Proposal Wizard.</li>
                        <li>Look at the top header bar next to <strong>Cost Breakdown</strong> and click the green <strong>VI Cost Optimizer</strong> button.</li>
                        <li>VI cross-references your current costing rows against all verified supplier contracts inside your Vault.</li>
                        <li>If a cheaper direct rate is identified, VI displays an interactive green banner highlighting exactly how much net profit you can gain (e.g. <i>"Identified potential net price savings by using direct negotiated contract rates!"</i>).</li>
                        <li>Click <strong>Apply Net Price Savings</strong>. VI will optimize your pricing and discount structure, raising your profit margin instantly.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* 3. VI Curated Itinerary */}
                <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm flex flex-col space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-2xl">map</span>
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-on-surface">3. VI Curated Itinerary (Day-by-Day Generator)</h3>
                      <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">How to draft complete trip days in seconds</p>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    <strong>In simple words:</strong> Tell VI where the client is going and how many days they have, and it generates a complete day-by-day luxury schedule complete with VIP transfers, cultural highlights, and culinary experiences.
                  </p>
                  
                  <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant text-xs space-y-4">
                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-blue-600">input</span>
                        Required Inputs
                      </div>
                      <p className="text-on-surface-variant pl-5">
                        You need: <strong>Destination</strong> (e.g. Kashmir / Dubai / Srinagar) entered in Step 1, and your target travel duration.
                      </p>
                    </div>

                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-blue-600">play_circle</span>
                        Step-by-Step Actions
                      </div>
                      <ol className="list-decimal pl-10 space-y-1 text-on-surface-variant">
                        <li>Navigate to <strong>Step 2 (Itinerary Builder)</strong> inside the Proposal Wizard.</li>
                        <li>Look at the top of the timeline section next to the heading <strong>Proposal Itinerary</strong> and click the <strong>Generate Day-by-Day with VI</strong> button.</li>
                        <li>If your itinerary is empty, VI instantly builds a structured multi-day luxury schedule tailored to your destination. If you already have days, VI enriches every description with elevated luxury phrasing and Vault highlights.</li>
                        <li>Additionally, check the right-side panel labeled <strong>Suggested from Vault</strong> or click <strong>VI Expand Luxury Experience</strong> inside individual day blocks to further customize daily activities.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* 4. VI Proposal Review */}
                <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm flex flex-col space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-purple-500/10 text-purple-600 rounded-2xl flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-2xl">fact_check</span>
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-on-surface">4. VI Proposal Review (Quality, Pacing & Reminders Audit)</h3>
                      <p className="text-xs text-purple-600 font-bold uppercase tracking-wider">How to audit pacing, hotel transitions & visa reminders before sending</p>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    <strong>In simple words:</strong> Like having a meticulous senior hospitality director review your proposal before emailing it out. It checks pacing, mechanical hotel switches, and ensures critical travel reminders are included.
                  </p>
                  
                  <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant text-xs space-y-4">
                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-purple-600">visibility</span>
                        Required Inputs
                      </div>
                      <p className="text-on-surface-variant pl-5">
                        A proposal with itinerary days populated under Step 2.
                      </p>
                    </div>

                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-purple-600">play_circle</span>
                        Step-by-Step Actions
                      </div>
                      <ol className="list-decimal pl-10 space-y-1 text-on-surface-variant">
                        <li>Navigate to <strong>Step 5 (Preview)</strong> in the Proposal Wizard.</li>
                        <li>In the top toolbar next to style controls, click the purple <strong>VI Proposal Review</strong> button (or <strong>VI Auto-Title</strong> to generate a premium title).</li>
                        <li>VI scans your entire itinerary and checks: (a) Are hotel check-ins/check-outs paced comfortably or is the client switching hotels too frequently without reason? (b) Are sightseeing days rushed or repetitive? (c) Did you include important destination-specific reminders such as <strong>Visa requirements</strong>, <strong>passport validity</strong>, or essential <strong>packing guidelines</strong>?</li>
                        <li>If any recommendations or missing items are identified, VI highlights them under the <strong>VI Itinerary Pacing & Sequence Analysis</strong> panel so you can resolve them before generating your client PDF.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* 5. VI Rewrite */}
                <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm flex flex-col space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-2xl">edit_note</span>
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-on-surface">5. VI Rewrite (Tone & Luxury Polish)</h3>
                      <p className="text-xs text-secondary font-bold uppercase tracking-wider">How to transform basic notes into rich hospitality phrasing</p>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    <strong>In simple words:</strong> If you typed a rough bullet point like *"pick up 9am go to dal lake boat ride"*, VI Rewrite instantly turns it into *"At 9:00 AM, our private chauffeur will escort you to the serene waters of Dal Lake for an exclusive, guided Shikara excursion..."*
                  </p>
                  
                  <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant text-xs space-y-4">
                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-secondary">input</span>
                        Required Inputs
                      </div>
                      <p className="text-on-surface-variant pl-5">
                        Any text block, bullet point list, or rough notes in Step 4 Branding or inside the Step 5 WYSIWYG Live Editor.
                      </p>
                    </div>

                    <div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-secondary">play_circle</span>
                        Step-by-Step Actions
                      </div>
                      <ol className="list-decimal pl-10 space-y-1 text-on-surface-variant">
                        <li>In <strong>Step 4 (Branding)</strong>, click the <strong>VI Icon button</strong> (featuring the logo) right above Inclusions, Exclusions, or Terms to check grammar and expand bullet points.</li>
                        <li>In <strong>Step 5 (Preview)</strong>, click <strong>✨ WYSIWYG Live Editor</strong> and click directly on any text paragraph.</li>
                        <li>An inline popover appears where you can edit your text directly and adjust styling.</li>
                        <li>Click <strong>Apply</strong> to commit the refined text to your proposal.</li>
                      </ol>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'operations' && (
            <div className="space-y-12 animate-fade-in">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <h2 className="font-display text-3xl font-bold text-on-surface mb-2">Agency Operations</h2>
                <p className="text-sm text-on-surface-variant">Complete client, invoice, and portal suite designed specifically for boutique luxury agencies.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Client CRM */}
                <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm flex flex-col space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/15 text-primary rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined">contacts</span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-on-surface">Client CRM (Traveler Profiles)</h3>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Build historical records for client families. Store meal preferences, airline loyalty programs, hotel room criteria, and past itineraries.
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    When creating a new proposal, select the client and the wizard automatically populates their details and aligns vector search queries to match their historical style preferences.
                  </p>
                </div>

                {/* Invoicing, UPI QR, and Receipts */}
                <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm flex flex-col space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/15 text-primary rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined">account_balance_wallet</span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-on-surface">Invoicing & UPI Receipts</h3>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Generate professional digital invoices containing custom margins. Include dynamic UPI payment QR codes so Indian clients can scan and pay instantly.
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Once paid, trigger automated digital receipt logs, sending elegant verification notes and tracking invoices cleanly in the Invoices dashboard.
                  </p>
                </div>

                {/* Live Web View / Client Portal */}
                <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-sm flex flex-col space-y-4 md:col-span-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/15 text-primary rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined">public</span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-on-surface">Interactive Live Web View</h3>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Ditch standard PDF attachments. Share proposals with a live Web View link (`/view/:token`) that fits desktop and mobile screens perfectly.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-on-surface-variant">
                    <div className="p-3 bg-surface-container-low border border-outline-variant rounded-xl text-center">
                      <span className="material-symbols-outlined text-primary block mb-1">chat</span>
                      <strong>Real-Time Feedback</strong>
                      <span className="block text-[10px] mt-1 text-on-surface-variant">Clients can leave questions directly on daily activities.</span>
                    </div>
                    <div className="p-3 bg-surface-container-low border border-outline-variant rounded-xl text-center">
                      <span className="material-symbols-outlined text-primary block mb-1">check_box</span>
                      <strong>Digital Approval</strong>
                      <span className="block text-[10px] mt-1 text-on-surface-variant">One-click Client Approval to initiate supplier bookings.</span>
                    </div>
                    <div className="p-3 bg-surface-container-low border border-outline-variant rounded-xl text-center">
                      <span className="material-symbols-outlined text-primary block mb-1">print</span>
                      <strong>Print to PDF</strong>
                      <span className="block text-[10px] mt-1 text-on-surface-variant">Resets background themes to pure white for pristine prints.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Call Section */}
        <div className="mt-20 py-16 px-6 bg-primary text-white text-center rounded-[32px] shadow-xl relative overflow-hidden">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">Put Your Skills to Work</h2>
          <p className="text-sm text-white/80 max-w-xl mx-auto mb-8 font-medium">Ready to create a proposal, upload supplier rate cards, or test the VI Cost Optimizer?</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => navigate('/login?signup=true')}
              className="px-6 py-3.5 bg-white text-primary font-bold text-sm rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all border-none cursor-pointer"
            >
              Sign Up Now
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3.5 bg-black/30 text-white font-bold text-sm rounded-xl hover:bg-black/40 transition-all border border-white/20 cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
