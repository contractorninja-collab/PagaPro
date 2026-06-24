"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CompanyRow = { id: string; legalName: string; tradeName: string | null };

export function DevActiveCompanyPicker() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/dev/companies")
      .then((r) => r.json())
      .then((data: { companies?: CompanyRow[] }) => {
        if (!cancelled && Array.isArray(data.companies)) {
          setCompanies(data.companies);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCompanyChange(companyId: string) {
    if (!companyId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dev/active-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Nuk u vendos kompania.");
        return;
      }
      toast.success("Kompania aktive u përditësua.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (companies.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nuk u lexuan kompanitë nga DB (sigurohuni që ka të dhëna dhe që migrimet janë aplikuar).
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
      <Label htmlFor="dev-active-company" className="text-sm font-medium">
        Development — kompania aktive
      </Label>
      <select
        id="dev-active-company"
        disabled={busy}
        defaultValue=""
        className={cn(
          "flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        onChange={(e) => void onCompanyChange(e.target.value)}
      >
        <option value="">Zgjidh një kompani…</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {(c.tradeName ?? "").trim() || c.legalName}
          </option>
        ))}
      </select>
    </div>
  );
}
