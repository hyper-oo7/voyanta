import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ProposalBuilderProvider } from './context/ProposalBuilderContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AuthenticationPage from './pages/AuthenticationPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AiItineraryGeneratorPage from './pages/AiItineraryGeneratorPage.jsx';
import ClientBriefFormPage from './pages/ClientBriefFormPage.jsx';
import ProposalPreviewPage from './pages/ProposalPreviewPage.jsx';
import ProposalsListPage from './pages/ProposalsListPage.jsx';
import CostCalculatorPage from './pages/CostCalculatorPage.jsx';
import LibrariesPage from './pages/LibrariesPage.jsx';
import HotelLibraryPage from './pages/HotelLibraryPage.jsx';
import AssetsLibraryPage from './pages/AssetsLibraryPage.jsx';
import AgencyBrandingPage from './pages/AgencyBrandingPage.jsx';
import FlightsPage from './pages/FlightsPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';

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
            <Route path="/proposals/new"       element={<Protected><AiItineraryGeneratorPage /></Protected>} />
            <Route path="/proposals/brief"     element={<Protected><ClientBriefFormPage /></Protected>} />
            <Route path="/proposals/preview"   element={<Protected><ProposalPreviewPage /></Protected>} />
            <Route path="/templates"           element={<Protected><TemplatesPage /></Protected>} />
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
