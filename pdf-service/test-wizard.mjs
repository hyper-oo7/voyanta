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
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: execPath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const logs = [];
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('Maximum') || msg.text().includes('depth') || msg.text().includes('React') || msg.text().includes('setState')) {
      logs.push(`[CONSOLE ${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR] ${err.toString()}\nStack: ${err.stack}`);
  });

  console.log('Visiting root to inject auth state...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  
  await page.evaluate(() => {
    localStorage.setItem('voyanta-auth-store', JSON.stringify({
      state: {
        isDemo: true,
        user: { id: 'demo_user_1', email: 'demo@voyanta.com', user_metadata: { full_name: 'Demo Agent' } },
        session: { access_token: 'fake_token', user: { id: 'demo_user_1' } }
      },
      version: 0
    }));
  });

  console.log('Navigating to http://127.0.0.1:3000/proposals/wizard...');
  try {
    await page.goto('http://127.0.0.1:3000/proposals/wizard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 4000));
  } catch (e) {
    console.log('Error navigating to /proposals/wizard:', e.message);
  }

  // Let's also check which step we are on and click Next
  try {
    const url = page.url();
    console.log('Current URL:', url);
    const content = await page.content();
    if (content.includes('Maximum update depth exceeded')) {
      console.log('!!! DETECTED Maximum update depth exceeded immediately on wizard load !!!');
    }
  } catch (e) {}

  console.log('\n--- BROWSER CONSOLE ERRORS ---');
  logs.forEach(l => console.log(l));

  console.log('\n--- BROWSER PAGE ERRORS ---');
  errors.forEach(e => console.log(e));

  await browser.close();
})();
