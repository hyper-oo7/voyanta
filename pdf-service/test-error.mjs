import puppeteer from 'puppeteer';
import fs from 'fs';

const getExecutablePath = () => {
  const candidates = [
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
};

(async () => {
  const execPath = getExecutablePath();
  console.log('Using executablePath:', execPath);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: execPath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const logs = [];
  const errors = [];

  page.on('console', msg => {
    logs.push(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR] ${err.toString()}\nStack: ${err.stack}`);
  });

  console.log('Navigating to http://127.0.0.1:3000...');
  try {
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) {
    console.log('Error navigating to root:', e.message);
  }

  console.log('Navigating to http://127.0.0.1:3000/vault...');
  try {
    await page.goto('http://127.0.0.1:3000/vault', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 4000));
  } catch (e) {
    console.log('Error navigating to /vault:', e.message);
  }

  console.log('\n--- BROWSER CONSOLE LOGS ---');
  logs.forEach(l => console.log(l));

  console.log('\n--- BROWSER PAGE ERRORS ---');
  errors.forEach(e => console.log(e));

  await browser.close();
})();
