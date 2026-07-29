"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, CornerDownRight, ExternalLink, Plus, Search } from "lucide-react";
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

/**
 * One customer, one cluster: the mother company (the group's oldest) carries
 * the row, and its group companies nest beneath it. A brand with five legal
 * entities reads as one client with five companies — not five unrelated rows
 * that happen to share a badge.
 */
interface CompanyCluster {
  mother: AdminCompanyListItem;
  children: AdminCompanyListItem[];
}

function buildClusters(companies: AdminCompanyListItem[]): CompanyCluster[] {
  const byGroup = new Map<string, AdminCompanyListItem[]>();
  for (const c of companies) {
    if (!c.brandGroupId) continue;
    const arr = byGroup.get(c.brandGroupId) ?? [];
    arr.push(c);
    byGroup.set(c.brandGroupId, arr);
  }

  const clusters: CompanyCluster[] = [];
  const emitted = new Set<string>();
  // The service returns createdAt desc; keep each cluster at its first
  // appearance so recently active brands stay near the top.
  for (const c of companies) {
    if (!c.brandGroupId) {
      clusters.push({ mother: c, children: [] });
      continue;
    }
    if (emitted.has(c.brandGroupId)) continue;
    emitted.add(c.brandGroupId);
    const members = [...(byGroup.get(c.brandGroupId) ?? [c])].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    const [mother, ...children] = members;
    clusters.push({ mother: mother!, children });
  }
  return clusters;
}

function matches(c: AdminCompanyListItem, q: string): boolean {
  return [c.legalName, c.tradeName, c.brandGroupName, c.slug, c.customDomain, c.tenantUrl, c.fiscalNumber, c.businessRegistrationNumber, c.email]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(q));
}

export function BiznesetClient({ companies }: { companies: AdminCompanyListItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const clusters = useMemo(() => {
    const all = buildClusters(companies);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    // A hit on any member keeps the whole cluster — a child match with the
    // mother hidden would read as an ungrouped company.
    return all.filter((cl) => matches(cl.mother, q) || cl.children.some((c) => matches(c, q)));
  }, [companies, query]);

  function onCreate(values: CompanyFormValues) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      // Always ungrouped from here — to add a company under an existing brand,
      // use "+ Kompani e Re" on that brand's own page.
      const res = await createCompanyAction(values);
      if (res.ok && res.data) {
        toast.success(
          `Biznesi u krijua. U instaluan ${res.data.templatesSeeded} shabllone dokumentesh.`,
        );
        for (const warning of res.data.warnings) {
          toast.warning(warning, { duration: 10000 });
        }
        setCreateOpen(false);
        router.push(adminPath(`bizneset/${res.data.id}`));
      } else if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  function companyRow(c: AdminCompanyListItem, child: boolean) {
    const status = STATUS_LABELS[c.status];
    return (
      <TableRow
        key={c.id}
        className="cursor-pointer"
        onClick={() => router.push(adminPath(`bizneset/${c.id}`))}
      >
        <TableCell className={child ? "pl-10" : undefined}>
          <div className="flex items-start gap-2">
            {child ? (
              <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
            <div>
              <Link
                href={adminPath(`bizneset/${c.id}`)}
                className="font-medium text-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {c.legalName}
              </Link>
              {c.tradeName ? <p className="text-xs text-muted-foreground">{c.tradeName}</p> : null}
              {!child && c.brandGroupName ? (
                <Badge variant="secondary" className="mt-1 font-normal">
                  {c.brandGroupName}
                </Badge>
              ) : null}
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
            </div>
          </div>
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

      {clusters.length === 0 ? (
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
            {clusters.map((cl) => [
              companyRow(cl.mother, false),
              ...cl.children.map((c) => companyRow(c, true)),
            ])}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
