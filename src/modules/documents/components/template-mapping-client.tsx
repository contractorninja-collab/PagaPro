"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { TemplateDetectionMode } from "@prisma/client";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { cn } from "@/lib/utils";
import { saveTemplateMappingAction } from "@/modules/documents/actions/documents-actions";
import {
  docBtnPrimary,
  docCard,
  docInput,
  docSelect,
} from "@/modules/documents/components/doc-ui";
import type {
  BlankFieldMapping,
  DetectedBlankField,
  PlaceholderFieldMapping,
  TemplateMappingJson,
} from "@/modules/documents/types/template-mapping";
import { parseMappingJson } from "@/modules/documents/validators/document-template-validator";

export interface RegistryOption {
  placeholderKey: string;
  label: string;
  category: string;
}

const fieldLabelClass = "text-[12px] font-semibold text-[#64748b]";

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
    <>
      <AppSubBar
        dense
        backHref={`/dokumentet/templates/${props.templateId}`}
        backLabel="Shablloni"
        title="Mapimi i fushave"
        description={`${props.templateName} — v${props.versionNumber} (${props.detectionMode ?? "—"})`}
      />
      <div className="space-y-5">
      {blankFields.length > 0 ? (
        <section className={docCard}>
          <div className="border-b border-[#eef2f7] px-4 py-3">
            <h2 className="text-[13.5px] font-bold text-[#0f172a]">
              Fushat bosh ({blankFields.length})
            </h2>
            <p className="mt-0.5 text-[12px] text-[#94a3b8]">
              Çdo vijë (_) mapohet me një çelës të dhënash nga regjistri — pa hamendësime automatike.
            </p>
          </div>
          <div className="space-y-4 p-4">
            {props.detectedBlanks.map((detected, i) => (
              <div key={detected.index} className="space-y-3 rounded-[10px] border border-[#eef2f7] p-4">
                <div>
                  <p className="text-[13px] font-bold text-[#0f172a]">Fusha {detected.index}</p>
                  <p className="mt-1 rounded-md bg-[#f8fafc] px-2.5 py-1.5 text-[12px] italic text-[#64748b]">
                    {detected.paragraphPreview}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label className={fieldLabelClass}>Çelësi i të dhënave</label>
                    <select
                      className={cn(docSelect, "w-full")}
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
                  <div className="grid gap-1.5">
                    <label className={fieldLabelClass}>Etiketa (opsionale)</label>
                    <input
                      className={docInput}
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
                  <div className="grid gap-1.5">
                    <label className={fieldLabelClass}>Vlerë rezervë</label>
                    <input
                      className={docInput}
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
                  <label className="flex items-center gap-2 self-end pb-2 text-[13px] font-medium text-[#334155]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#2563EB]"
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
          </div>
        </section>
      ) : null}

      {placeholders.length > 0 ? (
        <section className={docCard}>
          <div className="border-b border-[#eef2f7] px-4 py-3">
            <h2 className="text-[13.5px] font-bold text-[#0f172a]">
              Placeholder {"{{tags}}"} ({placeholders.length})
            </h2>
          </div>
          <div className="space-y-2.5 p-4">
            {placeholders.map((ph, i) => (
              <div
                key={ph.key}
                className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#eef2f7] px-3 py-2.5 transition-colors hover:bg-[#f8fafc]"
              >
                <code className="rounded-md bg-[#eff6ff] px-2 py-0.5 font-mono text-[12px] font-semibold text-brand-blue">
                  {`{{${ph.key}}}`}
                </code>
                <label className="ml-auto flex items-center gap-2 text-[13px] font-medium text-[#334155]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#2563EB]"
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
          </div>
        </section>
      ) : null}

      <div className="flex gap-2">
        <button type="button" className={docBtnPrimary} disabled={pending} onClick={save}>
          {pending ? "Duke ruajtur…" : "Ruaj mapimin"}
        </button>
      </div>
      </div>
    </>
  );
}
