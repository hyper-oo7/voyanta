import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// "Active proposal" context: the proposal the user is currently assembling.
// Holds the proposal id in localStorage so navigation between Hotels/Flights/
// Activities/Itinerary keeps the same proposal in scope.

const KEY = 'voyanta_active_proposal_id';
const Ctx = createContext(null);

export function ProposalBuilderProvider({ children }) {
  const [activeId, setActiveId] = useState(() => localStorage.getItem(KEY) || null);
  useEffect(() => {
    if (activeId) localStorage.setItem(KEY, activeId);
    else localStorage.removeItem(KEY);
  }, [activeId]);
  const set = useCallback((id) => setActiveId(id || null), []);
  return <Ctx.Provider value={{ activeId, setActiveId: set }}>{children}</Ctx.Provider>;
}

export const useProposalBuilder = () => useContext(Ctx);
