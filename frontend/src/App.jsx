import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ProposalBuilderProvider } from './context/ProposalBuilderContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AuthenticationPage from './pages/AuthenticationPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProposalsListPage from './pages/ProposalsListPage.jsx';
import ProposalWizard from './pages/ProposalWizard.jsx';
import CostCalculatorPage from './pages/CostCalculatorPage.jsx';
import HotelLibraryPage from './pages/HotelLibraryPage.jsx';
import AssetsLibraryPage from './pages/AssetsLibraryPage.jsx';
import AgencyBrandingPage from './pages/AgencyBrandingPage.jsx';
import FlightsPage from './pages/FlightsPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import ItineraryRedirect from './pages/ItineraryRedirect.jsx';
import LibrariesPage from './pages/LibrariesPage.jsx';
import ProposalPreviewPage from './pages/ProposalPreviewPage.jsx';

const Protected = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ProposalBuilderProvider>
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
            <Route path="/itinerary"           element={<Protected><ItineraryRedirect /></Protected>} />
            <Route path="/activities"          element={<Protected><AssetsLibraryPage /></Protected>} />
            <Route path="/flights"             element={<Protected><FlightsPage /></Protected>} />
            <Route path="/cost-calculator"     element={<Protected><CostCalculatorPage /></Protected>} />
            <Route path="/libraries"           element={<Protected><LibrariesPage /></Protected>} />
            <Route path="/libraries/hotels"    element={<Protected><HotelLibraryPage /></Protected>} />
            <Route path="/libraries/assets"    element={<Protected><AssetsLibraryPage /></Protected>} />
            <Route path="/branding"            element={<Protected><AgencyBrandingPage /></Protected>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProposalBuilderProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
