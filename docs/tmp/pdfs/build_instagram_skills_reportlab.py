from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(r"F:\intern_work1")
SOURCE = ROOT / "my_work" / "Instagram养号skills.md"
OUTPUT = ROOT / "output" / "pdf" / "instagram_skills.pdf"
FONT_PATH = Path(r"C:\Windows\Fonts\Deng.ttf")
BOLD_FONT_PATH = Path(r"C:\Windows\Fonts\Dengb.ttf")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("CN", str(FONT_PATH)))
    pdfmetrics.registerFont(TTFont("CN-Bold", str(BOLD_FONT_PATH)))
    pdfmetrics.registerFontFamily("CN", normal="CN", bold="CN-Bold")


def inline_md(text: str) -> str:
    escaped = html.escape(text, quote=False)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        lambda m: f'<font color="#0f5ea8"><u>{m.group(1)}</u></font>',
        escaped,
    )
    return escaped


def build_styles() -> dict[str, ParagraphStyle]:
    styles = getSampleStyleSheet()
    base = ParagraphStyle(
        "BaseCN",
        parent=styles["Normal"],
        fontName="CN",
        fontSize=10.5,
        leading=17,
        textColor=colors.HexColor("#1f2933"),
        alignment=TA_LEFT,
        wordWrap="CJK",
        spaceAfter=5,
    )
    return {
        "p": base,
        "h1": ParagraphStyle(
            "H1CN",
            parent=base,
            fontName="CN-Bold",
            fontSize=22,
            leading=28,
            textColor=colors.HexColor("#111827"),
            spaceBefore=0,
            spaceAfter=15,
            borderPadding=(0, 0, 8, 0),
            borderWidth=0,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "H2CN",
            parent=base,
            fontName="CN-Bold",
            fontSize=16,
            leading=22,
            textColor=colors.HexColor("#111827"),
            spaceBefore=14,
            spaceAfter=8,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "H3CN",
            parent=base,
            fontName="CN-Bold",
            fontSize=13,
            leading=18,
            textColor=colors.HexColor("#111827"),
            spaceBefore=10,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "h4": ParagraphStyle(
            "H4CN",
            parent=base,
            fontName="CN-Bold",
            fontSize=11,
            leading=16,
            textColor=colors.HexColor("#111827"),
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "h5": ParagraphStyle(
            "H5CN",
            parent=base,
            fontName="CN-Bold",
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor("#111827"),
            spaceBefore=7,
            spaceAfter=3,
            keepWithNext=True,
        ),
        "bullet0": ParagraphStyle(
            "Bullet0CN",
            parent=base,
            leftIndent=14,
            firstLineIndent=-8,
            bulletIndent=0,
            spaceAfter=3,
        ),
        "bullet1": ParagraphStyle(
            "Bullet1CN",
            parent=base,
            leftIndent=28,
            firstLineIndent=-8,
            bulletIndent=14,
            spaceAfter=2,
        ),
    }


def markdown_flowables(markdown: str) -> list:
    styles = build_styles()
    story: list = []

    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line.strip():
            story.append(Spacer(1, 3))
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            level = min(len(heading.group(1)), 5)
            story.append(Paragraph(inline_md(heading.group(2).strip()), styles[f"h{level}"]))
            continue

        bullet = re.match(r"^(\s*)[*-]\s+(.+)$", line)
        if bullet:
            indent = min(len(bullet.group(1)) // 2, 1)
            story.append(
                Paragraph(
                    inline_md(bullet.group(2).strip()),
                    styles[f"bullet{indent}"],
                    bulletText="•" if indent == 0 else "◦",
                )
            )
            continue

        story.append(Paragraph(inline_md(line.strip()), styles["p"]))

    return story


def main() -> None:
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    markdown = SOURCE.read_text(encoding="utf-8-sig")
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Instagram养号skills",
        author="",
    )
    doc.build(markdown_flowables(markdown))
    print(OUTPUT)


if __name__ == "__main__":
    main()

