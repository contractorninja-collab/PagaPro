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
 *
 * Page margins are built into the document rather than declared on `@page`. A
 * browser draws its own header and footer — page title, date, source URL, page
 * numbers — inside the `@page` margin box, and no CSS can suppress that text while
 * the box exists. With `@page { margin: 0 }` there is no box and nothing is drawn,
 * so each sheet recreates the margins itself: sides as padding, top and bottom as
 * spacer rows in a wrapper table. Those rows are `<thead>`/`<tfoot>`, which the
 * browser repeats on every page a document spills onto, so a contract's second and
 * third pages keep the same margins as its first.
 */
export function buildPrintPageHtml(documents: PrintablePageDocument[], options?: { autoPrint?: boolean }): string {
  const geometry = documents.find((d) => d.render.geometry)?.render.geometry ?? A4;
  const first = documents[0]?.render;
  const bodyFont = fontStack(first?.fontFamily ?? null);
  const bodySize = first?.fontSizePt ?? 11;
  const autoPrint = options?.autoPrint ?? true;

  const sheets = documents
    .map(
      (doc) => `<section class="sheet" aria-label="${escapeHtml(doc.title)}">
<table class="frame">
<thead><tr><td class="gap-top"></td></tr></thead>
<tfoot><tr><td class="gap-bottom"></td></tr></tfoot>
<tbody><tr><td class="content">
${doc.render.logoDataUri ? `<img class="logo" src="${doc.render.logoDataUri}" alt="">` : ""}
${doc.render.html}
</td></tr></tbody>
</table>
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
  /* No margin box means the browser has nowhere to print its own header/footer. */
  @page { size: ${geometry.widthMm}mm ${geometry.heightMm}mm; margin: 0; }
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
    background: #fff;
    box-shadow: 0 1px 6px rgba(15, 23, 42, 0.18);
  }
  .frame { width: 100%; border-collapse: collapse; }
  /* Repeated by the browser on every page of a document that runs long. */
  .gap-top { height: ${geometry.marginTopMm}mm; }
  .gap-bottom { height: ${geometry.marginBottomMm}mm; }
  .content {
    padding: 0 ${geometry.marginRightMm}mm 0 ${geometry.marginLeftMm}mm;
    vertical-align: top;
  }
  .content p { orphans: 2; widows: 2; white-space: pre-wrap; }
  .logo { max-width: 35mm; max-height: 18mm; margin-bottom: 6mm; }
  .content table { page-break-inside: avoid; }
  /* A full-width sheet would scroll sideways in a narrow window; print keeps the real page size. */
  @media screen and (max-width: ${Math.ceil(geometry.widthMm) + 20}mm) {
    .sheet { width: auto; min-height: 0; margin: 12px; }
    .gap-top, .gap-bottom { height: 8mm; }
    .content { padding: 0 8mm; }
  }
  @media print {
    body { background: #fff; }
    .no-print { display: none !important; }
    .sheet {
      width: auto;
      min-height: 0;
      margin: 0;
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
