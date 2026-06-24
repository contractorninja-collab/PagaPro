"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Copy, KeyRound, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/patterns/empty-state";
import { CompanyForm, type CompanyFormValues } from "@/components/admin/company-form";
import {
  createCompanyUserAction,
  resetUserPasswordAction,
  setCompanyStatusAction,
  setMembershipActiveAction,
  updateCompanyAction,
} from "@/modules/admin/actions/admin-actions";
import type { AdminCompanyDetail } from "@/modules/admin/services/admin-service";
import { MEMBERSHIP_ROLES } from "@/modules/admin/validation/admin-schemas";

const STATUS_LABELS: Record<AdminCompanyDetail["status"], { label: string; variant: "success" | "warning" | "secondary" }> = {
  ACTIVE: { label: "Aktiv", variant: "success" },
  SUSPENDED: { label: "I pezulluar", variant: "warning" },
  ARCHIVED: { label: "I arkivuar", variant: "secondary" },
};

const ROLE_LABELS: Record<(typeof MEMBERSHIP_ROLES)[number], string> = {
  OWNER: "Pronar",
  ADMIN: "Administrator",
  HR_MANAGER: "Menaxher i BNJ",
  ACCOUNTANT: "Kontabilist",
  READ_ONLY: "Vetëm lexim",
};

function TempPasswordDialog({
  state,
  onClose,
}: {
  state: { email: string; tempPassword: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(state.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopjimi dështoi — kopjojeni manualisht.");
    }
  }

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fjalëkalimi i përkohshëm</DialogTitle>
          <DialogDescription>
            Dërgojani këtë fjalëkalim përdoruesit <span className="font-medium text-foreground">{state?.email}</span>.
            Shfaqet vetëm një herë — përdoruesi do ta ndryshojë në hyrjen e parë.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <code className="flex-1 select-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
            {state?.tempPassword}
          </code>
          <Button type="button" variant="secondary" size="icon" onClick={copy} aria-label="Kopjo fjalëkalimin">
            {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            E ruajta — mbyll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BiznesDetailClient({ company }: { company: AdminCompanyDetail }) {
  const router = useRouter();
  const status = STATUS_LABELS[company.status];

  // Company edit
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string[]>>({});
  const [editPending, startEditTransition] = useTransition();

  // Status toggle
  const [statusPending, startStatusTransition] = useTransition();

  // User creation
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<(typeof MEMBERSHIP_ROLES)[number]>("ADMIN");
  const [userError, setUserError] = useState<string | null>(null);
  const [userFieldErrors, setUserFieldErrors] = useState<Record<string, string[]>>({});
  const [userPending, startUserTransition] = useTransition();

  // Temp password reveal + per-row actions
  const [tempPassword, setTempPassword] = useState<{ email: string; tempPassword: string } | null>(null);
  const [rowPending, startRowTransition] = useTransition();

  const initialFormValues: CompanyFormValues = {
    legalName: company.legalName,
    tradeName: company.tradeName ?? "",
    fiscalNumber: company.fiscalNumber ?? "",
    businessRegistrationNumber: company.businessRegistrationNumber ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    website: company.website ?? "",
    addressLine: company.addressLine ?? "",
    city: company.city ?? "",
    postalCode: company.postalCode ?? "",
  };

  function onUpdate(values: CompanyFormValues) {
    setEditError(null);
    setEditFieldErrors({});
    startEditTransition(async () => {
      const res = await updateCompanyAction({ companyId: company.id, payload: values });
      if (res.ok) {
        toast.success("Të dhënat e biznesit u ruajtën.");
        router.refresh();
      } else {
        setEditError(res.error);
        setEditFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  function onToggleStatus() {
    const next = company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    startStatusTransition(async () => {
      const res = await setCompanyStatusAction({ companyId: company.id, status: next });
      if (res.ok) {
        toast.success(next === "ACTIVE" ? "Biznesi u aktivizua." : "Biznesi u pezullua.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUserError(null);
    setUserFieldErrors({});
    startUserTransition(async () => {
      const res = await createCompanyUserAction({
        companyId: company.id,
        payload: { email: newEmail, displayName: newName, role: newRole },
      });
      if (res.ok && res.data) {
        setAddUserOpen(false);
        if (res.data.tempPassword) {
          setTempPassword({ email: newEmail.trim().toLowerCase(), tempPassword: res.data.tempPassword });
        } else {
          toast.success("Përdoruesi ekzistues u lidh me këtë biznes — fjalëkalimi i tij mbetet i njëjtë.");
        }
        setNewEmail("");
        setNewName("");
        setNewRole("ADMIN");
        router.refresh();
      } else if (!res.ok) {
        setUserError(res.error);
        setUserFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  function onResetPassword(userId: string, email: string) {
    startRowTransition(async () => {
      const res = await resetUserPasswordAction({ companyId: company.id, userId });
      if (res.ok && res.data) {
        setTempPassword({ email, tempPassword: res.data.tempPassword });
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  function onToggleAccess(membershipId: string, isActive: boolean) {
    startRowTransition(async () => {
      const res = await setMembershipActiveAction({ companyId: company.id, membershipId, isActive });
      if (res.ok) {
        toast.success(isActive ? "Qasja u aktivizua." : "Qasja u çaktivizua.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <Link
            href="/admin/bizneset"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Bizneset
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{company.legalName}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            NUI: {company.fiscalNumber ?? "—"} · NRB: {company.businessRegistrationNumber ?? "—"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant={company.status === "ACTIVE" ? "destructive" : "default"}
            onClick={onToggleStatus}
            disabled={statusPending}
          >
            {statusPending ? "Duke ndryshuar…" : company.status === "ACTIVE" ? "Pezullo biznesin" : "Aktivizo biznesin"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Të dhënat e biznesit</CardTitle>
            <CardDescription>Informacioni zyrtar i klientit — NUI, NRB dhe kontaktet.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm
              initialValues={initialFormValues}
              submitLabel="Ruaj ndryshimet"
              pendingLabel="Duke ruajtur…"
              isPending={editPending}
              error={editError}
              fieldErrors={editFieldErrors}
              onSubmit={onUpdate}
            />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Përdoruesit</CardTitle>
              <CardDescription>Llogaritë me qasje në panelin e këtij biznesi.</CardDescription>
            </div>
            <Button type="button" size="sm" onClick={() => setAddUserOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden />
              Shto Përdorues
            </Button>
          </CardHeader>
          <CardContent>
            {company.users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Ende nuk ka përdorues"
                description="Shtoni përdoruesin e parë që klienti të hyjë në PagaPRO."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Përdoruesi</TableHead>
                    <TableHead>Roli</TableHead>
                    <TableHead>Qasja</TableHead>
                    <TableHead className="text-right">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.users.map((u) => (
                    <TableRow key={u.membershipId}>
                      <TableCell>
                        <p className="font-medium text-foreground">{u.displayName?.trim() || u.email}</p>
                        {u.displayName?.trim() ? <p className="text-xs text-muted-foreground">{u.email}</p> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{ROLE_LABELS[u.role]}</TableCell>
                      <TableCell>
                        <Badge variant={u.membershipActive ? "success" : "secondary"}>
                          {u.membershipActive ? "Aktive" : "E çaktivizuar"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onResetPassword(u.userId, u.email)}
                            disabled={rowPending}
                            aria-label={`Rivendos fjalëkalimin për ${u.email}`}
                          >
                            <KeyRound className="h-4 w-4" aria-hidden />
                            Rivendos
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={u.membershipActive ? "text-destructive hover:text-destructive" : ""}
                            onClick={() => onToggleAccess(u.membershipId, !u.membershipActive)}
                            disabled={rowPending}
                          >
                            {u.membershipActive ? "Çaktivizo" : "Aktivizo"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={addUserOpen}
        onOpenChange={(open) => {
          setAddUserOpen(open);
          if (!open) {
            setUserError(null);
            setUserFieldErrors({});
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Përdorues i ri</DialogTitle>
            <DialogDescription>
              Krijohet një llogari me fjalëkalim të përkohshëm që do t&apos;ia dërgoni klientit manualisht.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onAddUser} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="newUserEmail">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="newUserEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                autoFocus
              />
              {userFieldErrors.email?.length ? (
                <p className="text-xs font-medium text-destructive">{userFieldErrors.email[0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newUserName">Emri i plotë</Label>
              <Input id="newUserName" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newUserRole">Roli</Label>
              <select
                id="newUserRole"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as (typeof MEMBERSHIP_ROLES)[number])}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {MEMBERSHIP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              {userFieldErrors.role?.length ? (
                <p className="text-xs font-medium text-destructive">{userFieldErrors.role[0]}</p>
              ) : null}
            </div>
            {userError ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {userError}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={userPending}>
                {userPending ? "Duke krijuar…" : "Krijo përdoruesin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TempPasswordDialog state={tempPassword} onClose={() => setTempPassword(null)} />
    </div>
  );
}
