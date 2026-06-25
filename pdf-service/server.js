// Voyanta PDF service — Puppeteer-based renderer that turns a proposal export
// JSON envelope into a true A4 PDF. Designed to be called from the FastAPI
// backend (which proxies /api/pdf/generate → POST /generate here).
//
// Contract:
//   POST /generate
//     body: { proposal, items, items_by_kind, totals, presentation: { style, include }, branding }
//     resp: application/pdf (binary)
//
//   GET  /health → { ok: true }

import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { renderProposalHtml } from './template.js';

const PORT = process.env.PDF_PORT || 8002;
const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
      ],
    });
  }
  return browserPromise;
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'voyanta-pdf', port: PORT }));

app.post('/generate', async (req, res) => {
  const envelope = req.body || {};
  if (!envelope.proposal) return res.status(400).json({ error: 'missing proposal' });

  try {
    const html = renderProposalHtml(envelope);
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:9px;color:#888;padding:0 14mm;display:flex;justify-content:space-between;font-family:Inter, sans-serif;">
          <span>${escapeHtml(envelope.proposal?.name || 'Proposal')}</span>
          <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
    });
    await page.close();
    const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    const filename = (envelope.proposal?.name || 'proposal').replace(/[^a-z0-9._-]+/gi, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.end(buf);
  } catch (e) {
    console.error('[pdf-service] generate failed', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

app.listen(PORT, '0.0.0.0', () => console.log(`[pdf-service] listening on :${PORT}`));

// Graceful shutdown
['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, async () => {
  try { const b = await browserPromise; await b?.close(); } catch {}
  process.exit(0);
}));
