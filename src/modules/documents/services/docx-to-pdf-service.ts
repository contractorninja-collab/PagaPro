/**
 * Converts DOCX → PDF, trying in order:
 *  1. HTTP converter (e.g. Gotenberg) when DOCX_TO_PDF_URL is set — preferred for production.
 *  2. LibreOffice CLI (`soffice --headless --convert-to pdf`) when installed (or SOFFICE_PATH set).
 *  3. Microsoft Word COM automation via PowerShell (Windows with Office installed).
 *
 * Local converters are serialized through a queue — Word/LibreOffice don't handle
 * concurrent invocations reliably.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const LOCAL_CONVERT_TIMEOUT_MS = 120_000;

export type DocxToPdfResult =
  | { ok: true; pdf: Buffer }
  | { ok: false; skipped: true }
  | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* 1. HTTP converter (Gotenberg-compatible)                            */
/* ------------------------------------------------------------------ */

async function convertViaHttp(docxBuffer: Buffer, base: string): Promise<DocxToPdfResult> {
  const endpoint = `${base}/forms/libreoffice/convert`;

  try {
    const body = new FormData();
    body.append("files", new Blob([new Uint8Array(docxBuffer)]), "document.docx");

    const res = await fetch(endpoint, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(LOCAL_CONVERT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Converter HTTP ${res.status}${text ? `: ${text.slice(0, 500)}` : ""}`,
      };
    }

    const ab = await res.arrayBuffer();
    return { ok: true, pdf: Buffer.from(ab) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/* ------------------------------------------------------------------ */
/* 2. LibreOffice CLI                                                  */
/* ------------------------------------------------------------------ */

let cachedSofficePath: string | null | undefined;

function resolveSofficePath(): string | null {
  if (cachedSofficePath !== undefined) return cachedSofficePath;

  const candidates = [
    process.env.SOFFICE_PATH?.trim(),
    ...(process.platform === "win32"
      ? [
          "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
          "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
        ]
      : ["/usr/bin/soffice", "/usr/local/bin/soffice", "/opt/libreoffice/program/soffice"]),
  ].filter((p): p is string => Boolean(p));

  cachedSofficePath = candidates.find((p) => existsSync(p)) ?? null;
  return cachedSofficePath;
}

async function convertViaLibreOffice(docxBuffer: Buffer, sofficePath: string): Promise<DocxToPdfResult> {
  const workDir = await mkdtemp(path.join(tmpdir(), "pagapro-pdf-"));
  const inputPath = path.join(workDir, "document.docx");
  const outputPath = path.join(workDir, "document.pdf");

  try {
    await writeFile(inputPath, docxBuffer);
    await execFileAsync(
      sofficePath,
      ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", workDir, inputPath],
      { timeout: LOCAL_CONVERT_TIMEOUT_MS, windowsHide: true },
    );
    const pdf = await readFile(outputPath);
    return { ok: true, pdf };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `LibreOffice: ${msg}` };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* 3. Microsoft Word COM (Windows)                                     */
/* ------------------------------------------------------------------ */

/** Set to false after a definitive "Word is not installed" failure to avoid repeated probing. */
let wordComAvailable = process.platform === "win32";

async function convertViaWordCom(docxBuffer: Buffer): Promise<DocxToPdfResult> {
  const workDir = await mkdtemp(path.join(tmpdir(), "pagapro-pdf-"));
  const inputPath = path.join(workDir, "document.docx");
  const outputPath = path.join(workDir, "document.pdf");

  // wdFormatPDF = 17. Paths come from mkdtemp — no quoting hazards.
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$word = New-Object -ComObject Word.Application",
    "$word.Visible = $false",
    "$word.DisplayAlerts = 0",
    "try {",
    `  $doc = $word.Documents.Open('${inputPath}', $false, $true)`,
    `  $doc.SaveAs2('${outputPath}', 17)`,
    "  $doc.Close($false)",
    "} finally {",
    "  $word.Quit()",
    "}",
  ].join("; ");

  try {
    await writeFile(inputPath, docxBuffer);
    await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { timeout: LOCAL_CONVERT_TIMEOUT_MS, windowsHide: true },
    );
    const pdf = await readFile(outputPath);
    return { ok: true, pdf };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/80040154|Word\.Application/i.test(msg)) {
      wordComAvailable = false;
    }
    return { ok: false, error: `Word COM: ${msg}` };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

let localConversionQueue: Promise<unknown> = Promise.resolve();

function enqueueLocal<T>(task: () => Promise<T>): Promise<T> {
  const next = localConversionQueue.then(task, task);
  localConversionQueue = next.catch(() => {});
  return next;
}

export async function convertDocxBufferToPdf(docxBuffer: Buffer): Promise<DocxToPdfResult> {
  const httpBase = process.env.DOCX_TO_PDF_URL?.trim().replace(/\/$/, "");
  if (httpBase) {
    return convertViaHttp(docxBuffer, httpBase);
  }

  const sofficePath = resolveSofficePath();
  if (sofficePath) {
    return enqueueLocal(() => convertViaLibreOffice(docxBuffer, sofficePath));
  }

  if (wordComAvailable) {
    return enqueueLocal(() => convertViaWordCom(docxBuffer));
  }

  return { ok: false, skipped: true };
}
