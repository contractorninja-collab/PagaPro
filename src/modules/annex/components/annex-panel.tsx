"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Printer, Plus, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContractTermType } from "@prisma/client";
import { CONTRACT_TERM_LABELS, ANNEX_CATEGORY_LABELS, type AnnexChangeCategory } from "@/modules/annex/types";
import {
  getAnnexPanelDataAction,
  updateContractTermAction,
  deleteAnnexAction,
  updateAnnexEffectiveDateAction,
} from "@/modules/annex/actions/annex-actions";
import type { AnnexPanelData } from "@/modules/annex/services/annex-service";
import { AnnexDialog } from "./annex-dialog";

const CARD = "rounded-[12px] border border-[#e2e8f0] bg-white p-4";
const BTN_PRIMARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-brand-blue px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:pointer-events-none disabled:opacity-50";
const BTN_DENSE =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[#e2e8f0] bg-white px-3 text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] disabled:pointer-events-none disabled:opacity-50";
const FIELD =
  "h-9 rounded-[8px] border border-[#e2e8f0] bg-white px-2.5 text-[13px] text-[#334155] outline-none focus:border-brand-blue";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("sq-AL", { timeZone: "UTC" });
  } catch {
    return iso;
  }
}

export function AnnexPanel(props: { employeeId: string; canEdit: boolean }) {
  const { employeeId, canEdit } = props;
  const [data, setData] = useState<AnnexPanelData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editDateId, setEditDateId] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState("");
  const [savingDateId, setSavingDateId] = useState<string | null>(null);

  const load = useCallback(() => {
    getAnnexPanelDataAction({ employeeId }).then((res) => {
      if (res.ok && res.data) setData(res.data);
    });
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadDocx(annexId: string) {
    setBusyId(annexId);
    try {
      const res = await fetch(`/api/punonjesit/${employeeId}/aneks/${annexId}/document?inline=0`);
      if (!res.ok) {
        toast.error("Dokumenti nuk u gjenerua.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Aneks-${annexId}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusyId(null);
    }
  }

  function printAnnex(annexId: string) {
    window.open(`/punonjesit/${employeeId}/aneks/${annexId}/print`, "_blank", "noopener,noreferrer");
  }

  async function deleteAnnex(annexId: string) {
    setDeletingId(annexId);
    try {
      const res = await deleteAnnexAction({ annexId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Aneksi u fshi.");
      setConfirmDeleteId(null);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  function startEditDate(annexId: string, current: string) {
    setConfirmDeleteId(null);
    setEditDateId(annexId);
    setEditDateValue(current);
  }

  async function saveDate(annexId: string) {
    if (!editDateValue) {
      toast.error("Zgjidhni një datë.");
      return;
    }
    setSavingDateId(annexId);
    try {
      const res = await updateAnnexEffectiveDateAction({ annexId, effectiveDate: editDateValue });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Data e hyrjes në fuqi u përditësua.");
      setEditDateId(null);
      load();
    } finally {
      setSavingDateId(null);
    }
  }

  if (!data) {
    return <div className={CARD}>Duke ngarkuar…</div>;
  }

  return (
    <div className="space-y-4">
      <ContractTermCard
        data={data}
        canEdit={canEdit}
        employeeId={employeeId}
        editing={editingTerm}
        setEditing={setEditingTerm}
        onSaved={() => {
          setEditingTerm(false);
          load();
        }}
      />

      <div className={CARD}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-[#0f172a]">Anekset e kontratës</h3>
            <p className="text-[12.5px] text-[#64748b]">
              Ndryshimet e kontratës sipas Ligjit Nr. 03/L-212 (Neni 10, 11, 17-19).
            </p>
          </div>
          {canEdit ? (
            <button type="button" className={BTN_PRIMARY} onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Gjenero Aneks
            </button>
          ) : null}
        </div>

        {data.annexes.length === 0 ? (
          <p className="text-[13px] text-[#64748b]">Nuk ka anekse të lëshuara.</p>
        ) : (
          <ul className="divide-y divide-[#f1f5f9]">
            {data.annexes.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#0f172a]">
                    Aneks nr. {a.annexNumber}
                    <span className="ml-2 font-normal text-[#94a3b8]">
                      efektiv nga {fmt(a.effectiveDate)}
                    </span>
                  </p>
                  <p className="truncate text-[12px] text-[#64748b]">
                    {a.changeCategories
                      .map((c) => ANNEX_CATEGORY_LABELS[c as AnnexChangeCategory] ?? c)
                      .join(", ")}
                  </p>
                </div>
                {editDateId === a.id ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <input
                      type="date"
                      className={FIELD}
                      value={editDateValue}
                      onChange={(e) => setEditDateValue(e.target.value)}
                    />
                    <button
                      type="button"
                      className={cn(BTN_DENSE, "border-brand-blue/40 text-brand-blue")}
                      disabled={savingDateId === a.id}
                      onClick={() => saveDate(a.id)}
                    >
                      {savingDateId === a.id ? "…" : "Ruaj"}
                    </button>
                    <button
                      type="button"
                      className={BTN_DENSE}
                      disabled={savingDateId === a.id}
                      onClick={() => setEditDateId(null)}
                    >
                      Anulo
                    </button>
                  </div>
                ) : confirmDeleteId === a.id ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[12px] font-medium text-[#b45309]">Fshij aneksin?</span>
                    <button
                      type="button"
                      className={cn(BTN_DENSE, "border-destructive/40 text-destructive")}
                      disabled={deletingId === a.id}
                      onClick={() => deleteAnnex(a.id)}
                    >
                      {deletingId === a.id ? "…" : "Po, fshij"}
                    </button>
                    <button
                      type="button"
                      className={BTN_DENSE}
                      disabled={deletingId === a.id}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Jo
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button type="button" className={BTN_DENSE} onClick={() => printAnnex(a.id)}>
                      <Printer className="h-3.5 w-3.5" aria-hidden />
                      Printo
                    </button>
                    <button
                      type="button"
                      className={BTN_DENSE}
                      disabled={busyId === a.id}
                      onClick={() => downloadDocx(a.id)}
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      {busyId === a.id ? "…" : "Shkarko"}
                    </button>
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          className={cn(BTN_DENSE, "px-2 text-[#94a3b8] hover:text-brand-blue")}
                          aria-label="Ndrysho datën e hyrjes në fuqi"
                          onClick={() => startEditDate(a.id, a.effectiveDate)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={cn(BTN_DENSE, "px-2 text-[#94a3b8] hover:text-destructive")}
                          aria-label="Fshij aneksin"
                          onClick={() => setConfirmDeleteId(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnnexDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employeeId={employeeId}
        currentContractType={data.contractType}
        currentContractEndDate={data.contractEndDate}
        onCreated={() => load()}
      />
    </div>
  );
}

function ContractTermCard(props: {
  data: AnnexPanelData;
  canEdit: boolean;
  employeeId: string;
  editing: boolean;
  setEditing: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { data, canEdit, employeeId, editing, setEditing, onSaved } = props;
  const [type, setType] = useState<ContractTermType>(data.contractType);
  const [end, setEnd] = useState<string>(data.contractEndDate ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateContractTermAction({
        employeeId,
        contractType: type,
        contractEndDate: type === "INDEFINITE" ? null : end || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Afati i kontratës u ruajt.");
      onSaved();
    });
  }

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#0f172a]">Të dhënat e kontratës</h3>
        {canEdit && !editing ? (
          <button type="button" className={BTN_DENSE} onClick={() => setEditing(true)}>
            Ndrysho afatin
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">Lloji</span>
            <select className={FIELD} value={type} onChange={(e) => setType(e.target.value as ContractTermType)}>
              {(["INDEFINITE", "FIXED_TERM", "SPECIFIC_TASK"] as ContractTermType[]).map((t) => (
                <option key={t} value={t}>
                  {CONTRACT_TERM_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {type !== "INDEFINITE" ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
                Data e skadimit
              </span>
              <input type="date" className={FIELD} value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          ) : null}
          <button type="button" className={BTN_PRIMARY} disabled={pending} onClick={save}>
            {pending ? "Duke ruajtur…" : "Ruaj"}
          </button>
          <button type="button" className={BTN_DENSE} onClick={() => setEditing(false)}>
            Anulo
          </button>
        </div>
      ) : (
        <dl className="mt-3 grid grid-cols-3 gap-3 text-[13px]">
          <Term label="Fillimi" value={fmt(data.contractStartDate)} />
          <Term label="Skadimi" value={fmt(data.contractEndDate)} />
          <Term label="Lloji" value={CONTRACT_TERM_LABELS[data.contractType]} />
        </dl>
      )}
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">{label}</dt>
      <dd className="mt-0.5 tabular-nums text-[#334155]">{value}</dd>
    </div>
  );
}
