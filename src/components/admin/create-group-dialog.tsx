"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Trash2 } from "lucide-react";
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
import { adminPath } from "@/lib/admin-path";
import { randomClientId } from "@/lib/utils";
import { createBrandGroupWithCompaniesAction } from "@/modules/admin/actions/admin-actions";
import { EMPTY_COMPANY_FORM, type CompanyFormValues } from "@/components/admin/company-form";

/**
 * One customer with several legal entities, captured in a single pass: the brand
 * name, then a business per row.
 *
 * Rows carry a client-side rowKey rather than being keyed by index — the same
 * scheme the Konfigurimet representatives editor uses — so removing the middle
 * row does not make React reuse the wrong inputs. Server field errors come back
 * dot-joined as `companies.<idx>.<field>`, which is how each row finds its own.
 */

type CompanyDraft = CompanyFormValues & { rowKey: string };

function blankCompany(): CompanyDraft {
  return { ...EMPTY_COMPANY_FORM, rowKey: randomClientId() };
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-destructive">{errors[0]}</p>;
}

export function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [companies, setCompanies] = useState<CompanyDraft[]>(() => [blankCompany()]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function reset() {
    setGroupName("");
    setCompanies([blankCompany()]);
    setError(null);
    setFieldErrors({});
  }

  function patch(rowKey: string, key: keyof CompanyFormValues, value: string) {
    setCompanies((prev) =>
      prev.map((c) => (c.rowKey === rowKey ? { ...c, [key]: value } : c)),
    );
  }

  function addCompany() {
    setCompanies((prev) => [...prev, blankCompany()]);
  }

  function removeCompany(rowKey: string) {
    // A group with no businesses is not a group; the last row stays.
    setCompanies((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.rowKey !== rowKey)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await createBrandGroupWithCompaniesAction({
        name: groupName,
        // rowKey is client-only bookkeeping; the server never sees it.
        companies: companies.map((c) => {
          const values = { ...c } as Partial<CompanyDraft>;
          delete values.rowKey;
          return values as CompanyFormValues;
        }),
      });

      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      if (!res.data) return;

      const created = res.data.results.filter((r) => r.outcome === "created");
      const failed = res.data.results.filter((r) => r.outcome !== "created");

      toast.success(
        `Grupi "${res.data.brandGroupName}" u krijua me ${created.length} nga ${res.data.results.length} biznese.`,
      );
      for (const f of failed) {
        const why =
          f.outcome === "duplicate_nui"
            ? "NUI ekziston tashmë"
            : f.outcome === "duplicate_slug"
              ? "slug ekziston tashmë"
              : f.outcome === "duplicate_domain"
                ? "domain ekziston tashmë"
                : "krijimi dështoi";
        toast.warning(`${f.legalName}: ${why} — nuk u krijua.`, { duration: 10000 });
      }
      for (const c of created) {
        for (const w of c.warnings) toast.warning(`${c.legalName}: ${w}`, { duration: 10000 });
      }

      onOpenChange(false);
      reset();
      // Stay on the list: several companies were created, so there is no single
      // detail page that is "the" result.
      router.push(adminPath("bizneset"));
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Krijo grup</DialogTitle>
          <DialogDescription>
            Një klient me disa entitete ligjore. Vendosni emrin e grupit dhe shtoni bizneset — të
            gjitha krijohen njëherësh, secili me shabllonet e veta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="group-name">
              Emri i grupit <span className="text-destructive">*</span>
            </Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="p.sh. Grupi Alba"
              disabled={isPending}
            />
            <FieldError errors={fieldErrors.name} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Bizneset në grup ({companies.length})
              </h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addCompany}
                disabled={isPending}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Shto biznes
              </Button>
            </div>
            <FieldError errors={fieldErrors.companies} />

            {companies.map((c, idx) => {
              const err = (field: string) => fieldErrors[`companies.${idx}.${field}`];
              return (
                <div
                  key={c.rowKey}
                  className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" aria-hidden />
                      Biznesi {idx + 1}
                    </p>
                    {companies.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeCompany(c.rowKey)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Hiq
                      </Button>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`legalName-${c.rowKey}`}>
                      Emri ligjor <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`legalName-${c.rowKey}`}
                      value={c.legalName}
                      onChange={(e) => patch(c.rowKey, "legalName", e.target.value)}
                      disabled={isPending}
                    />
                    <FieldError errors={err("legalName")} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`tradeName-${c.rowKey}`}>Emri tregtar</Label>
                      <Input
                        id={`tradeName-${c.rowKey}`}
                        value={c.tradeName}
                        onChange={(e) => patch(c.rowKey, "tradeName", e.target.value)}
                        disabled={isPending}
                      />
                      <FieldError errors={err("tradeName")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`fiscalNumber-${c.rowKey}`}>NUI</Label>
                      <Input
                        id={`fiscalNumber-${c.rowKey}`}
                        value={c.fiscalNumber}
                        onChange={(e) => patch(c.rowKey, "fiscalNumber", e.target.value)}
                        disabled={isPending}
                      />
                      <FieldError errors={err("fiscalNumber")} />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`email-${c.rowKey}`}>Email</Label>
                      <Input
                        id={`email-${c.rowKey}`}
                        value={c.email}
                        onChange={(e) => patch(c.rowKey, "email", e.target.value)}
                        disabled={isPending}
                      />
                      <FieldError errors={err("email")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`city-${c.rowKey}`}>Qyteti</Label>
                      <Input
                        id={`city-${c.rowKey}`}
                        value={c.city}
                        onChange={(e) => patch(c.rowKey, "city", e.target.value)}
                        disabled={isPending}
                      />
                      <FieldError errors={err("city")} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`addressLine-${c.rowKey}`}>Adresa</Label>
                    <Input
                      id={`addressLine-${c.rowKey}`}
                      value={c.addressLine}
                      onChange={(e) => patch(c.rowKey, "addressLine", e.target.value)}
                      disabled={isPending}
                    />
                    <FieldError errors={err("addressLine")} />
                  </div>
                </div>
              );
            })}
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Anulo
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Duke krijuar…" : `Krijo grupin me ${companies.length} biznese`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
