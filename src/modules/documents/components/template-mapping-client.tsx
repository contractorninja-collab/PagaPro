"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { TemplateDetectionMode } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTemplateMappingAction } from "@/modules/documents/actions/documents-actions";
import type {
  BlankFieldMapping,
  DetectedBlankField,
  PlaceholderFieldMapping,
  TemplateMappingJson,
} from "@/modules/documents/types/template-mapping";
import { parseMappingJson } from "@/modules/documents/validators/document-template-validator";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface RegistryOption {
  placeholderKey: string;
  label: string;
  category: string;
}

export function TemplateMappingClient(props: {
  templateId: string;
  templateName: string;
  versionId: string;
  versionNumber: number;
  detectionMode: TemplateDetectionMode | null;
  detectedBlanks: DetectedBlankField[];
  detectedPlaceholders: string[];
  initialMapping: TemplateMappingJson | null;
  registry: RegistryOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const defaultBlanks = useMemo((): BlankFieldMapping[] => {
    const existing = parseMappingJson(props.initialMapping)?.blankFields ?? [];
    return props.detectedBlanks.map((b) => {
      const found = existing.find((x) => x.index === b.index);
      return {
        index: b.index,
        placeholderKey: found?.placeholderKey ?? b.suggestedKey ?? "",
        label: found?.label ?? `Fusha ${b.index}`,
        required: found?.required ?? true,
        fallback: found?.fallback ?? "",
      };
    });
  }, [props.detectedBlanks, props.initialMapping]);

  const defaultPlaceholders = useMemo((): PlaceholderFieldMapping[] => {
    const existing = parseMappingJson(props.initialMapping)?.placeholders ?? [];
    return props.detectedPlaceholders.map((key) => {
      const found = existing.find((p) => p.key === key);
      return { key, required: found?.required ?? true, fallback: found?.fallback ?? "" };
    });
  }, [props.detectedPlaceholders, props.initialMapping]);

  const [blankFields, setBlankFields] = useState(defaultBlanks);
  const [placeholders, setPlaceholders] = useState(defaultPlaceholders);

  function save() {
    startTransition(async () => {
      const res = await saveTemplateMappingAction({
        templateId: props.templateId,
        versionId: props.versionId,
        mappingJson: { blankFields, placeholders },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Mapimi u ruajt.");
      router.refresh();
    });
  }

  const groupedRegistry = useMemo(() => {
    const map = new Map<string, RegistryOption[]>();
    for (const r of props.registry) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return map;
  }, [props.registry]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mapimi i fushave</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {props.templateName} — v{props.versionNumber} ({props.detectionMode ?? "—"})
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href={`/dokumentet/templates/${props.templateId}`}>Kthehu te shablloni</Link>
        </Button>
      </div>

      {blankFields.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Fushat bosh ({blankFields.length})</CardTitle>
            <CardDescription>
              Çdo vijë (_) mapohet me një çelës të dhënash nga regjistri — pa hamendësime automatike.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {props.detectedBlanks.map((detected, i) => (
              <div key={detected.index} className="rounded-lg border border-border p-4 space-y-3">
                <div>
                  <p className="font-medium">Fusha {detected.index}</p>
                  <p className="text-xs text-muted-foreground mt-1">{detected.paragraphPreview}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Çelësi i të dhënave</Label>
                    <select
                      className={selectClass}
                      value={blankFields[i]?.placeholderKey ?? ""}
                      onChange={(e) => {
                        const key = e.target.value;
                        setBlankFields((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, placeholderKey: key } : row,
                          ),
                        );
                      }}
                    >
                      <option value="">Zgjidhni…</option>
                      {[...groupedRegistry.entries()].map(([cat, opts]) => (
                        <optgroup key={cat} label={cat}>
                          {opts.map((o) => (
                            <option key={o.placeholderKey} value={o.placeholderKey}>
                              {o.label} ({o.placeholderKey})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Etiketa (opsionale)</Label>
                    <Input
                      value={blankFields[i]?.label ?? ""}
                      onChange={(e) =>
                        setBlankFields((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, label: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Vlerë rezervë</Label>
                    <Input
                      value={blankFields[i]?.fallback ?? ""}
                      onChange={(e) =>
                        setBlankFields((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, fallback: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={blankFields[i]?.required !== false}
                      onChange={(e) =>
                        setBlankFields((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, required: e.target.checked } : row,
                          ),
                        )
                      }
                    />
                    E detyrueshme
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {placeholders.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Placeholder {"{{tags}}"} ({placeholders.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {placeholders.map((ph, i) => (
              <div key={ph.key} className="flex flex-wrap items-center gap-3 rounded border p-3">
                <code className="text-sm">{`{{${ph.key}}}`}</code>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ph.required !== false}
                    onChange={(e) =>
                      setPlaceholders((prev) =>
                        prev.map((row, idx) =>
                          idx === i ? { ...row, required: e.target.checked } : row,
                        ),
                      )
                    }
                  />
                  E detyrueshme
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Duke ruajtur…" : "Ruaj mapimin"}
        </Button>
      </div>
    </div>
  );
}
