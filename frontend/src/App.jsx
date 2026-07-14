import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { ToastProvider } from './context/ToastContext.jsx';
import { BackendHealthProvider } from './context/BackendHealthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import DiagnosticsPanel from './components/DiagnosticsPanel.jsx';
import GoogleTranslateWidget from './components/GoogleTranslateWidget.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

// Lazy-load all page components for route-based code splitting.
// Only the page the user navigates to is downloaded — cutting initial bundle size.
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const AuthenticationPage = lazy(() => import('./pages/AuthenticationPage.jsx'));
const WebViewPage = lazy(() => import('./pages/WebViewPage.jsx'));
const ProposalPrintRoute = lazy(() => import('./pages/ProposalPrintRoute.jsx'));
const ProposalActionRoute = lazy(() => import('./pages/ProposalActionRoute.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const ProposalsListPage = lazy(() => import('./pages/ProposalsListPage.jsx'));
const CrmPage = lazy(() => import('./pages/CrmPage.jsx'));
const ContactsPage = lazy(() => import('./pages/ContactsPage.jsx'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage.jsx'));
const MyVaultPage = lazy(() => import('./pages/MyVaultPage.jsx'));
const UnifiedLibraryPage = lazy(() => import('./pages/UnifiedLibraryPage.jsx'));
const ProposalWizard = lazy(() => import('./pages/ProposalWizard.jsx'));
const CostCalculatorPage = lazy(() => import('./pages/CostCalculatorPage.jsx'));
const HotelLibraryPage = lazy(() => import('./pages/HotelLibraryPage.jsx'));
const AssetsLibraryPage = lazy(() => import('./pages/AssetsLibraryPage.jsx'));
const FlightsPage = lazy(() => import('./pages/FlightsPage.jsx'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage.jsx'));
const TemplatePreviewPage = lazy(() => import('./pages/TemplatePreviewPage.jsx'));
const PlanPage = lazy(() => import('./pages/PlanPage.jsx'));

const ItineraryLibraryPage = lazy(() => import('./pages/ItineraryLibraryPage.jsx'));
const NewItineraryPage = lazy(() => import('./pages/NewItineraryPage.jsx'));
const ItineraryEditorPage = lazy(() => import('./pages/ItineraryEditorPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'));
const TermsOfService = lazy(() => import('./pages/TermsOfService.jsx'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy.jsx'));
const HowToUsePage = lazy(() => import('./pages/HowToUsePage.jsx'));
const ContactPage = lazy(() => import('./pages/ContactPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

const Protected = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

// Minimal loading indicator shown while a lazy chunk downloads
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <span className="material-symbols-outlined text-primary" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }}>progress_activity</span>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    const unsub = useAuthStore.getState().initAuth();
    return () => unsub();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
        <ToastProvider>
        <BackendHealthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<AuthenticationPage />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/cookies" element={<CookiePolicy />} />
              <Route path="/how-to-use" element={<HowToUsePage />} />
              <Route path="/contact" element={<ContactPage />} />
              
              {/* Public routes for PDF printing & client action tracking */}
              <Route path="/proposals/:id/print" element={<ProposalPrintRoute />} />
              <Route path="/proposal-action" element={<ProposalActionRoute />} />
              <Route path="/view/:token" element={<WebViewPage />} />

              {/* Wrapped all authenticated routes in AppLayout */}
              <Route element={<Protected><AppLayout /></Protected>}>
                <Route path="/dashboard"           element={<DashboardPage />} />
                <Route path="/proposals"           element={<ProposalsListPage />} />
                <Route path="/crm"                 element={<CrmPage />} />
                <Route path="/contacts"            element={<ContactsPage />} />
                <Route path="/library"             element={<UnifiedLibraryPage />} />
                <Route path="/invoices"            element={<InvoicesPage />} />
                <Route path="/vault"               element={<MyVaultPage />} />

                {/* Wizard is the primary proposal workflow */}
                <Route path="/proposals/wizard"    element={<ProposalWizard />} />
                <Route path="/proposals/preview"   element={<Navigate to="/proposals/wizard" replace />} />

                {/* Inventory modules — still accessible standalone for browsing/imports */}
                <Route path="/templates"           element={<TemplatesPage />} />
                <Route path="/templates/:id"       element={<TemplatePreviewPage />} />
                <Route path="/itinerary"           element={<ItineraryLibraryPage />} />
                <Route path="/itinerary/new"       element={<NewItineraryPage />} />
                <Route path="/itinerary/:id"       element={<ItineraryEditorPage />} />
                <Route path="/flights"             element={<FlightsPage />} />
                <Route path="/cost-calculator"     element={<CostCalculatorPage />} />
                <Route path="/libraries"           element={<Navigate to="/templates" replace />} />
                <Route path="/libraries/hotels"    element={<HotelLibraryPage />} />
                <Route path="/libraries/assets"    element={<AssetsLibraryPage />} />
                <Route path="/settings"            element={<SettingsPage />} />
                <Route path="/plan"                element={<PlanPage />} />
              </Route>
              
              {/* Legacy entry-points all funnel into the wizard */}
              <Route path="/proposals/new"       element={<Navigate to="/proposals/wizard" replace />} />
              <Route path="/proposals/brief"     element={<Navigate to="/proposals/wizard" replace />} />

              <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            <DiagnosticsPanel />
            <GoogleTranslateWidget />
        </BackendHealthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
