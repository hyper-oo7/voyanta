import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ProposalBuilderProvider } from './context/ProposalBuilderContext.jsx';
import { BackendHealthProvider } from './context/BackendHealthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
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
const TemplatePreviewPage = lazy(() => import('./pages/TemplatePreviewPage.jsx'));

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

              {/* Wrapped all authenticated routes in AppLayout */}
              <Route element={<Protected><AppLayout /></Protected>}>
                <Route path="/dashboard"           element={<DashboardPage />} />
                <Route path="/proposals"           element={<ProposalsListPage />} />

                {/* Wizard is the primary proposal workflow */}
                <Route path="/proposals/wizard"    element={<ProposalWizard />} />
                <Route path="/proposals/preview"   element={<ProposalPreviewPage />} />

                {/* Inventory modules — still accessible standalone for browsing/imports */}
                <Route path="/templates"           element={<TemplatesPage />} />
                <Route path="/templates/:id"       element={<TemplatePreviewPage />} />
                <Route path="/itinerary"           element={<AssetsLibraryPage />} />
                <Route path="/flights"             element={<FlightsPage />} />
                <Route path="/cost-calculator"     element={<CostCalculatorPage />} />
                <Route path="/libraries"           element={<LibrariesPage />} />
                <Route path="/libraries/hotels"    element={<HotelLibraryPage />} />
                <Route path="/libraries/assets"    element={<AssetsLibraryPage />} />
                <Route path="/branding"            element={<AgencyBrandingPage />} />
                <Route path="/settings"            element={<SettingsPage />} />
              </Route>
              
              {/* Legacy entry-points all funnel into the wizard */}
              <Route path="/proposals/new"       element={<Navigate to="/proposals/wizard" replace />} />
              <Route path="/proposals/brief"     element={<Navigate to="/proposals/wizard" replace />} />

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
