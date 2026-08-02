import { useState, useCallback } from "react";
import { Upload, FileText, X, Loader2, CheckCircle } from "lucide-react";
import { uploadDocument, listDocuments, deleteDocument } from "../services/api";

export default function PDFUploader({ agencyId = "demo-agency" }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState([]);
  const [message, setMessage] = useState("");

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setMessage("");

    const results = [];
    for (const file of files) {
      try {
        const res = await uploadDocument(file, agencyId);
        results.push({ name: file.name, status: "success", data: res.data });
      } catch (err) {
        results.push({ name: file.name, status: "error", error: err.message });
      }
    }

    setFiles([]);
    setUploading(false);
    const successCount = results.filter((r) => r.status === "success").length;
    setMessage(`${successCount} of ${results.length} files uploaded & indexed.`);
    fetchDocs();
  };

  const fetchDocs = async () => {
    try {
      const res = await listDocuments(agencyId);
      setDocs(res.data.documents || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm("Delete this document and all its indexed data?")) return;
    try {
      await deleteDocument(docId, agencyId);
      fetchDocs();
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Upload travel documents</h2>
      <p style={{ color: "var(--kimi-color-text-secondary, #64748b)", marginBottom: 16, fontSize: 14 }}>
        Upload past proposals, supplier quotes, hotel confirmations, or itinerary PDFs.
        AI will extract text, chunk it, and index into your knowledge base.
      </p>

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          border: "2px dashed var(--kimi-color-border, #cbd5e1)",
          borderRadius: 12,
          padding: "32px 24px",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
        onClick={() => document.getElementById("file-input").click()}
      >
        <Upload size={32} style={{ color: "var(--kimi-color-text-tertiary, #94a3b8)", marginBottom: 8 }} />
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Drop PDFs here or click to browse</div>
        <div style={{ fontSize: 13, color: "var(--kimi-color-text-tertiary, #94a3b8)" }}>
          Supports PDF, PNG, JPEG — up to 20MB each
        </div>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,image/*"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {files.map((file, idx) => (
            <div
              key={idx}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 10,
                border: "1px solid var(--kimi-color-border, #e2e8f0)",
                marginBottom: 8, background: "var(--kimi-color-surface, #ffffff)",
              }}
            >
              <FileText size={18} style={{ color: "var(--kimi-color-text-tertiary, #94a3b8)" }} />
              <span style={{ flex: 1, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </span>
              <button
                onClick={() => removeFile(idx)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--kimi-color-text-tertiary, #94a3b8)" }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              marginTop: 8, padding: "10px 20px", borderRadius: 10,
              border: "none", background: "var(--kimi-color-text-primary, #0f172a)",
              color: "var(--kimi-color-surface, #ffffff)", fontWeight: 500,
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.6 : 1,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {uploading && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
            {uploading ? "Indexing documents..." : "Upload & index"}
          </button>
        </div>
      )}

      {message && (
        <div style={{
          marginTop: 12, padding: 12, borderRadius: 10,
          background: "#f0fdf4",
          color: "#166534", fontSize: 14,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle size={16} />
          {message}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 17, fontWeight: 500 }}>Indexed documents</h3>
          <button onClick={fetchDocs} style={{ fontSize: 13, color: "var(--kimi-color-text-secondary, #64748b)", background: "none", border: "none", cursor: "pointer" }}>
            Refresh
          </button>
        </div>
        {docs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--kimi-color-text-tertiary, #94a3b8)", fontSize: 14 }}>
            No documents indexed yet. Upload your first PDF above.
          </div>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 10,
                border: "1px solid var(--kimi-color-border, #e2e8f0)",
                marginBottom: 8, background: "var(--kimi-color-surface, #ffffff)",
              }}
            >
              <FileText size={18} style={{ color: "var(--kimi-color-text-tertiary, #94a3b8)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {doc.filename}
                </div>
                <div style={{ fontSize: 12, color: "var(--kimi-color-text-tertiary, #94a3b8)" }}>
                  {doc.status} · {doc.page_count || "?"} pages · {new Date(doc.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--kimi-color-text-tertiary, #94a3b8)" }}
                title="Delete"
              >
                <X size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
