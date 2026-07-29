"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { adminPath } from "@/lib/admin-path";
import {
  copyCompanyMembershipsAction,
  createBrandGroupAction,
  createCompanyAction,
  setCompanyBrandGroupAction,
} from "@/modules/admin/actions/admin-actions";
import type {
  BrandGroupSibling,
  UngroupedCompanyOption,
} from "@/modules/admin/services/company-brand-group-service";

/**
 * "Add another company like this one" — the primary way a multi-company brand
 * gets built. Clicking it once (from an ungrouped company) creates the group
 * as a side effect; every click after that just adds a sibling. It replaces a
 * flow that made you leave the page, reopen "Shto Biznes" and hunt for the
 * right group in a dropdown for every company after the first.
 *
 * Two modes in one dialog: create a brand-new sibling, or adopt an existing
 * ungrouped company into this brand. Adoption is the only remaining door in
 * for a company created outside the group (the form-level group picker was
 * removed on purpose) — without it, such a company is stranded as a top-level
 * row forever.
 *
 * Either way the sibling inherits the current company's active users, so the
 * customer's one login covers it immediately — no manual add-user step.
 */
export function CompanyGroupTabs({
  currentCompanyId,
  currentCompanyLabel,
  brandGroupId,
  brandGroupName,
  siblings,
  ungroupedCompanies,
}: {
  currentCompanyId: string;
  currentCompanyLabel: string;
  brandGroupId: string | null;
  brandGroupName: string | null;
  siblings: BrandGroupSibling[];
  ungroupedCompanies: UngroupedCompanyOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "attach">("create");
  const [newGroupName, setNewGroupName] = useState(brandGroupName ?? currentCompanyLabel);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [attachCompanyId, setAttachCompanyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canAttach = ungroupedCompanies.length > 0;

  function openDialog() {
    setError(null);
    setMode("create");
    setNewGroupName(brandGroupName ?? currentCompanyLabel);
    setNewCompanyName("");
    setAttachCompanyId(ungroupedCompanies[0]?.id ?? "");
    setOpen(true);
  }

  /** Group must exist before anything can point at it — created lazily on first use. */
  async function ensureGroupId(): Promise<string | null> {
    if (brandGroupId) return brandGroupId;
    if (!newGroupName.trim()) {
      setError("Emri i grupit është i detyrueshëm.");
      return null;
    }
    const g = await createBrandGroupAction({ name: newGroupName });
    if (!g.ok || !g.data) {
      setError(g.ok ? "Krijimi i grupit dështoi." : g.error);
      return null;
    }
    const link = await setCompanyBrandGroupAction({
      companyId: currentCompanyId,
      brandGroupId: g.data.id,
    });
    if (!link.ok) {
      setError(link.error);
      return null;
    }
    return g.data.id;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "create" && !newCompanyName.trim()) {
      setError("Emri i kompanisë së re është i detyrueshëm.");
      return;
    }
    if (mode === "attach" && !attachCompanyId) {
      setError("Zgjidhni kompaninë që do t'i bashkohet grupit.");
      return;
    }

    startTransition(async () => {
      const groupId = await ensureGroupId();
      if (!groupId) return;

      if (mode === "attach") {
        const link = await setCompanyBrandGroupAction({
          companyId: attachCompanyId,
          brandGroupId: groupId,
        });
        if (!link.ok) {
          setError(link.error);
          return;
        }

        // Same guarantee as creating a sibling: the customer's existing users
        // extend onto the adopted company; users it already has are skipped.
        const copy = await copyCompanyMembershipsAction({
          fromCompanyId: currentCompanyId,
          toCompanyId: attachCompanyId,
        });
        const label =
          ungroupedCompanies.find((c) => c.id === attachCompanyId)?.tradeName?.trim() ||
          ungroupedCompanies.find((c) => c.id === attachCompanyId)?.legalName ||
          "Kompania";
        toast.success(
          copy.ok && copy.data && copy.data.copied > 0
            ? `${label} iu bashkua grupit — ${copy.data.copied} përdorues morën qasje.`
            : `${label} iu bashkua grupit.`,
        );

        setOpen(false);
        // Stay here — the new pill appearing next to this company is the confirmation.
        router.refresh();
        return;
      }

      const res = await createCompanyAction({ legalName: newCompanyName, brandGroupId: groupId });
      if (!res.ok || !res.data) {
        setError(res.ok ? "Krijimi dështoi." : res.error);
        return;
      }

      // Without this, a brand-new company sits with zero users — the customer who already
      // manages the rest of the group wouldn't see it, and giving them access would look
      // like creating a new login rather than extending the one they already have.
      const copy = await copyCompanyMembershipsAction({
        fromCompanyId: currentCompanyId,
        toCompanyId: res.data.id,
      });
      if (copy.ok && copy.data && copy.data.copied > 0) {
        toast.success(
          `${newCompanyName} u krijua — ${copy.data.copied} përdorues morën qasje automatikisht.`,
        );
      } else {
        toast.success(`${newCompanyName} u krijua.`);
      }

      setOpen(false);
      router.push(adminPath(`bizneset/${res.data.id}`));
    });
  }

  const modeTab = (value: "create" | "attach", label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(value);
        setError(null);
      }}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        mode === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-5">
        <span
          className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          aria-current="page"
        >
          {currentCompanyLabel}
        </span>
        {siblings.map((s) => (
          <Link
            key={s.id}
            href={adminPath(`bizneset/${s.id}`)}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            {s.tradeName?.trim() || s.legalName}
          </Link>
        ))}
        <Button type="button" variant="secondary" size="sm" className="rounded-full" onClick={openDialog}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Kompani e Re
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Kompani {brandGroupId ? `në grupin ${brandGroupName}` : `nën ${currentCompanyLabel}`}
            </DialogTitle>
            <DialogDescription>
              {brandGroupId
                ? "Kompania do të shfaqet si skedë pranë të tjerave dhe përdoruesit aktualë marrin qasje automatikisht."
                : "Do të krijohet grupi i brendit dhe të dyja kompanitë do t'i bashkohen — përdoruesit aktualë marrin qasje automatikisht."}
            </DialogDescription>
          </DialogHeader>

          {canAttach ? (
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {modeTab("create", "Krijo të re")}
              {modeTab("attach", "Shto ekzistuese")}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {!brandGroupId ? (
              <div className="space-y-2">
                <Label htmlFor="newGroupName">Emri i grupit / brendit</Label>
                <Input
                  id="newGroupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>
            ) : null}

            {mode === "create" ? (
              <div className="space-y-2">
                <Label htmlFor="newCompanyName">Emri i kompanisë së re</Label>
                <Input
                  id="newCompanyName"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="attachCompanyId">Kompania ekzistuese</Label>
                <select
                  id="attachCompanyId"
                  value={attachCompanyId}
                  onChange={(e) => setAttachCompanyId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {ungroupedCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName?.trim() || c.legalName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Vetëm kompanitë që nuk janë ende në ndonjë grup.
                </p>
              </div>
            )}

            {error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Duke ruajtur…"
                  : mode === "attach"
                    ? "Shto në grup"
                    : "Krijo dhe vazhdo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
