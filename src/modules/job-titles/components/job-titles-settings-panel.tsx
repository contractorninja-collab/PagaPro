"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  archiveJobTitleAction,
  loadJobTitlesAction,
  restoreJobTitleAction,
  saveJobTitleAction,
} from "@/modules/job-titles/actions/job-title-actions";
import type { JobTitleDto } from "@/modules/job-titles/services/job-title-service";

interface Draft {
  id?: string;
  title: string;
  department: string;
  level: string;
  description: string;
  responsibilities: string;
  requirements: string;
}

const emptyDraft: Draft = {
  title: "",
  department: "",
  level: "",
  description: "",
  responsibilities: "",
  requirements: "",
};

function asDraft(row: JobTitleDto): Draft {
  return {
    id: row.id,
    title: row.title,
    department: row.department ?? "",
    level: row.level ?? "",
    description: row.description,
    responsibilities: row.responsibilities ?? "",
    requirements: row.requirements ?? "",
  };
}

function flattenErrors(raw?: Record<string, string[] | undefined>): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(raw)) {
    const first = messages?.[0];
    if (first) out[key] = first;
  }
  return out;
}

export function JobTitlesSettingsPanel(props: {
  initialJobTitles: JobTitleDto[];
}) {
  const { initialJobTitles } = props;
  const [jobTitles, setJobTitles] = useState(initialJobTitles);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setJobTitles(initialJobTitles);
  }, [initialJobTitles]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await loadJobTitlesAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setJobTitles(res.jobTitles);
    } finally {
      setBusy(false);
    }
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobTitles.filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (!q) return true;
      return [row.title, row.department, row.level, row.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [jobTitles, query, status]);

  const patchDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const clearField = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const resetDraft = () => {
    setDraft(emptyDraft);
    setFieldErrors({});
  };

  const handleSave = async () => {
    setBusy(true);
    setFieldErrors({});
    try {
      const res = await saveJobTitleAction({
        id: draft.id,
        title: draft.title,
        department: draft.department || null,
        level: draft.level || null,
        description: draft.description,
        responsibilities: draft.responsibilities || null,
        requirements: draft.requirements || null,
      });
      if (!res.ok) {
        const flat = flattenErrors(res.fieldErrors);
        setFieldErrors(flat);
        toast.error(Object.values(flat)[0] ?? res.error);
        return;
      }
      toast.success(draft.id ? "Pozita u përditësua." : "Pozita u krijua.");
      resetDraft();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleArchiveToggle = async (row: JobTitleDto) => {
    setBusy(true);
    try {
      const res =
        row.status === "ACTIVE"
          ? await archiveJobTitleAction({ id: row.id })
          : await restoreJobTitleAction({ id: row.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(row.status === "ACTIVE" ? "Pozita u arkivua." : "Pozita u rikthye.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pozitat dhe përshkrimet e punës</CardTitle>
        <CardDescription>
          Këto përshkrime përdoren në regjistrimin e punonjësve, profile dhe gjenerimin e kontratave.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px),minmax(0,1fr)]">
          <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {draft.id ? "Ndrysho pozitën" : "Shto pozitë"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Përshkrimi ruhet si burim zyrtar për kontrata dhe profil.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="job-title-name">Titulli</Label>
                <Input
                  id="job-title-name"
                  value={draft.title}
                  onChange={(e) => {
                    clearField("title");
                    patchDraft({ title: e.target.value });
                  }}
                  placeholder="p.sh. Menaxher i shitjes"
                  disabled={busy}
                />
                {fieldErrors.title ? <p className="text-xs text-destructive">{fieldErrors.title}</p> : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="job-title-department">Departamenti</Label>
                  <Input
                    id="job-title-department"
                    value={draft.department}
                    onChange={(e) => patchDraft({ department: e.target.value })}
                    placeholder="p.sh. Shitje"
                    disabled={busy}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="job-title-level">Niveli</Label>
                  <Input
                    id="job-title-level"
                    value={draft.level}
                    onChange={(e) => patchDraft({ level: e.target.value })}
                    placeholder="Junior, Senior, Lead"
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="job-title-description">Përshkrimi i punës</Label>
                <textarea
                  id="job-title-description"
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.description}
                  onChange={(e) => {
                    clearField("description");
                    patchDraft({ description: e.target.value });
                  }}
                  disabled={busy}
                />
                {fieldErrors.description ? <p className="text-xs text-destructive">{fieldErrors.description}</p> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="job-title-responsibilities">Përgjegjësitë</Label>
                <textarea
                  id="job-title-responsibilities"
                  className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.responsibilities}
                  onChange={(e) => patchDraft({ responsibilities: e.target.value })}
                  placeholder="Një përgjegjësi për rresht"
                  disabled={busy}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="job-title-requirements">Kërkesat</Label>
                <textarea
                  id="job-title-requirements"
                  className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.requirements}
                  onChange={(e) => patchDraft({ requirements: e.target.value })}
                  placeholder="Një kërkesë për rresht"
                  disabled={busy}
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={resetDraft}>
                Pastro
              </Button>
              <Button type="button" disabled={busy} onClick={() => void handleSave()}>
                {busy ? "Duke ruajtur..." : "Ruaj pozitën"}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Kërko sipas titullit, departamentit ose përshkrimit"
                  disabled={busy}
                />
              </div>
              <select
                className="flex h-10 min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                disabled={busy}
              >
                <option value="ALL">Të gjitha</option>
                <option value="ACTIVE">Aktive</option>
                <option value="ARCHIVED">Arkivuara</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pozita</TableHead>
                    <TableHead>Departamenti</TableHead>
                    <TableHead>Niveli</TableHead>
                    <TableHead>Statusi</TableHead>
                    <TableHead>Punonjës</TableHead>
                    <TableHead className="text-right">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Nuk ka pozita për këto filtra.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="max-w-[320px]">
                            <p className="font-medium">{row.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>{row.department ?? "—"}</TableCell>
                        <TableCell>{row.level ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "ACTIVE" ? "success" : "secondary"}>
                            {row.status === "ACTIVE" ? "Aktive" : "Arkivuar"}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.employeeCount}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => setDraft(asDraft(row))}
                            >
                              Ndrysho
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={busy}
                              aria-label={row.status === "ACTIVE" ? `Arkivo ${row.title}` : `Rikthe ${row.title}`}
                              onClick={() => void handleArchiveToggle(row)}
                            >
                              {row.status === "ACTIVE" ? (
                                <Archive className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                              )}
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
      </CardContent>
    </Card>
  );
}
