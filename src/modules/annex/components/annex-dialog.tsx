"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CONTRACT_TERM_LABELS, type AnnexChange, type AnnexChangeSuggestion } from "@/modules/annex/types";
import { getAnnexDiffAction, createAnnexAction } from "@/modules/annex/actions/annex-actions";
import type { ContractTermType } from "@prisma/client";

const FIELD =
  "h-9 w-full rounded-[8px] border border-[#e2e8f0] bg-white px-2.5 text-[13px] text-[#334155] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-brand-blue";
const BTN_PRIMARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-brand-blue px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:pointer-events-none disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[#e2e8f0] bg-white px-4 text-[13px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7]";

interface Row extends AnnexChangeSuggestion {
  include: boolean;
}

const TERM_OPTIONS: ContractTermType[] = ["INDEFINITE", "FIXED_TERM", "SPECIFIC_TASK"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AnnexDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  currentContractType: ContractTermType;
  currentContractEndDate: string | null;
  onCreated: (annexId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [contractType, setContractType] = useState<ContractTermType>(props.currentContractType);
  const [contractEndDate, setContractEndDate] = useState<string>(props.currentContractEndDate ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    setLoading(true);
    setEffectiveDate(todayIso());
    setContractType(props.currentContractType);
    setContractEndDate(props.currentContractEndDate ?? "");
    getAnnexDiffAction({ employeeId: props.employeeId }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Nuk u ngarkuan të dhënat." : res.error);
        return;
      }
      setRows(res.data.suggestions.map((s) => ({ ...s, include: s.changed })));
    });
    return () => {
      cancelled = true;
    };
  }, [props.open, props.employeeId, props.currentContractType, props.currentContractEndDate]);

  function patchRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const termChanged =
    contractType !== props.currentContractType ||
    (contractEndDate || null) !== props.currentContractEndDate;

  function submit() {
    const changes: AnnexChange[] = rows
      .filter((r) => r.include)
      .map((r) => ({ category: r.category, label: r.label, from: r.from, to: r.to }));

    if (changes.length === 0) {
      toast.error("Zgjidhni të paktën një ndryshim.");
      return;
    }

    startTransition(async () => {
      const res = await createAnnexAction({
        employeeId: props.employeeId,
        effectiveDate,
        changes,
        ...(termChanged
          ? {
              contractType,
              contractEndDate: contractType === "INDEFINITE" ? null : contractEndDate || null,
            }
          : {}),
      });
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Gabim." : res.error, { duration: 7000 });
        return;
      }
      toast.success(`Aneksi nr. ${res.data.annexNumber} u krijua.`);
      props.onOpenChange(false);
      props.onCreated(res.data.id);
    });
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gjenero Aneks Kontrate</DialogTitle>
          <DialogDescription>
            Zgjidhni dhe konfirmoni ndryshimet. Vlerat paraprake mbushen automatikisht; për
            aneksin e parë disa vlera duhet konfirmuar manualisht.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-[13px] text-[#64748b]">Duke ngarkuar…</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div
                  key={r.category}
                  className={cn(
                    "rounded-[10px] border p-3",
                    r.include ? "border-brand-blue/40 bg-brand-blue/[0.03]" : "border-[#e2e8f0]",
                  )}
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-[16px] w-[16px] accent-[#2563EB]"
                      checked={r.include}
                      onChange={(e) => patchRow(i, { include: e.target.checked })}
                    />
                    <span className="text-[13px] font-semibold text-[#0f172a]">{r.label}</span>
                    {r.fromUnknown ? (
                      <span className="text-[11px] font-medium text-[#b45309]">
                        konfirmo vlerën paraprake
                      </span>
                    ) : null}
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-[#94a3b8]">Nga</span>
                      <input
                        className={FIELD}
                        value={r.from}
                        onChange={(e) => patchRow(i, { from: e.target.value })}
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-[#94a3b8]">Në</span>
                      <input
                        className={FIELD}
                        value={r.to}
                        onChange={(e) => patchRow(i, { to: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-[#eef2f7] pt-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
                  Data e hyrjes në fuqi
                </span>
                <input
                  type="date"
                  className={FIELD}
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
                  Lloji i kontratës
                </span>
                <select
                  className={FIELD}
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value as ContractTermType)}
                >
                  {TERM_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {CONTRACT_TERM_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              {contractType !== "INDEFINITE" ? (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
                    Data e skadimit
                  </span>
                  <input
                    type="date"
                    className={FIELD}
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t border-[#eef2f7] bg-white px-6 py-3">
          <button type="button" className={BTN_SECONDARY} onClick={() => props.onOpenChange(false)}>
            Anulo
          </button>
          <button type="button" className={BTN_PRIMARY} disabled={pending || loading} onClick={submit}>
            {pending ? "Duke gjeneruar…" : "Gjenero aneksin"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
