#!/usr/bin/env python3
"""Build the pitch PDF from the markdown sources.

Usage:  python3 docs/pitch/build-pdf.py
        chromium --headless --no-pdf-header-footer \
          --print-to-pdf=Costly-Accelerator-Pitch.pdf docs/pitch/pitch.html

Needs `pip install markdown` and any Chromium. Edit the markdown, never the
HTML — it is regenerated on every run.
"""
import re, pathlib, markdown

BASE = pathlib.Path(__file__).resolve().parent
REPO = BASE.parent.parent

SECTIONS = [
    ("The pitch", "01-narrative.md"),
    ("The deck", "02-deck.md"),
    ("Q&amp;A preparation", "03-qa-prep.md"),
    ("What to send, and to whom", "04-application-kit.md"),
    ("How to use this set", "README.md"),
]

CSS = """
@page { size: A4; margin: 20mm 18mm 18mm 18mm; }
:root {
  --ink: #161a14; --soft: #55604f; --rule: #d9ded4;
  --green: #127a41; --green-bg: #f0faf3; --burn: #c0341f; --gold: #8a6410;
}
* { box-sizing: border-box; }
body {
  font-family: "Inter", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  color: var(--ink); font-size: 10.2pt; line-height: 1.52;
  margin: 0; -webkit-font-smoothing: antialiased;
}
code, kbd, pre, .num { font-family: "SF Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace; }

/* ---------- cover ---------- */
.cover { page-break-after: always; padding-top: 52mm; }
.cover .mark {
  font-family: "SF Mono", "DejaVu Sans Mono", monospace;
  font-size: 42pt; font-weight: 700; letter-spacing: -0.02em; margin: 0;
}
.cover .mark b { color: var(--green); font-weight: 700; }
.cover .tag { font-size: 15pt; color: var(--ink); margin: 6mm 0 0; font-weight: 500; }
.cover .sub { font-size: 10.5pt; color: var(--soft); margin: 3mm 0 0; }
.cover hr { border: 0; border-top: 2px solid var(--green); margin: 12mm 0 6mm; width: 28mm; }
.cover .meta { font-size: 9.5pt; color: var(--soft); line-height: 1.9; }
.cover .meta b { color: var(--ink); font-weight: 600; }
.cover .note {
  margin-top: 14mm; padding: 4mm 5mm; background: var(--green-bg);
  border-left: 3px solid var(--green); font-size: 9.2pt; color: var(--soft);
}

/* ---------- section dividers ---------- */
.section-open { page-break-before: always; margin-bottom: 8mm; }
.section-open .kicker {
  font-family: "SF Mono", monospace; font-size: 8pt; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--green); margin: 0 0 2mm;
}
.section-open h1 {
  font-size: 24pt; margin: 0; padding: 0 0 4mm; border-bottom: 2px solid var(--green);
  letter-spacing: -0.02em;
}

/* ---------- headings ---------- */
h1 { font-size: 17pt; margin: 9mm 0 3mm; letter-spacing: -0.01em; page-break-after: avoid; }
h2 {
  font-size: 12.6pt; margin: 8mm 0 2.5mm; padding-top: 2.5mm;
  border-top: 1px solid var(--rule); page-break-after: avoid; letter-spacing: -0.01em;
}
h3 { font-size: 10.8pt; margin: 5.5mm 0 1.5mm; color: var(--green); page-break-after: avoid; }
h2 + h3 { margin-top: 3mm; }

p { margin: 0 0 2.6mm; orphans: 3; widows: 3; }
strong { font-weight: 650; }
em { color: var(--soft); }
a { color: var(--green); text-decoration: none; border-bottom: 1px solid #b8e0c6; }

ul, ol { margin: 0 0 3mm; padding-left: 5.5mm; }
li { margin-bottom: 1.4mm; }
li > ul, li > ol { margin-top: 1.4mm; }

hr { border: 0; border-top: 1px solid var(--rule); margin: 6mm 0; }

/* ---------- blockquote: slide text / spoken answers ---------- */
blockquote {
  margin: 3mm 0 4mm; padding: 3mm 4.5mm; background: #f7f9f5;
  border-left: 3px solid var(--green); page-break-inside: avoid;
}
blockquote p { margin-bottom: 1.8mm; }
blockquote p:last-child { margin-bottom: 0; }
blockquote h2, blockquote h3 {
  border: 0; margin: 0 0 2mm; padding: 0; color: var(--ink); font-size: 12pt;
}
blockquote ol, blockquote ul { margin-bottom: 0; }

/* ---------- tables ---------- */
table {
  width: 100%; border-collapse: collapse; margin: 3mm 0 5mm;
  font-size: 8.9pt; page-break-inside: avoid;
}
th {
  text-align: left; background: #f2f5ef; border-bottom: 1.5px solid var(--green);
  padding: 2mm 2.4mm; font-weight: 650; font-size: 8.6pt;
}
td { padding: 2mm 2.4mm; border-bottom: 1px solid var(--rule); vertical-align: top; }
tr:nth-child(even) td { background: #fbfcfa; }

code {
  font-size: 8.8pt; background: #f2f5ef; padding: 0.4mm 1.2mm;
  border-radius: 2px; color: #2b3327;
}

/* keep a slide + its notes together where possible */
h3 + blockquote { page-break-before: avoid; }
"""

COVER = """
<div class="cover">
  <p class="mark">COST<b>LY</b></p>
  <p class="tag">Doomscrolling, with a price tag.</p>
  <p class="sub">Accelerator pitch &middot; working set</p>
  <hr>
  <div class="meta">
    <b>Sina Dehesh</b> &middot; Founder<br>
    Milan, Italy &middot; sinadehesh@gmail.com<br>
    github.com/Sinadehesh/costly
  </div>
  <div class="note">
    <b>Contents.</b> The pitch (problem through the ask) &middot; the 13-slide
    deck with speaker notes &middot; Q&amp;A preparation &middot; how to use this set.
    <br><br>
    Pre-launch and pre-revenue: the system is built, no user has installed it
    and no charge has moved. Every figure here is either sourced inline or
    marked as needing one.
  </div>
</div>
"""


def convert(path: pathlib.Path) -> str:
    text = path.read_text()
    # Drop the H1 title line; the section divider carries it.
    text = re.sub(r"\A#\s+[^\n]*\n+", "", text)
    return markdown.markdown(
        text, extensions=["tables", "fenced_code", "sane_lists", "attr_list"]
    )


parts = [COVER]
for i, (title, fname) in enumerate(SECTIONS, start=1):
    parts.append(
        f'<div class="section-open"><p class="kicker">Part {i} of {len(SECTIONS)}</p>'
        f"<h1>{title}</h1></div>"
    )
    parts.append(convert(BASE / fname))

html = (
    "<!doctype html><html><head><meta charset='utf-8'>"
    "<title>Costly — Accelerator Pitch</title>"
    f"<style>{CSS}</style></head><body>{''.join(parts)}</body></html>"
)

out = BASE / "pitch.html"
out.write_text(html)
print("wrote", out, len(html), "bytes")
