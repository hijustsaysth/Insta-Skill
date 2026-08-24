from __future__ import annotations

import html
import re
from pathlib import Path


ROOT = Path(r"F:\intern_work1")
SOURCE = ROOT / "my_work" / "Instagram养号skills.md"
OUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
HTML_OUT = TMP_DIR / "Instagram养号skills.html"


def inline_md(text: str) -> str:
    escaped = html.escape(text, quote=False)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        lambda m: f'<a href="{html.escape(m.group(2), quote=True)}">{m.group(1)}</a>',
        escaped,
    )
    return escaped


def markdown_to_html(markdown: str) -> str:
    lines = markdown.splitlines()
    body: list[str] = []
    list_stack: list[int] = []

    def close_lists(target_indent: int = -1) -> None:
        while list_stack and list_stack[-1] > target_indent:
            body.append("</ul>")
            list_stack.pop()

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            close_lists(-1)
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            close_lists(-1)
            level = min(len(heading.group(1)), 4)
            body.append(f"<h{level}>{inline_md(heading.group(2).strip())}</h{level}>")
            continue

        bullet = re.match(r"^(\s*)[*-]\s+(.+)$", line)
        if bullet:
            indent = len(bullet.group(1)) // 2
            while list_stack and list_stack[-1] > indent:
                body.append("</ul>")
                list_stack.pop()
            if not list_stack or list_stack[-1] < indent:
                body.append("<ul>")
                list_stack.append(indent)
            body.append(f"<li>{inline_md(bullet.group(2).strip())}</li>")
            continue

        close_lists(-1)
        body.append(f"<p>{inline_md(line.strip())}</p>")

    close_lists(-1)
    return "\n".join(body)


def build_html() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    content = SOURCE.read_text(encoding="utf-8-sig")
    body = markdown_to_html(content)
    page = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Instagram养号skills</title>
  <style>
    @page {{
      size: A4;
      margin: 20mm 18mm 20mm 18mm;
    }}
    * {{
      box-sizing: border-box;
    }}
    body {{
      margin: 0;
      color: #1f2933;
      font-family: "Microsoft YaHei", "DengXian", "SimHei", sans-serif;
      font-size: 11.2pt;
      line-height: 1.72;
      background: #ffffff;
    }}
    h1, h2, h3, h4 {{
      color: #111827;
      line-height: 1.35;
      page-break-after: avoid;
      font-weight: 700;
    }}
    h1 {{
      font-size: 24pt;
      padding-bottom: 8pt;
      margin: 0 0 18pt;
      border-bottom: 2pt solid #111827;
    }}
    h2 {{
      font-size: 18pt;
      margin: 24pt 0 10pt;
      padding-bottom: 4pt;
      border-bottom: 1pt solid #d8dee9;
    }}
    h3 {{
      font-size: 14.5pt;
      margin: 18pt 0 8pt;
    }}
    h4 {{
      font-size: 12pt;
      margin: 14pt 0 6pt;
    }}
    h5 {{
      font-size: 11.4pt;
      margin: 12pt 0 5pt;
      color: #111827;
    }}
    p {{
      margin: 0 0 8pt;
    }}
    ul {{
      margin: 0 0 8pt 0;
      padding-left: 18pt;
    }}
    li {{
      margin: 2pt 0;
      padding-left: 1pt;
    }}
    li ul {{
      margin-top: 2pt;
      margin-bottom: 2pt;
    }}
    a {{
      color: #0f5ea8;
      text-decoration: none;
      overflow-wrap: anywhere;
    }}
    strong {{
      font-weight: 700;
    }}
  </style>
</head>
<body>
{body}
</body>
</html>
"""
    HTML_OUT.write_text(page, encoding="utf-8")


if __name__ == "__main__":
    build_html()
    print(HTML_OUT)
