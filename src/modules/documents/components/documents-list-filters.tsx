import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  docBtnPrimaryDense,
  docBtnSecondaryDense,
  docCard,
  docInput,
  docSelect,
} from "@/modules/documents/components/doc-ui";

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
    <form className={cn(docCard, "flex flex-wrap items-center gap-2 p-3")} method="get">
      <div className="relative w-full min-w-[180px] sm:w-auto sm:flex-1 sm:max-w-[280px]">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
          aria-hidden
        />
        <label htmlFor="dq" className="sr-only">
          Kërko
        </label>
        <input
          id="dq"
          name="q"
          placeholder="Kërko titull, skedar…"
          defaultValue={props.defaults.q}
          className={cn(docInput, "pl-8")}
        />
      </div>

      <label htmlFor="de" className="sr-only">
        Punonjësi
      </label>
      <select id="de" name="employeeId" className={docSelect} defaultValue={props.defaults.employeeId}>
        <option value="">Punonjësi: të gjithë</option>
        {props.employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.lastName} {e.firstName}
          </option>
        ))}
      </select>

      <label htmlFor="dc" className="sr-only">
        Lloji
      </label>
      <select
        id="dc"
        name="documentCategory"
        className={docSelect}
        defaultValue={props.defaults.documentCategory}
      >
        <option value="">Lloji: të gjithë</option>
        <option value="CONTRACT">Kontratë</option>
        <option value="LEAVE">Pushim</option>
        <option value="TERMINATION">Ndërprerje</option>
        <option value="WARNING">Vërejtje</option>
        <option value="PAYROLL">Pagë</option>
        <option value="OTHER">Tjetër</option>
      </select>

      <label htmlFor="dm" className="sr-only">
        Muaji
      </label>
      <input
        id="dm"
        name="month"
        type="month"
        defaultValue={props.defaults.month}
        className={cn(docInput, "w-auto min-w-[150px] tabular-nums")}
      />

      <label htmlFor="da" className="sr-only">
        Arkivi
      </label>
      <select id="da" name="archived" className={docSelect} defaultValue={props.defaults.archived}>
        <option value="all">Arkivi: të gjithë</option>
        <option value="no">Jo të arkivuar</option>
        <option value="yes">Të arkivuar</option>
      </select>

      <label htmlFor="dau" className="sr-only">
        Gjeneruar nga
      </label>
      <select id="dau" name="authorId" className={docSelect} defaultValue={props.defaults.authorId}>
        <option value="">Autori: të gjithë</option>
        {props.authors.map((a) => (
          <option key={a.id ?? "unknown"} value={a.id ?? ""}>
            {a.displayName?.trim() || a.email || a.id || "—"}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-2">
        <button type="submit" className={docBtnPrimaryDense}>
          Apliko filtrat
        </button>
        <Link href="/dokumentet" className={docBtnSecondaryDense}>
          Pastro
        </Link>
      </div>
    </form>
  );
}
