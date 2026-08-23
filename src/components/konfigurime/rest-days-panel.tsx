"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/layout/capability-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadRestDaysAction, saveRestDaysAction } from "@/modules/timeclock/actions/timeclock-actions";

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

/**
 * Which weekdays the time clock pays the weekend premium on. A six-day
 * factory that works Saturdays was paying every Saturday hour at 1.5×,
 * because the weekend was hardcoded to Saturday+Sunday.
 */
export function RestDaysPanel() {
  const canWrite = useCan("company.settings");
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await loadRestDaysAction();
      if (r.ok && r.data) setSelected(new Set(r.data));
    })();
  }, []);

  function toggle(day: number) {
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await saveRestDaysAction({ restDays: [...selected] });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Ditët e pushimit u ruajtën. Orët rillogariten në leximin e radhës.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ditët e pushimit javor (ora e punës)</CardTitle>
        <CardDescription>
          Orët e punuara në këto ditë paguhen me shtesën e fundjavës në orën e punës. Për një
          kompani që punon të shtunave, hiqeni të shtunën — përndryshe çdo orë e shtune paguhet
          si fundjavë.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {selected === null ? (
          <p className="text-sm text-muted-foreground">Duke u ngarkuar…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ditët e pushimit">
              {WEEKDAYS.map((d) => {
                const on = selected.has(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={on}
                    disabled={busy || !canWrite}
                    onClick={() => toggle(d.value)}
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
            <Button
              type="button"
              size="sm"
              className="ml-auto"
              disabled={busy || !canWrite}
              onClick={() => void save()}
            >
              {busy ? "Duke ruajtur…" : "Ruaj"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
