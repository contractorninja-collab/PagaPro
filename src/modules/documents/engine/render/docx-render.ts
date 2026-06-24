import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export interface DocxRenderOptions {
  /** Reserved — validation happens before render; missing tags become empty strings. */
  strict?: boolean;
}

/**
 * Renders a DOCX buffer using docxtemplater with `{{placeholder}}` delimiters.
 */
export function renderDocxTemplate(
  docxBuffer: Buffer,
  flatData: Record<string, string>,
  _options: DocxRenderOptions = {},
): Buffer {
  void _options;
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter() {
      return "";
    },
  });

  doc.render(flatData);

  const out = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;

  return out;
}
