/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Authors templates/contracts/kontrate-praktikant.docx — the internship
 * employment contract (Kontratë Pune për Praktikant).
 *
 * Legal basis: Ligji Nr. 03/L-212 i Punës — Neni 10-11 (contract form and
 * content), Neni 16 (interns: real employment contract, full rights, max
 * duration 1 year university / 6 months secondary education, safety per Ligji
 * Nr. 2003/19, unpaid internships allowed only with registry evidence — this
 * template is for PAID interns processed through payroll), Neni 20-21
 * (part-time work, rights proportional to hours; the intern works
 * {{daily_hours}} h/day, {{weekly_hours}} h/week from the employee profile).
 *
 * PLACEHOLDER mode ({{tags}}), like the leave/termination templates — the
 * signature underscores are formatting, not fillable blanks.
 *
 * Regenerate after editing: node scripts/build-praktikant-template.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const PizZip = require("pizzip");

const REPO = path.join(__dirname, "..");
const SKELETON = path.join(REPO, "templates", "leave", "vertetim-pushim-tjeter.docx");
const OUT = path.join(REPO, "templates", "contracts", "kontrate-praktikant.docx");

const FONT = '<w:rFonts w:ascii="Calibri" w:cs="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri"/>';

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function run(text, opts = {}) {
  const rpr = [
    FONT,
    opts.bold ? "<w:b/><w:bCs/>" : "",
    opts.size ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : "",
    opts.color ? `<w:color w:val="${opts.color}"/>` : "",
  ].join("");
  return `<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}
function para(runsXml, opts = {}) {
  const ppr = [
    `<w:spacing w:after="${opts.after ?? 120}"/>`,
    opts.align ? `<w:jc w:val="${opts.align}"/>` : "",
  ].join("");
  return `<w:p><w:pPr>${ppr}</w:pPr>${runsXml}</w:p>`;
}
const h = (t) => para(run(t, { bold: true }), { after: 80 });
const p = (t) => para(run(t));

function signatureTable() {
  const W = 4819;
  const cell = (inner) => `<w:tc><w:tcPr><w:tcW w:w="${W}" w:type="dxa"/></w:tcPr>${inner}</w:tc>`;
  const cp = (text, opts) =>
    `<w:p><w:pPr><w:spacing w:after="60"/><w:jc w:val="center"/></w:pPr>${run(text, opts)}</w:p>`;
  const row = (l, r) => `<w:tr>${cell(l)}${cell(r)}</w:tr>`;
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"/>` +
    `<w:tblBorders><w:top w:val="none" w:sz="0" w:space="0"/><w:left w:val="none" w:sz="0" w:space="0"/>` +
    `<w:bottom w:val="none" w:sz="0" w:space="0"/><w:right w:val="none" w:sz="0" w:space="0"/>` +
    `<w:insideH w:val="none" w:sz="0" w:space="0"/><w:insideV w:val="none" w:sz="0" w:space="0"/></w:tblBorders></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="${W}"/><w:gridCol w:w="${W}"/></w:tblGrid>` +
    row(cp("Punëdhënësi", { bold: true }), cp("Praktikanti/ja", { bold: true })) +
    row(cp("________________________"), cp("________________________")) +
    row(cp("{{authorized_person_name}}"), cp("{{employee_name}}")) +
    `</w:tbl>`
  );
}

const SECTPR =
  `<w:sectPr><w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>` +
  `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>` +
  `<w:docGrid w:linePitch="360"/></w:sectPr>`;

function buildBody() {
  const s = [];

  s.push(para(run("{{company_name}}", { bold: true, size: 30 }), { after: 40 }));
  s.push(para(run("{{company_address}}", { size: 18 }), { after: 300 }));

  s.push(para(run("KONTRATË PUNE PËR PRAKTIKANT", { bold: true, size: 28 }), { align: "center", after: 60 }));
  s.push(para(run("(me orar jo të plotë pune)", { size: 20, color: "595959" }), { align: "center", after: 300 }));

  s.push(
    p(
      "Në bazë të neneve 10, 11, 16, 20 dhe 21 të Ligjit Nr. 03/L-212 të Punës, palët nënshkruese lidhin këtë kontratë pune për praktikant:",
    ),
  );
  s.push(
    p(
      "1. Punëdhënësi: {{company_name}}, me seli në {{company_address}}, NUI {{company_nui}}, NRB {{company_nrb}}, i përfaqësuar nga {{authorized_person_name}} ({{authorized_person_position}}); dhe",
    ),
  );
  s.push(
    para(
      run(
        "2. Praktikanti/ja: {{employee_name}}, numri personal {{employee_personal_number}}, me vendbanim {{employee_address}}.",
      ),
      { after: 240 },
    ),
  );

  s.push(h("Neni 1 — Objekti i kontratës"));
  s.push(
    p(
      "Praktikanti/ja pranohet për kryerjen e punës praktike në pozitën {{employee_position}}, me detyrat: {{employee_job_description}}. Në pajtim me nenin 16.2 të Ligjit të Punës, praktikanti/ja i realizon të gjitha të drejtat dhe detyrimet nga marrëdhënia e punës sikurse të punësuarit e tjerë, në proporcion me orët e punës (neni 21.3).",
    ),
  );

  s.push(h("Neni 2 — Kohëzgjatja e punës praktike"));
  s.push(
    p(
      "Puna praktike fillon më {{contract_start_date}} dhe përfundon më {{contract_end_date}}. Në pajtim me nenin 16.4 të Ligjit të Punës, puna praktike nuk mund të zgjasë më shumë se një (1) vit për praktikantin me përgatitje pasuniversitare, universitare dhe të lartë, përkatësisht gjashtë (6) muaj për praktikantin me shkollim të mesëm.",
    ),
  );

  s.push(h("Neni 3 — Orari i punës"));
  s.push(
    p(
      "Praktikanti/ja punon me orar jo të plotë pune (neni 21): {{daily_hours}} orë në ditë, gjithsej {{weekly_hours}} orë në javë, nga e hëna në të premte. Orari i saktë ditor përcaktohet nga punëdhënësi në pajtim me natyrën e punës.",
    ),
  );

  s.push(h("Neni 4 — Paga"));
  s.push(
    p(
      "Për punën e kryer, praktikantit/es i takon paga bazë bruto mujore prej {{salary_gross}}, e cila i paguhet në llogarinë bankare pas ndalesave të përcaktuara me ligj. Të drejtat pasurore janë proporcionale me orët e punës (neni 21.3).",
    ),
  );

  s.push(h("Neni 5 — Pushimet"));
  s.push(
    p(
      "Praktikanti/ja gëzon të drejtën e pushimit ditor, javor dhe vjetor sipas Ligjit të Punës, në proporcion me orët e punës së kryer (neni 21.3).",
    ),
  );

  s.push(h("Neni 6 — Siguria dhe mbrojtja në punë"));
  s.push(
    p(
      "Në pajtim me nenin 16.3 të Ligjit të Punës, punëdhënësi ofron mbrojtje dhe siguri në punë sipas Ligjit Nr. 2003/19 për siguri në punë, mbrojtje të shëndetit të të punësuarve dhe mbrojtjen e ambientit të punës.",
    ),
  );

  s.push(h("Neni 7 — Aftësimi profesional"));
  s.push(
    p(
      "Punëdhënësi cakton personin përgjegjës për mbikëqyrjen dhe aftësimin profesional të praktikantit/es gjatë punës praktike (neni 16.6).",
    ),
  );

  s.push(h("Neni 8 — Përfundimi i kontratës"));
  s.push(
    p(
      "Kontrata përfundon me skadimin e afatit nga Neni 2, ose para afatit në rastet dhe sipas procedurave të përcaktuara me Ligjin e Punës.",
    ),
  );

  s.push(h("Neni 9 — Dispozitat përfundimtare"));
  s.push(
    para(
      run(
        "Për çështjet e parregulluara me këtë kontratë zbatohen dispozitat e Ligjit Nr. 03/L-212 të Punës. Kontrata përpilohet në dy (2) kopje të barasvlershme, nga një për secilën palë.",
      ),
      { after: 300 },
    ),
  );

  s.push(para(run("{{document_place}}, më {{document_date}}"), { after: 400 }));
  s.push(signatureTable());
  s.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`);
  return s.join("") + SECTPR;
}

function main() {
  const zip = new PizZip(fs.readFileSync(SKELETON));
  const docXml = zip.file("word/document.xml").asText();
  const bodyOpen = docXml.indexOf("<w:body>");
  const bodyClose = docXml.indexOf("</w:body>");
  if (bodyOpen === -1 || bodyClose === -1) throw new Error("skeleton has no <w:body>");
  zip.file(
    "word/document.xml",
    docXml.slice(0, bodyOpen + "<w:body>".length) + buildBody() + docXml.slice(bodyClose),
  );
  ["word/comments.xml", "word/_rels/comments.xml.rels"].forEach((k) => {
    if (zip.file(k)) zip.remove(k);
  });
  fs.writeFileSync(OUT, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Wrote ${path.relative(REPO, OUT)} (${fs.statSync(OUT).size} bytes)`);
}

main();
