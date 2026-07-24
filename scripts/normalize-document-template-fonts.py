"""Apply PagaPRO's contract font hierarchy to bundled DOCX templates."""

from __future__ import annotations

import argparse
import os
import re
import tempfile
import zipfile
from pathlib import Path

from lxml import etree

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{W_NS}}}"
NS = {"w": W_NS}

BODY_FONT = "Liberation Serif"
HEADING_FONT = "Liberation Sans"
HEADING_STYLE_IDS = {
    "Title",
    "Subtitle",
    "ArticleTitle",
    *(f"Heading{i}" for i in range(1, 10)),
}
ROMAN_HEADING_RE = re.compile(r"^[IVXLCDM]+\.$")
COMPACT_SIGNATURE_TEMPLATES = {
    "vertetim-pushim-mjekesor.docx",
    "vertetim-pushim-vjetor.docx",
}


def ensure_child(parent: etree._Element, tag: str, *, first: bool = False) -> etree._Element:
    child = parent.find(tag, NS)
    if child is not None:
        return child
    child = etree.Element(f"{W}{tag.removeprefix('w:')}")
    if first:
        parent.insert(0, child)
    else:
        parent.append(child)
    return child


def set_run_font(run_properties: etree._Element, font_name: str) -> None:
    fonts = ensure_child(run_properties, "w:rFonts", first=True)
    for attr in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"):
        fonts.attrib.pop(f"{W}{attr}", None)
    for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
        fonts.set(f"{W}{attr}", font_name)


def paragraph_is_heading(paragraph: etree._Element) -> bool:
    style = paragraph.find("w:pPr/w:pStyle", NS)
    if style is not None and style.get(f"{W}val") in HEADING_STYLE_IDS:
        return True

    text = "".join(paragraph.xpath(".//w:t/text()", namespaces=NS)).strip()
    if text.startswith("Neni ") or ROMAN_HEADING_RE.fullmatch(text):
        return True

    sizes = []
    for size in paragraph.findall(".//w:rPr/w:sz", NS):
        value = size.get(f"{W}val")
        if value and value.isdigit():
            sizes.append(int(value))
    return bool(sizes and max(sizes) >= 24)


def paragraph_text(paragraph: etree._Element) -> str:
    return "".join(paragraph.xpath(".//w:t/text()", namespaces=NS)).strip()


def set_spacing_after(paragraph: etree._Element, value: int) -> None:
    properties = ensure_child(paragraph, "w:pPr", first=True)
    spacing = ensure_child(properties, "w:spacing")
    spacing.set(f"{W}after", str(value))


def set_paragraph_font_size(paragraph: etree._Element, half_points: int) -> None:
    for run in paragraph.findall(".//w:r", NS):
        properties = ensure_child(run, "w:rPr", first=True)
        for tag in ("w:sz", "w:szCs"):
            size = ensure_child(properties, tag)
            size.set(f"{W}val", str(half_points))


def compact_leave_signature_block(
    root: etree._Element,
    *,
    compact_legal_text: bool = False,
) -> None:
    paragraphs = root.findall(".//w:body/w:p", NS)
    legal_heading_index = next(
        (
            index
            for index, paragraph in enumerate(paragraphs)
            if paragraph_text(paragraph) == "Shënime ligjore"
        ),
        None,
    )
    if legal_heading_index is None:
        return

    if legal_heading_index > 0 and not paragraph_text(paragraphs[legal_heading_index - 1]):
        set_spacing_after(paragraphs[legal_heading_index - 1], 80)
    set_spacing_after(paragraphs[legal_heading_index], 40)

    for paragraph in paragraphs[legal_heading_index + 1 :]:
        text = paragraph_text(paragraph)
        if text == "Punëdhënësi / Personi i autorizuar":
            break
        spacing = paragraph.find("w:pPr/w:spacing", NS)
        current = int(spacing.get(f"{W}after", "0")) if spacing is not None else 0
        set_spacing_after(paragraph, 120 if current >= 300 else min(current, 60))
        if compact_legal_text:
            set_paragraph_font_size(paragraph, 20)

    for paragraph in paragraphs:
        if paragraph_text(paragraph) == "{{authorized_person_position}}":
            set_spacing_after(paragraph, 120)


def normalize_content_part(
    xml_bytes: bytes,
    *,
    compact_signatures: bool = False,
    compact_legal_text: bool = False,
) -> bytes:
    root = etree.fromstring(xml_bytes)
    for paragraph in root.findall(".//w:p", NS):
        font_name = HEADING_FONT if paragraph_is_heading(paragraph) else BODY_FONT
        for run in paragraph.findall(".//w:r", NS):
            properties = ensure_child(run, "w:rPr", first=True)
            set_run_font(properties, font_name)
    if compact_signatures:
        compact_leave_signature_block(
            root,
            compact_legal_text=compact_legal_text,
        )
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def normalize_styles(xml_bytes: bytes) -> bytes:
    root = etree.fromstring(xml_bytes)

    default_properties = root.find("w:docDefaults/w:rPrDefault/w:rPr", NS)
    if default_properties is not None:
        set_run_font(default_properties, BODY_FONT)

    for style in root.findall("w:style", NS):
        style_id = style.get(f"{W}styleId")
        style_type = style.get(f"{W}type")
        if style_type not in {"paragraph", "character"}:
            continue
        properties = ensure_child(style, "w:rPr")
        font_name = HEADING_FONT if style_id in HEADING_STYLE_IDS else BODY_FONT
        set_run_font(properties, font_name)

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def should_normalize_content_part(name: str) -> bool:
    return bool(
        name == "word/document.xml"
        or re.fullmatch(r"word/header\d*\.xml", name)
        or re.fullmatch(r"word/footer\d*\.xml", name)
    )


def normalize_docx(path: Path) -> None:
    with zipfile.ZipFile(path, "r") as source:
        entries = [(info, source.read(info.filename)) for info in source.infolist()]

    fd, temp_name = tempfile.mkstemp(suffix=".docx", dir=path.parent)
    os.close(fd)
    temp_path = Path(temp_name)
    try:
        with zipfile.ZipFile(temp_path, "w") as target:
            for info, data in entries:
                if info.filename == "word/styles.xml":
                    data = normalize_styles(data)
                elif should_normalize_content_part(info.filename):
                    data = normalize_content_part(
                        data,
                        compact_signatures=(
                            info.filename == "word/document.xml"
                            and path.name in COMPACT_SIGNATURE_TEMPLATES
                        ),
                        compact_legal_text=(
                            info.filename == "word/document.xml"
                            and path.name == "vertetim-pushim-vjetor.docx"
                        ),
                    )
                target.writestr(info, data)
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()

    files: list[Path] = []
    for path in args.paths:
        files.extend(sorted(path.glob("*.docx")) if path.is_dir() else [path])

    for path in files:
        normalize_docx(path)
        print(f"Normalized fonts: {path}")


if __name__ == "__main__":
    main()
