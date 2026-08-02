import { useState } from "react";
import { executeRAGQuery } from "../services/api";
import { Search, Loader2, Database, Layers } from "lucide-react";

export default function RAGQueryPanel({ agencyId = "demo-agency" }) {
  const [query, setQuery] = useState({
    destination: "Manali",
    duration_days: 5,
    travelers: 4,
    travel_style: "family",
    budget_inr: 75000,
    special_requests: "adventure focus",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleQuery = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await executeRAGQuery({
        agency_id: agencyId,
        ...query,
      });
      setResult(res.data?.data || res.data);
    } catch (err) {
      alert("RAG query failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 850 }}>
      <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>RAG Knowledge Search</h2>
      <p style={{ color: "var(--kimi-color-text-secondary, #64748b)", marginBottom: 20, fontSize: 14 }}>
        Test vector retrieval against your indexed PDF documents and itinerary blocks.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <input
          placeholder="Destination"
          value={query.destination}
          onChange={(e) => setQuery({ ...query, destination: e.target.value })}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
        />
        <input
          placeholder="Travel Style"
          value={query.travel_style}
          onChange={(e) => setQuery({ ...query, travel_style: e.target.value })}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
        />
      </div>

      <button
        onClick={handleQuery}
        disabled={loading}
        style={{
          padding: "10px 20px", borderRadius: 8, border: "none",
          background: "var(--kimi-color-text-primary, #0f172a)", color: "#ffffff",
          fontWeight: 500, cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 8, marginBottom: 24
        }}
      >
        {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={16} />}
        {loading ? "Retrieving vector chunks..." : "Run RAG retrieval"}
      </button>

      {result && (
        <div style={{ background: "#f8fafc", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginBottom: 12, color: "#0f172a" }}>
            <Database size={18} />
            Found {result.chunk_count || (result.chunks || []).length} Chunks
          </div>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
            <strong>Assembled RAG Query:</strong> {result.query}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(result.chunks || []).map((chunk, idx) => (
              <div key={idx} style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #cbd5e1" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Layers size={14} />
                  Chunk {idx + 1} | Section: {chunk.metadata?.section_title || "General"} | Similarity: {chunk.similarity ? (chunk.similarity * 100).toFixed(1) + "%" : "N/A"}
                </div>
                <div style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {chunk.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
