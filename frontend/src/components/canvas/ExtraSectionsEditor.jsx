import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SUGGESTED_TEMPLATES = [
  {
    key: 'what_to_pack',
    title: 'What to Pack',
    icon: 'luggage',
    placeholder: '• Warm layers and windproof jackets\n• Comfortable walking/hiking shoes\n• Personal medications and basic first aid\n• Power banks and universal adapters\n• Valid government photo ID & permits'
  },
  {
    key: 'visa_info',
    title: 'Visa & Entry Requirements',
    icon: 'badge',
    placeholder: '• Passport valid for at least 6 months from arrival date\n• E-Visa or Visa on Arrival required for tourist entry\n• Inner Line Permit (ILP) required for restricted areas\n• Return flight ticket confirmation'
  },
  {
    key: 'important_notes',
    title: 'Important Travel Guidelines',
    icon: 'info',
    placeholder: '• Check-in time: 2:00 PM | Check-out time: 11:00 AM\n• Driver duty hours: 8:00 AM to 8:00 PM for safety\n• Carry cash for remote areas as cards may not be accepted\n• Respect local religious customs and photography rules'
  },
  {
    key: 'cancellation_policy',
    title: 'Cancellation & Refund Terms',
    icon: 'policy',
    placeholder: '• 30+ days prior to departure: 10% administrative fee\n• 15-29 days prior: 50% package retention\n• Less than 15 days or No-Show: 100% non-refundable\n• Unutilized services due to weather are non-refundable'
  }
];

export default function ExtraSectionsEditor({ proposal = {}, updateProposal }) {
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTitleKey, setEditingTitleKey] = useState(null);
  const [tempTitle, setTempTitle] = useState('');

  const rawExtra = proposal?.extra_sections || {};
  const extraSections = typeof rawExtra === 'object' && rawExtra !== null ? rawExtra : {};

  const handleUpdateContent = (secKey, newContent) => {
    const updated = { ...extraSections, [secKey]: newContent };
    updateProposal({
      ...proposal,
      extra_sections: updated
    });
  };

  const handleDeleteSection = (secKey) => {
    const updated = { ...extraSections };
    delete updated[secKey];
    updateProposal({
      ...proposal,
      extra_sections: updated
    });
  };

  const handleAddCustomSection = (title, defaultContent = '') => {
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) return;

    // Generate safe key from title
    const key = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `section_${Date.now()}`;

    // If key exists, avoid collision
    let finalKey = key;
    let counter = 1;
    while (finalKey in extraSections) {
      finalKey = `${key}_${counter++}`;
    }

    const updated = {
      ...extraSections,
      [finalKey]: defaultContent || `• Add details for ${cleanTitle} here...`
    };

    updateProposal({
      ...proposal,
      extra_sections: updated
    });

    setNewSectionTitle('');
    setShowAddForm(false);
  };

  const handleStartRename = (secKey) => {
    const formatted = secKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    setEditingTitleKey(secKey);
    setTempTitle(formatted);
  };

  const handleSaveRename = (oldKey) => {
    const cleanTitle = (tempTitle || '').trim();
    if (!cleanTitle) {
      setEditingTitleKey(null);
      return;
    }

    const newKey = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || oldKey;

    if (newKey === oldKey) {
      setEditingTitleKey(null);
      return;
    }

    const updated = {};
    Object.entries(extraSections).forEach(([k, v]) => {
      if (k === oldKey) {
        updated[newKey] = v;
      } else {
        updated[k] = v;
      }
    });

    updateProposal({
      ...proposal,
      extra_sections: updated
    });

    setEditingTitleKey(null);
  };

  const sectionEntries = Object.entries(extraSections);

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5 space-y-5">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">menu_book</span>
          </div>
          <div>
            <h3 className="font-bold font-headline text-lg text-on-surface m-0 flex items-center gap-2">
              Extra Sections & Trip Policies
            </h3>
            <p className="text-xs text-on-surface-variant m-0">
              Auto-extracted destination guidelines, packing checklists, visa details, and custom terms.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl border border-primary/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              {showAddForm ? 'close' : 'add'}
            </span>
            <span>{showAddForm ? 'Cancel' : 'Add Custom Section'}</span>
          </button>
        </div>
      </div>

      {/* ── Add Section Quick Drawer / Form ───────────────── */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-surface border border-outline-variant space-y-3">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                Add New Itinerary Section
              </span>

              {/* Quick Template Badges */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-on-surface-variant font-medium">Quick Suggestions:</span>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_TEMPLATES.map((tmpl) => {
                    const isAlreadyAdded = Boolean(extraSections[tmpl.key] || extraSections[tmpl.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')]);
                    return (
                      <button
                        key={tmpl.key}
                        type="button"
                        disabled={isAlreadyAdded}
                        onClick={() => handleAddCustomSection(tmpl.title, tmpl.placeholder)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isAlreadyAdded
                            ? 'bg-surface-container text-on-surface-variant/40 border border-outline-variant/30 cursor-not-allowed'
                            : 'bg-surface-container hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-on-surface border border-outline-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">{tmpl.icon}</span>
                        <span>{tmpl.title}</span>
                        {isAlreadyAdded && <span className="text-[10px] text-emerald-500 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Title Input */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSection(newSectionTitle);
                    }
                  }}
                  placeholder="Or enter custom title (e.g., Local Cuisine & Dining, Dress Code, Dos and Don'ts)"
                  className="flex-1 px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => handleAddCustomSection(newSectionTitle)}
                  disabled={!newSectionTitle.trim()}
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-xs hover:bg-primary/90 transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>Create</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty State ───────────────────────────────────── */}
      {sectionEntries.length === 0 ? (
        <div className="p-8 text-center bg-surface rounded-2xl border border-dashed border-outline-variant space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">post_add</span>
          </div>
          <div>
            <h4 className="font-bold text-sm text-on-surface m-0">No Extra Sections Added Yet</h4>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1">
              Add packing lists, visa instructions, or supplier terms. These sections will automatically render in your client Web View and exported PDFs.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {SUGGESTED_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.key}
                type="button"
                onClick={() => handleAddCustomSection(tmpl.title, tmpl.placeholder)}
                className="px-3 py-1.5 bg-surface-container hover:bg-primary/10 hover:text-primary text-on-surface border border-outline-variant rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px] text-primary">{tmpl.icon}</span>
                <span>+ {tmpl.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Populated Sections List ───────────────────────── */
        <div className="space-y-4">
          {sectionEntries.map(([secKey, secContent], idx) => {
            const formattedDefaultTitle = secKey
              .replace(/_/g, ' ')
              .replace(/\b\w/g, l => l.toUpperCase());

            const contentString = typeof secContent === 'string'
              ? secContent
              : Array.isArray(secContent)
                ? secContent.map(item => (typeof item === 'string' && !item.startsWith('•') ? `• ${item}` : String(item))).join('\n')
                : JSON.stringify(secContent, null, 2);

            const isRenaming = editingTitleKey === secKey;

            return (
              <motion.div
                key={secKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: idx * 0.03 }}
                className="p-4 rounded-2xl bg-surface border border-outline-variant space-y-3 shadow-xs hover:border-outline transition-all group"
              >
                {/* Card Title & Actions */}
                <div className="flex items-center justify-between gap-3">
                  {isRenaming ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(secKey);
                          if (e.key === 'Escape') setEditingTitleKey(null);
                        }}
                        autoFocus
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-surface-container border border-primary text-on-surface outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(secKey)}
                        className="px-2 py-1 bg-primary text-on-primary rounded-lg text-[11px] font-bold"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTitleKey(null)}
                        className="px-2 py-1 bg-surface-container text-on-surface-variant rounded-lg text-[11px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        {secKey.includes('pack') ? 'luggage' : secKey.includes('visa') ? 'badge' : secKey.includes('cancellation') ? 'policy' : 'article'}
                      </span>
                      <h4 className="font-bold text-sm text-on-surface m-0">
                        {formattedDefaultTitle}
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleStartRename(secKey)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant hover:text-primary transition-opacity"
                        title="Rename section title"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Quick bullet formatting helper
                        const lines = contentString.split('\n');
                        const formatted = lines
                          .map(l => l.trim())
                          .filter(Boolean)
                          .map(l => l.startsWith('•') ? l : `• ${l}`)
                          .join('\n');
                        handleUpdateContent(secKey, formatted);
                      }}
                      className="px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-highest text-on-surface-variant text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      title="Format as bullet points"
                    >
                      <span className="material-symbols-outlined text-[13px]">format_list_bulleted</span>
                      <span>Bullets</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSection(secKey)}
                      className="p-1 text-on-surface-variant hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Delete section"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>

                {/* Content Textarea */}
                <textarea
                  rows={Math.min(10, Math.max(3, contentString.split('\n').length + 1))}
                  value={contentString}
                  onChange={(e) => handleUpdateContent(secKey, e.target.value)}
                  placeholder={`Enter details, guidelines, or checklists for ${formattedDefaultTitle}...`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary leading-relaxed resize-y font-mono"
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
