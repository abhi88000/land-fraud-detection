"""Tiny Markdown -> HTML converter for the Landshield solution doc.
Handles: # headings, paragraphs, **bold**, *italic*, `code`, inline code,
fenced code blocks, GFM tables, unordered/ordered lists, blockquotes.
Output is styled for clean import into Microsoft Word.
"""
import re
import sys
import html
from pathlib import Path

SRC = Path(sys.argv[1])
DST = Path(sys.argv[2])

text = SRC.read_text(encoding="utf-8")
lines = text.splitlines()

out = []
i = 0
in_code = False
code_buf = []


def inline(s: str) -> str:
    # Escape HTML first, then re-introduce markdown spans.
    s = html.escape(s)
    # images ![alt](src)  -- must run BEFORE link substitution
    s = re.sub(
        r"!\[([^\]]*)\]\(([^)]+)\)",
        r'<img src="\2" alt="\1" style="max-width:100%;height:auto;"/>',
        s,
    )
    # links [t](u)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    # bold **x**
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    # italic *x* (avoid matching ** already replaced)
    s = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", s)
    # inline code `x`
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    return s


def flush_paragraph(buf):
    if buf:
        joined = " ".join(b.strip() for b in buf)
        out.append(f"<p>{inline(joined)}</p>")
        buf.clear()


para = []
while i < len(lines):
    ln = lines[i]
    # Fenced code block
    if ln.startswith("```"):
        flush_paragraph(para)
        if not in_code:
            in_code = True
            code_buf = []
        else:
            in_code = False
            out.append(
                "<pre><code>" + html.escape("\n".join(code_buf)) + "</code></pre>"
            )
            code_buf = []
        i += 1
        continue
    if in_code:
        code_buf.append(ln)
        i += 1
        continue

    # Horizontal rule
    if re.match(r"^---+\s*$", ln):
        flush_paragraph(para)
        out.append("<hr/>")
        i += 1
        continue

    # Headings
    m = re.match(r"^(#{1,6})\s+(.*)$", ln)
    if m:
        flush_paragraph(para)
        level = len(m.group(1))
        out.append(f"<h{level}>{inline(m.group(2).strip())}</h{level}>")
        i += 1
        continue

    # Blockquote
    if ln.startswith("> "):
        flush_paragraph(para)
        out.append(f'<blockquote>{inline(ln[2:].strip())}</blockquote>')
        i += 1
        continue

    # Table (GFM)
    if "|" in ln and i + 1 < len(lines) and re.match(r"^\s*\|?[\s\-:|]+\|?\s*$", lines[i + 1]):
        flush_paragraph(para)
        header_cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        i += 2  # skip separator
        rows = []
        while i < len(lines) and "|" in lines[i] and lines[i].strip():
            row_cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
            rows.append(row_cells)
            i += 1
        thead = "".join(f"<th>{inline(c)}</th>" for c in header_cells)
        body = "".join(
            "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows
        )
        out.append(f"<table><thead><tr>{thead}</tr></thead><tbody>{body}</tbody></table>")
        continue

    # Unordered list
    if re.match(r"^\s*[-*]\s+", ln):
        flush_paragraph(para)
        items = []
        while i < len(lines) and re.match(r"^\s*[-*]\s+", lines[i]):
            items.append(re.sub(r"^\s*[-*]\s+", "", lines[i]))
            i += 1
        out.append("<ul>" + "".join(f"<li>{inline(it)}</li>" for it in items) + "</ul>")
        continue

    # Ordered list
    if re.match(r"^\s*\d+\.\s+", ln):
        flush_paragraph(para)
        items = []
        while i < len(lines) and re.match(r"^\s*\d+\.\s+", lines[i]):
            items.append(re.sub(r"^\s*\d+\.\s+", "", lines[i]))
            i += 1
        out.append("<ol>" + "".join(f"<li>{inline(it)}</li>" for it in items) + "</ol>")
        continue

    # Blank line -> paragraph break
    if not ln.strip():
        flush_paragraph(para)
        i += 1
        continue

    # Default: accumulate paragraph
    para.append(ln)
    i += 1

flush_paragraph(para)

style = """
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #202124; line-height: 1.45; }
  h1 { font-family: Calibri; color: #1765cc; font-size: 22pt; margin-top: 20pt; }
  h2 { font-family: Calibri; color: #1765cc; font-size: 16pt; margin-top: 18pt; border-bottom: 1px solid #1a73e8; padding-bottom: 2pt; }
  h3 { font-family: Calibri; color: #1f2a44; font-size: 13pt; margin-top: 14pt; }
  h4 { font-family: Calibri; color: #1f2a44; font-size: 12pt; margin-top: 10pt; }
  p  { margin: 6pt 0; }
  code { font-family: Consolas, monospace; font-size: 10pt; background: #f2f4f7; padding: 1pt 3pt; }
  pre  { font-family: Consolas, monospace; font-size: 9.5pt; background: #f2f4f7; padding: 8pt; border: 1px solid #e0e0e0; white-space: pre-wrap; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 1px solid #c0c4ca; padding: 5pt 8pt; vertical-align: top; font-size: 10.5pt; }
  th { background: #1a73e8; color: white; text-align: left; }
  tr:nth-child(even) td { background: #f8f9fa; }
  blockquote { border-left: 4px solid #1a73e8; background: #f2f8ff; margin: 10pt 0; padding: 8pt 12pt; font-style: italic; }
  hr { border: none; border-top: 1px solid #c0c4ca; margin: 14pt 0; }
  ul, ol { margin: 6pt 0 6pt 22pt; }
  li { margin: 2pt 0; }
</style>
"""

html_doc = (
    "<!DOCTYPE html><html><head><meta charset='utf-8'>"
    + "<title>Landshield Solution Document</title>"
    + style
    + "</head><body>"
    + "\n".join(out)
    + "</body></html>"
)

DST.write_text(html_doc, encoding="utf-8")
print(f"Wrote {DST} ({len(html_doc)} bytes)")
