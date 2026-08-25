"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/layout/capability-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listCompanyMembersAction,
  setMemberSalaryAccessAction,
  type CompanyMemberRow,
} from "@/modules/konfigurime/actions/company-users-actions";

const ROLE_LABELS: Record<CompanyMemberRow["role"], string> = {
  OWNER: "Pronar",
  ADMIN: "Administrator",
  HR_MANAGER: "Menaxher i BNJ",
  ACCOUNTANT: "Kontabilist",
  READ_ONLY: "Vetëm lexim",
};

const ACCESS_LABELS: Array<{ value: CompanyMemberRow["salaryAccess"]; label: string }> = [
  { value: "FULL", label: "Sheh të gjitha pagat" },
  { value: "STANDARD", label: "Pa personelin e lartë" },
  { value: "NONE", label: "Nuk sheh paga" },
];

/**
 * The one thing a client Admin may change about their colleagues: salary
 * visibility. Roles, new users and deactivation stay in the platform admin
 * console — this panel cannot lock a company out of its own account.
 */
export function CompanyUsersPanel() {
  const canManage = useCan("company.settings");
  const [members, setMembers] = useState<CompanyMemberRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await listCompanyMembersAction();
      if (r.ok && r.data) setMembers(r.data);
    })();
  }, []);

  async function changeAccess(row: CompanyMemberRow, salaryAccess: CompanyMemberRow["salaryAccess"]) {
    setBusyId(row.membershipId);
    try {
      const r = await setMemberSalaryAccessAction({ membershipId: row.membershipId, salaryAccess });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setMembers((prev) =>
        prev?.map((m) => (m.membershipId === row.membershipId ? { ...m, salaryAccess } : m)) ?? null,
      );
      toast.success(
        salaryAccess === "FULL"
          ? "Qasja e plotë në paga u dha — hyn në fuqi në kyçjen e radhës."
          : "Qasja në paga u kufizua — sesionet e përdoruesit u mbyllën.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Qasja në paga sipas përdoruesit</CardTitle>
        <CardDescription>
          Kush sheh shumat e pagave. Rolet dhe krijimi i përdoruesve menaxhohen nga PagaPRO —
          kontaktoni mbështetjen për ndryshime rolesh.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members === null ? (
          <p className="text-sm text-muted-foreground">Duke u ngarkuar…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nuk ka përdorues.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {members.map((m) => (
              <li key={m.membershipId} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink-900">
                    {m.displayName?.trim() || m.email}
                    {m.isSelf ? <span className="ml-2 text-[11px] font-medium text-ink-400">(ju)</span> : null}
                  </p>
                  <p className="text-[12px] text-ink-500">
                    {m.email} · {ROLE_LABELS[m.role]}
                  </p>
                </div>
                {!m.isActive ? <Badge variant="secondary">E çaktivizuar</Badge> : null}
                <select
                  value={m.salaryAccess}
                  disabled={!canManage || m.isSelf || busyId === m.membershipId}
                  title={m.isSelf ? "Nuk mund të ndryshoni qasjen tuaj në paga." : undefined}
                  aria-label={`Qasja në paga e ${m.email}`}
                  onChange={(e) =>
                    void changeAccess(m, e.target.value as CompanyMemberRow["salaryAccess"])
                  }
                  className="h-9 rounded-lg border border-line bg-white px-2 text-[13px] text-ink-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {ACCESS_LABELS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
