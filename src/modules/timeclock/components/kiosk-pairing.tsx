"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PagaProMark } from "@/components/branding/logo";

const TOKEN_KEY = "pp_timeclock_token";
const DEVICE_LABEL_KEY = "pp_timeclock_device";
const COMPANY_KEY = "pp_timeclock_company";

/**
 * One-time enrolment. The pairing code is single-use and short-lived, so the
 * device token it returns — which lives in this browser's localStorage from then
 * on — cannot be minted twice from the same code.
 */
export function KioskPairing({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pair = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/skano/lidh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await res.json()) as
        | { ok: true; token: string; deviceLabel: string; companyName: string }
        | { ok: false; error: string };

      if (!json.ok) {
        setError(json.error);
        return;
      }

      window.localStorage.setItem(TOKEN_KEY, json.token);
      window.localStorage.setItem(DEVICE_LABEL_KEY, json.deviceLabel);
      window.localStorage.setItem(COMPANY_KEY, json.companyName);
      router.replace("/skano");
    } catch {
      setError("Lidhja dështoi — kontrolloni internetin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B1B33] p-8 text-white">
      <form onSubmit={pair} className="w-full max-w-md space-y-6 text-center">
        <PagaProMark size={64} surface="bareOnDark" className="mx-auto" />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Lidh pajisjen</h1>
          <p className="text-white/60">
            Futni kodin e lidhjes që ju është dhënë nga administratori. Kodi përdoret vetëm një herë.
          </p>
        </div>

        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-2xl border border-white/20 bg-white/[0.06] px-6 py-5 text-center font-mono text-3xl tracking-[0.2em] text-white outline-none focus:border-[#2563EB]"
        />

        {error ? (
          <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-rose-200">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={busy || code.trim().length < 4}
          className="w-full rounded-full bg-[#2563EB] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-40"
        >
          {busy ? "Duke lidhur…" : "Lidh"}
        </button>
      </form>
    </main>
  );
}
