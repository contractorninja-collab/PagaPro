"""Build the Manrope faces the payroll PDFs embed.

Two things have to be fixed before Manrope can be used in a pdf-lib document,
and neither can be done at render time:

1. **Weight.** Manrope ships as a variable font whose default instance is
   ExtraLight (wght 200). pdf-lib embeds the default instance, so a payslip
   drawn with the raw variable file comes out hairline-thin. We pin static
   instances at 400 (Regular) and 600 (SemiBold).

2. **Tabular figures.** Manrope's digits are proportional by default — "1" is
   roughly 58% the width of "6" — so two amounts with the same number of
   decimals render different widths and the decimal commas wander down a money
   column. Manrope *does* carry tabular alternates under the `tnum` OpenType
   feature, but pdf-lib draws glyphs straight through the cmap and has no way to
   apply features, so `tnum` would never reach the page. We resolve the feature
   ahead of time: read the tnum substitutions out of GSUB and point the digit
   codepoints at the tabular glyphs, making them what you get by default.

Text keeps the proportional digits (they read better in a sentence); only the
-Tabular pair is used for figures.

    python scripts/build-manrope-pdf-fonts.py path/to/Manrope[wght].ttf

Writes four files into templates/fonts/. Source:
https://github.com/google/fonts/tree/main/ofl/manrope (SIL OFL 1.1).
"""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT_DIR = Path(__file__).resolve().parent.parent / "templates" / "fonts"
WEIGHTS = {"Regular": 400, "SemiBold": 600}
DIGITS = range(0x30, 0x3A)


def tabular_substitutions(font: TTFont) -> dict[str, str]:
    """Glyph -> tabular alternate, as declared by the `tnum` feature."""
    gsub = font["GSUB"].table
    lookup_indices: set[int] = set()
    for record in gsub.FeatureList.FeatureRecord:
        if record.FeatureTag == "tnum":
            lookup_indices.update(record.Feature.LookupListIndex)

    mapping: dict[str, str] = {}
    for index in lookup_indices:
        for subtable in gsub.LookupList.Lookup[index].SubTable:
            if hasattr(subtable, "mapping"):
                mapping.update(subtable.mapping)
    return mapping


def build(source: Path) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, weight in WEIGHTS.items():
        font = TTFont(source)
        instancer.instantiateVariableFont(
            font, {"wght": weight}, inplace=True, updateFontNames=True
        )
        plain = OUT_DIR / f"Manrope-{name}.ttf"
        font.save(plain)

        substitutions = tabular_substitutions(font)
        if not substitutions:
            raise SystemExit(f"{source.name}: no tnum feature found — cannot build tabular figures")

        remapped = 0
        for table in (t for t in font["cmap"].tables if t.isUnicode()):
            for codepoint in DIGITS:
                glyph = table.cmap.get(codepoint)
                if glyph in substitutions:
                    table.cmap[codepoint] = substitutions[glyph]
                    remapped += 1

        tabular = OUT_DIR / f"Manrope-{name}-Tabular.ttf"
        font.save(tabular)

        widths = {
            font["hmtx"][next(t for t in font["cmap"].tables if t.isUnicode()).cmap[c]][0]
            for c in DIGITS
        }
        if len(widths) != 1:
            raise SystemExit(f"{tabular.name}: digits still proportional ({sorted(widths)})")

        print(f"{plain.name} + {tabular.name} — {remapped} digit mappings, all digits {widths.pop()} units")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Manrope[wght].ttf variable font")
    build(parser.parse_args().source)
