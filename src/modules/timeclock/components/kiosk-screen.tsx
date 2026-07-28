"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PagaProMark } from "@/components/branding/logo";
import { cn } from "@/lib/utils";

/**
 * The door screen.
 *
 * Barcode and RFID readers present themselves as HID keyboards: they type the
 * badge number very fast and press Enter. So there is no driver and no hardware
 * integration here — just one hidden input that keeps stealing focus back, and a
 * submit on Enter. A tablet with a USB reader is a working time clock.
 *
 * Nothing here reveals more than a first name and a last initial. Attendance is
 * personal data, and this screen hangs on a wall.
 */

const TOKEN_KEY = "pp_timeclock_token";
const DEVICE_LABEL_KEY = "pp_timeclock_device";
const COMPANY_KEY = "pp_timeclock_company";
const QUEUE_KEY = "pp_timeclock_queue";

/** How long the big confirmation panel stays up before returning to idle. */
const FLASH_MS = 4000;

interface FeedEntry {
  id: string;
  displayName: string;
  direction: "IN" | "OUT";
  occurredAt: string;
}

interface PunchResult {
  displayName: string;
  direction: "IN" | "OUT";
  occurredAt: string;
  todayMinutes: number;
  duplicateIgnored: boolean;
}

type Flash =
  | { kind: "ok"; result: PunchResult }
  | { kind: "error"; message: string }
  | null;

interface QueuedPunch {
  badgeCode: string;
  deviceReportedAt: string;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("sq-AL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} orë` : `${h} orë ${m} min`;
}

export function KioskScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ready, setReady] = useState(false);

  const [clock, setClock] = useState<string>("");
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [flash, setFlash] = useState<Flash>(null);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setToken(window.localStorage.getItem(TOKEN_KEY));
    setDeviceLabel(window.localStorage.getItem(DEVICE_LABEL_KEY) ?? "");
    setCompanyName(window.localStorage.getItem(COMPANY_KEY) ?? "");
    setReady(true);
  }, []);

  // Wall clock, ticking every second.
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("sq-AL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const showFlash = useCallback((next: Flash) => {
    setFlash(next);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  const readQueue = (): QueuedPunch[] => {
    try {
      const raw = window.localStorage.getItem(QUEUE_KEY);
      return raw ? (JSON.parse(raw) as QueuedPunch[]) : [];
    } catch {
      return [];
    }
  };

  const writeQueue = (items: QueuedPunch[]) => {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    setQueued(items.length);
  };

  /** Drains scans taken while the network was down, oldest first. */
  const drainQueue = useCallback(async (authToken: string) => {
    const items = readQueue();
    if (items.length === 0) return;

    const remaining: QueuedPunch[] = [];
    for (const item of items) {
      try {
        const res = await fetch("/api/skano/punch", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${authToken}` },
          body: JSON.stringify(item),
        });
        if (!res.ok && res.status !== 200) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    writeQueue(remaining);
  }, []);

  // Initial feed load + queue drain.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    void (async () => {
      await drainQueue(token);
      try {
        const res = await fetch("/api/skano/punch", {
          headers: { authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          if (!cancelled) setToken(null);
          window.localStorage.removeItem(TOKEN_KEY);
          return;
        }
        const json = (await res.json()) as { ok: boolean; deviceLabel?: string; feed?: FeedEntry[] };
        if (!cancelled && json.ok) {
          setFeed(json.feed ?? []);
          if (json.deviceLabel) setDeviceLabel(json.deviceLabel);
        }
      } catch {
        /* offline — the screen still accepts scans */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, drainQueue]);

  const keepFocus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // The input must never lose focus, or a scan types into nothing.
  useEffect(() => {
    if (!token) return;
    keepFocus();
    const id = setInterval(keepFocus, 1500);
    return () => clearInterval(id);
  }, [token, keepFocus]);

  const submit = async (badgeCode: string) => {
    const code = badgeCode.trim();
    if (!code || !token) return;

    setBusy(true);
    try {
      const res = await fetch("/api/skano/punch", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ badgeCode: code, deviceReportedAt: new Date().toISOString() }),
      });

      if (res.status === 401) {
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        return;
      }

      const json = (await res.json()) as
        | { ok: true; result: PunchResult; feed: FeedEntry[] }
        | { ok: false; error: string };

      if (json.ok) {
        showFlash({ kind: "ok", result: json.result });
        setFeed(json.feed);
      } else {
        showFlash({ kind: "error", message: json.error });
      }
    } catch {
      // Network down: keep the scan rather than lose it.
      writeQueue([...readQueue(), { badgeCode: code, deviceReportedAt: new Date().toISOString() }]);
      showFlash({ kind: "error", message: "Pa internet — skanimi u ruajt dhe do të dërgohet." });
    } finally {
      setBusy(false);
      keepFocus();
    }
  };

  if (!ready) return null;

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0B1B33] p-8 text-center text-white">
        <PagaProMark size={72} surface="bareOnDark" />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Pajisja nuk është e lidhur</h1>
          <p className="max-w-md text-white/70">
            Kërkoni nga administratori një kod lidhjeje dhe futeni në faqen e lidhjes për ta aktivizuar
            këtë ekran.
          </p>
        </div>
        <Link
          href="/skano/lidh"
          className="rounded-full bg-[#2563EB] px-8 py-3 text-lg font-semibold text-white transition hover:bg-[#1D4ED8]"
        >
          Lidh pajisjen
        </Link>
      </main>
    );
  }

  const ok = flash?.kind === "ok" ? flash.result : null;

  return (
    <main
      className="relative flex min-h-screen flex-col bg-[#0B1B33] text-white"
      onClick={keepFocus}
    >
      {/* HID readers type into this; it is deliberately invisible but focusable. */}
      <input
        ref={inputRef}
        type="text"
        inputMode="none"
        autoComplete="off"
        aria-label="Skano kartelën"
        className="absolute h-px w-px opacity-0"
        onBlur={() => setTimeout(keepFocus, 50)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const value = event.currentTarget.value;
          event.currentTarget.value = "";
          void submit(value);
        }}
      />

      <header className="flex items-center justify-between border-b border-white/10 px-10 py-6">
        <div className="flex items-center gap-4">
          <PagaProMark size={44} surface="bareOnDark" />
          <div>
            <p className="text-lg font-semibold leading-tight">{companyName || "Prezenca"}</p>
            <p className="text-sm text-white/50">{deviceLabel || "Pajisje skanimi"}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-4xl font-semibold tabular-nums leading-none">{clock}</p>
          <p className="mt-1 text-sm text-white/50">
            {new Date().toLocaleDateString("sq-AL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
      </header>

      <div className="grid flex-1 gap-8 p-10 lg:grid-cols-[1.6fr_1fr]">
        {/* Scan target */}
        <section
          className={cn(
            "flex flex-col items-center justify-center rounded-3xl border-2 p-12 text-center transition-colors duration-300",
            ok && ok.direction === "IN" && "border-emerald-400/60 bg-emerald-500/15",
            ok && ok.direction === "OUT" && "border-sky-400/60 bg-sky-500/15",
            flash?.kind === "error" && "border-rose-400/60 bg-rose-500/15",
            !flash && "border-white/15 bg-white/[0.03]",
          )}
        >
          {ok ? (
            <div className="space-y-4">
              <p className="text-2xl font-medium uppercase tracking-[0.2em] text-white/70">
                {ok.direction === "IN" ? "Hyrje" : "Dalje"}
              </p>
              <p className="text-6xl font-bold">{ok.displayName}</p>
              <p className="font-mono text-3xl tabular-nums text-white/80">
                {timeLabel(ok.occurredAt)}
              </p>
              <p className="text-xl text-white/60">
                Kjo ditë pune: {hoursLabel(ok.todayMinutes)}
              </p>
              {ok.duplicateIgnored ? (
                <p className="text-base text-amber-300">Skanim i përsëritur — u injorua.</p>
              ) : null}
            </div>
          ) : flash?.kind === "error" ? (
            <div className="space-y-4">
              <p className="text-6xl">✕</p>
              <p className="text-4xl font-semibold">{flash.message}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/20">
                <span className="text-6xl">⌁</span>
              </div>
              <p className="text-5xl font-semibold">Skano kartelën</p>
              <p className="text-xl text-white/50">
                Vendoseni kartelën para lexuesit — hyrja ose dalja regjistrohet automatikisht.
              </p>
              {busy ? <p className="text-white/40">Duke regjistruar…</p> : null}
            </div>
          )}
        </section>

        {/* Live feed */}
        <section className="flex flex-col rounded-3xl bg-white/[0.04] p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-white/40">
            Skanimet e fundit
          </h2>
          {feed.length === 0 ? (
            <p className="text-white/40">Ende asnjë skanim sot.</p>
          ) : (
            <ul className="space-y-2 overflow-hidden">
              {feed.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3"
                >
                  <span className="truncate text-lg font-medium">{entry.displayName}</span>
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                        entry.direction === "IN"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-sky-500/20 text-sky-300",
                      )}
                    >
                      {entry.direction === "IN" ? "Hyrje" : "Dalje"}
                    </span>
                    <span className="font-mono text-lg tabular-nums text-white/70">
                      {timeLabel(entry.occurredAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {queued > 0 ? (
            <p className="mt-4 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
              {queued} skanime në pritje për t&apos;u dërguar.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
