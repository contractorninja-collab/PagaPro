"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  ExternalLink,
  Layers,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
import { CreateGroupDialog } from "@/components/admin/create-group-dialog";
import { DeleteCompanyDialog } from "@/components/admin/delete-company-dialog";
import { adminPath } from "@/lib/admin-path";
import { createCompanyAction } from "@/modules/admin/actions/admin-actions";
import type { AdminCompanyListItem } from "@/modules/admin/services/admin-service";

const STATUS_LABELS: Record<AdminCompanyListItem["status"], { label: string; variant: "success" | "warning" | "secondary" }> = {
  ACTIVE: { label: "Aktiv", variant: "success" },
  SUSPENDED: { label: "I pezulluar", variant: "warning" },
  ARCHIVED: { label: "I arkivuar", variant: "secondary" },
};

const PAYMENT_LABELS: Record<
  AdminCompanyListItem["paymentState"],
  { label: string; variant: "success" | "warning" | "secondary" | "destructive" }
> = {
  PAID: { label: "I paguar", variant: "success" },
  GRACE: { label: "Në tolerancë", variant: "warning" },
  OVERDUE: { label: "Vonesë", variant: "destructive" },
  UNPAID: { label: "I papaguar", variant: "destructive" },
  NO_PLAN: { label: "Pa paketë", variant: "secondary" },
};

/** X / cap with a colour that warns as the client approaches or exceeds the plan cap. */
function EmployeeUsage({ active, cap }: { active: number; cap: number | null }) {
  const over = cap != null && active > cap;
  const near = cap != null && !over && active >= cap * 0.8;
  return (
    <span
      className={
        over
          ? "font-semibold text-destructive"
          : near
            ? "font-semibold text-amber-600"
            : "text-muted-foreground"
      }
      title={cap != null ? `Plani lejon deri në ${cap} punonjës aktivë` : "Pa kufi plani"}
    >
      {active}
      {cap != null ? ` / ${cap}` : ""}
    </span>
  );
}

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
  return [c.legalName, c.tradeName, c.brandGroupName, c.slug, c.customDomain, c.tenantUrl, c.fiscalNumber, c.email]
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
  const [pendingDelete, setPendingDelete] = useState<AdminCompanyListItem | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  // Groups start folded: a customer with five entities should read as one client,
  // not five rows. Expanding is per-group and remembered while the page lives.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  function toggleGroup(brandGroupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(brandGroupId)) next.delete(brandGroupId);
      else next.add(brandGroupId);
      return next;
    });
  }

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

  function companyRow(c: AdminCompanyListItem, child: boolean, groupSize = 0) {
    const status = STATUS_LABELS[c.status];
    const expandable = !child && groupSize > 0 && c.brandGroupId != null;
    const expanded = expandable && expandedGroups.has(c.brandGroupId!);
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
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {c.brandGroupName}
                  </Badge>
                  {expandable ? (
                    <button
                      type="button"
                      // The row navigates on click; this must not do both.
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroup(c.brandGroupId!);
                      }}
                      aria-expanded={expanded}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-brand-blue transition-colors hover:bg-muted"
                    >
                      {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {expanded
                        ? "Fshih kompanitë"
                        : `Shiko më shumë (${groupSize} kompani)`}
                    </button>
                  ) : null}
                </div>
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
        <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
        <TableCell className="text-center">{c.userCount}</TableCell>
        <TableCell className="text-center tabular-nums">
          <EmployeeUsage active={c.activeEmployees} cap={c.planMaxActiveEmployees} />
        </TableCell>
        <TableCell>
          <div className="space-y-1">
            <p className="text-sm text-foreground">{c.planName ?? "—"}</p>
            <Badge variant={PAYMENT_LABELS[c.paymentState].variant} className="font-normal">
              {PAYMENT_LABELS[c.paymentState].label}
            </Badge>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={status.variant}>{status.label}</Badge>
        </TableCell>
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title={`Fshi ${c.legalName}`}
            // The row itself navigates; a click here must not do both.
            onClick={(e) => {
              e.stopPropagation();
              setPendingDelete(c);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Fshi {c.legalName}</span>
          </Button>
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
          <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setGroupOpen(true)}>
            <Layers className="h-4 w-4" aria-hidden />
            Krijo Grup
          </Button>
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
          </div>
        }
      />

      <CreateGroupDialog open={groupOpen} onOpenChange={setGroupOpen} />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kërko sipas emrit, NUI ose email…"
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
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Përdorues</TableHead>
              <TableHead className="text-center">Punonjës aktivë</TableHead>
              <TableHead>Paketa / Pagesa</TableHead>
              <TableHead>Statusi</TableHead>
              <TableHead className="w-[64px] text-right">Veprime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clusters.map((cl) => {
              // Whole group counted, mother included — "3 kompani" should mean
              // three, not "one plus two others".
              const groupSize = cl.children.length > 0 ? cl.children.length + 1 : 0;
              const q = query.trim().toLowerCase();
              // A search that hits a child must show it, even folded — otherwise
              // the result you searched for is the one thing you cannot see.
              const searchHitsChild = q.length > 0 && cl.children.some((c) => matches(c, q));
              const open =
                searchHitsChild ||
                (cl.mother.brandGroupId != null && expandedGroups.has(cl.mother.brandGroupId));
              return [
                companyRow(cl.mother, false, groupSize),
                ...(open ? cl.children.map((c) => companyRow(c, true)) : []),
              ];
            })}
          </TableBody>
        </Table>
      )}

      {pendingDelete ? (
        <DeleteCompanyDialog
          companyId={pendingDelete.id}
          legalName={pendingDelete.legalName}
          open
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          onDeleted={() => {
            setPendingDelete(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
