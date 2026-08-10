"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteCompanyAction,
  getCompanyDeletionPreviewAction,
} from "@/modules/admin/actions/admin-actions";

/**
 * Deleting a client is not recoverable from the UI, so the dialog does two
 * things before it will let go: it says out loud what is about to be destroyed
 * (read live, not guessed), and it makes the operator retype the legal name.
 *
 * Archiving still exists for a client whose records must be kept — this is for
 * the one that was added by mistake.
 */

type Preview = {
  id: string;
  legalName: string;
  employees: number;
  payrolls: number;
  contractorPayrolls: number;
  documents: number;
  leaveRequests: number;
  users: number;
  usersLosingLastCompany: number;
  storageObjects: number;
};

export function DeleteCompanyDialog({
  companyId,
  legalName,
  open,
  onOpenChange,
  onDeleted,
}: {
  companyId: string;
  legalName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setConfirmName("");
      setError(null);
      return;
    }
    setLoading(true);
    void getCompanyDeletionPreviewAction({ companyId }).then((res) => {
      setLoading(false);
      if (res.ok && res.data) setPreview(res.data as Preview);
      else if (!res.ok) setError(res.error);
    });
  }, [open, companyId]);

  const nameMatches = confirmName.trim() === legalName.trim();
  const hasRecords =
    preview != null &&
    preview.employees + preview.payrolls + preview.contractorPayrolls + preview.documents > 0;

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await deleteCompanyAction({ companyId, confirmName });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`"${legalName}" u fshi përfundimisht.`);
      onOpenChange(false);
      onDeleted?.();
    });
  }

  const rows: Array<{ label: string; value: number }> = preview
    ? [
        { label: "Punonjës", value: preview.employees },
        { label: "Cikle page", value: preview.payrolls },
        { label: "Cikle kontraktorësh", value: preview.contractorPayrolls },
        { label: "Dokumente të gjeneruara", value: preview.documents },
        { label: "Kërkesa pushimi", value: preview.leaveRequests },
        { label: "Përdorues të lidhur", value: preview.users },
        { label: "Skedarë në ruajtje", value: preview.storageObjects },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            Fshi biznesin përfundimisht
          </DialogTitle>
          <DialogDescription>
            Kjo fshin <strong className="text-foreground">{legalName}</strong> dhe çdo të dhënë të
            tij. Veprimi nuk kthehet mbrapa. Për të ruajtur të dhënat, përdorni statusin
            &laquo;I arkivuar&raquo; në vend të fshirjes.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Po lexohet çfarë do të fshihet…
          </p>
        ) : preview ? (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                Do të fshihen
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className="font-semibold tabular-nums text-foreground">{r.value}</dd>
                  </div>
                ))}
              </dl>
              {preview.usersLosingLastCompany > 0 ? (
                <p className="mt-2 text-xs text-destructive">
                  {preview.usersLosingLastCompany} llogari hyrjeje mbeten pa asnjë kompani dhe do të
                  fshihen bashkë me biznesin.
                </p>
              ) : null}
            </div>

            {hasRecords ? (
              <p className="text-sm font-medium text-destructive">
                Ky biznes ka të dhëna reale pune, jo vetëm konfigurim. Sigurohuni që po fshini atë të
                duhurin.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ky biznes nuk ka ende punonjës, paga apo dokumente — duket si i krijuar rishtazi.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="confirm-company-name">
                Shkruani emrin ligjor për të konfirmuar
              </Label>
              <Input
                id="confirm-company-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={legalName}
                autoComplete="off"
                disabled={isPending}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-destructive">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
            Anulo
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!preview || !nameMatches || isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
            Fshi përfundimisht
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
