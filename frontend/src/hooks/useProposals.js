import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient.js';
import { fetchProposalsFlat as fetchProposals, createProposal, deleteProposal, deleteAllProposals, duplicateProposal } from '../services/proposalService.js';

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
        return cached || undefined;
      } catch { return undefined; }
    },
  });

  useEffect(() => {
    if (!supabase) return;
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

  return {
    proposals: proposalsQuery.data || [],
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
