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

const PORT = process.env.PDF_PORT || 8002;
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large base64 images

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Limit each user to 3 requests per 1 minute
  keyGenerator: (req) => req.headers['x-user-id'] || req.ip,
  message: { error: 'Too many PDF generation requests, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/generate', limiter);

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
        '--disable-web-security' // Allow local resources if needed
      ],
    });
  }
  return browserPromise;
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'voyanta-pdf', port: PORT }));

app.post('/generate', async (req, res) => {
  const { html, name } = req.body || {};
  if (!html) return res.status(400).json({ error: 'missing html payload' });
  
  if (html.length > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'HTML payload exceeds 10MB limit' });
  }

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.emulateMediaType('print');
    
    // Set viewport to A4 dimensions (at 96 DPI: 794x1123)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true, // Respects @page size
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false, // Turn off default header/footer since we render everything in HTML
    });
    
    const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    const filename = (name || 'proposal').replace(/[^a-z0-9._-]+/gi, '-');
    
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
