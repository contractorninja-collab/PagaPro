import type { DocxPrintRender, PrintPageGeometry } from "./docx-to-print-html";

export interface PrintablePageDocument {
  title: string;
  render: DocxPrintRender;
}

const A4: PrintPageGeometry = {
  widthMm: 210,
  heightMm: 297,
  marginTopMm: 20,
  marginRightMm: 20,
  marginBottomMm: 20,
  marginLeftMm: 20,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fontStack(family: string | null): string {
  const fallback = '"Times New Roman", Georgia, serif';
  if (!family) return fallback;
  return `"${family.replace(/["\\]/g, "")}", ${fallback}`;
}

/**
 * Assembles one printable HTML page holding every requested document, each on its
 * own sheet with a page break in between, so a batch of contracts is previewed and
 * printed in a single pass instead of opening them one by one.
 */
export function buildPrintPageHtml(documents: PrintablePageDocument[], options?: { autoPrint?: boolean }): string {
  const geometry = documents.find((d) => d.render.geometry)?.render.geometry ?? A4;
  const first = documents[0]?.render;
  const bodyFont = fontStack(first?.fontFamily ?? null);
  const bodySize = first?.fontSizePt ?? 11;
  const contentWidthMm = geometry.widthMm - geometry.marginLeftMm - geometry.marginRightMm;
  const autoPrint = options?.autoPrint ?? true;

  const sheets = documents
    .map(
      (doc) => `<section class="sheet" aria-label="${escapeHtml(doc.title)}">
${doc.render.logoDataUri ? `<img class="logo" src="${doc.render.logoDataUri}" alt="">` : ""}
${doc.render.html}
</section>`,
    )
    .join("\n");

  const label =
    documents.length === 1
      ? escapeHtml(documents[0]!.title)
      : `${documents.length} dokumente`;

  return `<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Printo — ${label}</title>
<style>
  @page {
    size: ${geometry.widthMm}mm ${geometry.heightMm}mm;
    margin: ${geometry.marginTopMm}mm ${geometry.marginRightMm}mm ${geometry.marginBottomMm}mm ${geometry.marginLeftMm}mm;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #eef2f7;
    color: #000;
    font-family: ${bodyFont};
    font-size: ${bodySize}pt;
    line-height: 1.35;
  }
  .bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 13px;
  }
  .bar strong { font-size: 13.5px; }
  .bar .hint { color: #64748b; }
  .bar button {
    border: 0;
    border-radius: 9px;
    background: #2563eb;
    color: #fff;
    font: inherit;
    font-weight: 600;
    padding: 8px 16px;
    cursor: pointer;
  }
  .sheet {
    width: ${geometry.widthMm}mm;
    min-height: ${geometry.heightMm}mm;
    margin: 16px auto;
    padding: ${geometry.marginTopMm}mm ${geometry.marginRightMm}mm ${geometry.marginBottomMm}mm ${geometry.marginLeftMm}mm;
    background: #fff;
    box-shadow: 0 1px 6px rgba(15, 23, 42, 0.18);
  }
  .sheet p { orphans: 2; widows: 2; white-space: pre-wrap; }
  .logo { max-width: 35mm; max-height: 18mm; margin-bottom: 6mm; }
  table { page-break-inside: avoid; }
  /* A full-width sheet would scroll sideways in a narrow window; print keeps the real page size. */
  @media screen and (max-width: ${Math.ceil(geometry.widthMm) + 20}mm) {
    .sheet { width: auto; min-height: 0; margin: 12px; padding: 8mm; }
  }
  @media print {
    body { background: #fff; }
    .no-print { display: none !important; }
    .sheet {
      width: ${contentWidthMm}mm;
      min-height: 0;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }
    .sheet + .sheet { page-break-before: always; break-before: page; }
  }
</style>
</head>
<body>
<div class="bar no-print">
  <span><strong>${label}</strong> <span class="hint">— dritarja e printimit hapet automatikisht.</span></span>
  <button type="button" onclick="window.print()">Printo</button>
</div>
${sheets}
${
  autoPrint
    ? `<script>
window.addEventListener("load", function () {
  window.setTimeout(function () { window.print(); }, 300);
});
</script>`
    : ""
}
</body>
</html>`;
}

/** Standalone HTML error page — this view opens in its own tab, where raw JSON would read as a crash. */
export function buildPrintErrorPage(message: string): string {
  return `<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8">
<title>Printimi nuk u hap</title>
<style>
  body { margin: 0; display: grid; place-items: center; min-height: 100vh; background: #f8fafc;
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; }
  .card { max-width: 460px; padding: 28px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
          box-shadow: 0 1px 4px rgba(15,23,42,.08); }
  h1 { margin: 0 0 8px; font-size: 17px; }
  p { margin: 0; color: #475569; font-size: 14px; line-height: 1.5; }
</style>
</head>
<body><div class="card"><h1>Printimi nuk u hap</h1><p>${escapeHtml(message)}</p></div></body>
</html>`;
}
