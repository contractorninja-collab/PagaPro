import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { rgb, StandardFonts, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";

const FONT_DIR = path.join(process.cwd(), "templates", "fonts");
const SERIF_REGULAR_PATH = path.join(FONT_DIR, "LiberationSerif-Regular.ttf");
const SANS_BOLD_PATH = path.join(FONT_DIR, "LiberationSans-Bold.ttf");

/**
 * Brand faces the payroll documents are drawn in — Manrope, the same face the
 * app's interface uses, so a payslip looks like it came from the product the
 * employee's manager is looking at. They remain optional: the loader falls back
 * to metrically compatible standard faces (Helvetica ≈ Liberation Sans ≈ Arial)
 * if a file is missing, so column maths holds either way.
 *
 * The figure faces are a SEPARATE, deliberately prepared pair. Manrope's digits
 * are proportional by default — "1" is 3.2pt where "6" is 5.6pt — so two amounts
 * with the same decimals come out different widths and the commas wander down
 * the column. Manrope does ship tabular alternates (`tnum`), but pdf-lib draws
 * glyphs straight through the cmap and cannot apply OpenType features, so the
 * feature alone would never reach the page. The -Tabular files therefore have
 * the tabular glyphs mapped onto the digit codepoints, making them the default:
 * every digit is one width, and money lines up without a monospaced face.
 *
 * Regenerate with scripts/build-manrope-pdf-fonts.py after a font update.
 */
const OPTIONAL_FACES = {
  sans: "Manrope-Regular.ttf",
  sansBold: "Manrope-SemiBold.ttf",
  mono: "Manrope-Regular-Tabular.ttf",
  monoBold: "Manrope-SemiBold-Tabular.ttf",
} as const;

let fontBytesPromise:
  | Promise<{ serifRegular: Buffer; sansBold: Buffer }>
  | undefined;

function loadFontBytes() {
  fontBytesPromise ??= Promise.all([
    readFile(SERIF_REGULAR_PATH),
    readFile(SANS_BOLD_PATH),
  ]).then(([serifRegular, sansBold]) => ({ serifRegular, sansBold }));
  return fontBytesPromise;
}

async function readOptionalFace(filename: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(FONT_DIR, filename));
  } catch {
    return null;
  }
}

export interface PayrollPdfFonts {
  /** Body copy. */
  sans: PDFFont;
  /** Headings, labels, totals. */
  sansBold: PDFFont;
  /** Tabular figures, so money and hour columns align on the decimal. */
  mono: PDFFont;
  monoBold: PDFFont;
  /**
   * Standard (non-embedded) faces encode WinAnsi only, so text drawn in them must
   * pass through `toPdfStandardFontText`. Embedded faces must NOT — the sanitiser
   * would strip characters they render perfectly well.
   */
  sanitize: { sans: boolean; sansBold: boolean; mono: boolean; monoBold: boolean };
  /** Which face each slot resolved to — surfaced for diagnostics and tests. */
  faces: { sans: string; sansBold: string; mono: string; monoBold: string };
  /** Back-compat with the builders written against the previous signature. */
  body: PDFFont;
  heading: PDFFont;
}

export async function embedPayrollPdfFonts(pdf: PDFDocument): Promise<PayrollPdfFonts> {
  pdf.registerFontkit(fontkit);
  const { serifRegular, sansBold: liberationSansBold } = await loadFontBytes();

  const [brandSans, brandSansBold, brandMono, brandMonoBold] = await Promise.all([
    readOptionalFace(OPTIONAL_FACES.sans),
    readOptionalFace(OPTIONAL_FACES.sansBold),
    readOptionalFace(OPTIONAL_FACES.mono),
    readOptionalFace(OPTIONAL_FACES.monoBold),
  ]);

  const sans = brandSans
    ? await pdf.embedFont(brandSans, { subset: true })
    : await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = brandSansBold
    ? await pdf.embedFont(brandSansBold, { subset: true })
    : await pdf.embedFont(liberationSansBold, { subset: true });
  const mono = brandMono
    ? await pdf.embedFont(brandMono, { subset: true })
    : await pdf.embedFont(StandardFonts.Courier);
  const monoBold = brandMonoBold
    ? await pdf.embedFont(brandMonoBold, { subset: true })
    : await pdf.embedFont(StandardFonts.CourierBold);

  const body = await pdf.embedFont(serifRegular, { subset: true });

  return {
    sans,
    sansBold,
    mono,
    monoBold,
    sanitize: {
      sans: !brandSans,
      sansBold: false,
      mono: !brandMono,
      monoBold: !brandMonoBold,
    },
    faces: {
      sans: brandSans ? OPTIONAL_FACES.sans : "Helvetica",
      sansBold: brandSansBold ? OPTIONAL_FACES.sansBold : "LiberationSans-Bold.ttf",
      mono: brandMono ? OPTIONAL_FACES.mono : "Courier",
      monoBold: brandMonoBold ? OPTIONAL_FACES.monoBold : "Courier-Bold",
    },
    body,
    heading: sansBold,
  };
}

export function drawPagaproGeneratedFooter(
  page: PDFPage,
  font: PDFFont,
  options: { pageWidth: number; margin: number },
): void {
  const text = "Gjeneruar nga PagaPRO";
  const size = 6.5;
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: options.pageWidth - options.margin - width,
    y: 16,
    size,
    font,
    color: rgb(0.48, 0.51, 0.56),
  });
}
