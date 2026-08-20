"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadEmployeeDocumentAction } from "@/modules/employee-documents/actions/employee-document-actions";
import {
  ALLOWED_EMPLOYEE_DOCUMENT_MIME,
  MAX_EMPLOYEE_DOCUMENT_BYTES,
} from "@/modules/employee-documents/services/employee-document-file";
import {
  EMPLOYEE_DOCUMENT_CATEGORY_LABELS,
  EMPLOYEE_DOCUMENT_CATEGORY_ORDER,
} from "@/modules/employee-documents/components/employee-document-labels";

const FIELD =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EmployeeDocumentUploadDialog({
  employeeId,
  canSeeSensitive,
}: {
  employeeId: string;
  /** Sensitive folders are not offered to viewers who could then not see their own upload. */
  canSeeSensitive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("IDENTIFIKIM");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const categories = EMPLOYEE_DOCUMENT_CATEGORY_ORDER.filter(
    (c) => canSeeSensitive || (c !== "MJEKESORE" && c !== "DISIPLINORE"),
  );

  function stageFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (!(f.type in ALLOWED_EMPLOYEE_DOCUMENT_MIME)) {
      toast.error("Lloji i skedarit nuk lejohet. Pranohen: PDF, JPG, PNG, WEBP, DOCX.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (f.size > MAX_EMPLOYEE_DOCUMENT_BYTES) {
      toast.error("Skedari është mbi 10 MB.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFile(f);
    if (title.trim() === "") setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function submit() {
    if (!file) {
      toast.error("Zgjidhni një skedar.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        employeeId,
        category,
        title: title.trim(),
        note: note.trim() === "" ? undefined : note.trim(),
        issuedAt: issuedAt === "" ? undefined : issuedAt,
        expiresAt: expiresAt === "" ? undefined : expiresAt,
      }),
    );
    fd.set("file", file);
    let r: Awaited<ReturnType<typeof uploadEmployeeDocumentAction>>;
    try {
      r = await uploadEmployeeDocumentAction(fd);
    } catch {
      // A thrown action (oversized body, dropped connection) must not leave
      // the dialog spinning forever.
      toast.error("Ngarkimi dështoi — kontrolloni lidhjen dhe madhësinë e skedarit.");
      return;
    } finally {
      setBusy(false);
    }
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Dokumenti u ngarkua.");
    setOpen(false);
    setFile(null);
    setTitle("");
    setNote("");
    setIssuedAt("");
    setExpiresAt("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          Ngarko dokument
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ngarko dokument në dosje</DialogTitle>
          <DialogDescription>
            PDF, JPG, PNG, WEBP ose DOCX — deri në 10 MB. Data e skadencës aktivizon
            paralajmërimin 60-ditor në panel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ed-file">Skedari</Label>
            <input
              id="ed-file"
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
              className="block w-full text-sm text-[#64748b] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(e) => stageFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-cat">Kategoria</Label>
            <select
              id="ed-cat"
              className={FIELD}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {EMPLOYEE_DOCUMENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-title">Titulli</Label>
            <Input
              id="ed-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="p.sh. Letërnjoftim — Kosovë"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-issued">Lëshuar më</Label>
              <input
                id="ed-issued"
                type="date"
                className={FIELD}
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-expires">Skadon më</Label>
              <input
                id="ed-expires"
                type="date"
                className={FIELD}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-note">Shënim (opsional)</Label>
            <Input
              id="ed-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="p.sh. origjinali në arkivin fizik"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Anulo
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={busy || !file || title.trim().length < 2}>
              {busy ? "Duke ngarkuar…" : "Ngarko"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
