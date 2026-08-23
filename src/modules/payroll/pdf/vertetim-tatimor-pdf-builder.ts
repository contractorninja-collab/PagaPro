import { PDFDocument } from "pdf-lib";
import type { EmployeeAnnualStatement } from "@/modules/payroll/services/employee-annual-statement-service";
import { embedPayrollPdfFonts, drawPagaproGeneratedFooter } from "./payroll-pdf-fonts";
import { PP, PAGE, RULE, drawRoundedRect } from "./payroll-pdf-tokens";

/**
 * "Vërtetim për tatimin dhe kontributet e mbajtura në burim" — the annual
 * per-employee certificate: what the employer withheld, month by month, over
 * one year. Figures come exclusively from finalized payroll periods; the
 * service refuses to build a statement out of drafts.
 */

const MONTHS_SQ = [
  "Janar",
  "Shkurt",
  "Mars",
  "Prill",
  "Maj",
  "Qershor",
  "Korrik",
  "Gusht",
  "Shtator",
  "Tetor",
  "Nëntor",
  "Dhjetor",
] as const;

const MARGIN = 48;

export async function buildVertetimTatimorPdf(
  statement: EmployeeAnnualStatement,
  generatedAtLabel: string,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const fonts = await embedPayrollPdfFonts(pdf);
  const page = pdf.addPage([PAGE.a4Portrait.width, PAGE.a4Portrait.height]);
  const width = PAGE.a4Portrait.width;
  let y = PAGE.a4Portrait.height - MARGIN;

  const companyName = statement.company.tradeName?.trim() || statement.company.legalName;

  // Header band
  drawRoundedRect(page, {
    x: MARGIN,
    y: y - 58,
    w: width - MARGIN * 2,
    h: 58,
    r: 8,
    color: PP.navy,
  });
  page.drawText(companyName, {
    x: MARGIN + 16,
    y: y - 24,
    size: 13,
    font: fonts.sansBold,
    color: PP.white,
  });
  const subline = [
    statement.company.fiscalNumber ? `NUI ${statement.company.fiscalNumber}` : null,
    [statement.company.addressLine, statement.company.city].filter(Boolean).join(", ") || null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (subline) {
    page.drawText(subline, {
      x: MARGIN + 16,
      y: y - 42,
      size: 8.5,
      font: fonts.sans,
      color: PP.onNavy,
    });
  }
  y -= 90;

  // Title
  page.drawText("VËRTETIM", {
    x: MARGIN,
    y,
    size: 20,
    font: fonts.sansBold,
    color: PP.navy,
  });
  y -= 18;
  page.drawText(
    `për tatimin dhe kontributet e mbajtura në burim — viti ${statement.year}`,
    { x: MARGIN, y, size: 11, font: fonts.sans, color: PP.slate800 },
  );
  y -= 34;

  // Employee identity
  const who = `${statement.employee.firstName} ${statement.employee.lastName}`;
  const idLines: Array<[string, string]> = [
    ["Punonjësi", who],
    ["Numri personal", statement.employee.personalId],
    ...(statement.employee.jobTitle ? ([["Pozita", statement.employee.jobTitle]] as Array<[string, string]>) : []),
  ];
  for (const [label, value] of idLines) {
    page.drawText(label.toUpperCase(), {
      x: MARGIN,
      y,
      size: 7.5,
      font: fonts.sansBold,
      color: PP.muted,
    });
    page.drawText(value, {
      x: MARGIN + 110,
      y,
      size: 10,
      font: fonts.sansBold,
      color: PP.text,
    });
    y -= 16;
  }
  y -= 14;

  // Table
  const cols = [
    { label: "Muaji", w: 92, align: "left" as const },
    { label: "Bruto", w: 78, align: "right" as const },
    { label: "E tatueshme", w: 82, align: "right" as const },
    { label: "Tatimi", w: 70, align: "right" as const },
    { label: "Trusti (punonjësi)", w: 96, align: "right" as const },
    { label: "Neto", w: 80, align: "right" as const },
  ];
  const tableX = MARGIN;
  const rowH = 18;

  function drawRow(
    values: string[],
    opts: { bold?: boolean; fill?: boolean; header?: boolean } = {},
  ) {
    if (opts.header || opts.fill) {
      drawRoundedRect(page, {
        x: tableX,
        y: y - 5,
        w: cols.reduce((s, c) => s + c.w, 0),
        h: rowH,
        r: opts.header ? 4 : 0,
        color: opts.header ? PP.navy : PP.wash,
      });
    }
    let x = tableX;
    values.forEach((value, i) => {
      const col = cols[i]!;
      const font = opts.header || opts.bold ? fonts.sansBold : i === 0 ? fonts.sans : fonts.mono;
      const size = opts.header ? 8 : 8.5;
      const textWidth = font.widthOfTextAtSize(value, size);
      page.drawText(value, {
        x: col.align === "right" ? x + col.w - 10 - textWidth : x + 8,
        y,
        size,
        font,
        color: opts.header ? PP.white : opts.bold ? PP.navy : PP.text,
      });
      x += col.w;
    });
    y -= rowH;
  }

  drawRow(cols.map((c) => c.label), { header: true });

  statement.months.forEach((m, idx) => {
    drawRow(
      [
        MONTHS_SQ[m.month - 1] ?? String(m.month),
        m.gross,
        m.taxableIncome,
        m.pit,
        m.pensionEmployee,
        m.net,
      ],
      { fill: idx % 2 === 1 },
    );
  });

  // Totals rule + row
  page.drawLine({
    start: { x: tableX, y: y + rowH - 7 },
    end: { x: tableX + cols.reduce((s, c) => s + c.w, 0), y: y + rowH - 7 },
    thickness: RULE.thin,
    color: PP.navy,
  });
  drawRow(
    [
      "TOTALI",
      statement.totals.gross,
      statement.totals.taxableIncome,
      statement.totals.pit,
      statement.totals.pensionEmployee,
      statement.totals.net,
    ],
    { bold: true },
  );
  y -= 22;

  // Statement text
  const para =
    `Vërtetohet se për punonjësin ${who} (nr. personal ${statement.employee.personalId}), ` +
    `gjatë vitit ${statement.year}, ${companyName} ka mbajtur në burim tatimin në paga dhe ` +
    `kontributet pensionale sipas shifrave të mësipërme, të nxjerra nga periudhat e finalizuara ` +
    `të pagave. Kontributi pensional i punëdhënësit për të njëjtën periudhë: ${statement.totals.pensionEmployer} EUR.`;
  const words = para.split(" ");
  let line = "";
  const maxWidth = width - MARGIN * 2;
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (fonts.sans.widthOfTextAtSize(probe, 9) > maxWidth) {
      page.drawText(line, { x: MARGIN, y, size: 9, font: fonts.sans, color: PP.slate800 });
      y -= 13;
      line = word;
    } else {
      line = probe;
    }
  }
  if (line) {
    page.drawText(line, { x: MARGIN, y, size: 9, font: fonts.sans, color: PP.slate800 });
    y -= 13;
  }
  y -= 18;

  page.drawText(`Gjeneruar më ${generatedAtLabel}. Vlen pa nënshkrim.`, {
    x: MARGIN,
    y,
    size: 7.5,
    font: fonts.sans,
    color: PP.muted,
  });

  drawPagaproGeneratedFooter(page, fonts.sans, { pageWidth: width, margin: MARGIN });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
