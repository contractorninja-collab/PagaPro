"use client";

import Link from "next/link";
import type { PayrollPeriodStatus } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayrollStatusBadge } from "@/modules/payroll/components/payroll-status-badge";
import { formatIsoDateUtcDdMmYyyy } from "@/modules/payroll/helpers/display-date";
import { MoreHorizontal } from "lucide-react";

export type PayrollListRow = {
  id: string;
  year: number;
  month: number;
  monthLabel: string;
  companyLabel: string;
  employeeCount: number;
  totalGross: string;
  totalNet: string;
  status: PayrollPeriodStatus;
  createdAt: string;
};

export function PayrollsTable(props: {
  rows: PayrollListRow[];
  onRegenerate: (id: string) => void;
  onReview: (id: string) => void;
  onApprove: (id: string) => void;
  onLock: (id: string) => void;
  onArchive: (id: string) => void;
  onPdf: (id: string) => void;
}) {
  const { rows, onRegenerate, onReview, onApprove, onLock, onArchive, onPdf } = props;

  return (
    <>
      <div className="hidden rounded-lg border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Muaji</TableHead>
              <TableHead>Kompania</TableHead>
              <TableHead className="text-right">Punonjësit</TableHead>
              <TableHead className="text-right">Bruto Totale</TableHead>
              <TableHead className="text-right">Neto Totale</TableHead>
              <TableHead>Statusi</TableHead>
              <TableHead>Krijuar</TableHead>
              <TableHead className="w-[52px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  Nuk ka periudha pagë. Krijoni një payroll për të filluar.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.monthLabel}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">{r.companyLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.employeeCount}</TableCell>
                  <TableCell className="text-right tabular-nums">€{r.totalGross}</TableCell>
                  <TableCell className="text-right tabular-nums">€{r.totalNet}</TableCell>
                  <TableCell>
                    <PayrollStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatIsoDateUtcDdMmYyyy(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Veprime">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem asChild>
                          <Link href={`/pagat/${r.id}`}>Shiko payroll</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {r.status === "DRAFT" ? (
                          <DropdownMenuItem onClick={() => onRegenerate(r.id)}>Ripëllogarit</DropdownMenuItem>
                        ) : null}
                        {r.status === "DRAFT" ? (
                          <DropdownMenuItem onClick={() => onReview(r.id)}>Shëno të shqyrtuar</DropdownMenuItem>
                        ) : null}
                        {r.status === "REVIEWED" ? (
                          <DropdownMenuItem onClick={() => onApprove(r.id)}>Mirato</DropdownMenuItem>
                        ) : null}
                        {r.status === "APPROVED" ? (
                          <DropdownMenuItem onClick={() => onLock(r.id)}>Kyç payroll</DropdownMenuItem>
                        ) : null}
                        {r.status === "APPROVED" ? (
                          <DropdownMenuItem onClick={() => onPdf(r.id)}>Paraprakisht: gjenero PDF</DropdownMenuItem>
                        ) : null}
                        {r.status === "LOCKED" ? (
                          <DropdownMenuItem onClick={() => onArchive(r.id)}>Arkivo</DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
            Nuk ka periudha pagë.
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold leading-tight">{r.monthLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.companyLabel}</p>
                </div>
                <PayrollStatusBadge status={r.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Punonjësit</dt>
                  <dd className="tabular-nums font-medium">{r.employeeCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Bruto</dt>
                  <dd className="tabular-nums font-medium">€{r.totalGross}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Neto</dt>
                  <dd className="tabular-nums font-medium">€{r.totalNet}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Krijuar</dt>
                  <dd className="text-xs">{formatIsoDateUtcDdMmYyyy(r.createdAt)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/pagat/${r.id}`}>Hap</Link>
                </Button>
                {r.status === "DRAFT" ? (
                  <Button size="sm" variant="secondary" type="button" onClick={() => onRegenerate(r.id)}>
                    Ripëllogarit
                  </Button>
                ) : null}
                {r.status === "REVIEWED" ? (
                  <Button size="sm" variant="secondary" type="button" onClick={() => onApprove(r.id)}>
                    Mirato
                  </Button>
                ) : null}
                {r.status === "APPROVED" ? (
                  <Button size="sm" type="button" onClick={() => onLock(r.id)}>
                    Kyç
                  </Button>
                ) : null}
                {r.status === "APPROVED" ? (
                  <Button size="sm" variant="secondary" type="button" onClick={() => onPdf(r.id)}>
                    PDF
                  </Button>
                ) : null}
                {r.status === "LOCKED" ? (
                  <Button size="sm" variant="secondary" type="button" onClick={() => onArchive(r.id)}>
                    Arkivo
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
