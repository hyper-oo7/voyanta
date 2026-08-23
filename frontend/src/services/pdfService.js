import { api } from './api.js';

/**
 * Proposal PDF export.
 *
 * The document is rendered server-side: /api/pdf/generate hands the proposal to
 * the Puppeteer service, which loads /proposals/:id/print and calls page.pdf().
 * That route renders the proposal on its own, with `@page { size: A4 }` and
 * page-break rules, and without any of the editor chrome.
 *
 * This is deliberately NOT window.print(). Printing the canvas prints the
 * application UI — header, toolbars, tab strip, editor panels — as one long
 * page, which is what made exports look like a screenshot of the screen.
 */

/** localStorage keys the print route may need to rehydrate branding/overrides. */
function collectVoyantaLocalStorage() {
  const dump = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('voyanta_')) dump[k] = localStorage.getItem(k);
    }
  } catch {
    /* private mode / storage disabled — the print route falls back to server data */
  }
  return dump;
}

function toSafeFilename(name) {
  const base = (name || 'proposal').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return `${base || 'proposal'}.pdf`;
}

/**
 * Generate and download a proposal PDF.
 *
 * @param {object} proposal      must carry an `id` — the renderer loads the saved proposal
 * @param {object} [options]
 * @param {string} [options.style]     template slug override
 * @param {string} [options.filename]  download name, defaults to the proposal name
 * @returns {Promise<void>} rejects with a readable message the caller can surface
 */
export async function downloadProposalPdf(proposal, options = {}) {
  const id = proposal?.id;
  if (!id) {
    throw new Error('Save this proposal before exporting — the PDF is rendered from the saved version.');
  }

  const blob = await api.post(
    '/api/pdf/generate',
    {
      proposal_id: id,
      name: proposal.name || 'proposal',
      style: options.style || proposal.template_style || undefined,
      local_storage: collectVoyantaLocalStorage(),
    },
    { responseType: 'blob', timeout: 60000 }
  );

  if (!blob || (blob.size !== undefined && blob.size === 0)) {
    throw new Error('The PDF service returned an empty document.');
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = options.filename || toSafeFilename(proposal.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default downloadProposalPdf;
