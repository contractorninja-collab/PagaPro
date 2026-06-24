"use client";

import Link from "next/link";
import type { DocumentCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DOCUMENT_CATEGORY_LABELS, formatArtifactKind } from "@/modules/documents/components/document-labels";

export interface ArtifactRow {
  id: string;
  title: string;
  displayFilename: string;
  documentCategory: DocumentCategory;
  kind: string;
  createdAt: string;
  /** Pre-formatted on the server — avoids client locale hydration mismatches. */
  createdAtLabel: string;
  isArchived: boolean;
  employeeLabel: string | null;
  templateName: string;
  authorLabel: string | null;
  hasPdf: boolean;
}

export interface SubjectOption {
  id: string;
  label: string;
}

export interface DocumentsDashboardClientProps {
  artifacts: ArtifactRow[];
  templateSummary: {
    total: number;
    ready: number;
    needsMapping: number;
    missingPublished: number;
  };
}

function CategoryBadge({ category }: { category: DocumentCategory }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
      {DOCUMENT_CATEGORY_LABELS[category]}
    </span>
  );
}

export function DocumentsDashboardClient(props: DocumentsDashboardClientProps) {
  const finalCount = props.artifacts.filter((a) => a.kind === "ARCHIVED_FINAL").length;
  const previewCount = props.artifacts.filter((a) => a.kind === "PREVIEW").length;
  const archivedCount = props.artifacts.filter((a) => a.isArchived).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dokumentet HR</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Qendër e strukturuar për printimin e kontratave, pushimeve, largimeve dhe vërejtjeve me shabllone DOCX.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/dokumentet/templates">Konfigurimi i shablloneve</Link>
          </Button>
          <Button asChild>
            <Link href="/dokumentet/generate">Gjenero dokumente</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prodhimi i dokumenteve</CardTitle>
            <CardDescription>Një rrjedhë për një ose shumë punonjës.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Krijoni kontrata, pushime, largime dhe vërejtje nga shabllonet e publikuara.
            </p>
            <Button className="w-full" asChild>
              <Link href="/dokumentet/generate">Hap workflow-in</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gjendja e shablloneve</CardTitle>
            <CardDescription>{props.templateSummary.ready} nga {props.templateSummary.total} gati për gjenerim.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted p-3">
              <p className="text-lg font-semibold">{props.templateSummary.ready}</p>
              <p className="text-[11px] text-muted-foreground">Gati</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-lg font-semibold">{props.templateSummary.needsMapping}</p>
              <p className="text-[11px] text-muted-foreground">Mapim</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-lg font-semibold">{props.templateSummary.missingPublished}</p>
              <p className="text-[11px] text-muted-foreground">Publikim</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arkiva</CardTitle>
            <CardDescription>Dokumentet finale dhe parapamjet e fundit.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted p-3">
              <p className="text-lg font-semibold">{finalCount}</p>
              <p className="text-[11px] text-muted-foreground">Finale</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-lg font-semibold">{previewCount}</p>
              <p className="text-[11px] text-muted-foreground">Preview</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-lg font-semibold">{archivedCount}</p>
              <p className="text-[11px] text-muted-foreground">Arkiv</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="md:hidden space-y-3">
        {props.artifacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nuk ka dokumente për filtrat aktualë.</p>
        ) : (
          props.artifacts.map((a) => (
            <Link
              key={a.id}
              href={`/dokumentet/${a.id}`}
              className="block rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.displayFilename}</p>
                </div>
                <CategoryBadge category={a.documentCategory} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{formatArtifactKind(a.kind)}</span>
                {a.isArchived ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                    Arkiv
                  </span>
                ) : null}
                {a.employeeLabel ? <span>{a.employeeLabel}</span> : null}
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titulli</TableHead>
              <TableHead>Lloji</TableHead>
              <TableHead>Shablloni</TableHead>
              <TableHead>Punonjësi</TableHead>
              <TableHead>Gjeneruar</TableHead>
              <TableHead className="text-right">Veprime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.artifacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nuk ka dokumente për filtrat aktualë.
                </TableCell>
              </TableRow>
            ) : (
              props.artifacts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{a.title}</span>
                      <span className="text-xs text-muted-foreground">{a.displayFilename}</span>
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                            a.kind === "PREVIEW"
                              ? "bg-amber-500/15 text-amber-900"
                              : "bg-emerald-500/15 text-emerald-900",
                          )}
                        >
                          {formatArtifactKind(a.kind)}
                        </span>
                        {a.isArchived ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            Arkiv
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={a.documentCategory} />
                  </TableCell>
                  <TableCell className="text-sm">{a.templateName}</TableCell>
                  <TableCell className="text-sm">{a.employeeLabel ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {a.createdAtLabel}
                    {a.authorLabel ? (
                      <span className="mt-1 block text-[11px]">{a.authorLabel}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/dokumentet/${a.id}`}>Hap</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 md:hidden">
        <Button className="w-full shadow-lg" asChild>
          <Link href="/dokumentet/generate">Gjenero dokumente</Link>
        </Button>
      </div>
    </div>
  );
}
