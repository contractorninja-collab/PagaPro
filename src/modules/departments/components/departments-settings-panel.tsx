"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  createDepartmentAction,
  deleteDepartmentAction,
  loadDepartmentsAction,
  renameDepartmentAction,
} from "@/modules/departments/actions/department-actions";
import type { DepartmentWithEmployeeCountDto } from "@/modules/departments/services/department-service";

export function DepartmentsSettingsPanel(props: {
  initialDepartments: DepartmentWithEmployeeCountDto[];
}) {
  const { initialDepartments } = props;
  const [departments, setDepartments] = useState(initialDepartments);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DepartmentWithEmployeeCountDto | null>(null);

  useEffect(() => {
    setDepartments(initialDepartments);
  }, [initialDepartments]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await loadDepartmentsAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDepartments(res.departments);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Shkruani emrin e departamentit.");
      return;
    }
    setBusy(true);
    try {
      const res = await createDepartmentAction({ name });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Departamenti «${res.name}» u krijua.`);
      setNewName("");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (row: DepartmentWithEmployeeCountDto) => {
    setEditingId(row.id);
    setEditName(row.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleRename = async (id: string) => {
    const name = editName.trim();
    if (!name) {
      toast.error("Emri i departamentit nuk mund të jetë bosh.");
      return;
    }
    setBusy(true);
    try {
      const res = await renameDepartmentAction({ id, name });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Departamenti u përditësua.");
      cancelEdit();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await deleteDepartmentAction({ id: deleteTarget.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Departamenti u fshi.");
      setDeleteTarget(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Departamentet</CardTitle>
          <CardDescription>
            Struktura organizative e kompanisë. Punonjësit caktohen në departament nga forma e punonjësit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <Label htmlFor="new-department-name">Emri i departamentit</Label>
              <Input
                id="new-department-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="p.sh. Financa, HR, IT"
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreate();
                  }
                }}
              />
            </div>
            <Button type="button" disabled={busy} onClick={() => void handleCreate()}>
              Shto departament
            </Button>
          </div>

          {departments.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              Nuk ka departamente. Shtoni të parin më sipër ose nga forma e punonjësit.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emri</TableHead>
                    <TableHead className="w-[140px]">Punonjës</TableHead>
                    <TableHead className="w-[160px] text-right">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {editingId === row.id ? (
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={busy}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleRename(row.id);
                              }
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          <span className="font-medium">{row.name}</span>
                        )}
                      </TableCell>
                      <TableCell>{row.employeeCount}</TableCell>
                      <TableCell className="text-right">
                        {editingId === row.id ? (
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={cancelEdit}>
                              Anulo
                            </Button>
                            <Button type="button" size="sm" disabled={busy} onClick={() => void handleRename(row.id)}>
                              Ruaj
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={busy}
                              aria-label={`Ndrysho ${row.name}`}
                              onClick={() => startEdit(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={busy}
                              aria-label={`Fshi ${row.name}`}
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fshi departamentin?</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget.employeeCount > 0
                ? `«${deleteTarget.name}» ka ${deleteTarget.employeeCount} punonjës të caktuar. Pas fshirjes, ata do të shfaqen si «Pa departamenti».`
                : deleteTarget
                  ? `«${deleteTarget.name}» do të fshihet përgjithmonë.`
                  : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleteTarget(null)}>
              Anulo
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void handleDelete()}>
              Fshi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
