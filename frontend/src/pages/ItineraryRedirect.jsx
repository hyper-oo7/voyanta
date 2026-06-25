// /itinerary route — opens the active proposal's wizard at the Activities/Itinerary
// step (4). If no active proposal is set, redirects to the proposals list so the
// user can pick one.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProposalBuilder } from '../context/ProposalBuilderContext.jsx';

export default function ItineraryRedirect() {
  const navigate = useNavigate();
  const { activeId } = useProposalBuilder() || {};
  useEffect(() => {
    if (activeId) navigate(`/proposals/wizard?id=${encodeURIComponent(activeId)}&step=4`, { replace: true });
    else navigate('/proposals', { replace: true });
  }, [activeId, navigate]);
  return null;
}
