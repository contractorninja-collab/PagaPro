import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface FilterEmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

export interface FilterAuthorOption {
  id: string | null;
  displayName: string | null;
  email: string | null;
}

export interface DocumentsListFiltersProps {
  defaults: {
    q: string;
    employeeId: string;
    documentCategory: string;
    month: string;
    archived: string;
    authorId: string;
  };
  employees: FilterEmployeeOption[];
  authors: FilterAuthorOption[];
}

export function DocumentsListFilters(props: DocumentsListFiltersProps) {
  return (
    <form className="space-y-4 rounded-lg border border-border bg-card p-4" method="get">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="grid gap-2 xl:col-span-2">
          <Label htmlFor="dq">Kërko</Label>
          <Input id="dq" name="q" placeholder="Titulli, skedari…" defaultValue={props.defaults.q} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="de">Punonjësi</Label>
          <select id="de" name="employeeId" className={selectClass} defaultValue={props.defaults.employeeId}>
            <option value="">Të gjithë</option>
            {props.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lastName} {e.firstName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dc">Lloji</Label>
          <select id="dc" name="documentCategory" className={selectClass} defaultValue={props.defaults.documentCategory}>
            <option value="">Të gjithë</option>
            <option value="CONTRACT">Kontratë</option>
            <option value="LEAVE">Pushim</option>
            <option value="TERMINATION">Ndërprerje</option>
            <option value="WARNING">Vërejtje</option>
            <option value="PAYROLL">Pagë</option>
            <option value="OTHER">Tjetër</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dm">Muaji</Label>
          <Input id="dm" name="month" type="month" defaultValue={props.defaults.month} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="da">Arkivi</Label>
          <select id="da" name="archived" className={selectClass} defaultValue={props.defaults.archived}>
            <option value="all">Të gjithë</option>
            <option value="no">Jo të arkivuar</option>
            <option value="yes">Të arkivuar</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dau">Gjeneruar nga</Label>
          <select id="dau" name="authorId" className={selectClass} defaultValue={props.defaults.authorId}>
            <option value="">Të gjithë</option>
            {props.authors.map((a) => (
              <option key={a.id ?? "unknown"} value={a.id ?? ""}>
                {a.displayName?.trim() || a.email || a.id || "—"}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm">
          Apliko filtrat
        </Button>
        <Button type="reset" variant="secondary" size="sm" asChild>
          <Link href="/dokumentet">Pastro</Link>
        </Button>
      </div>
    </form>
  );
}
