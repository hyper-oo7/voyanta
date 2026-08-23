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
/** Saved proposals carry a database UUID. Anything else is a client-side id. */
const SAVED_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function downloadProposalPdf(proposal, options = {}) {
  const id = proposal?.id;
  // A proposal applied from the vault carries an id like "vault_1787509779893_0",
  // which the renderer cannot load. Exporting anyway produced a one-page PDF
  // reading "Error: Proposal ... not found", so refuse with something actionable.
  if (!id || !SAVED_ID.test(String(id))) {
    throw new Error('Save this proposal first — the PDF is rendered from the saved version, so unsaved drafts cannot be exported yet.');
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

  // A non-Blob here means the request layer parsed the response as text — the
  // symptom is an opaque "createObjectURL: Overload resolution failed", so fail
  // with something that names the cause instead.
  if (!(blob instanceof Blob)) {
    throw new Error('The PDF service did not return a document. Check that /api/pdf/generate is reachable.');
  }
  if (blob.size === 0) {
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
