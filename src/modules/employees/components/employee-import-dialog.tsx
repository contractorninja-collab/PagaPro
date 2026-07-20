"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  EmployeeImportCommitResult,
  EmployeeImportPreview,
} from "@/modules/employees/types/employee-import";

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Kërkesa dështoi.");
  return payload;
}

export function EmployeeImportDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [result, setResult] = useState<EmployeeImportCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (props.open) return;
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setPending(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [props.open]);

  async function previewFile(selectedFile: File) {
    setFile(selectedFile);
    setPreview(null);
    setResult(null);
    setError(null);
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      const response = await fetch("/api/employees/import/preview", { method: "POST", body: formData });
      setPreview(await readJson<EmployeeImportPreview>(response));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kontrolli i CSV-së dështoi.");
    } finally {
      setPending(false);
    }
  }

  async function commit() {
    if (!file || !preview || preview.totals.valid === 0) return;
    setError(null);
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/employees/import/commit", { method: "POST", body: formData });
      const committed = await readJson<EmployeeImportCommitResult>(response);
      setResult(committed);
      setPreview(null);
      props.onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Importi dështoi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importo punonjës nga CSV</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 border-y border-[#e2e8f0] py-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#15803d]" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[#0f172a]">Importi përfundoi</p>
                <p className="mt-1 text-sm text-[#64748b]">
                  {result.imported} u importuan · {result.skipped} u anashkaluan
                </p>
              </div>
            </div>
            {result.skipped > 0 ? (
              <div className="max-h-64 overflow-auto border-y border-[#e2e8f0]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#f8fafc] text-[#64748b]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Rreshti</th>
                      <th className="px-3 py-2 font-semibold">Nr personal</th>
                      <th className="px-3 py-2 font-semibold">Arsyeja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef2f7]">
                    {result.rows.filter((row) => !row.imported).map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-2 tabular-nums">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.personalId || "—"}</td>
                        <td className="px-3 py-2 text-[#b91c1c]">{row.errors.join(" ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 border-y border-[#e2e8f0] py-4">
              <Button asChild variant="outlinePrimary">
                <a href="/api/employees/import/template" download>
                  <Download className="h-4 w-4" aria-hidden />
                  Shkarko modelin CSV
                </a>
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) void previewFile(selected);
                }}
              />
              <Button type="button" onClick={() => inputRef.current?.click()} disabled={pending}>
                <Upload className="h-4 w-4" aria-hidden />
                Zgjidh CSV
              </Button>
              {file ? (
                <span className="inline-flex min-w-0 items-center gap-2 text-sm text-[#475569]">
                  <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="max-w-64 truncate">{file.name}</span>
                </span>
              ) : null}
            </div>

            {pending ? <p className="py-6 text-center text-sm text-[#64748b]">Duke përpunuar CSV-në…</p> : null}
            {error ? (
              <div className="flex items-start gap-2 border-l-4 border-[#dc2626] bg-[#fef2f2] px-3 py-2.5 text-sm text-[#991b1b]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : null}

            {preview && !pending ? (
              <>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <span className="font-semibold text-[#0f172a]">{preview.totals.total} rreshta</span>
                  <span className="font-semibold text-[#15803d]">{preview.totals.valid} të vlefshëm</span>
                  <span className="font-semibold text-[#b91c1c]">{preview.totals.invalid} me gabime</span>
                </div>
                <div className="max-h-[420px] overflow-auto border-y border-[#e2e8f0]">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="sticky top-0 bg-[#f8fafc] text-[#64748b]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Rreshti</th>
                        <th className="px-3 py-2 font-semibold">Punonjësi</th>
                        <th className="px-3 py-2 font-semibold">Nr personal</th>
                        <th className="px-3 py-2 font-semibold">Punësimi</th>
                        <th className="px-3 py-2 text-right font-semibold">Paga bruto</th>
                        <th className="px-3 py-2 font-semibold">Statusi</th>
                        <th className="px-3 py-2 font-semibold">Validimi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef2f7]">
                      {preview.rows.map((row) => (
                        <tr key={row.rowNumber} className={row.errors.length ? "bg-[#fffafa]" : undefined}>
                          <td className="px-3 py-2 tabular-nums">{row.rowNumber}</td>
                          <td className="px-3 py-2 font-medium text-[#0f172a]">{`${row.firstName} ${row.lastName}`.trim() || "—"}</td>
                          <td className="px-3 py-2">{row.personalId || "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{row.hireDateIso || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.baseSalaryMonthly}</td>
                          <td className="px-3 py-2">
                            <span className={row.intendedStatus === "ACTIVE" ? "font-semibold text-[#15803d]" : "font-semibold text-[#b45309]"}>
                              {row.intendedStatus === "ACTIVE" ? "Aktiv" : "Jo aktiv"}
                            </span>
                          </td>
                          <td className={row.errors.length ? "px-3 py-2 text-[#b91c1c]" : "px-3 py-2 text-[#15803d]"}>
                            {row.errors.length ? row.errors.join(" ") : "Në rregull"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={() => props.onOpenChange(false)}>Mbyll</Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>Anulo</Button>
              <Button type="button" disabled={pending || !preview || preview.totals.valid === 0} onClick={() => void commit()}>
                Importo {preview?.totals.valid ?? 0} punonjës
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
