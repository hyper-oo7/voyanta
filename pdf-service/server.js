// Voyanta PDF service — Puppeteer-based high-speed rendering microservice.
// Uses a Page Pool & concurrency limiter (max 5 concurrent renderings) and auto-recycles
// Chromium after 50 generations to prevent memory leaks under heavy load.

import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) process.env[key] = value;
      }
    }
  });
}

const PORT = process.env.PDF_PORT || 8002;
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // Scaled for higher throughput with pooling
  message: { error: 'Too many PDF generation requests, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/generate', limiter);

if (!process.env.INTERNAL_API_KEY) {
  console.error("FATAL: INTERNAL_API_KEY environment variable must be set.");
  process.exit(1);
}
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

app.use('/generate', (req, res, next) => {
  const authHeader = req.headers['x-internal-api-key'] || req.headers['authorization'];
  if (!authHeader || (authHeader !== INTERNAL_API_KEY && authHeader !== `Bearer ${INTERNAL_API_KEY}`)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid internal API key' });
  }
  next();
});

// ─── Browser & Page Pool Management ─────────────────────────────────────────
let browserPromise = null;
let jobsProcessed = 0;
const MAX_JOBS_BEFORE_RECYCLE = 50;
const MAX_CONCURRENT_PAGES = 5;
let activePages = 0;
const pageQueue = [];

async function getBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (!b || !b.isConnected()) {
        console.log('[pdf-service] Browser disconnected or closed, relaunching...');
        browserPromise = null;
      }
    } catch {
      browserPromise = null;
    }
  }

  if (jobsProcessed >= MAX_JOBS_BEFORE_RECYCLE && activePages === 0) {
    console.log(`[pdf-service] Recycling Chromium after ${jobsProcessed} jobs...`);
    jobsProcessed = 0;
    const oldBrowser = await browserPromise;
    browserPromise = null;
    try { await oldBrowser?.close(); } catch {}
  }

  if (!browserPromise) {
    let execPath = undefined;
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
    if (!execPath) {
      try {
        const p = puppeteer.executablePath();
        if (p && fs.existsSync(p)) execPath = p;
      } catch {}
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
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions'
      ],
    });
  }
  return browserPromise;
}

// Semaphore to limit concurrent Chromium page tabs
async function acquirePage() {
  if (activePages >= MAX_CONCURRENT_PAGES) {
    await new Promise(resolve => pageQueue.push(resolve));
  }
  activePages++;
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.emulateMediaType('print');
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    return page;
  } catch (err) {
    activePages = Math.max(0, activePages - 1);
    if (pageQueue.length > 0) {
      const next = pageQueue.shift();
      next();
    }
    throw err;
  }
}

function releasePage(page) {
  activePages = Math.max(0, activePages - 1);
  jobsProcessed++;
  if (pageQueue.length > 0) {
    const next = pageQueue.shift();
    next();
  }
}

// Pre-warm browser on startup
getBrowser().catch(err => console.warn('[pdf-service] Pre-warm warning:', err.message));

// ─── Endpoints ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  ok: true,
  service: 'voyanta-pdf',
  port: PORT,
  activePages,
  queueLength: pageQueue.length,
  jobsProcessed
}));

function sanitizeHtmlForPdf(htmlStr) {
  if (!htmlStr || typeof htmlStr !== 'string') return '';
  let cleaned = htmlStr.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<(iframe|object|embed|applet)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, '');
  cleaned = cleaned.replace(/(href|src|data)\s*=\s*(?:["']\s*javascript:[^"']*["']|javascript:[^\s>]+)/gi, '$1="#"');
  return cleaned;
}

app.post('/generate', async (req, res) => {
  const { html, name, proposal_id, style, local_storage } = req.body || {};
  if (!html && !proposal_id) return res.status(400).json({ error: 'missing html or proposal_id payload' });
  
  if (html && html.length > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'HTML payload exceeds 10MB limit' });
  }

  let page = null;
  const startTime = Date.now();
  try {
    page = await acquirePage();
    
    if (local_storage && typeof local_storage === 'object') {
      await page.evaluateOnNewDocument((data) => {
        for (const [k, v] of Object.entries(data)) {
          try { localStorage.setItem(k, v); } catch {}
        }
      }, local_storage);
    }
    
    if (html) {
      const cleanHtml = sanitizeHtmlForPdf(html);
      try {
        await page.setContent(cleanHtml, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: 25000 });
      } catch (err) {
        console.warn('[pdf-service] setContent timeout warning (proceeding with rendered DOM):', err.message);
      }
    } else if (proposal_id) {
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
      const styleParam = style ? `?style=${encodeURIComponent(style)}` : '';
      const targetUrl = `${FRONTEND_URL}/proposals/${proposal_id}/print${styleParam}`;
      console.log(`[pdf-service] Navigating to ${targetUrl}`);
      try {
        await page.goto(targetUrl, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: 25000 });
      } catch (err) {
        console.warn('[pdf-service] goto timeout warning (proceeding with rendered DOM):', err.message);
      }
      await page.waitForSelector('#pdf-render-root', { timeout: 8000 }).catch(() => {});
    }
    
    // Give 250ms for fonts/images to settle
    await new Promise(r => setTimeout(r, 250));
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
      tagged: true,
      outline: true,
    });
    
    const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    const filename = (name || proposal_id || 'proposal').replace(/[^a-z0-9._-]+/gi, '-');
    
    console.log(`[pdf-service] Generated "${filename}.pdf" (${Math.round(buf.length/1024)} KB) in ${Date.now() - startTime}ms`);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.end(buf);
  } catch (e) {
    console.error('[pdf-service] generate failed after', Date.now() - startTime, 'ms:', e);
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (page) {
      await page.close().catch(() => {});
      releasePage(page);
    }
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`[pdf-service] listening on :${PORT}`));

// Graceful shutdown
['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, async () => {
  try { const b = await browserPromise; await b?.close(); } catch {}
  process.exit(0);
}));
