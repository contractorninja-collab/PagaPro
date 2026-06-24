import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSummaryCards } from "../types/dashboard-types";

const LABELS: { key: keyof DashboardSummaryCards; label: string; hint: string }[] = [
  { key: "activeEmployees", label: "Aktiv punonjës", hint: "Statusi ACTIVE" },
  {
    key: "contractsExpiringWithin30Days",
    label: "Kontrata afër skadimit",
    hint: "brenda 30 ditëve",
  },
  { key: "payrollsInDraft", label: "Payroll në draft", hint: "të gjitha periudhat" },
  { key: "leaveRequestsPending", label: "Pushime në pritje", hint: "status PENDING" },
  {
    key: "documentsGeneratedThisMonth",
    label: "Dokumente të gjeneruara",
    hint: "final, muaji i filtrit",
  },
  {
    key: "employeesTerminatedThisMonth",
    label: "Të larguar këtë muaj",
    hint: "sipas datës së largimit",
  },
];

export function DashboardSummaryCardsGrid({ summary }: { summary: DashboardSummaryCards }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Përmbledhje operative">
      {LABELS.map(({ key, label, hint }) => (
        <Card key={key} className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </CardTitle>
            <CardDescription className="text-[11px]">{hint}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{summary[key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardSummaryCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-2 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
