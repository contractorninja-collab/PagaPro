import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { rgb, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";

const FONT_DIR = path.join(process.cwd(), "templates", "fonts");
const SERIF_REGULAR_PATH = path.join(FONT_DIR, "LiberationSerif-Regular.ttf");
const SANS_BOLD_PATH = path.join(FONT_DIR, "LiberationSans-Bold.ttf");

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

export async function embedPayrollPdfFonts(
  pdf: PDFDocument,
): Promise<{ body: PDFFont; heading: PDFFont }> {
  pdf.registerFontkit(fontkit);
  const { serifRegular, sansBold } = await loadFontBytes();
  const [body, heading] = await Promise.all([
    pdf.embedFont(serifRegular, { subset: true }),
    pdf.embedFont(sansBold, { subset: true }),
  ]);
  return { body, heading };
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
