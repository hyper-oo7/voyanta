import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient.js';
import { fetchProposalsFlat as fetchProposals, createProposal, deleteProposal, deleteAllProposals, duplicateProposal } from '../services/proposalService.js';

const EMPTY_PROPOSALS = Object.freeze([]);

export function normalizeProposalsData(rawData) {
  if (Array.isArray(rawData)) return rawData;
  if (rawData && Array.isArray(rawData.data)) return rawData.data;
  return EMPTY_PROPOSALS;
}

export function useProposals() {
  const queryClient = useQueryClient();

  const proposalsQuery = useQuery({
    queryKey: ['proposals'],
    queryFn: fetchProposals,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    initialData: () => {
      try {
        const cached = JSON.parse(localStorage.getItem('voyanta_proposals_list_cache') || 'null');
        if (Array.isArray(cached)) return cached;
        if (cached && Array.isArray(cached.data)) return cached.data;
        return undefined;
      } catch { return undefined; }
    },
  });

  useEffect(() => {
    const handleUpdate = () => queryClient.invalidateQueries({ queryKey: ['proposals'] });
    window.addEventListener('voyanta:proposals-updated', handleUpdate);
    
    if (!supabase) return () => window.removeEventListener('voyanta:proposals-updated', handleUpdate);
    let lastInvalidated = 0;
    const channel = supabase.channel('proposals-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, () => {
        const now = Date.now();
        if (now - lastInvalidated > 30000) {
          lastInvalidated = now;
          queryClient.invalidateQueries({ queryKey: ['proposals'] });
        }
      })
      .subscribe();
    return () => {
      window.removeEventListener('voyanta:proposals-updated', handleUpdate);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: createProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllProposals,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });

  const rawData = proposalsQuery.data;

  // Memoised so the identity only changes when the underlying query data does.
  //
  // Previously this ran on every render and produced a brand-new [] whenever
  // `data` was not an array — which is the whole window between mount and the
  // first successful fetch, i.e. exactly what happens right after login/signup
  // when there is no cached list in localStorage. Consumers with
  // `useEffect(..., [proposals])` then re-ran on every render, and because
  // those effects call setState, each pass scheduled another render. The result
  // was hundreds of duplicate API calls per second until the query settled.
  const safeProposals = useMemo(() => normalizeProposalsData(rawData), [rawData]);

  return {
    proposals: safeProposals,
    isLoading: proposalsQuery.isLoading,
    isError: proposalsQuery.isError,
    error: proposalsQuery.error,
    createProposal: createMutation.mutateAsync,
    deleteProposal: deleteMutation.mutateAsync,
    deleteAllProposals: deleteAllMutation.mutateAsync,
    duplicateProposal: duplicateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending || deleteAllMutation.isPending,
  };
}
