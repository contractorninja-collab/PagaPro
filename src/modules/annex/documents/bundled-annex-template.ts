import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Reads the committed annex DOCX template straight from the repo.
 * `templates/**` is traced into the Vercel bundle (next.config.ts), so this works
 * serverless with no object store — the same approach as the termination templates.
 */
export async function resolveBundledAnnexTemplate(): Promise<Buffer> {
  return readFile(path.join(process.cwd(), "templates", "annex", "aneks-kontrate.docx"));
}
