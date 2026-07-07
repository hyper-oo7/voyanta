# Voyanta

Voyanta is an advanced Travel Operating System (Travel OS) designed for luxury travel concierges and modern travel agencies. It serves as a unified hub for managing client relationships (CRM), generating interactive proposals, building custom itineraries, automating financial calculations, and issuing invoices.

## Features

- **Dynamic Pipeline CRM**: Track client inquiries, preferences, and booking conversion statuses.
- **Smart Itinerary Builder**: Construct bespoke travel packages using modular blocks for Hotels, Flights, Activities, and Custom services.
- **Cost Calculator**: Reactive spreadsheet-like editor to manage margins, taxes, visas, and transfers with real-time subtotals.
- **Automated Invoicing**: Instantly convert complex proposals into beautifully formatted, client-ready invoices with UPI/Bank transfer branding.
- **Universal Library Import Engine**: Drop any `.xlsx` or `.csv` from your suppliers into Voyanta, and the heuristic importer will automatically map the data into your central resource hub.
- **Demo Mode vs Production Mode**: Seamlessly toggle between a fast-loading offline demo (using `localStorage`) and a fully-authenticated, multi-user production environment (using Supabase).

## Tech Stack

- **Frontend**: React 18, Vite, React Router
- **Styling**: Tailwind CSS v4, PostCSS, Vanilla CSS (Glassmorphic Design System)
- **State & Data**: Zustand, React Query
- **Backend / DB**: Supabase (PostgreSQL, GoTrue Auth, Row-Level Security)
- **PDF Generation**: Containerized Node.js Microservice with Puppeteer/Playwright

## Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase Project (for Production usage)

### Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/voyanta.git
   cd voyanta
   ```

2. **Install Frontend Dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Configure Environment:**
   Copy the example environment file and add your Supabase credentials if running in production mode.
   ```bash
   cp .env.example .env.local
   # Edit .env.local to include VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Voyanta will be accessible at `http://localhost:3000`.

## Architecture & Data Flow

Voyanta leverages a **Network-First Caching Strategy** to guarantee both instantaneous UI rendering and iron-clad data consistency in multi-user environments:
- **Reads**: UI fetches data directly from Supabase. Successful fetches overwrite local caches, providing a clean offline fallback without risking split-brain data resurrection.
- **Mutations (Writes)**: Operations like creating proposals or invoices are sent to Supabase first. Upon successful confirmation, the local cache is updated and a pub/sub event (`voyanta:crm-updated`, `voyanta:invoices-updated`) is dispatched to trigger reactive UI re-renders.

### Directory Structure
- `/frontend`: The core Vite React application.
- `/backend`: Supplemental backend services and routing.
- `/pdf-service`: Microservice dedicated to rendering exact A4 PDF documents from the live UI payload.
- `/memory`: System state, architecture documentation, and the MVP readiness report.

## License
Proprietary / Closed Source. All rights reserved.
