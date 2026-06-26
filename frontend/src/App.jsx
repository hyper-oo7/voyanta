import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ProposalBuilderProvider } from './context/ProposalBuilderContext.jsx';
import { BackendHealthProvider } from './context/BackendHealthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DiagnosticsPanel from './components/DiagnosticsPanel.jsx';

// Lazy-load all page components for route-based code splitting.
// Only the page the user navigates to is downloaded — cutting initial bundle size.
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const AuthenticationPage = lazy(() => import('./pages/AuthenticationPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const ProposalsListPage = lazy(() => import('./pages/ProposalsListPage.jsx'));
const ProposalWizard = lazy(() => import('./pages/ProposalWizard.jsx'));
const CostCalculatorPage = lazy(() => import('./pages/CostCalculatorPage.jsx'));
const HotelLibraryPage = lazy(() => import('./pages/HotelLibraryPage.jsx'));
const AssetsLibraryPage = lazy(() => import('./pages/AssetsLibraryPage.jsx'));
const AgencyBrandingPage = lazy(() => import('./pages/AgencyBrandingPage.jsx'));
const FlightsPage = lazy(() => import('./pages/FlightsPage.jsx'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage.jsx'));
const ItineraryPage = lazy(() => import('./pages/ItineraryPage.jsx'));
const LibrariesPage = lazy(() => import('./pages/LibrariesPage.jsx'));
const ProposalPreviewPage = lazy(() => import('./pages/ProposalPreviewPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
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
  return (
    <AuthProvider>
      <ToastProvider>
        <BackendHealthProvider>
          <ProposalBuilderProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<AuthenticationPage />} />
              <Route path="/dashboard"           element={<Protected><DashboardPage /></Protected>} />
              <Route path="/proposals"           element={<Protected><ProposalsListPage /></Protected>} />

              {/* Wizard is the primary proposal workflow */}
              <Route path="/proposals/wizard"    element={<Protected><ProposalWizard /></Protected>} />
              {/* Legacy entry-points all funnel into the wizard */}
              <Route path="/proposals/new"       element={<Navigate to="/proposals/wizard" replace />} />
              <Route path="/proposals/brief"     element={<Navigate to="/proposals/wizard" replace />} />
              <Route path="/proposals/preview"   element={<Protected><ProposalPreviewPage /></Protected>} />

              {/* Inventory modules — still accessible standalone for browsing/imports */}
              <Route path="/templates"           element={<Protected><TemplatesPage /></Protected>} />
              <Route path="/itinerary"           element={<Protected><ItineraryPage /></Protected>} />
              <Route path="/activities"          element={<Protected><AssetsLibraryPage /></Protected>} />
              <Route path="/flights"             element={<Protected><FlightsPage /></Protected>} />
              <Route path="/cost-calculator"     element={<Protected><CostCalculatorPage /></Protected>} />
              <Route path="/libraries"           element={<Protected><LibrariesPage /></Protected>} />
              <Route path="/libraries/hotels"    element={<Protected><HotelLibraryPage /></Protected>} />
              <Route path="/libraries/assets"    element={<Protected><AssetsLibraryPage /></Protected>} />
              <Route path="/branding"            element={<Protected><AgencyBrandingPage /></Protected>} />
              <Route path="/settings"            element={<Protected><SettingsPage /></Protected>} />

              <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            <DiagnosticsPanel />
          </ProposalBuilderProvider>
        </BackendHealthProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
