import { useState, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  Users,
  Wallet,
} from 'lucide-react';
import { useProposalStore } from '../store/proposalStore.js';
import { assembleProposal } from '../services/assemblyService.js';
import { executeRAGQuery } from '../services/api.js';
import { matchVaultResources } from '../services/resourceMatchingService.js';

const PIPELINE_STEPS = [
  { key: 'brief', label: 'Analyzing client brief', icon: '👤' },
  { key: 'rag', label: 'Retrieving supplier documents', icon: '📚' },
  { key: 'vault', label: 'Matching vault inventory', icon: '🏨' },
  { key: 'assemble', label: 'Assembling day-by-day plan', icon: '✨' },
  { key: 'cost', label: 'Calculating costs & margins', icon: '💰' },
  { key: 'done', label: 'Itinerary ready', icon: '✅' },
];

export default function OneClickGenerateButton() {
  const { client, costingPrefs, setProposal, setClient } = useProposalStore();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [error, setError] = useState(null);

  const canGenerate =
    client.destination && (client.duration_days || client.start_date);

  const runGeneration = useCallback(async () => {
    if (!canGenerate) return;
    setIsOpen(true);
    setStepIndex(0);
    setError(null);

    try {
      // ── Step 1: Brief (instant) ──
      await new Promise((r) => setTimeout(r, 400));
      setStepIndex(1);

      // ── Step 2: RAG ──
      const ragRes = await executeRAGQuery({
        destination: client.destination,
        duration_days: client.duration_days,
        travelers: (client.num_adults || 0) + (client.num_children || 0),
        travel_style: client.pace,
        budget_inr: client.budget,
        special_requests: client.special_notes,
      }).catch(() => ({ data: { chunks: [], query: '' } }));

      setStepIndex(2);

      // ── Step 3: Vault matching ──
      const vaultMatches = await matchVaultResources({
        destination: client.destination,
        budgetPerHead: client.budget,
        travelers: (client.num_adults || 0) + (client.num_children || 0),
        durationDays: client.duration_days,
        travelStyle: client.pace,
      });

      setStepIndex(3);

      // ── Step 4-5: Assembly (backend LLM) ──
      const proposal = await assembleProposal(
        {
          client_name: client.customer_name,
          destination: client.destination,
          duration_days: client.duration_days,
          num_travelers: (client.num_adults || 0) + (client.num_children || 0),
          budget_per_head: client.budget,
          start_date: client.start_date,
          end_date: client.end_date,
          pace: client.pace,
          special_notes: client.special_notes,
          arrival_city: client.arrival_city,
          departure_city: client.departure_city,
          arrival_airport: client.arrival_airport,
          departure_airport: client.departure_airport,
          agency_id: 'demo-agency',
        },
        ragRes?.data || { chunks: [], query: '' },
        vaultMatches,
        costingPrefs
      );

      setStepIndex(5);

      // Hydrate store
      setProposal(proposal);
      setClient({
        customer_name: client.customer_name || proposal.name,
        destination: proposal.destination,
        start_date: client.start_date,
        end_date: client.end_date,
      });

      // Let user admire the "Done" state for a moment
      await new Promise((r) => setTimeout(r, 1200));
      setIsOpen(false);
    } catch (err) {
      setError(err.message || 'Generation failed');
      setStepIndex(5);
    }
  }, [canGenerate, client, costingPrefs, setProposal, setClient]);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={runGeneration}
        disabled={!canGenerate || isOpen}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
          canGenerate && !isOpen
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        {isOpen ? 'Generating…' : 'Generate Itinerary'}
      </button>

      {/* Pipeline Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                Building Your Itinerary
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                AI is grounding itself in your vault & supplier docs…
              </p>
            </div>

            {/* Brief Summary */}
            <div className="flex flex-wrap gap-3 justify-center mb-6 text-xs text-gray-600">
              {client.destination && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full">
                  <MapPin className="w-3 h-3" /> {client.destination}
                </span>
              )}
              {client.duration_days && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full">
                  <Calendar className="w-3 h-3" /> {client.duration_days} days
                </span>
              )}
              {client.num_adults > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full">
                  <Users className="w-3 h-3" />{' '}
                  {(client.num_adults || 0) + (client.num_children || 0)} pax
                </span>
              )}
              {client.budget && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full">
                  <Wallet className="w-3 h-3" /> ₹{client.budget}
                </span>
              )}
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {PIPELINE_STEPS.map((step, idx) => {
                const isDone = idx < stepIndex;
                const isActive = idx === stepIndex && !error;
                const isFuture = idx > stepIndex;

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 transition-all duration-500 ${
                      isFuture ? 'opacity-35' : 'opacity-100'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-colors ${
                        isDone
                          ? 'bg-green-100 text-green-600'
                          : isActive
                          ? 'bg-blue-100 text-blue-600 animate-pulse'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isActive ? 'text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      {step.label}
                    </span>
                    {isActive && !error && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500 ml-auto" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Error State */}
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Could not generate itinerary
                  </p>
                  <p className="text-sm text-red-600 mt-0.5">{error}</p>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="mt-3 text-xs font-medium text-red-700 underline hover:no-underline"
                  >
                    Close & add inventory
                  </button>
                </div>
              </div>
            )}

            {/* Success Close */}
            {!error && stepIndex >= 5 && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  View Itinerary
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
