import path from "node:path";
import type { PrismaClient } from "@prisma/client";

/**
 * Seeds the bundled DOCX document templates (contracts, leave, termination) for
 * ONE company, at provisioning time.
 *
 * Without this, templates existed only for companies present at build time —
 * `vercel-build` enumerates companies and seeds them — so a client created via
 * the admin console between deploys had no templates until the next deploy.
 *
 * The seeders are CommonJS scripts under scripts/ (shared with the build).
 * They are loaded via createRequire against the real filesystem rather than
 * imported, so webpack leaves them external and their __dirname-relative paths
 * (templates/, seed-storage.cjs) resolve identically at build time and at
 * runtime. scripts/** is traced into the serverless bundle via next.config.ts.
 */

type PerCompanySeeder = (prisma: PrismaClient, companyId: string) => Promise<number>;

/**
 * A real Node `require` rooted in scripts/, acquired WITHOUT importing
 * `node:module`.
 *
 * `import { createRequire } from "node:module"` compiled, under Next 15.5's
 * webpack, to `let c = void 0` — the import and the call were eliminated as
 * dead code, so every company created between deploys got "c is not a
 * function" and ZERO document templates (the build-time seeder later healed
 * them on the next deploy, which is why nothing looked wrong for long).
 * `process.getBuiltinModule` is a runtime property access on a global; no
 * bundler can resolve or tree-shake it. Node ≥ 20.16 — both Vercel's runtime
 * and local dev qualify.
 */
export function requireFromScriptsDir(): (id: string) => unknown {
  const proc = process as unknown as {
    getBuiltinModule?: (id: string) => { createRequire: (base: string) => (id: string) => unknown };
  };
  const nodeModule = proc.getBuiltinModule?.("node:module");
  if (!nodeModule) {
    throw new Error(
      "process.getBuiltinModule mungon — kërkohet Node 20.16+ për ngarkimin e seeder-ëve.",
    );
  }
  // Resolution base inside scripts/ — the file itself doesn't need to exist.
  return nodeModule.createRequire(path.join(process.cwd(), "scripts", "__resolve__.cjs"));
}

export const FAMILIES: ReadonlyArray<{ label: string; module: string; export: string }> = [
  { label: "kontratat", module: "./seed-contract-templates.cjs", export: "seedContractTemplatesForCompany" },
  { label: "pushimet", module: "./seed-leave-templates.cjs", export: "seedLeaveTemplatesForCompany" },
  { label: "largimet", module: "./seed-termination-templates.cjs", export: "seedTerminationTemplatesForCompany" },
  { label: "vërejtjet", module: "./seed-warning-templates.cjs", export: "seedWarningTemplatesForCompany" },
  // Was missing: the build-time seeder has always included annexes, so a
  // company created between deploys had no Aneks template until the next one.
  { label: "anekset", module: "./seed-annex-templates.cjs", export: "seedAnnexTemplatesForCompany" },
];

export interface CompanyTemplateSeedResult {
  seeded: number;
  warnings: string[];
}

export async function seedDocumentTemplatesForCompany(
  prisma: PrismaClient,
  companyId: string,
): Promise<CompanyTemplateSeedResult> {
  const requireFromScripts = requireFromScriptsDir();

  let seeded = 0;
  const warnings: string[] = [];

  for (const family of FAMILIES) {
    try {
      const mod = requireFromScripts(family.module) as Record<string, PerCompanySeeder>;
      const fn = mod[family.export];
      if (typeof fn !== "function") {
        throw new Error(`${family.module} does not export ${family.export}`);
      }
      seeded += await fn(prisma, companyId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[provisionCompany] template seeding (${family.label}) failed for ${companyId}:`, err);
      warnings.push(`Shabllonet e ${family.label} nuk u krijuan: ${msg}`);
    }
  }

  return { seeded, warnings };
}
