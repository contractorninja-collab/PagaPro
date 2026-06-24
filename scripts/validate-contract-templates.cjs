/**
 * Validates contract DOCX files: underline blank count must match manifest field order length.
 * Usage: node scripts/validate-contract-templates.cjs
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const PizZip = require("pizzip");
const { loadContractManifest, contractsDir } = require("./contract-manifest.cjs");

const XML_PART = /^word\/(document\d*|header\d*|footer\d*)\.xml$/i;
const UNDERLINE_RE = /_{4,}/g;
const STUB_MARKER_RE = /Kontrate me Afat.*— fusha \d+:/;

function countUnderlineBlanks(docxBuffer) {
  const zip = new PizZip(docxBuffer);
  let count = 0;
  const names = Object.keys(zip.files).sort();
  for (const name of names) {
    if (!XML_PART.test(name)) continue;
    const file = zip.files[name];
    if (!file || file.dir) continue;
    const text = file.asText();
    const matches = text.match(UNDERLINE_RE);
    if (matches) count += matches.length;
  }
  return count;
}

function docxContainsStubMarker(docxBuffer) {
  const zip = new PizZip(docxBuffer);
  for (const name of Object.keys(zip.files).sort()) {
    if (!XML_PART.test(name)) continue;
    const file = zip.files[name];
    if (!file || file.dir) continue;
    if (STUB_MARKER_RE.test(file.asText())) return true;
  }
  return false;
}

function main() {
  const dir = contractsDir();
  const templates = loadContractManifest();
  let ok = true;

  for (const tpl of templates) {
    if (!tpl.filename || !Array.isArray(tpl.fields)) {
      console.error(`Invalid manifest entry: ${JSON.stringify(tpl)}`);
      ok = false;
      continue;
    }

    const full = path.join(dir, tpl.filename);
    if (!fs.existsSync(full)) {
      console.error(`Missing real DOCX file: ${tpl.filename}`);
      ok = false;
      continue;
    }

    const buf = fs.readFileSync(full);
    if (docxContainsStubMarker(buf)) {
      console.error(`${tpl.filename}: this is a generated stub, not a real contract DOCX. Replace it with the real Word file.`);
      ok = false;
      continue;
    }

    const blankCount = countUnderlineBlanks(buf);
    const fieldCount = tpl.fields.length;

    if (blankCount !== fieldCount) {
      console.error(
        `${tpl.filename}: ${blankCount} underline blank(s) in DOCX, ${fieldCount} field(s) in manifest — adjust Word or manifest.json`,
      );
      ok = false;
    } else {
      console.log(`OK  ${tpl.filename} — ${fieldCount} blanks ↔ ${fieldCount} fields (${tpl.templateSubtype})`);
    }
  }

  if (!ok) process.exit(1);
  console.log("\nAll contract templates validated.");
}

main();
