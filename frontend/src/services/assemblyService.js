import { api, executeRAGQuery } from './api.js';
import { matchVaultResources } from './resourceMatchingService.js';
import { TimeoutError, ServerError } from '../utils/apiErrors.js';

export async function generateGroundedProposal(intakeData, costingPrefs) {
  const [ragRes, vaultMatches] = await Promise.all([
    executeRAGQuery({
      agency_id: intakeData.agency_id || 'demo-agency',
      destination: intakeData.destination,
      duration_days: intakeData.duration_days,
      travelers: intakeData.num_travelers,
      travel_style: intakeData.pace || 'medium',
      budget_inr: intakeData.budget_per_head,
      special_requests: intakeData.special_notes || '',
    }).catch((err) => {
      console.warn('[1-Shot] RAG query failed, continuing without doc context:', err);
      return { data: { chunks: [], query: '' } };
    }),

    matchVaultResources({
      destination: intakeData.destination,
      budgetPerHead: intakeData.budget_per_head,
      travelers: intakeData.num_travelers,
      durationDays: intakeData.duration_days,
      travelStyle: intakeData.pace,
    }).catch((err) => {
      console.warn('[1-Shot] Vault matching failed:', err);
      return { hotels: [], activities: [], flights: [], templates: [] };
    }),
  ]);

  return assembleProposal(
    intakeData,
    { chunks: ragRes?.data?.chunks || [], assembled_query: ragRes?.data?.query || '' },
    vaultMatches,
    costingPrefs
  );
}

/**
 * Call the agentic assembly API with full grounding context.
 * Uses the api client's built-in retry & timeout logic.
 */
export async function assembleProposal(intakeData, ragContext, vaultMatches, costingPrefs) {
  const payload = {
    client_name: intakeData.client_name || 'Valued Traveler',
    destination: intakeData.destination,
    duration_days: intakeData.duration_days || 5,
    num_travelers: intakeData.num_travelers || 2,
    budget_per_head: intakeData.budget_per_head || null,
    start_date: intakeData.start_date || null,
    end_date: intakeData.end_date || null,
    pace: intakeData.pace || 'medium',
    special_notes: intakeData.special_notes || '',
    arrival_city: intakeData.arrival_city || '',
    departure_city: intakeData.departure_city || '',
    arrival_airport: intakeData.arrival_airport || '',
    departure_airport: intakeData.departure_airport || '',
    agency_id: intakeData.agency_id || 'demo-agency',
    rag_context: ragContext || { chunks: [], assembled_query: '' },
    vault_matches: vaultMatches || { hotels: [], activities: [], flights: [], templates: [] },
    costing_prefs: costingPrefs || {
      fixed_markup: 0,
      pct_markup: 15,
      discount: 0,
      tax: 5,
      margin_type: 'percentage',
      margin_value: 15,
      visibility_mode: 'ITEMIZED',
    },
  };

  // api.post auto-detects /assemble-1shot and applies GENERATION_TIMEOUT_MS (120s)
  // plus up to 3 retries on 502/503/timeout.
  const res = await api.post('/api/assemble-1shot', payload);

  if (res?.status === 'success' && res.proposal) {
    return res.proposal;
  }

  if (res?.status === 'insufficient_inventory') {
    const err = new Error(
      res.detail ||
        'Not enough inventory in your vault for this destination. Add hotels, activities, or supplier PDFs first.'
    );
    err.code = 'INSUFFICIENT_INVENTORY';
    throw err;
  }

  throw new Error(res?.detail || 'Itinerary assembly failed. Please try again.');
}

/**
 * Upload a PDF with progress tracking.
 */
export async function uploadPdfWithProgress(file, agencyId, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('agency_id', agencyId);
  formData.append('currency', 'INR');

  return api.upload('/api/import/process', formData, {
    onProgress,
    timeout: 60000,
  });
}
