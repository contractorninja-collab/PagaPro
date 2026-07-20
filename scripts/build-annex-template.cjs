/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Authors templates/annex/aneks-kontrate.docx.
 *
 * docx-js is not a project dependency, so instead of adding one we reuse a
 * known-good template package (styles/fonts/sectPr) from templates/leave and
 * swap in a fresh <w:body>. The body is a docxtemplater {{placeholder}} template
 * with a {{#changes}} loop; the render engine (docx-render.ts) already runs
 * docxtemplater with paragraphLoop:true.
 *
 * Run once (or after editing the content): node scripts/build-annex-template.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const PizZip = require("pizzip");

const REPO = path.join(__dirname, "..");
const SKELETON = path.join(REPO, "templates", "leave", "vertetim-pushim-tjeter.docx");
const OUT_DIR = path.join(REPO, "templates", "annex");
const OUT = path.join(OUT_DIR, "aneks-kontrate.docx");

const FONT = '<w:rFonts w:ascii="Calibri" w:cs="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri"/>';

/** XML-escape body text. Placeholders ({{ }}) contain none of these, so they pass through. */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function run(text, opts = {}) {
  const rpr = [
    FONT,
    opts.bold ? "<w:b/><w:bCs/>" : "",
    opts.italic ? "<w:i/><w:iCs/>" : "",
    opts.size ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : "",
  ].join("");
  return `<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(runsXml, opts = {}) {
  const ppr = [
    `<w:spacing w:after="${opts.after ?? 140}"/>`,
    opts.align ? `<w:jc w:val="${opts.align}"/>` : "",
  ].join("");
  return `<w:p><w:pPr>${ppr}</w:pPr>${runsXml}</w:p>`;
}

/** Two-column borderless signature table (DXA widths sum to the text column). */
function signatureTable() {
  const W = 4819;
  const cell = (inner) =>
    `<w:tc><w:tcPr><w:tcW w:w="${W}" w:type="dxa"/></w:tcPr>${inner}</w:tc>`;
  const rowP = (text, opts) =>
    `<w:p><w:pPr><w:spacing w:after="60"/><w:jc w:val="center"/></w:pPr>${run(text, opts)}</w:p>`;
  const row = (l, r) => `<w:tr>${cell(l)}${cell(r)}</w:tr>`;
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"/>` +
    `<w:tblBorders>` +
    `<w:top w:val="none" w:sz="0" w:space="0"/><w:left w:val="none" w:sz="0" w:space="0"/>` +
    `<w:bottom w:val="none" w:sz="0" w:space="0"/><w:right w:val="none" w:sz="0" w:space="0"/>` +
    `<w:insideH w:val="none" w:sz="0" w:space="0"/><w:insideV w:val="none" w:sz="0" w:space="0"/>` +
    `</w:tblBorders></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="${W}"/><w:gridCol w:w="${W}"/></w:tblGrid>` +
    row(rowP("Punëdhënësi", { bold: true }), rowP("I punësuari", { bold: true })) +
    row(rowP("________________________"), rowP("________________________")) +
    row(rowP("{{authorized_person_name}}"), rowP("{{employee_name}}")) +
    `</w:tbl>`
  );
}

const SECTPR =
  `<w:sectPr><w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>` +
  `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>` +
  `<w:docGrid w:linePitch="360"/></w:sectPr>`;

function buildBody() {
  const parts = [];

  // Company letterhead
  parts.push(para(run("{{company_name}}", { bold: true, size: 30 }), { after: 40 }));
  parts.push(para(run("{{company_address}}", { size: 18 }), { after: 300 }));

  // Title
  parts.push(
    para(run("ANEKS NR. {{annex_number}} I KONTRATËS SË PUNËS", { bold: true, size: 28 }), {
      align: "center",
      after: 300,
    }),
  );

  // Legal basis
  parts.push(
    para(
      run(
        "Në bazë të neneve 10, 11, 17, 18 dhe 19 të Ligjit Nr. 03/L-212 të Punës, si dhe Kontratës së Punës të lidhur me datën {{original_contract_date}}, palët nënshkruese lidhin këtë aneks të kontratës së punës:",
      ),
    ),
  );

  // Parties
  parts.push(
    para(
      run(
        "1. Punëdhënësi: {{company_name}}, me seli në {{company_address}}, numri i biznesit {{company_nrb}}, i përfaqësuar nga {{authorized_person_name}} ({{authorized_person_position}}); dhe",
      ),
    ),
  );
  parts.push(
    para(
      run(
        "2. I punësuari: {{employee_name}}, numri personal {{employee_personal_number}}, me vendbanim {{employee_address}}.",
      ),
      { after: 240 },
    ),
  );

  // Article 1 — the changes
  parts.push(para(run("Neni 1 — Objekti i aneksit", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run("Me këtë aneks, palët pajtohen që kushtet e kontratës së punës të ndryshohen si në vijim:"),
    ),
  );
  // docxtemplater loop: the open/close tag paragraphs are consumed; the middle repeats.
  parts.push(para(run("{{#changes}}")));
  parts.push(para(run("•  {{label}}: nga “{{from}}” në “{{to}}”.")));
  parts.push(para(run("{{/changes}}"), { after: 240 }));

  // Article 2 — effective date
  parts.push(para(run("Neni 2 — Hyrja në fuqi", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run("Ndryshimet e përcaktuara me këtë aneks hyjnë në fuqi nga data {{annex_effective_date}}."),
      { after: 240 },
    ),
  );

  // Article 3 — final provisions
  parts.push(para(run("Neni 3 — Dispozitat përfundimtare", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run(
        "Të gjitha dispozitat e tjera të kontratës së punës të datës {{original_contract_date}} mbeten të pandryshuara dhe në fuqi. Ky aneks është pjesë përbërëse e kontratës së punës dhe përpilohet në dy (2) kopje, nga një për secilën palë.",
      ),
      { after: 300 },
    ),
  );

  // Place & date
  parts.push(para(run("{{document_place}}, më {{document_date}}"), { after: 400 }));

  // Signatures
  parts.push(signatureTable());
  // A trailing empty paragraph is required before sectPr.
  parts.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`);

  return parts.join("") + SECTPR;
}

function main() {
  const skeleton = fs.readFileSync(SKELETON);
  const zip = new PizZip(skeleton);
  const docXml = zip.file("word/document.xml").asText();

  const bodyOpen = docXml.indexOf("<w:body>");
  const bodyClose = docXml.indexOf("</w:body>");
  if (bodyOpen === -1 || bodyClose === -1) throw new Error("skeleton has no <w:body>");

  const head = docXml.slice(0, bodyOpen + "<w:body>".length);
  const tail = docXml.slice(bodyClose); // includes </w:body></w:document>
  const newXml = head + buildBody() + tail;

  zip.file("word/document.xml", newXml);

  // Drop the skeleton's comments so no orphan anchors linger.
  ["word/comments.xml", "word/_rels/comments.xml.rels"].forEach((k) => {
    if (zip.file(k)) zip.remove(k);
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Wrote ${path.relative(REPO, OUT)} (${fs.statSync(OUT).size} bytes)`);
}

main();
