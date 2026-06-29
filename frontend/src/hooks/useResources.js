import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient.js';
import { hotelsService, flightsService, activitiesService, templatesService, itinerariesService } from '../services/resourceService.js';

function createResourceHook(resourceName, service) {
  return function useResourceHook(filters = {}) {
    const queryClient = useQueryClient();
    const queryKey = [resourceName, filters];

    const listQuery = useQuery({
      queryKey,
      queryFn: () => service.list(filters),
    });

    useEffect(() => {
      if (!supabase) return;
      const channel = supabase.channel(`${resourceName}-channel`)
        .on('postgres_changes', { event: '*', schema: 'public', table: resourceName }, () => {
          queryClient.invalidateQueries({ queryKey: [resourceName] });
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }, [queryClient]);

    const createMutation = useMutation({
      mutationFn: service.create,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [resourceName] });
      },
    });

    const updateMutation = useMutation({
      mutationFn: ({ id, patch }) => service.update(id, patch),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [resourceName] });
      },
    });

    const deleteMutation = useMutation({
      mutationFn: service.remove,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [resourceName] });
      },
    });

    return {
      data: listQuery.data || [],
      isLoading: listQuery.isLoading,
      isError: listQuery.isError,
      error: listQuery.error,
      create: createMutation.mutateAsync,
      update: updateMutation.mutateAsync,
      remove: deleteMutation.mutateAsync,
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
    };
  };
}

export const useHotels = createResourceHook('hotels', hotelsService);
export const useFlights = createResourceHook('flights', flightsService);
export const useActivities = createResourceHook('activities', activitiesService);
export const useTemplates = createResourceHook('templates', templatesService);
export const useItineraries = createResourceHook('itineraries', itinerariesService);
