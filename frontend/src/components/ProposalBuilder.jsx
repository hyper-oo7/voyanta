import { useState } from "react";
import { generateProposalWithTemplate, saveProposal } from "../services/api";
import { Wand2, Loader2, Save } from "lucide-react";

const TRAVEL_STYLES = [
  { value: "family", label: "Family trip" },
  { value: "couple", label: "Romantic getaway" },
  { value: "adventure", label: "Adventure & trekking" },
  { value: "luxury", label: "Luxury experience" },
  { value: "budget", label: "Budget backpacker" },
  { value: "group", label: "Group tour" },
];

export default function ProposalBuilder({ agencyId = "demo-agency", clientId = "demo-client" }) {
  const [form, setForm] = useState({
    destination: "Manali",
    duration_days: 5,
    travelers: 4,
    travel_style: "family",
    budget_inr: "",
    special_requests: "",
    template_id: "",
    include_images: true,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setSaved(false);
    try {
      const payload = {
        agency_id: agencyId,
        client_id: clientId,
        ...form,
        duration_days: parseInt(form.duration_days, 10),
        travelers: parseInt(form.travelers, 10),
        budget_inr: form.budget_inr ? parseInt(form.budget_inr, 10) : null,
      };
      const res = await generateProposalWithTemplate(payload);
      setResult(res.data);
    } catch (err) {
      alert("Generation failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await saveProposal({
        agency_id: agencyId,
        client_id: clientId,
        template_id: form.template_id || null,
        generated_proposal: result.proposal,
        status: "draft",
      });
      setSaved(true);
    } catch (err) {
      alert("Save failed: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Generate proposal</h2>
      <p style={{ color: "var(--kimi-color-text-secondary, #64748b)", marginBottom: 24, fontSize: 14 }}>
        AI will search your indexed documents, retrieve relevant Manali content, and write a fresh proposal in your agency's voice.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--kimi-color-text-secondary, #64748b)" }}>Destination</label>
          <input
            value={form.destination}
            onChange={(e) => handleChange("destination", e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1px solid var(--kimi-color-border, #cbd5e1)",
              background: "var(--kimi-color-surface, #ffffff)",
              color: "var(--kimi-color-text-primary, #0f172a)",
              fontSize: 14, outline: "none",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--kimi-color-text-secondary, #64748b)" }}>Duration (days)</label>
          <input
            type="number" min={1} max={30}
            value={form.duration_days}
            onChange={(e) => handleChange("duration_days", e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1px solid var(--kimi-color-border, #cbd5e1)",
              background: "var(--kimi-color-surface, #ffffff)",
              color: "var(--kimi-color-text-primary, #0f172a)",
              fontSize: 14, outline: "none",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--kimi-color-text-secondary, #64748b)" }}>Travelers</label>
          <input
            type="number" min={1}
            value={form.travelers}
            onChange={(e) => handleChange("travelers", e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1px solid var(--kimi-color-border, #cbd5e1)",
              background: "var(--kimi-color-surface, #ffffff)",
              color: "var(--kimi-color-text-primary, #0f172a)",
              fontSize: 14, outline: "none",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--kimi-color-text-secondary, #64748b)" }}>Budget (₹, optional)</label>
          <input
            type="number" placeholder="e.g. 75000"
            value={form.budget_inr}
            onChange={(e) => handleChange("budget_inr", e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1px solid var(--kimi-color-border, #cbd5e1)",
              background: "var(--kimi-color-surface, #ffffff)",
              color: "var(--kimi-color-text-primary, #0f172a)",
              fontSize: 14, outline: "none",
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--kimi-color-text-secondary, #64748b)" }}>Travel style</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TRAVEL_STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => handleChange("travel_style", style.value)}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: "1px solid var(--kimi-color-border, #cbd5e1)",
                background: form.travel_style === style.value ? "var(--kimi-color-text-primary, #0f172a)" : "var(--kimi-color-surface, #ffffff)",
                color: form.travel_style === style.value ? "var(--kimi-color-surface, #ffffff)" : "var(--kimi-color-text-primary, #0f172a)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--kimi-color-text-secondary, #64748b)" }}>Special requests</label>
        <textarea
          rows={3}
          placeholder="e.g. They have a 3-year-old, need a crib. Want to include river rafting and paragliding."
          value={form.special_requests}
          onChange={(e) => handleChange("special_requests", e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10,
            border: "1px solid var(--kimi-color-border, #cbd5e1)",
            background: "var(--kimi-color-surface, #ffffff)",
            color: "var(--kimi-color-text-primary, #0f172a)",
            fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            padding: "12px 24px", borderRadius: 10,
            border: "none", background: "var(--kimi-color-text-primary, #0f172a)",
            color: "var(--kimi-color-surface, #ffffff)", fontWeight: 500,
            fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={18} />}
          {loading ? "Generating with AI..." : "Generate proposal"}
        </button>
      </div>

      {result && (
        <div style={{ border: "1px solid var(--kimi-color-border, #cbd5e1)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid var(--kimi-color-border, #cbd5e1)",
            background: "var(--kimi-color-surface-raised, #f8fafc)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 500 }}>{result.proposal.title}</div>
              <div style={{ fontSize: 13, color: "var(--kimi-color-text-tertiary, #94a3b8)", marginTop: 2 }}>
                {result.proposal.destination} · {result.proposal.duration_days} days · {result.is_fallback ? "Fallback layout" : result.template_used}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSave}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  border: "1px solid var(--kimi-color-border, #cbd5e1)",
                  background: "var(--kimi-color-surface, #ffffff)",
                  color: "var(--kimi-color-text-primary, #0f172a)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Save size={14} />
                {saved ? "Saved!" : "Save draft"}
              </button>
            </div>
          </div>
          <div
            dangerouslySetInnerHTML={{ __html: result.rendered_html }}
            style={{ padding: 24, maxHeight: 600, overflow: "auto" }}
          />
        </div>
      )}
    </div>
  );
}
