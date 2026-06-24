import type { Row } from "exceljs";

/**
 * Copy row height and cell styles from a template row (preserves ATK formatting).
 * Values are not copied — caller writes values separately.
 */
export function copyRowDimensionsAndStyle(source: Row, target: Row): void {
  target.height = source.height;
  source.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const dest = target.getCell(colNumber);
    const style = cell.style;
    if (style && Object.keys(style).length > 0) {
      dest.style = JSON.parse(JSON.stringify(style)) as typeof dest.style;
    }
    dest.numFmt = cell.numFmt;
  });
}
