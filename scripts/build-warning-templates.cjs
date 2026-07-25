/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Authors the three Vërejtje templates under templates/warning/.
 *
 * Content follows Ligji Nr. 03/L-212 i Punës:
 *  - Neni 85.1: the disciplinary measures, of which 85.1.1 is the verbal warning
 *    and 85.1.2 the written one; Neni 85.2 places both on light breaches.
 *  - Neni 86.1/86.3: the measure is imposed by the employer or an authorised
 *    person, in writing, stating the reasoning and the advice on legal remedies.
 *  - Neni 70.2: a written warning that is to support a later dismissal must give
 *    a description of the shortcoming, a deadline to correct it, and say that
 *    failing to do so leads to dismissal without further written warning.
 *  - Neni 70.3: the employee may be accompanied by a representative at the meeting.
 *  - Neni 78/79: the remedies — a request to the employer (decided within 15 days,
 *    delivered within 8), then a labour dispute within 30 days.
 *
 * Same approach as build-annex-template.cjs: reuse a known-good DOCX package for
 * styles/fonts and swap in a fresh {{placeholder}} body.
 *
 * Run: node scripts/build-warning-templates.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const PizZip = require("pizzip");

const REPO = path.join(__dirname, "..");
const SKELETON = path.join(REPO, "templates", "leave", "vertetim-pushim-tjeter.docx");
const OUT_DIR = path.join(REPO, "templates", "warning");

const FONT = '<w:rFonts w:ascii="Calibri" w:cs="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri"/>';

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

function signatureTable(rightLabel) {
  const W = 4819;
  const cell = (inner) => `<w:tc><w:tcPr><w:tcW w:w="${W}" w:type="dxa"/></w:tcPr>${inner}</w:tc>`;
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
    row(rowP("Punëdhënësi", { bold: true }), rowP(rightLabel, { bold: true })) +
    row(rowP("________________________"), rowP("________________________")) +
    row(rowP("{{authorized_person_name}}"), rowP("{{employee_name}}")) +
    `</w:tbl>`
  );
}

const SECTPR =
  `<w:sectPr><w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>` +
  `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>` +
  `<w:docGrid w:linePitch="360"/></w:sectPr>`;

/** Letterhead + title + the parties block every warning shares. */
function head(title, legalBasis) {
  const parts = [];
  parts.push(para(run("{{company_name}}", { bold: true, size: 30 }), { after: 40 }));
  parts.push(para(run("{{company_address}}", { size: 18 }), { after: 300 }));
  parts.push(para(run(title, { bold: true, size: 28 }), { align: "center", after: 120 }));
  parts.push(
    para(run("Nr. i protokollit: ______ / {{document_date}}", { size: 18 }), {
      align: "center",
      after: 300,
    }),
  );
  parts.push(para(run(legalBasis)));
  parts.push(
    para(
      run(
        "Punëdhënësi: {{company_name}}, me seli në {{company_address}}, numri i biznesit {{company_nrb}}, i përfaqësuar nga {{authorized_person_name}} ({{authorized_person_position}}).",
      ),
    ),
  );
  parts.push(
    para(
      run(
        "I punësuari: {{employee_name}}, numri personal {{employee_personal_number}}, i punësuar në pozitën {{employee_position}}, me vendbanim {{employee_address}}.",
      ),
      { after: 240 },
    ),
  );
  return parts;
}

/** Neni 78/79 — the legal-remedy advice Neni 86.3 requires the decision to carry. */
function legalRemedies() {
  return [
    para(run("Këshilla për mjetet juridike", { bold: true }), { after: 80 }),
    para(
      run(
        "Në pajtim me nenin 78 të Ligjit të Punës, i punësuari që vlerëson se i janë shkelur të drejtat nga marrëdhënia e punës, mund të paraqesë kërkesë te punëdhënësi për realizimin e të drejtave. Punëdhënësi vendos brenda pesëmbëdhjetë (15) ditëve nga pranimi i kërkesës dhe vendimin ia dorëzon të punësuarit me shkrim brenda tetë (8) ditëve. Nëse i punësuari nuk është i kënaqur me vendimin ose nuk merr përgjigje brenda këtij afati, sipas nenit 79 mund të inicojë kontest pune në gjykatën kompetente brenda tridhjetë (30) ditëve.",
      ),
      { after: 300 },
    ),
  ];
}

function closing(signatureRightLabel) {
  return [
    para(run("{{document_place}}, më {{document_date}}"), { after: 400 }),
    signatureTable(signatureRightLabel),
    `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`,
  ];
}

/** Vërejtje — the general disciplinary notice (Neni 85 + 86). */
function buildGeneralWarning() {
  const parts = head(
    "VËREJTJE",
    "Në bazë të nenit 85 dhe nenit 86 të Ligjit Nr. 03/L-212 të Punës, punëdhënësi nxjerr këtë vërejtje:",
  );

  parts.push(para(run("1. Shkelja e konstatuar", { bold: true }), { after: 80 }));
  parts.push(para(run("{{warning_summary}}"), { after: 200 }));

  parts.push(para(run("2. Data e konstatimit", { bold: true }), { after: 80 }));
  parts.push(para(run("Shkelja është konstatuar më {{warning_issued_at}}."), { after: 200 }));

  parts.push(para(run("3. Masa e shqiptuar", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run(
        "Për shkeljen e lartpërmendur të detyrave të punës, të punësuarit i shqiptohet masa: {{warning_measure}} (neni 85.1 i Ligjit të Punës).",
      ),
      { after: 200 },
    ),
  );

  parts.push(para(run("4. Arsyetimi", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run(
        "Sjellja e përshkruar më lart përbën shkelje të detyrave të punës të përcaktuara me Kontratën e Punës, aktet e brendshme të punëdhënësit dhe Ligjin e Punës. Punëdhënësi kërkon nga i punësuari që të përmbahet nga përsëritja e kësaj sjelljeje dhe t’i kryejë detyrat e punës me ndërgjegje. Në rast të përsëritjes, punëdhënësi mund të shqiptojë masa më të rënda sipas nenit 85 të Ligjit të Punës.",
      ),
      { after: 240 },
    ),
  );

  parts.push(...legalRemedies());
  parts.push(...closing("I punësuari (pranova një kopje)"));
  return parts.join("") + SECTPR;
}

/** Vërejtje me gojë — Neni 85.1.1; the written record of a verbal measure. */
function buildVerbalWarning() {
  const parts = head(
    "VËREJTJE ME GOJË",
    "Në bazë të nenit 85.1.1 të Ligjit Nr. 03/L-212 të Punës, punëdhënësi shqipton vërejtjen me gojë dhe e evidenton atë me këtë shkresë:",
  );

  parts.push(para(run("1. Shkelja e konstatuar", { bold: true }), { after: 80 }));
  parts.push(para(run("{{warning_summary}}"), { after: 200 }));

  parts.push(para(run("2. Shqiptimi i masës", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run(
        "Më {{warning_issued_at}}, të punësuarit i është shqiptuar me gojë vërejtja për shkeljen e detyrave të punës, në takimin e mbajtur ndërmjet të punësuarit dhe përfaqësuesit të punëdhënësit. Kjo shkresë shërben vetëm si evidencë e masës së shqiptuar me gojë.",
      ),
      { after: 200 },
    ),
  );

  parts.push(para(run("3. E drejta e shoqërimit", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run(
        "Në pajtim me nenin 70.3 të Ligjit të Punës, i punësuari ka pasur të drejtë të shoqërohet nga një përfaqësues sipas dëshirës së vet.",
      ),
      { after: 200 },
    ),
  );

  parts.push(para(run("4. Arsyetimi dhe kërkesa", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run(
        "Sjellja e përshkruar përbën shkelje të lehtë të detyrave të punës në kuptim të nenit 85.2 të Ligjit të Punës. Punëdhënësi kërkon nga i punësuari korrigjimin e menjëhershëm të sjelljes. Në rast të përsëritjes, punëdhënësi mund të shqiptojë vërejtje me shkrim ose masa më të rënda sipas nenit 85 të Ligjit të Punës.",
      ),
      { after: 240 },
    ),
  );

  parts.push(...legalRemedies());
  parts.push(...closing("I punësuari (u njoftua)"));
  return parts.join("") + SECTPR;
}

/** Vërejtje me shkrim — Neni 85.1.2, carrying the Neni 70.2 elements. */
function buildWrittenWarning() {
  const parts = head(
    "VËREJTJE ME SHKRIM",
    "Në bazë të nenit 85.1.2 dhe nenit 86 të Ligjit Nr. 03/L-212 të Punës, punëdhënësi shqipton këtë vërejtje me shkrim:",
  );

  parts.push(para(run("1. Përshkrimi i shkeljes / performancës së pakënaqshme", { bold: true }), { after: 80 }));
  parts.push(para(run("{{warning_summary}}"), { after: 200 }));

  parts.push(para(run("2. Data e konstatimit", { bold: true }), { after: 80 }));
  parts.push(para(run("Shkelja është konstatuar më {{warning_issued_at}}."), { after: 200 }));

  parts.push(para(run("3. Afati për përmirësim", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run(
        "I punësuari obligohet ta korrigjojë sjelljen, përkatësisht ta përmirësojë performancën e vet, deri më {{warning_improvement_deadline}}.",
      ),
      { after: 200 },
    ),
  );

  parts.push(para(run("4. Pasojat e mospërmirësimit", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run(
        "Në pajtim me nenin 70.2 të Ligjit të Punës, i punësuari njoftohet se dështimi për ta përmirësuar performancën brenda afatit të lartpërmendur mund të rezultojë me ndërprerje të kontratës së punës, pa asnjë paralajmërim të mëtejmë me shkrim.",
      ),
      { after: 200 },
    ),
  );

  parts.push(para(run("5. Arsyetimi", { bold: true }), { after: 80 }));
  parts.push(
    para(
      run(
        "Sjellja, përkatësisht performanca e përshkruar më lart, nuk është në përputhje me detyrat e punës të përcaktuara me Kontratën e Punës, aktet e brendshme të punëdhënësit dhe Ligjin e Punës. Në pajtim me nenin 70.3, i punësuari ka të drejtë të shoqërohet nga një përfaqësues sipas dëshirës së vet në takimin me punëdhënësin.",
      ),
      { after: 240 },
    ),
  );

  parts.push(...legalRemedies());
  parts.push(...closing("I punësuari (pranova një kopje)"));
  return parts.join("") + SECTPR;
}

const DOCUMENTS = [
  { file: "verejtje.docx", build: buildGeneralWarning },
  { file: "verejtje-me-goje.docx", build: buildVerbalWarning },
  { file: "verejtje-me-shkrim.docx", build: buildWrittenWarning },
];

function main() {
  const skeleton = fs.readFileSync(SKELETON);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const doc of DOCUMENTS) {
    const zip = new PizZip(skeleton);
    const documentXml = zip.file("word/document.xml").asText();
    const open = documentXml.indexOf("<w:body>");
    const close = documentXml.lastIndexOf("</w:body>");
    if (open === -1 || close === -1) throw new Error("skeleton has no <w:body>");

    const next =
      documentXml.slice(0, open + "<w:body>".length) + doc.build() + documentXml.slice(close);
    zip.file("word/document.xml", next);

    const out = path.join(OUT_DIR, doc.file);
    fs.writeFileSync(out, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
    const placeholders = new Set(next.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? []);
    console.log(`Wrote ${path.relative(REPO, out)} (${placeholders.size} placeholders)`);
  }
}

main();
