"use client";

import type { CompanyHolidayCategory } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CompanyHolidayDto } from "@/modules/payroll/services/company-holiday-service";
import {
  createCompanyHolidayAction,
  deleteCompanyHolidayAction,
  loadCompanyHolidaysAction,
  seedKosovoOfficialFixedHolidaysAction,
  toggleCompanyHolidayActiveAction,
} from "@/modules/konfigurime/actions/company-holiday-actions";

const CATEGORY_LABELS: Record<CompanyHolidayCategory, string> = {
  KOSOVO_OFFICIAL_FIXED: "Kosovë — festë zyrtare (fikse)",
  KOSOVO_OFFICIAL_MOVABLE: "Kosovë — festë zyrtare (lëvizëse)",
  COMPANY_CUSTOM: "Festë kompanie / kolektive",
};

export function HolidaySettingsPanel({
  defaultYear,
  initialHolidays,
}: {
  defaultYear: number;
  initialHolidays: CompanyHolidayDto[];
}) {
  const [year, setYear] = useState(defaultYear);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [busy, setBusy] = useState(false);

  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<CompanyHolidayCategory>("COMPANY_CUSTOM");

  useEffect(() => {
    setYear(defaultYear);
    setHolidays(initialHolidays);
  }, [defaultYear, initialHolidays]);

  const refresh = useCallback(async (y: number) => {
    setBusy(true);
    try {
      const res = await loadCompanyHolidaysAction(y);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHolidays(res.holidays);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleSeed = async () => {
    setBusy(true);
    try {
      const res = await seedKosovoOfficialFixedHolidaysAction(year);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`U përditësuan ${res.upserted} festa zyrtare fikse për vitin ${year}.`);
      await refresh(year);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const res = await toggleCompanyHolidayActiveAction({ id, isActive });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setHolidays((prev) => prev.map((h) => (h.id === id ? { ...h, isActive } : h)));
  };

  const handleDelete = async (id: string) => {
    if (!globalThis.confirm("Fshi këtë festë nga kalendari i kompanisë?")) return;
    const res = await deleteCompanyHolidayAction({ id });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    toast.success("Festa u hoq.");
  };

  const handleAdd = async () => {
    const res = await createCompanyHolidayAction({
      calendarYear: year,
      observedOnIso: newDate,
      name: newName,
      category: newCategory,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Festa u shtua.");
    setNewDate("");
    setNewName("");
    await refresh(year);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Festat publike &amp; ditët e pushimit</CardTitle>
          <CardDescription>
            Konfigurimi vjetor për kompaninë aktive. Payroll-i përjashton automatikisht fundjavat dhe festat{" "}
            <strong className="text-foreground">aktive</strong> nga norma mujore e orëve të rregullta.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="holiday-year">Viti</Label>
            <Input
              id="holiday-year"
              type="number"
              className="w-28"
              min={2000}
              max={2100}
              value={year}
              disabled={busy}
              onChange={(e) => setYear(Number(e.target.value))}
              onBlur={() => void refresh(year)}
            />
          </div>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void refresh(year)}>
            Ringarko
          </Button>
          <Button type="button" disabled={busy} onClick={() => void handleSeed()}>
            Importo festat fikse zyrtare (XK)
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Emërtimi</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Aktive</th>
                <th className="px-3 py-2 text-right">Veprim</th>
              </tr>
            </thead>
            <tbody>
              {holidays.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Nuk ka rreshta për {year}. Importoni festat zyrtare ose shtoni një festë të personalizuar.
                  </td>
                </tr>
              ) : (
                holidays.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{h.observedOn}</td>
                    <td className="px-3 py-2">{h.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{CATEGORY_LABELS[h.category]}</td>
                    <td className="px-3 py-2">
                      <Switch
                        checked={h.isActive}
                        disabled={busy}
                        onCheckedChange={(v) => void handleToggle(h.id, v)}
                        aria-label={`Aktive ${h.observedOn}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void handleDelete(h.id)}>
                        Fshi
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 rounded-md border border-border bg-muted/15 p-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 md:col-span-2 lg:col-span-1">
            <Label htmlFor="new-holiday-date">Data (YYYY-MM-DD)</Label>
            <Input
              id="new-holiday-date"
              type="date"
              disabled={busy}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="new-holiday-name">Emërtimi</Label>
            <Input
              id="new-holiday-name"
              disabled={busy}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="p.sh. Bajrami i madh"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-holiday-cat">Kategori</Label>
            <select
              id="new-holiday-cat"
              disabled={busy}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as CompanyHolidayCategory)}
            >
              <option value="KOSOVO_OFFICIAL_MOVABLE">{CATEGORY_LABELS.KOSOVO_OFFICIAL_MOVABLE}</option>
              <option value="COMPANY_CUSTOM">{CATEGORY_LABELS.COMPANY_CUSTOM}</option>
              <option value="KOSOVO_OFFICIAL_FIXED">{CATEGORY_LABELS.KOSOVO_OFFICIAL_FIXED}</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full" disabled={busy || !newDate.trim() || !newName.trim()} onClick={() => void handleAdd()}>
              Shto festë
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Festat <strong className="text-foreground">jo aktive</strong> mbeten në historik por nuk ndikojnë në llogaritjen e ditëve të punës.
          Në krijimin e parë të payroll settings për kompaninë, sistemi mbush automatikisht vetëm vitin UTC aktual me festat zyrtare fikse të
          Kosovës — vetëm nëse nuk ekziston asnjë festë për atë vit (pastaj mund të ndryshohen). JSON legacy në payroll_settings (shtesa/përjashtime)
          përzihet me këtë listë.
        </p>
      </CardContent>
    </Card>
  );
}
