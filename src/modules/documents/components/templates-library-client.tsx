"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { DocumentCategory } from "@prisma/client";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  publishDocumentTemplateVersionAction,
  setDocumentTemplateActiveAction,
  uploadDocumentTemplateVersionAction,
  updateDocumentTemplateTerminationKeyAction,
} from "@/modules/documents/actions/documents-actions";
import { DOCUMENT_CATEGORY_LABELS } from "@/modules/documents/components/document-labels";

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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Shabllonet DOCX</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Ngarkoni versione të rij, inspektoni placeholderët dhe publikoni një version për gjenerim.
          </p>
        </div>
        <UploadTemplateDialog onUploaded={() => refresh()} pending={pending} startTransition={startTransition} />
      </div>

      <div className="space-y-10">
        {props.templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nuk ka shabllon ende — ngarkoni një DOCX.</p>
        ) : (
          props.templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card">
              <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <Link
                    href={`/dokumentet/templates/${t.id}`}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {t.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {DOCUMENT_CATEGORY_LABELS[t.documentCategory]} ·{" "}
                    {t.isActive ? "Aktiv" : "Jo aktiv"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Aktiv</span>
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
              <div className="overflow-x-auto p-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ver.</TableHead>
                      <TableHead>Skedari</TableHead>
                      <TableHead>Placeholderë</TableHead>
                      <TableHead>Fusha bosh</TableHead>
                      <TableHead>Mapping</TableHead>
                      <TableHead>Ngarkuar</TableHead>
                      <TableHead className="text-right">Veprime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {t.versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-sm">{v.versionNumber}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {v.originalFilename ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">{v.placeholderCount}</TableCell>
                        <TableCell className="text-sm">{v.blankCount}</TableCell>
                        <TableCell className="text-xs">
                          {v.isMapped ? (
                            <span className="font-medium text-emerald-700">Gati</span>
                          ) : v.blankCount > 0 || v.detectionMode === "MIXED" ? (
                            <span className="text-amber-700">Duhet mapping</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(v.uploadedAt).toLocaleString("sq-AL", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {!v.isMapped && v.blankCount > 0 ? (
                              <Button type="button" size="sm" variant="secondary" asChild>
                                <Link href={`/dokumentet/templates/${t.id}/mapping?versionId=${v.id}`}>
                                  Mapo fushat
                                </Link>
                              </Button>
                            ) : null}
                            {v.isPublished ? (
                              <span className="text-xs font-medium text-emerald-700">Publikuar</span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={pending}
                                onClick={() => publish(t.id, v.id)}
                              >
                                Publiko
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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
        <Button type="button">Ngarko DOCX</Button>
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
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3 md:flex-row md:items-end md:gap-4">
      <div className="flex-1 space-y-1">
        <Label className="text-xs text-muted-foreground">Çelësi Largimet (workflow)</Label>
        <select
          className={selectClass}
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
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={save}>
        Ruaj çelësin
      </Button>
    </div>
  );
}
