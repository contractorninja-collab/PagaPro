"use client";

/** Print/close controls for the annex print view. Hidden when printing (@media print). */
export function AnnexPrintControls() {
  return (
    <div className="no-print" style={{ marginBottom: 24, display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          padding: "8px 18px",
          borderRadius: 8,
          background: "#2563EB",
          color: "#fff",
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
        }}
      >
        Printo
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        style={{
          padding: "8px 18px",
          borderRadius: 8,
          background: "#fff",
          color: "#334155",
          fontWeight: 600,
          border: "1px solid #e2e8f0",
          cursor: "pointer",
        }}
      >
        Mbyll
      </button>
    </div>
  );
}
