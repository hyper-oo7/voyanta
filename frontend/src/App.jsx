import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import AuthenticationPage from './pages/AuthenticationPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AiItineraryGeneratorPage from './pages/AiItineraryGeneratorPage.jsx';
import ClientBriefFormPage from './pages/ClientBriefFormPage.jsx';
import ProposalPreviewPage from './pages/ProposalPreviewPage.jsx';
import CostCalculatorPage from './pages/CostCalculatorPage.jsx';
import LibrariesPage from './pages/LibrariesPage.jsx';
import HotelLibraryPage from './pages/HotelLibraryPage.jsx';
import AssetsLibraryPage from './pages/AssetsLibraryPage.jsx';
import AgencyBrandingPage from './pages/AgencyBrandingPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthenticationPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/proposals/new" element={<AiItineraryGeneratorPage />} />
      <Route path="/proposals/brief" element={<ClientBriefFormPage />} />
      <Route path="/proposals/preview" element={<ProposalPreviewPage />} />
      <Route path="/cost-calculator" element={<CostCalculatorPage />} />
      <Route path="/libraries" element={<LibrariesPage />} />
      <Route path="/libraries/hotels" element={<HotelLibraryPage />} />
      <Route path="/libraries/assets" element={<AssetsLibraryPage />} />
      <Route path="/branding" element={<AgencyBrandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
