"use client";

import { useState } from "react";

export function ErpRetryButton({
  id,
  kind = "sales",
}: {
  id: string;
  kind?: "sales" | "expenses";
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function retry() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/erp-sync/${kind}/${encodeURIComponent(id)}/retry`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setMessage(
        body?.message || (response.ok ? "Retry berhasil." : "Retry gagal."),
      );
      if (response.ok) window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={retry}
        disabled={loading}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        {loading ? "Retry..." : "Retry"}
      </button>
      {message && <p className="max-w-48 text-xs text-slate-500">{message}</p>}
    </div>
  );
}
