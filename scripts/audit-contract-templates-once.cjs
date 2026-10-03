/**
 * TEMPORARY build-time diagnostic — removed after one deploy.
 *
 * Which contract template file is actually PUBLISHED per company in
 * production, and is it the bundled (compact) file or something else?
 * Template metadata only, no employee data. Never fails the build.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const PizZip = require("pizzip");
const { PDFDocument } = require("pdf-lib");
const { getStorage, describeStorage } = require("./seed-storage.cjs");

function resolveConnectionString() {
  const raw =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    null;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!process.env.VERCEL) return trimmed;
  const url = new URL(trimmed);
  url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
}

function resolveSchema() {
  return process.env.PAGAPRO_DATABASE_SCHEMA?.trim() || (process.env.VERCEL ? "pagapro" : "public");
}

const sha = (buf) => createHash("sha1").update(buf).digest("hex").slice(0, 10);

function spacingSignature(buf) {
  try {
    const zip = new PizZip(buf);
    const styles = zip.file("word/styles.xml")?.asText() ?? "";
    const doc = zip.file("word/document.xml")?.asText() ?? "";
    const grab = (re) => (styles.match(re)?.[0]?.match(/<w:spacing[^/>]*\/>/)?.[0]) ?? "-";
    const body = grab(/<w:style [^>]*w:styleId="BodyLegal"[\s\S]*?<\/w:style>/);
    const normal = grab(/<w:style [^>]*w:styleId="Normal"[\s\S]*?<\/w:style>/);
    const defaults = grab(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/);
    const paraXml = doc.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [];
    const paras = paraXml.length;
    const styled = (doc.match(/<w:pStyle w:val="BodyLegal"/g) ?? []).length;
    // Blank paragraphs = visible empty lines between clauses.
    const empty = paraXml.filter((p) => !/<w:t[ >]/.test(p)).length;
    // Direct per-paragraph spacing that overrides the style.
    const direct = {};
    for (const p of paraXml) {
      const sp = p.match(/<w:pPr>[\s\S]*?<w:spacing([^/>]*)\/>/);
      if (!sp) continue;
      const k = sp[1].trim().replace(/w:/g, "");
      direct[k] = (direct[k] ?? 0) + 1;
    }
    const directTop = Object.entries(direct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, n]) => `${n}x{${k}}`)
      .join(" ");
    return `paras=${paras} bodyLegal=${styled} empty=${empty} | BodyLegal ${body} | defaults ${defaults} | direct: ${directTop || "none"}`;
  } catch (e) {
    return `unreadable: ${e.message}`;
  }
}

/** Character-weighted font sizes + paragraphs that lost their style. No text. */
function sizeProfile(buf) {
  try {
    const doc = new PizZip(buf).file("word/document.xml")?.asText() ?? "";
    const STYLE_SZ = { BodyLegal: 20, ArticleTitle: 21 };
    const bySize = {};
    let unstyled = 0;
    for (const p of doc.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? []) {
      const sid = p.match(/<w:pStyle w:val="([^"]+)"/)?.[1];
      const hasText = /<w:t[ >]/.test(p);
      if (!sid && hasText) unstyled += 1;
      for (const r of p.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g) ?? []) {
        const n = [...r.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].reduce((s, m) => s + m[1].length, 0);
        if (!n) continue;
        const sz = Number(r.match(/<w:sz w:val="(\d+)"\/>/)?.[1] ?? STYLE_SZ[sid] ?? 21) / 2;
        bySize[sz] = (bySize[sz] ?? 0) + n;
      }
    }
    const sizes = Object.entries(bySize)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([s, n]) => `${s}pt:${n}`)
      .join(",");
    return `unstyledTextParas=${unstyled} sizes=${sizes}`;
  } catch (e) {
    return `sizeProfile failed: ${e.message}`;
  }
}

async function main() {
  const P = "[tpl-audit]";
  const cs = resolveConnectionString();
  if (!cs) {
    console.log(`${P} no DATABASE_URL — skipping`);
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: cs }, { schema: resolveSchema() }) });
  try {
    console.log(`${P} storage: ${describeStorage()}`);
    const bundle = {};
    for (const f of ["kontrate-me-afat-te-caktuar", "kontrate-me-afat-te-pacaktuar"]) {
      const buf = fs.readFileSync(path.join(__dirname, "..", "templates", "contracts", `${f}.docx`));
      bundle[sha(buf)] = f;
      console.log(`${P} BUNDLE ${f} sha=${sha(buf)} | ${spacingSignature(buf)}`);
    }

    const companies = await prisma.company.findMany({ select: { id: true, legalName: true }, orderBy: { legalName: "asc" } });
    for (const c of companies) {
      const templates = await prisma.documentTemplate.findMany({
        where: { companyId: c.id, documentCategory: "CONTRACT" },
        select: {
          id: true,
          name: true,
          templateSubtype: true,
          isActive: true,
          versions: {
            where: { isPublished: true },
            select: { versionNumber: true, sourceStorageKey: true, originalFilename: true, uploadedAt: true },
          },
          _count: { select: { versions: true } },
        },
        orderBy: { name: "asc" },
      });
      for (const t of templates) {
        if (!/afat/i.test(t.name) && t.templateSubtype !== "AFAT_I_CAKTUAR" && t.templateSubtype !== "AFAT_I_PACAKTUAR") continue;
        const pub = t.versions[0];
        let info = "no published version";
        if (pub) {
          const buf = await getStorage(pub.sourceStorageKey);
          if (!buf) info = "published file MISSING in storage";
          else info = `${bundle[sha(buf)] ? "= BUNDLE" : `CUSTOM sha=${sha(buf)}`} | ${spacingSignature(buf)}`;
        }
        const artifacts = await prisma.documentGenerationArtifact.count({
          where: { companyId: c.id, templateVersion: { templateId: t.id } },
        });
        console.log(
          `${P} ${c.legalName} :: ${t.name} [${t.templateSubtype}] active=${t.isActive} versions=${t._count.versions} ` +
            `pub=v${pub?.versionNumber ?? "-"} (${pub?.originalFilename ?? "-"}, ${pub?.uploadedAt?.toISOString().slice(0, 10) ?? "-"}) ` +
            `artifacts=${artifacts} :: ${info}`,
        );

        // What people actually DOWNLOAD: the generated contracts, which are
        // frozen snapshots of whichever template version was published then.
        // Structure + spacing only — never text, names or amounts.
        const recent = await prisma.documentGenerationArtifact.findMany({
          where: { companyId: c.id, templateVersion: { templateId: t.id }, generatedDocxStorageKey: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: {
            createdAt: true,
            kind: true,
            generatedDocxStorageKey: true,
            generatedPdfStorageKey: true,
            templateVersion: { select: { versionNumber: true, originalFilename: true } },
          },
        });
        for (const a of recent) {
          let sig = "docx missing in storage";
          const buf = await getStorage(a.generatedDocxStorageKey);
          if (buf) sig = sizeProfile(buf) + ` | docx paras/empty: ${spacingSignature(buf).split(" | ")[0]}`;
          // The PDF is what people open — converted separately from the DOCX.
          let pdfInfo = "no pdf";
          if (a.generatedPdfStorageKey) {
            const pdfBuf = await getStorage(a.generatedPdfStorageKey);
            if (!pdfBuf) pdfInfo = "pdf missing";
            else {
              try {
                const pdf = await PDFDocument.load(pdfBuf, { ignoreEncryption: true });
                const producer = (pdf.getProducer() ?? "-").slice(0, 40);
                pdfInfo = `PDF pages=${pdf.getPageCount()} bytes=${pdfBuf.length} producer="${producer}"`;
              } catch (e) {
                pdfInfo = `pdf unreadable: ${e.message}`;
              }
            }
          }
          sig = `${pdfInfo} || ${sig}`;
          console.log(
            `${P}    artifact ${a.createdAt.toISOString().slice(0, 16)} ${a.kind} from v${a.templateVersion.versionNumber} ` +
              `(${a.templateVersion.originalFilename ?? "-"}) pdf=${a.generatedPdfStorageKey ? "yes" : "no"} :: ${sig}`,
          );
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // A diagnostic must never block a deploy.
  console.error("[tpl-audit] FAILED:", e?.message ?? e);
});
