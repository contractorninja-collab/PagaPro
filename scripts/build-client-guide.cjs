/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Authors docs/onboarding/Udhezues-PagaPRO-per-Klientin.docx — the client-facing
 * getting-started guide, in Albanian, handed to every new client at onboarding.
 *
 * Same approach as build-annex-template.cjs: reuse a known-good DOCX package
 * (styles/fonts/page setup) and swap in a fresh body. Static text, no placeholders.
 *
 * Regenerate after editing: node scripts/build-client-guide.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const PizZip = require("pizzip");

const REPO = path.join(__dirname, "..");
const SKELETON = path.join(REPO, "templates", "leave", "vertetim-pushim-tjeter.docx");
const OUT = path.join(REPO, "docs", "onboarding", "Udhezues-PagaPRO-per-Klientin.docx");

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
    opts.color ? `<w:color w:val="${opts.color}"/>` : "",
  ].join("");
  return `<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(runsXml, opts = {}) {
  const ppr = [
    `<w:spacing w:after="${opts.after ?? 120}"/>`,
    opts.align ? `<w:jc w:val="${opts.align}"/>` : "",
    opts.indent ? `<w:ind w:left="${opts.indent}"/>` : "",
  ].join("");
  return `<w:p><w:pPr>${ppr}</w:pPr>${runsXml}</w:p>`;
}

const title = (t) => para(run(t, { bold: true, size: 32 }), { align: "center", after: 60 });
const subtitle = (t) => para(run(t, { size: 22, color: "595959" }), { align: "center", after: 360 });
const h1 = (t) => para(run(t, { bold: true, size: 26 }), { after: 120 });
const p = (t) => para(run(t));
const bullet = (t) => para(run("•  " + t), { indent: 340, after: 80 });
const check = (t) => para(run("☐  " + t), { indent: 340, after: 80 });
const note = (t) => para(run(t, { italic: true, color: "8a4b08" }), { after: 200 });
const gap = () => para(run(""), { after: 160 });

const SECTPR =
  `<w:sectPr><w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>` +
  `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>` +
  `<w:docGrid w:linePitch="360"/></w:sectPr>`;

function buildBody() {
  const s = [];

  s.push(title("Mirë se vini në PagaPRO"));
  s.push(subtitle("Udhëzues fillestar për administratorin e kompanisë suaj"));

  s.push(h1("1. Hyrja e parë në sistem"));
  s.push(bullet("Hapni adresën: https://pagapro.vercel.app"));
  s.push(bullet("Shkruani email-in dhe fjalëkalimin e përkohshëm që ju kemi dërguar."));
  s.push(bullet("Sistemi do t'ju kërkojë menjëherë të vendosni një fjalëkalim të ri — zgjidhni një fjalëkalim të fortë që e dini vetëm ju."));
  s.push(note("Fjalëkalimi i përkohshëm vlen vetëm për hyrjen e parë. Mos e ndani me askënd."));

  s.push(h1("2. Konfigurimi fillestar (Konfigurime)"));
  s.push(p("Para se të gjeneroni dokumente ose paga, plotësoni të dhënat e kompanisë te menyja Konfigurime:"));
  s.push(check("Kontrolloni emrin ligjor, NUI-në dhe NRB-në — këto shtypen në çdo kontratë e vendim."));
  s.push(check("Shkruani emrin dhe pozitën e përfaqësuesit të autorizuar (personi që nënshkruan dokumentet)."));
  s.push(check("Ngarkoni nënshkrimin dhe vulën e kompanisë (foto PNG, mundësisht me sfond transparent)."));
  s.push(check("Vendosni adresën e saktë të selisë."));
  s.push(note("Nëse këto fusha mbeten bosh, dokumentet e gjeneruara do të dalin me vende të zbrazëta."));

  s.push(h1("3. Departamentet dhe pozitat"));
  s.push(bullet("Krijoni departamentet e kompanisë (p.sh. Shitje, Administrata, Prodhimi)."));
  s.push(bullet("Krijoni pozitat e punës me përshkrimin e detyrave — përshkrimi futet automatikisht në kontratat e punës, siç e kërkon Ligji i Punës (Neni 11)."));

  s.push(h1("4. Regjistrimi i punonjësve"));
  s.push(bullet("Punonjësit shtohen te menyja Punonjësit — një nga një, ose të gjithë përnjëherë me import CSV."));
  s.push(bullet("Për import CSV, kolonat e detyrueshme janë: Emri, Mbiemri, Nr personal, Data e punësimit. Datat pranohen si 2026-01-31 ose 31.01.2026."));
  s.push(bullet("Pas regjistrimit, hapni profilin e secilit punonjës dhe kontrolloni: pagën bruto, orët javore, IBAN-in e bankës."));
  s.push(bullet("Te skeda Kontratat vendosni afatin e kontratës (në kohë të pacaktuar apo të caktuar me datë skadimi)."));

  s.push(h1("5. Dokumentet e punës"));
  s.push(bullet("Kontratat e punës gjenerohen te Dokumentet → Gjenero dokumente — zgjidhni llojin e kontratës dhe punonjësit."));
  s.push(bullet("Kur ndryshon paga, pozita ose kushtet e punës, gjeneroni Aneks Kontrate te profili i punonjësit → Kontratat → Gjenero Aneks. Sistemi i plotëson vetë ndryshimet."));
  s.push(bullet("Për largimet nga puna përdorni modulin Largimet — aty gjenerohet vendimi përkatës me një klik (Shkarko)."));
  s.push(bullet("Vërtetimet e pushimeve gjenerohen nga moduli Pushimet."));

  s.push(h1("6. Pagat mujore"));
  s.push(bullet("Në fillim të çdo muaji, te Pagat krijoni payroll-in e muajit — sistemi i llogarit vetë kontributet dhe tatimin sipas ligjeve të Kosovës."));
  s.push(bullet("Rrjedha e punës: Draft → Në shqyrtim → Miratim → Kyçje. Kontrolloni shifrat para miratimit."));
  s.push(bullet("Pas miratimit shkarkoni fletëpagesat për punonjësit dhe eksportin ATK për deklarimin mujor."));
  s.push(note("Muajin e parë, krahasoni pagat neto me llogaritjet tuaja të mëparshme para se të paguani."));

  s.push(h1("7. Pushimet"));
  s.push(bullet("Pushimet kërkohen dhe miratohen te moduli Pushimet — bilanci vjetor llogaritet automatikisht sipas ligjit."));

  s.push(h1("8. Ndihma"));
  s.push(bullet("Për çdo pyetje ose problem, kontaktoni: ______________________________"));
  s.push(bullet("Orari i mbështetjes: ______________________________"));
  s.push(gap());
  s.push(p("Ju urojmë punë të mbarë me PagaPRO!"));

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

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Wrote ${path.relative(REPO, OUT)} (${fs.statSync(OUT).size} bytes)`);
}

main();
