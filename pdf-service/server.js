// Voyanta PDF service — Puppeteer-based renderer that turns a proposal export
// HTML string into a true A4 PDF. Designed to be called from the FastAPI
// backend (which proxies /api/pdf/generate → POST /generate here).
//
// Contract:
//   POST /generate
//     body: { html: "<html>...</html>", name: "Proposal Name" }
//     resp: application/pdf (binary)
//
//   GET  /health → { ok: true }

import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import rateLimit from 'express-rate-limit';
import fs from 'fs';

const PORT = process.env.PDF_PORT || 8002;
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large base64 images

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Increased limit for normal usage and testing
  message: { error: 'Too many PDF generation requests, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/generate', limiter);

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    let execPath = undefined;
    try {
      const p = puppeteer.executablePath();
      if (p && fs.existsSync(p)) execPath = p;
    } catch {}

    if (!execPath) {
      const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          execPath = c;
          break;
        }
      }
    }

    console.log(`[pdf-service] Launching browser with executablePath: ${execPath || 'default (bundled)'}`);

    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
        '--disable-web-security' // Allow local resources if needed
      ],
    });
  }
  return browserPromise;
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'voyanta-pdf', port: PORT }));

app.post('/generate', async (req, res) => {
  const { html, name, proposal_id, style } = req.body || {};
  if (!html && !proposal_id) return res.status(400).json({ error: 'missing html or proposal_id payload' });
  
  if (html && html.length > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'HTML payload exceeds 10MB limit' });
  }

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.emulateMediaType('print');
    
    // Set viewport to A4 dimensions (at 96 DPI: 794x1123)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    
    if (html) {
      await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 300));
    } else if (proposal_id) {
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
      const styleParam = style ? `?style=${encodeURIComponent(style)}` : '';
      const targetUrl = `${FRONTEND_URL}/proposals/${proposal_id}/print${styleParam}`;
      console.log(`[pdf-service] Navigating to ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('#pdf-render-root', { timeout: 10000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    }
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true, // Respects @page size
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false, // Turn off default header/footer since we render everything in HTML
      tagged: true, // Creates tagged accessible PDF with preserved interactive hyperlinks
      outline: true, // Preserves document structure outline
    });
    
    const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    const filename = (name || proposal_id || 'proposal').replace(/[^a-z0-9._-]+/gi, '-');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.end(buf);
  } catch (e) {
    console.error('[pdf-service] generate failed', e);
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`[pdf-service] listening on :${PORT}`));

// Graceful shutdown
['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, async () => {
  try { const b = await browserPromise; await b?.close(); } catch {}
  process.exit(0);
}));
