from html import escape
from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "AUDIT_AND_BENCHMARK.md"
OUTPUT = ROOT / "output" / "pdf" / "whoisit-Audit-Benchmark.pdf"

BLUE = colors.HexColor("#1768E5")
INK = colors.HexColor("#151922")
MUTED = colors.HexColor("#5F6878")
LINE = colors.HexColor("#DCE2EA")
PALE_BLUE = colors.HexColor("#EAF2FF")
PALE = colors.HexColor("#F6F8FB")


def clean_text(value: str) -> str:
    return (
        value.replace("\u2011", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2212", "-")
        .replace("→", "to")
    )


def inline(value: str) -> str:
    value = escape(clean_text(value.strip()))
    value = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    return value


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="ReportTitle", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=23, leading=27, textColor=INK, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="ReportSubtitle", parent=styles["Heading2"], fontName="Helvetica",
    fontSize=12, leading=15, textColor=BLUE, spaceAfter=15,
))
styles.add(ParagraphStyle(
    name="Section", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=14, leading=17, textColor=INK, spaceBefore=13, spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="Subsection", parent=styles["Heading3"], fontName="Helvetica-Bold",
    fontSize=10.5, leading=13, textColor=INK, spaceBefore=9, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="BodySmall", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.4, leading=11.4, textColor=INK, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="BulletSmall", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.2, leading=11, leftIndent=13, firstLineIndent=-8,
    bulletIndent=2, textColor=INK, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="TableHead", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=6.8, leading=8.3, textColor=colors.white,
))
styles.add(ParagraphStyle(
    name="TableCell", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=6.6, leading=8.3, textColor=INK,
))
styles.add(ParagraphStyle(
    name="ReportCode", parent=styles["BodyText"], fontName="Courier",
    fontSize=7.2, leading=9.2, leftIndent=8, rightIndent=8,
    borderColor=LINE, borderWidth=.5, borderPadding=7,
    backColor=PALE, textColor=INK, spaceAfter=7,
))


def column_widths(count: int):
    usable = landscape(A4)[0] - 28 * mm
    presets = {
        2: [0.34, 0.66],
        4: [0.10, 0.25, 0.29, 0.36],
        5: [0.15, 0.18, 0.25, 0.22, 0.20],
        7: [0.20, 0.07, 0.12, 0.12, 0.16, 0.14, 0.19],
    }
    weights = presets.get(count, [1 / count] * count)
    return [usable * weight for weight in weights]


def table_flow(rows):
    count = len(rows[0])
    cells = []
    for row_index, row in enumerate(rows):
        style = styles["TableHead"] if row_index == 0 else styles["TableCell"]
        cells.append([Paragraph(inline(cell), style) for cell in row])
    table = Table(cells, colWidths=column_widths(count), repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), .35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def parse_markdown(text: str):
    lines = clean_text(text).splitlines()
    story = []
    paragraph = []
    code = []
    in_code = False
    index = 0

    def flush_paragraph():
        if paragraph:
            story.append(Paragraph(inline(" ".join(paragraph)), styles["BodySmall"]))
            paragraph.clear()

    while index < len(lines):
        line = lines[index].rstrip()
        stripped = line.strip()
        if stripped.startswith("```"):
            flush_paragraph()
            if in_code:
                story.append(Paragraph("<br/>".join(escape(item) for item in code), styles["ReportCode"]))
                code.clear()
            in_code = not in_code
            index += 1
            continue
        if in_code:
            code.append(line)
            index += 1
            continue
        if stripped.startswith("|") and index + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-+", lines[index + 1]):
            flush_paragraph()
            raw_rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                raw_rows.append([part.strip() for part in lines[index].strip().strip("|").split("|")])
                index += 1
            rows = [raw_rows[0], *raw_rows[2:]]
            story.extend([table_flow(rows), Spacer(1, 7)])
            continue
        if not stripped:
            flush_paragraph()
            index += 1
            continue
        if stripped.startswith("# "):
            flush_paragraph()
            story.append(Paragraph(inline(stripped[2:]), styles["ReportTitle"]))
        elif stripped.startswith("## "):
            flush_paragraph()
            title = stripped[3:]
            style = styles["ReportSubtitle"] if not re.match(r"\d+\.", title) else styles["Section"]
            story.append(Paragraph(inline(title), style))
        elif stripped.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(inline(stripped[4:]), styles["Subsection"]))
        elif re.match(r"^[-*] ", stripped):
            flush_paragraph()
            story.append(Paragraph(inline(stripped[2:]), styles["BulletSmall"], bulletText="-"))
        elif re.match(r"^\d+\. ", stripped):
            flush_paragraph()
            number, body = stripped.split(". ", 1)
            story.append(Paragraph(inline(body), styles["BulletSmall"], bulletText=f"{number}."))
        else:
            paragraph.append(stripped)
        index += 1
    flush_paragraph()
    return story


class NumberedDocTemplate(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(filename, pagesize=landscape(A4),
                         leftMargin=14 * mm, rightMargin=14 * mm,
                         topMargin=17 * mm, bottomMargin=15 * mm,
                         title="whoisit Instagram Relationship Checker - Audit and Benchmark",
                         author="itzstebin")
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="content")
        self.addPageTemplates(PageTemplate(id="report", frames=frame, onPage=self.decorate))

    def decorate(self, canvas, doc):
        canvas.saveState()
        width, height = landscape(A4)
        canvas.setStrokeColor(LINE)
        canvas.line(14 * mm, height - 11 * mm, width - 14 * mm, height - 11 * mm)
        canvas.setFont("Helvetica-Bold", 7.5)
        canvas.setFillColor(INK)
        canvas.drawString(14 * mm, height - 8 * mm, "WHOISIT")
        canvas.setFillColor(BLUE)
        canvas.drawString(42 * mm, height - 8 * mm, "AUDIT + BENCHMARK 2.2.0")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(width - 14 * mm, 8 * mm, f"Page {doc.page}")
        canvas.drawString(14 * mm, 8 * mm, "30 September 2026 - Local audit build")
        canvas.restoreState()


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
document = NumberedDocTemplate(str(OUTPUT))
document.build(parse_markdown(SOURCE.read_text(encoding="utf-8")))
print(OUTPUT)
