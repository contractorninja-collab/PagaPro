"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, ExternalLink, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { CompanyForm, type CompanyFormValues } from "@/components/admin/company-form";
import { adminPath } from "@/lib/admin-path";
import { createCompanyAction } from "@/modules/admin/actions/admin-actions";
import type { AdminCompanyListItem } from "@/modules/admin/services/admin-service";

const STATUS_LABELS: Record<AdminCompanyListItem["status"], { label: string; variant: "success" | "warning" | "secondary" }> = {
  ACTIVE: { label: "Aktiv", variant: "success" },
  SUSPENDED: { label: "I pezulluar", variant: "warning" },
  ARCHIVED: { label: "I arkivuar", variant: "secondary" },
};

export function BiznesetClient({ companies }: { companies: AdminCompanyListItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) =>
      [c.legalName, c.tradeName, c.slug, c.customDomain, c.tenantUrl, c.fiscalNumber, c.businessRegistrationNumber, c.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [companies, query]);

  function onCreate(values: CompanyFormValues) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await createCompanyAction(values);
      if (res.ok && res.data) {
        toast.success("Biznesi u krijua me sukses.");
        setCreateOpen(false);
        router.push(adminPath(`bizneset/${res.data.id}`));
      } else if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bizneset"
        description="Klientët e platformës — krijoni biznese të reja dhe menaxhoni qasjet e tyre."
        actions={
          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) {
                setError(null);
                setFieldErrors({});
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" aria-hidden />
                Shto Biznes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Biznes i ri</DialogTitle>
                <DialogDescription>
                  Regjistroni një klient të ri. Pas krijimit mund të shtoni përdoruesit e tij.
                </DialogDescription>
              </DialogHeader>
              <CompanyForm
                submitLabel="Krijo biznesin"
                pendingLabel="Duke krijuar…"
                isPending={isPending}
                error={error}
                fieldErrors={fieldErrors}
                onSubmit={onCreate}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kërko sipas emrit, NUI, NRB ose email…"
          className="pl-9"
          aria-label="Kërko biznese"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={companies.length === 0 ? "Ende nuk ka biznese" : "Asnjë rezultat"}
          description={
            companies.length === 0
              ? "Krijoni biznesin e parë të klientit për të filluar."
              : "Provoni një kërkim tjetër."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Emri i Biznesit</TableHead>
              <TableHead>NUI</TableHead>
              <TableHead>NRB</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Përdorues</TableHead>
              <TableHead>Statusi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const status = STATUS_LABELS[c.status];
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(adminPath(`bizneset/${c.id}`))}>
                  <TableCell>
                    <Link
                      href={adminPath(`bizneset/${c.id}`)}
                      className="font-medium text-foreground hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.legalName}
                    </Link>
                    {c.tradeName ? <p className="text-xs text-muted-foreground">{c.tradeName}</p> : null}
                    {c.tenantUrl ? (
                      <a
                        href={c.tenantUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.tenantUrl.replace(/^https:\/\//, "")}
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    ) : c.slug ? (
                      <p className="mt-1 text-xs text-muted-foreground">Slug: {c.slug}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.fiscalNumber ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.businessRegistrationNumber ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-center">{c.userCount}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
