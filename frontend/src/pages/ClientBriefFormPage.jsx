import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { useToast } from '../context/ToastContext.jsx';
import { useProposalBuilder } from '../context/ProposalBuilderContext.jsx';
import { createProposal } from '../services/proposalService.js';
import { VoyantaClientBriefForm_bodyClass, VoyantaClientBriefForm_extraStyles, VoyantaClientBriefForm_html } from './_html/voyanta_client_brief_form.js';

// Client Brief Form → on submit, persist a new proposal record.
// We attach a click listener on the form's final "Submit/Save" button (the
// existing Stitch primary CTA on the last step) and harvest field values
// directly from the form's inputs to keep the UI untouched.
export default function ClientBriefFormPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const builder = useProposalBuilder();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    // Find the primary submit-style button. Stitch CTA pattern: bg-primary text-on-primary.
    // We hook all of them and route based on label text.
    const ctas = Array.from(root.querySelectorAll('button.bg-primary, button[type="submit"]'));
    // Also wire any secondary "Save Draft" button to persist as a draft.
    Array.from(root.querySelectorAll('button')).forEach((b) => {
      if (/save draft|save as draft/i.test((b.textContent || '').trim()) && !ctas.includes(b)) {
        ctas.push(b);
      }
    });
    const handler = async (e) => {
      const btn = e.currentTarget;
      const label = (btn.textContent || '').trim().toLowerCase();
      // Only treat "Save", "Submit", "Create", "Save Proposal", "Generate" as proposal-submit
      if (!/save|submit|create|generate|finish|next|draft/.test(label)) return;
      e.preventDefault();
      if (saving) return;
      setSaving(true);
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Saving…';
      try {
        const payload = harvest(root);
        const proposal = await createProposal(payload);
        builder?.setActiveId(proposal.id);
        toast.success('Proposal saved — now active');
        setTimeout(() => navigate(`/proposals/new?id=${encodeURIComponent(proposal.id)}`), 400);
      } catch (err) {
        toast.error(err.message || 'Failed to save proposal');
        btn.innerHTML = original;
        btn.disabled = false;
        setSaving(false);
      }
    };
    ctas.forEach((b) => b.addEventListener('click', handler));
    return () => ctas.forEach((b) => b.removeEventListener('click', handler));
  }, [navigate, toast, saving]);

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <StitchPage
        styleId="stitch-style-brief"
        bodyClass={VoyantaClientBriefForm_bodyClass}
        extraStyles={VoyantaClientBriefForm_extraStyles}
        html={VoyantaClientBriefForm_html}
        navMap={navMap}
      />
    </div>
  );
}

// Read whatever the user typed into the Stitch form. Field labels in the
// Stitch HTML drive the mapping — anything not found falls back gracefully.
function harvest(root) {
  const byLabel = (text) => {
    const labels = Array.from(root.querySelectorAll('label'));
    const lab = labels.find((l) => l.textContent.trim().toLowerCase().includes(text.toLowerCase()));
    if (!lab) return '';
    // Walk up until we find a container that holds an input/select/textarea.
    let scope = lab.parentElement;
    for (let i = 0; i < 4 && scope; i++) {
      const el = scope.querySelector('input, select, textarea');
      if (el) return el.value.trim();
      scope = scope.parentElement;
    }
    if (lab.htmlFor) {
      const el = root.querySelector(`#${CSS.escape(lab.htmlFor)}`);
      if (el) return el.value.trim();
    }
    return '';
  };

  const clientName  = byLabel('full name') || byLabel('client');
  const email       = byLabel('email');
  const phone       = byLabel('phone');
  const destination = byLabel('destination');
  const startDate   = byLabel('start') || byLabel('departure');
  const endDate     = byLabel('end') || byLabel('return');
  const travelers   = parseInt(byLabel('travelers') || byLabel('guests') || '1', 10) || 1;
  const budgetMin   = parseFloat(byLabel('budget min') || '') || null;
  const budgetMax   = parseFloat(byLabel('budget max') || byLabel('budget') || '') || null;

  const name = destination
    ? `${destination} Proposal`
    : (clientName ? `${clientName} — New Trip` : 'Untitled Proposal');

  return {
    name,
    client_name: clientName || 'New Client',
    destination: destination || null,
    start_date: startDate || null,
    end_date: endDate || null,
    travelers,
    budget_min: budgetMin,
    budget_max: budgetMax,
    currency: 'INR',
    brief: { email, phone, raw: { destination, startDate, endDate, travelers, budgetMin, budgetMax } },
    status: 'Draft',
  };
}
