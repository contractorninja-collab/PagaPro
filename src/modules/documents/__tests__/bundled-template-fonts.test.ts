import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

const TEMPLATE_DIRECTORIES = ["annex", "leave", "termination"] as const;
const ALLOWED_FONTS = new Set(["Liberation Sans", "Liberation Serif"]);

function runFonts(xml: string): string[] {
  return Array.from(
    xml.matchAll(
      /<w:rFonts\b[^>]*\bw:(?:ascii|hAnsi|eastAsia|cs)=["']([^"']+)["'][^>]*\/?>/g,
    ),
    (match) => match[1]!,
  );
}

describe("bundled document template fonts", () => {
  it.each(TEMPLATE_DIRECTORIES)(
    "uses Liberation fonts in every %s template",
    async (directory) => {
      const templateDirectory = path.join(process.cwd(), "templates", directory);
      const filenames = (await readdir(templateDirectory))
        .filter((filename) => filename.endsWith(".docx"))
        .sort();

      expect(filenames.length).toBeGreaterThan(0);
      for (const filename of filenames) {
        const zip = new PizZip(await readFile(path.join(templateDirectory, filename)));
        const contentParts = Object.keys(zip.files).filter((name) =>
          /^word\/(?:document|header\d+|footer\d+)\.xml$/.test(name),
        );
        const fonts = contentParts.flatMap((name) =>
          runFonts(zip.file(name)?.asText() ?? ""),
        );

        expect(fonts, `${directory}/${filename} has no explicit run fonts`).not.toHaveLength(0);
        expect(
          fonts.filter((font) => !ALLOWED_FONTS.has(font)),
          `${directory}/${filename} contains a non-Liberation font`,
        ).toEqual([]);
        expect(fonts).toContain("Liberation Serif");
        expect(fonts).toContain("Liberation Sans");
      }
    },
  );
});
