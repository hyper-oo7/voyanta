import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient.js';
import { fetchProposals, createProposal, deleteProposal, duplicateProposal } from '../services/proposalService.js';

export function useProposals() {
  const queryClient = useQueryClient();

  const proposalsQuery = useQuery({
    queryKey: ['proposals'],
    queryFn: fetchProposals,
  });

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('proposals-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, () => {
        queryClient.invalidateQueries({ queryKey: ['proposals'] });
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
    duplicateProposal: duplicateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
