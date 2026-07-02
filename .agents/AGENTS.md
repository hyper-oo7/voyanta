# Voyanta Project Rules & Architecture Guardrails

## 1. Puppeteer & Headless Browser Execution
When creating or modifying Puppeteer/Playwright scripts and microservices (such as `pdf-service`):
- **Safe Binary Path Verification**: Always verify `fs.existsSync(execPath)` before passing `executablePath`. Do not blindly rely on `puppeteer.executablePath()` as it points to `~/.cache/puppeteer` which may not exist.
- **Multi-OS Candidate Fallbacks**: Include standard system browser candidates across operating systems:
  - Windows Edge: `C:\Program Files\Microsoft\Edge\Application\msedge.exe` and `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
  - Windows Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe` and `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
  - macOS/Linux: Standard `/Applications/...` and `/usr/bin/...` paths.
- **Modern Launch Options**: Always use `headless: true`. Never use `headless: 'new'` as it is deprecated and unsupported in Puppeteer v23+.

## 2. Windows Loopback Networking (`127.0.0.1` vs `localhost`)
In Node.js 18+ and Python Uvicorn/FastAPI environments on Windows:
- **Avoid `localhost` in Internal Proxies**: `localhost` resolves to IPv6 (`::1`) first in Node.js, while dev servers often bind to IPv4 (`0.0.0.0`). This mismatch causes `ECONNREFUSED` or 504 Gateway Timeouts.
- **Explicit IPv4 Loopback**: In configuration files (`vite.config.js`, API routers like `pdf_router.py`, Puppeteer navigation URLs, and health check scripts), always use explicit `127.0.0.1` addresses for inter-process communication.

## 3. Dark Mode Typography & Print Stylesheet Resets
When styling components and managing Tailwind design tokens:
- **Global Dark Mode Overrides**: Do not rely on hardcoded solid black tokens (`#000000`). Maintain comprehensive token overrides in `index.css` under `html.dark` for `.text-primary`, `.text-secondary`, `.text-tertiary`, `.text-on-background`, and badge backgrounds so typography remains luminous and crisp against dark glassmorphic surfaces.
- **Print Theme Isolation**: Printable documents and PDF generation routes must include `@media print` CSS rules that enforce pure white backgrounds (`#ffffff !important`), high-contrast dark text (`#000000 !important`), and reset shadows/color schemes so exported A4 documents remain pristine regardless of the user's active UI theme.

## 4. Resilient Export Data Layer & Direct HTML Payloads
When generating documents (PDF, PPT, exports):
- **Offline & Storage Fallback**: Data export services (`buildProposalExport`) must wrap database queries in `try/catch` and provide automatic fallback to `localStorage` (`voyanta_proposal_${id}` and list caches). This ensures document generation succeeds in unauthenticated browser sessions or offline environments.
- **Direct HTML Payload Optimization**: When exporting documents from an already-rendered UI view (such as Step 7 Preview), pass the live rendered DOM HTML (with bundled style tags and stylesheets) directly to the rendering microservice instead of passing only IDs that require background re-navigation.
