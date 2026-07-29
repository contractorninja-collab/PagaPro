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
import { adminPath } from "@/lib/admin-path";
import {
  copyCompanyMembershipsAction,
  createBrandGroupAction,
  createCompanyAction,
  setCompanyBrandGroupAction,
} from "@/modules/admin/actions/admin-actions";
import type { BrandGroupSibling } from "@/modules/admin/services/company-brand-group-service";

/**
 * "Add another company like this one" — the primary way a multi-company brand
 * gets built. Clicking it once (from an ungrouped company) creates the group
 * as a side effect; every click after that just adds a sibling. It replaces a
 * flow that made you leave the page, reopen "Shto Biznes" and hunt for the
 * right group in a dropdown for every company after the first.
 *
 * The company-detail page always renders this — even ungrouped, showing just
 * one pill — so "add a sibling" is discoverable without first knowing that
 * "grouping" is a concept.
 */
export function CompanyGroupTabs({
  currentCompanyId,
  currentCompanyLabel,
  brandGroupId,
  brandGroupName,
  siblings,
}: {
  currentCompanyId: string;
  currentCompanyLabel: string;
  brandGroupId: string | null;
  brandGroupName: string | null;
  siblings: BrandGroupSibling[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState(brandGroupName ?? currentCompanyLabel);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setError(null);
    setNewGroupName(brandGroupName ?? currentCompanyLabel);
    setNewCompanyName("");
    setOpen(true);
  }

  function onCreateSibling(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!newCompanyName.trim()) {
      setError("Emri i kompanisë së re është i detyrueshëm.");
      return;
    }

    startTransition(async () => {
      let groupId = brandGroupId;

      // First sibling ever: the group doesn't exist yet, and this company isn't in one.
      if (!groupId) {
        if (!newGroupName.trim()) {
          setError("Emri i grupit është i detyrueshëm.");
          return;
        }
        const g = await createBrandGroupAction({ name: newGroupName });
        if (!g.ok || !g.data) {
          setError(g.ok ? "Krijimi i grupit dështoi." : g.error);
          return;
        }
        groupId = g.data.id;

        const link = await setCompanyBrandGroupAction({
          companyId: currentCompanyId,
          brandGroupId: groupId,
        });
        if (!link.ok) {
          setError(link.error);
          return;
        }
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
              Kompani e re {brandGroupId ? `në grupin ${brandGroupName}` : ""}
            </DialogTitle>
            <DialogDescription>
              {brandGroupId
                ? "Krijohet menjëherë me NUI dhe të dhëna të veta — plotësoni pjesën tjetër pasi të kaloni te faqja e saj."
                : `${currentCompanyLabel} nuk është ende në një grup. Do të krijohet një grup i ri dhe kjo kompani do t'i bashkohet.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateSibling} className="space-y-4" noValidate>
            {!brandGroupId ? (
              <div className="space-y-2">
                <Label htmlFor="newGroupName">Emri i grupit / brendit</Label>
                <Input
                  id="newGroupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="newCompanyName">Emri i kompanisë së re</Label>
              <Input
                id="newCompanyName"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                required
                autoFocus={Boolean(brandGroupId)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Duke krijuar…" : "Krijo dhe vazhdo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
