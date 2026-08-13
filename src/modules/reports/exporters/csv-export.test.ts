import { describe, expect, it } from "vitest";
import { rowsToCsvBuffer } from "@/modules/reports/exporters/csv-export";

/**
 * Three download routes serve these bytes verbatim (leaves, contractor payroll,
 * financial export). The details pinned here are the ones Excel actually
 * punishes: the BOM, CRLF line ends, and quote escaping.
 */
describe("rowsToCsvBuffer", () => {
  const columns = [
    { key: "name", headerSq: "Punonjësi" },
    { key: "days", headerSq: "Ditë pune" },
  ];

  it("starts with exactly one UTF-8 BOM", () => {
    const buf = rowsToCsvBuffer(columns, [{ name: "Çelaj, Ylber", days: 5 }]);
    expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    // One BOM, not two — the leaves route used to prepend its own.
    expect([...buf.subarray(3, 6)]).not.toEqual([0xef, 0xbb, 0xbf]);
  });

  it("keeps Albanian diacritics intact after the BOM", () => {
    const buf = rowsToCsvBuffer(columns, [{ name: "Çelaj, Ylber", days: 5 }]);
    expect(buf.toString("utf8")).toBe(
      '\uFEFFPunonjësi,Ditë pune\r\n"Çelaj, Ylber",5',
    );
  });

  it("escapes quotes, commas and newlines", () => {
    const buf = rowsToCsvBuffer(columns, [{ name: 'thotë "jo", pastaj\nvazhdon', days: 1 }]);
    expect(buf.toString("utf8").split("\r\n")[1]).toBe('"thotë ""jo"", pastaj\nvazhdon",1');
  });

  it("writes empty cells for null and missing keys", () => {
    const buf = rowsToCsvBuffer(columns, [{ name: null, days: 0 }, {}]);
    const lines = buf.toString("utf8").split("\r\n");
    expect(lines[1]).toBe(",0");
    expect(lines[2]).toBe(",");
  });
});
