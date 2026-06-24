/**
 * One-shot: writes public/atk_template/Mostra Pagave ATK.xlsx with headers/data row
 * compatible with atk-workbook-fill.ts. Replace with HR's official file for production.
 *
 * Run: node scripts/write-atk-placeholder-template.cjs
 */
const path = require("node:path");
const fs = require("node:fs");
const ExcelJS = require("exceljs");

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista ATK");

  ws.addRow([
    "Emri",
    "Mbiemri",
    "Numri Individual i punëtorit",
    "Bruto paga për muaj",
    "Kontributi pensional i të punësuarit",
    "Kontributi pensional i punëdhënësit",
    "Kontributi suplementar i të punësuarit",
    "Kontributi suplementar i punëdhënësit",
    "Punë Primare",
    "Përfshihen Kontributet",
    "Aplikohet Tatimi në Paga",
  ]);

  ws.addRow(["", "", "", 0, 0, 0, 0, 0, "Jo", "Jo", "Jo"]);

  const dir = path.join(__dirname, "..", "public", "atk_template");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, "Mostra Pagave ATK.xlsx");
  await wb.xlsx.writeFile(out);
  console.log("Wrote placeholder ATK template:", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
