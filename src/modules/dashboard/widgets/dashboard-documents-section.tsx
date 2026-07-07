import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DOCUMENT_CATEGORY_LABELS, formatArtifactKind } from "@/modules/documents/components/document-labels";
import { PanelHeader } from "@/components/patterns/page-header";
import type { DocumentCategoryCount, RecentDocumentRow } from "../types/dashboard-types";

export function DashboardDocumentsSection(props: {
  byCategory: DocumentCategoryCount[];
  recent: RecentDocumentRow[];
}) {
  return (
    <div className="surface-card flex h-full flex-col">
      <PanelHeader
        title="Dokumentet"
        description="Gjenerimet e fundit dhe shpërndarja sipas llojit (muaji i filtrit)."
      />
      <div className="grid gap-4 surface-card-body lg:grid-cols-2">
        <div>
          <p className="card-label mb-2">Për kategori (final)</p>
          {props.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka dokumente për muajin.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {props.byCategory.map((c) => (
                <li key={c.category}>
                  <Badge variant="muted">
                    {DOCUMENT_CATEGORY_LABELS[c.category]}: {c.count}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="overflow-x-auto lg:col-span-2">
          <Table className="table-dense">
            <TableHeader>
              <TableRow>
                <TableHead>Dokumenti</TableHead>
                <TableHead>Lloji</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Punonjësi</TableHead>
                <TableHead className="text-right">Veprime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.recent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Nuk ka dokumente të fundit.
                  </TableCell>
                </TableRow>
              ) : (
                props.recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">{r.title}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {DOCUMENT_CATEGORY_LABELS[r.category]} · {formatArtifactKind(r.kind)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.templateName}</TableCell>
                    <TableCell>
                      {r.employeeId ? (
                        <Link
                          href={`/punonjesit/${r.employeeId}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {r.employeeName ?? "Hap"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/api/dokumentet/artifacts/${r.id}/pdf`} target="_blank" rel="noreferrer">
                            PDF
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dokumentet/${r.id}`}>Hap</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
