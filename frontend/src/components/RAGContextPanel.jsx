import { useState, useEffect } from 'react';
import { executeRAGQuery } from '../services/api.js';
import { matchVaultResources } from '../services/resourceMatchingService.js';
import {
  Database,
  BookOpen,
  Layers,
  RefreshCw,
  X,
  MapPin,
  Hotel,
  Plane,
  Ticket,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useProposalStore } from '../store/proposalStore.js';

export default function RAGContextPanel({ isOpen, onClose }) {
  const { client, proposal } = useProposalStore();
  const [ragData, setRagData] = useState(null);
  const [vaultData, setVaultData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('rag'); // 'rag' | 'vault'

  const loadContext = async () => {
    if (!client.destination) return;
    setLoading(true);
    try {
      const [ragRes, vaultRes] = await Promise.all([
        executeRAGQuery({
          destination: client.destination,
          duration_days: client.duration_days,
          travelers: (client.num_adults || 0) + (client.num_children || 0),
          travel_style: client.pace || 'medium',
          budget_inr: client.budget,
          special_requests: client.special_notes,
        }).catch(() => ({ data: { chunks: [], query: '' } })),

        matchVaultResources({
          destination: client.destination,
          budgetPerHead: client.budget,
          travelers: (client.num_adults || 0) + (client.num_children || 0),
          durationDays: client.duration_days,
          travelStyle: client.pace,
        }).catch(() => ({ hotels: [], activities: [], flights: [], templates: [] })),
      ]);

      setRagData(ragRes?.data || { chunks: [], query: '' });
      setVaultData(vaultRes);
    } catch (e) {
      console.error('RAG context load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && client.destination) {
      loadContext();
    }
  }, [isOpen, client.destination, client.duration_days, client.budget, client.pace]);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          AI Context
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={loadContext}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh context"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('rag')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'rag'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <BookOpen className="w-4 h-4" />
            Retrieved Docs
            {ragData?.chunks?.length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                {ragData.chunks.length}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('vault')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'vault'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <Database className="w-4 h-4" />
            Vault Matches
            {vaultData && (
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                {(vaultData.hotels?.length || 0) +
                  (vaultData.activities?.length || 0) +
                  (vaultData.flights?.length || 0)}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && (
          <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading AI context...
          </div>
        )}

        {/* RAG Chunks Tab */}
        {!loading && activeTab === 'rag' && (
          <div className="space-y-4">
            {ragData?.query && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Assembled Query
                </p>
                <p className="text-sm text-gray-800 font-medium">{ragData.query}</p>
              </div>
            )}

            {ragData?.chunks?.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No documents retrieved yet.</p>
                <p className="text-xs mt-1 max-w-[240px] mx-auto">
                  Upload supplier PDFs to your vault so RAG can ground the AI with real inventory.
                </p>
              </div>
            )}

            {ragData?.chunks?.map((chunk, idx) => (
              <div key={idx} className="group">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                  <div className="mt-0.5 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <span className="font-medium text-gray-700">
                        {chunk.source || 'Unknown source'}
                      </span>
                      {chunk.score != null && (
                        <span className="text-gray-400">
                          • {(chunk.score * 100).toFixed(0)}% match
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-800 leading-relaxed line-clamp-4 group-hover:line-clamp-none transition-all">
                      {chunk.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Vault Matches Tab */}
        {!loading && activeTab === 'vault' && (
          <div className="space-y-6">
            {/* Hotels */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Hotel className="w-4 h-4 text-amber-500" />
                Hotels
                <span className="text-xs font-normal text-gray-400">
                  ({vaultData?.hotels?.length || 0})
                </span>
              </h3>
              {vaultData?.hotels?.length === 0 && (
                <p className="text-xs text-gray-400 pl-6">No matching hotels in vault.</p>
              )}
              <div className="space-y-2">
                {vaultData?.hotels?.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-amber-200 hover:bg-amber-50/20 transition-all"
                  >
                    {h.image_url ? (
                      <img
                        src={h.image_url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Hotel className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{h.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {h.location || h.country || 'Unknown'}
                        {h.price_per_night && (
                          <span className="text-amber-600 font-medium">
                            • ₹{h.price_per_night}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activities */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Ticket className="w-4 h-4 text-emerald-500" />
                Activities
                <span className="text-xs font-normal text-gray-400">
                  ({vaultData?.activities?.length || 0})
                </span>
              </h3>
              {vaultData?.activities?.length === 0 && (
                <p className="text-xs text-gray-400 pl-6">No matching activities in vault.</p>
              )}
              <div className="space-y-2">
                {vaultData?.activities?.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Ticket className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                      <p className="text-xs text-gray-500">
                        {a.type || 'Activity'}
                        {a.price && (
                          <span className="text-emerald-600 font-medium">• ₹{a.price}</span>
                        )}
                        {a.duration_hours && <span>• {a.duration_hours}h</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Flights */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Plane className="w-4 h-4 text-sky-500" />
                Flights
                <span className="text-xs font-normal text-gray-400">
                  ({vaultData?.flights?.length || 0})
                </span>
              </h3>
              {vaultData?.flights?.length === 0 && (
                <p className="text-xs text-gray-400 pl-6">No matching flights in vault.</p>
              )}
              <div className="space-y-2">
                {vaultData?.flights?.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-sky-200 hover:bg-sky-50/20 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Plane className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {f.airline}{' '}
                        <span className="text-gray-500 font-normal">{f.flight_no}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {f.origin} → {f.destination}
                        {f.cost && (
                          <span className="text-sky-600 font-medium">• ₹{f.cost}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>
            This context is fed into the AI whenever you generate or edit the itinerary.
          </span>
        </div>
      </div>
    </div>
  );
}
