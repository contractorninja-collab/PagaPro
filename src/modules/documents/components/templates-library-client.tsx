"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { DocumentCategory } from "@prisma/client";
import { Upload } from "lucide-react";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  publishDocumentTemplateVersionAction,
  setDocumentTemplateActiveAction,
  uploadDocumentTemplateVersionAction,
  updateDocumentTemplateTerminationKeyAction,
} from "@/modules/documents/actions/documents-actions";
import { DOCUMENT_CATEGORY_LABELS } from "@/modules/documents/components/document-labels";
import {
  DocChip,
  docBtnPrimary,
  docBtnSecondaryDense,
  docCard,
  docSelect,
  docTableCell,
  docTableHead,
} from "@/modules/documents/components/doc-ui";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface TemplateVersionRow {
  id: string;
  versionNumber: number;
  isPublished: boolean;
  isMapped: boolean;
  detectionMode: string | null;
  uploadedAt: string;
  originalFilename: string | null;
  placeholderCount: number;
  blankCount: number;
}

export interface TemplateLibraryRow {
  id: string;
  name: string;
  documentCategory: DocumentCategory;
  isActive: boolean;
  terminationWorkflowKey: string | null;
  versions: TemplateVersionRow[];
}

export function TemplatesLibraryClient(props: { templates: TemplateLibraryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function publish(templateId: string, versionId: string) {
    startTransition(async () => {
      const res = await publishDocumentTemplateVersionAction({ templateId, versionId });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Versioni u publikua.");
        refresh();
      }
    });
  }

  function setActive(templateId: string, isActive: boolean) {
    startTransition(async () => {
      const res = await setDocumentTemplateActiveAction({ templateId, isActive });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(isActive ? "Shablloni u aktivizua." : "Shablloni u çaktivizua.");
        refresh();
      }
    });
  }

  return (
    <>
      <AppSubBar
        dense
        backHref="/dokumentet"
        backLabel="Dokumentet"
        title="Shabllonet DOCX"
        description="Ngarkoni versione të rij, inspektoni placeholderët dhe publikoni një version për gjenerim."
        actions={
          <UploadTemplateDialog onUploaded={() => refresh()} pending={pending} startTransition={startTransition} />
        }
      />
      <div className="space-y-5">
        {props.templates.length === 0 ? (
          <div className={cn(docCard, "p-8 text-center text-[13px] text-[#64748b]")}>
            Nuk ka shabllon ende — ngarkoni një DOCX.
          </div>
        ) : (
          props.templates.map((t) => (
            <div key={t.id} className={cn(docCard, "overflow-hidden")}>
              <div className="flex flex-col gap-3 border-b border-[#eef2f7] p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    href={`/dokumentet/templates/${t.id}`}
                    className="text-[14px] font-bold text-[#0f172a] hover:text-brand-blue"
                  >
                    {t.name}
                  </Link>
                  <DocChip tone="info">{DOCUMENT_CATEGORY_LABELS[t.documentCategory]}</DocChip>
                  <DocChip tone={t.isActive ? "success" : "neutral"}>
                    {t.isActive ? "Aktiv" : "Jo aktiv"}
                  </DocChip>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-medium text-[#64748b]">Aktiv</span>
                  <Switch
                    checked={t.isActive}
                    disabled={pending}
                    onCheckedChange={(v) => setActive(t.id, v)}
                  />
                </div>
              </div>
              {t.documentCategory === "TERMINATION" ? (
                <TerminationWorkflowKeyRow templateId={t.id} initialKey={t.terminationWorkflowKey} />
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
                      <th className={docTableHead}>Ver.</th>
                      <th className={docTableHead}>Skedari</th>
                      <th className={cn(docTableHead, "text-right")}>Placeholderë</th>
                      <th className={cn(docTableHead, "text-right")}>Fusha bosh</th>
                      <th className={docTableHead}>Mapping</th>
                      <th className={docTableHead}>Ngarkuar</th>
                      <th className={cn(docTableHead, "text-right")}>Veprime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.versions.map((v) => (
                      <tr
                        key={v.id}
                        className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                      >
                        <td className={cn(docTableCell, "text-[13px] font-semibold tabular-nums text-[#0f172a]")}>
                          v{v.versionNumber}
                        </td>
                        <td className={cn(docTableCell, "max-w-[220px] truncate text-[13px] text-[#334155]")}>
                          {v.originalFilename ?? "—"}
                        </td>
                        <td className={cn(docTableCell, "text-right text-[13px] tabular-nums text-[#334155]")}>
                          {v.placeholderCount}
                        </td>
                        <td className={cn(docTableCell, "text-right text-[13px] tabular-nums text-[#334155]")}>
                          {v.blankCount}
                        </td>
                        <td className={docTableCell}>
                          {v.isMapped ? (
                            <DocChip tone="success">Gati</DocChip>
                          ) : v.blankCount > 0 || v.detectionMode === "MIXED" ? (
                            <DocChip tone="warning">Duhet mapping</DocChip>
                          ) : (
                            <span className="text-[12px] text-[#94a3b8]">—</span>
                          )}
                        </td>
                        <td className={cn(docTableCell, "whitespace-nowrap text-[12.5px] tabular-nums text-[#64748b]")}>
                          {new Date(v.uploadedAt).toLocaleString("sq-AL", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className={cn(docTableCell, "text-right")}>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {!v.isMapped && v.blankCount > 0 ? (
                              <Link
                                href={`/dokumentet/templates/${t.id}/mapping?versionId=${v.id}`}
                                className={docBtnSecondaryDense}
                              >
                                Mapo fushat
                              </Link>
                            ) : null}
                            {v.isPublished ? (
                              <DocChip tone="success">Publikuar</DocChip>
                            ) : (
                              <button
                                type="button"
                                className={docBtnSecondaryDense}
                                disabled={pending}
                                onClick={() => publish(t.id, v.id)}
                              >
                                Publiko
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function UploadTemplateDialog(props: {
  onUploaded: () => void;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={docBtnPrimary}>
          <Upload className="h-4 w-4" aria-hidden />
          Ngarko DOCX
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ngarko version DOCX</DialogTitle>
          <DialogDescription>
            Versioni i ri është i numëruar automatikisht. Për shabllon të ri plotësoni emrin dhe kategorinë.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-2"
          action={(fd) => {
            props.startTransition(async () => {
              const res = await uploadDocumentTemplateVersionAction(fd);
              if (!res.ok) toast.error(res.error);
              else {
                const blankCount = res.data?.blankCount ?? 0;
                const needsMapping = res.data?.needsMapping ?? false;
                toast.success(
                  `U ngarkua. ${res.data?.placeholderKeys?.length ?? 0} placeholderë, ${blankCount} fusha bosh.`,
                );
                if (needsMapping && blankCount > 0) {
                  toast.info("Hapni «Mapo fushat» për të lidhur fushat bosh me të dhënat e sistemit.");
                }
                props.onUploaded();
              }
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="tid">Shablloni ekzistues (opsionale)</Label>
            <Input id="tid" name="templateId" placeholder="ID e shabllonit" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tn">Emri i shabllonit të ri</Label>
            <Input id="tn" name="newTemplateName" placeholder="p.sh. Kontratë AFAT_I_CAKTUAR" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tc">Kategoria</Label>
            <select id="tc" name="documentCategory" className={selectClass} defaultValue="">
              <option value="">— zgjidhni —</option>
              <option value="CONTRACT">Kontratë</option>
              <option value="LEAVE">Pushim</option>
              <option value="TERMINATION">Ndërprerje</option>
              <option value="WARNING">Vërejtje</option>
              <option value="PAYROLL">Pagë</option>
              <option value="OTHER">Tjetër</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tck">Lloji kontrate (vetëm për CONTRACT)</Label>
            <select id="tck" name="contractKind" className={selectClass} defaultValue="">
              <option value="">—</option>
              <option value="EMPLOYMENT">Punësim</option>
              <option value="CONTRACTOR_AGREEMENT">Kontraktor</option>
              <option value="AMENDMENT">Ndryshim</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cl">Shënim versioni</Label>
            <Input id="cl" name="changelog" placeholder="Opsionale" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fl">Skedari DOCX</Label>
            <Input id="fl" name="file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={props.pending}>
              Ngarko
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TerminationWorkflowKeyRow(props: { templateId: string; initialKey: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(props.initialKey ?? "");

  function save() {
    startTransition(async () => {
      const res = await updateDocumentTemplateTerminationKeyAction({
        templateId: props.templateId,
        terminationWorkflowKey: value,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Çelësi i largimit u ruajt.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-[#eef2f7] bg-[#f8fafc] px-4 py-3 md:flex-row md:items-end md:gap-4">
      <div className="flex-1 space-y-1">
        <Label className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">
          Çelësi Largimet (workflow)
        </Label>
        <select
          className={cn(docSelect, "w-full")}
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">(pa çelës)</option>
          <option value="LARGIM_VULLNETAR">LARGIM_VULLNETAR</option>
          <option value="PA_PARALAJMERIM">PA_PARALAJMERIM</option>
          <option value="MARREVESHJE_E_DYANSHME">MARREVESHJE_E_DYANSHME</option>
          <option value="NGA_PUNEDHENESI">NGA_PUNEDHENESI</option>
          <option value="MANUAL">MANUAL</option>
        </select>
      </div>
      <button type="button" className={docBtnSecondaryDense} disabled={pending} onClick={save}>
        Ruaj çelësin
      </button>
    </div>
  );
}
