import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TerminationType } from "@prisma/client";
import PizZip from "pizzip";

/**
 * Reads termination DOCX templates straight from the repo's committed
 * `templates/termination/` directory.
 *
 * This is the fallback the register uses when the seeded template blob is
 * missing from storage — which is the normal state on a serverless deployment
 * with no object store, where build-time seeds are written to an ephemeral disk
 * and lost. The bytes are committed to the repo and bundled into the function
 * (see `outputFileTracingIncludes` in next.config.ts), so they are always
 * available without any storage at all.
 */

const XML_PART = /^word\/(document\d*|header\d*|footer\d*)\.xml$/i;

interface ManifestEntry {
  filename: string;
  name: string;
  terminationWorkflowKey: TerminationType;
}

function templatesDir(): string {
  return path.join(process.cwd(), "templates", "termination");
}

async function loadManifest(): Promise<ManifestEntry[]> {
  const raw = await readFile(path.join(templatesDir(), "manifest.json"), "utf8");
  const parsed = JSON.parse(raw) as { templates?: ManifestEntry[] };
  return parsed.templates ?? [];
}

/**
 * Mirrors `normalizeBundledTerminationTemplate` in scripts/seed-termination-templates.cjs:
 * the committed DOCX use the legacy `{{employee_name}}` tag, which the seeder
 * rewrites to `{{employee_first_name}}` so it matches the placeholder registry.
 * The fallback must apply the identical rewrite or the employee's name renders blank.
 */
function normalizeBundledTemplate(source: Buffer): Buffer {
  const zip = new PizZip(source);
  for (const name of Object.keys(zip.files)) {
    const file = zip.files[name];
    if (!file || file.dir || !XML_PART.test(name)) continue;
    const normalized = file.asText().replace(/\{\{\s*employee_name\s*\}\}/g, "{{employee_first_name}}");
    zip.file(name, normalized);
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

/**
 * The normalized DOCX for a termination type, or null when the repo has no
 * template for it. Never throws for a missing template — the caller decides
 * whether that is an error.
 */
export async function resolveBundledTerminationTemplate(
  type: TerminationType,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const manifest = await loadManifest();
  const entry = manifest.find((e) => e.terminationWorkflowKey === type);
  if (!entry) return null;

  const raw = await readFile(path.join(templatesDir(), entry.filename));
  return { buffer: normalizeBundledTemplate(raw), filename: entry.filename };
}
