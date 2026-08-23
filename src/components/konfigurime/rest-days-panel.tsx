"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/layout/capability-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadTimeclockRulesAction,
  saveTimeclockRulesAction,
  type TimeclockRulesDto,
} from "@/modules/timeclock/actions/timeclock-actions";

/** Monday-first display order; values match Date#getUTCDay (0 = Sunday). */
const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Hën" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mër" },
  { value: 4, label: "Enj" },
  { value: 5, label: "Pre" },
  { value: 6, label: "Sht" },
  { value: 0, label: "Die" },
];

const ROUNDING_OPTIONS = [0, 5, 10, 15] as const;
const BREAK_OPTIONS = [0, 30, 45, 60] as const;

const FIELD =
  "h-9 rounded-lg border border-line bg-white px-2 text-[13px] text-ink-700 disabled:cursor-not-allowed disabled:opacity-60";
const LABEL = "text-[11px] font-bold uppercase tracking-[0.04em] text-ink-400";

/**
 * The time clock's pay-policy switches: which days count as weekend, whether
 * punches round, and whether an unpaid meal break is deducted automatically.
 * All default to off / Sat+Sun, so a company that never opens this panel is
 * exactly where it was before the panel existed.
 */
export function RestDaysPanel() {
  const canWrite = useCan("company.settings");
  const [rules, setRules] = useState<TimeclockRulesDto | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await loadTimeclockRulesAction();
      if (r.ok && r.data) setRules(r.data);
    })();
  }, []);

  function toggleDay(day: number) {
    setRules((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.restDays);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return { ...prev, restDays: [...next] };
    });
  }

  async function save() {
    if (!rules) return;
    setBusy(true);
    try {
      const r = await saveTimeclockRulesAction(rules);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Rregullat u ruajtën. Orët rillogariten në leximin e radhës.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rregullat e orës së punës</CardTitle>
        <CardDescription>
          Vlejnë vetëm për orët e regjistruara në kiosk — pagat mujore fikse nuk preken.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {rules === null ? (
          <p className="text-sm text-muted-foreground">Duke u ngarkuar…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <p className={LABEL}>Ditët e pushimit javor</p>
              <p className="text-[12.5px] text-muted-foreground">
                Orët në këto ditë paguhen me shtesën e fundjavës. Për një kompani që punon të
                shtunave, hiqeni të shtunën.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Ditët e pushimit">
                {WEEKDAYS.map((d) => {
                  const on = rules.restDays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      aria-pressed={on}
                      disabled={busy || !canWrite}
                      onClick={() => toggleDay(d.value)}
                      className={`h-9 w-12 rounded-lg border text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        on
                          ? "border-brand-blue bg-tone-info-bg text-brand-blue"
                          : "border-line bg-white text-ink-500 hover:bg-fill-faint"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="punch-rounding" className={LABEL}>
                  Rrumbullakimi i skanimeve
                </label>
                <p className="text-[12.5px] text-muted-foreground">
                  Në minutën më të afërt — simetrik, kurrë vetëm në dëm të punonjësit.
                </p>
                <select
                  id="punch-rounding"
                  className={FIELD}
                  value={rules.punchRoundingMinutes}
                  disabled={busy || !canWrite}
                  onChange={(e) =>
                    setRules({ ...rules, punchRoundingMinutes: Number(e.target.value) })
                  }
                >
                  <option value={0}>Pa rrumbullakim (minutë për minutë)</option>
                  {ROUNDING_OPTIONS.filter((o) => o !== 0).map((o) => (
                    <option key={o} value={o}>
                      {o} minuta
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="break-deduct" className={LABEL}>
                  Pauza e papaguar automatike
                </label>
                <p className="text-[12.5px] text-muted-foreground">
                  Zbritet nga ditët mbi 6 orë pa dalje të skanuar. Kush skanon pauzën e vet nuk
                  zbriten dy herë. Pauza 30-min e Nenit 64 mbetet e paguar — kjo është për pauza
                  shtesë sipas kontratës.
                </p>
                <select
                  id="break-deduct"
                  className={FIELD}
                  value={rules.breakDeductMinutes}
                  disabled={busy || !canWrite}
                  onChange={(e) => setRules({ ...rules, breakDeductMinutes: Number(e.target.value) })}
                >
                  <option value={0}>Pa zbritje automatike</option>
                  {BREAK_OPTIONS.filter((o) => o !== 0).map((o) => (
                    <option key={o} value={o}>
                      {o} minuta
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" size="sm" disabled={busy || !canWrite} onClick={() => void save()}>
                {busy ? "Duke ruajtur…" : "Ruaj rregullat"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
