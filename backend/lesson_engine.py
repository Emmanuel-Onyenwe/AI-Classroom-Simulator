"""
lesson_engine.py — turns a course PDF into a structured lesson the board and
voice can follow. No UI code in here, so it works with Streamlit today and a
React front end later.

Flow:  PDF -> pages -> sections (chunks) -> lesson plan -> "beats" per section
A beat is one thing the teacher says plus what appears on the board while
they say it. That pairing is what lets voice and board stay in sync.
"""
from __future__ import annotations

import ast
import json
import operator
import re
from dataclasses import dataclass, field

import numpy as np

# Gemini 2.5 Flash has a very large context window, so we can send far more
# than the old 6,000 characters. This is a safety cap, not a target.
MAX_CONTEXT_CHARS = 200_000
SECTION_TARGET_CHARS = 6_000


# ───────────────────────── 1. PDF -> pages ─────────────────────────
def extract_pages(reader) -> list[str]:
    """Return text for EVERY page. `reader` is a PyPDF2.PdfReader.
    Pages with no extractable text (scans) come back as empty strings."""
    pages = []
    for page in reader.pages:
        try:
            pages.append((page.extract_text() or "").strip())
        except Exception:
            pages.append("")
    return pages


def scan_warning(pages: list[str]) -> str | None:
    """Tell the student if the PDF looks like scanned images (no real text)."""
    if not pages:
        return "This PDF has no pages."
    empty = sum(1 for p in pages if len(p) < 30)
    if empty / len(pages) > 0.6:
        return ("This PDF looks like scanned images, so I can't read the text. "
                "Try a version where you can select the text.")
    return None


# ───────────────────────── 2. pages -> sections ─────────────────────────
@dataclass
class Section:
    id: int
    first_page: int
    last_page: int
    text: str
    title: str = ""
    beats: list = field(default_factory=list)


def chunk_pages(pages: list[str], target: int = SECTION_TARGET_CHARS) -> list[Section]:
    """Group consecutive pages into sections of roughly `target` characters.
    Splits only on page boundaries so page references stay accurate."""
    sections: list[Section] = []
    buf, start = "", 0
    for i, text in enumerate(pages):
        if not text:
            continue
        if not buf:
            start = i
        buf += f"\n[Page {i + 1}]\n{text}"
        if len(buf) >= target:
            sections.append(Section(len(sections), start + 1, i + 1, buf.strip()))
            buf = ""
    if buf.strip():
        sections.append(Section(len(sections), start + 1, len(pages), buf.strip()))
    return sections


def course_text(sections: list[Section]) -> str:
    text = "\n\n".join(s.text for s in sections)
    return text[:MAX_CONTEXT_CHARS]


# ───────────────────────── 3. Gemini helpers ─────────────────────────
def parse_json(raw: str):
    """Gemini sometimes wraps JSON in code fences. Strip them and parse."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.IGNORECASE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"(\{.*\}|\[.*\])", cleaned, flags=re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise


def build_lesson_plan(generate, sections: list[Section], mode: str) -> list[Section]:
    """One call: give each section a short title.
    `generate(prompt) -> str` is any function that calls Gemini and returns text
    (pass your safe_generate wrapper so key rotation still works)."""
    outline = "\n".join(
        f"{s.id}: pages {s.first_page}-{s.last_page}: {s.text[:350].replace(chr(10), ' ')}"
        for s in sections
    )
    prompt = (
        "You are planning a lesson from a student's course material.\n"
        "For each numbered section, write a clear title of at most 8 words.\n"
        'Reply with JSON only: [{"id": 0, "title": "..."}, ...]\n\n' + outline
    )
    try:
        for item in parse_json(generate(prompt)):
            sections[int(item["id"])].title = str(item["title"])[:80]
    except Exception:
        pass  # titles are a nicety; fall back to page ranges below
    for s in sections:
        if not s.title:
            s.title = f"Pages {s.first_page}-{s.last_page}"
    return sections


BEAT_SCHEMA = (
    'Reply with JSON only, in this shape:\n'
    '{"beats": [{"say": "what the teacher says out loud, 1-3 sentences, plain '
    'speech, no symbols", "board": [{"type": "write|equation|note|plot", '
    '"text": "what appears on the board"}]}]}\n'
    'A board item can instead be an infographic: {"type": "visual", "kind": "flow|compare|timeline", '
    '"title": "short title", "items": [{"label": "...", "detail": "..."}]}.\n'
    "Rules:\n"
    "- Use a visual only when it genuinely helps (a process, a comparison, a sequence in time), at most one per section, with 2 to 6 items.\n"
    '- flow: items are ordered steps. timeline: label is the date, detail is the event.\n'
    '- compare: also give "columns": ["A", "B"], and each item needs "label", "left", "right".\n'
    "- Visuals are drawn from this data only. Never write code or markup.\n"
    "- 'say' is spoken aloud, so write numbers and maths as words a person would say.\n"
    "- 'equation' text is LaTeX without dollar signs, one step per item, in solving order.\n"
    "- 'note' is a short key point, at most 12 words.\n"
    "- 'plot' text is a single numpy expression in x, for example np.sin(x).\n"
    "- Maximum 8 beats. End with one beat that asks the student a check question.\n"
)


VISUAL_KINDS = {"flow", "compare", "timeline"}
TEXT_TYPES = {"write", "equation", "note", "plot"}


def clean_visual(item: dict) -> dict | None:
    """Same rules as the front end's normalizeVisual: bad visuals are dropped, never shown."""
    rows = item.get("items")
    if item.get("kind") not in VISUAL_KINDS or not isinstance(rows, list):
        return None
    clip = lambda v, n: str(v if v is not None else "").strip()[:n]
    items = [{"label": clip(r.get("label"), 140), "detail": clip(r.get("detail"), 220),
              "left": clip(r.get("left"), 140), "right": clip(r.get("right"), 140)}
             for r in rows[:8] if isinstance(r, dict) and clip(r.get("label"), 1)]
    if len(items) < 2:
        return None
    cols = [clip(c, 40) for c in (item.get("columns") or [])][:2]
    if item["kind"] == "compare" and (len(cols) != 2 or not all(r["left"] and r["right"] for r in items)):
        return None
    return {"type": "visual", "kind": item["kind"], "title": clip(item.get("title"), 80), "columns": cols, "items": items}


def clean_beat(beat: dict) -> dict | None:
    if not isinstance(beat, dict) or not str(beat.get("say", "")).strip():
        return None
    board = []
    for it in beat.get("board") or []:
        if not isinstance(it, dict):
            continue
        if it.get("type") == "visual":
            v = clean_visual(it)
            if v:
                board.append(v)
        elif it.get("type") in TEXT_TYPES and str(it.get("text", "")).strip():
            board.append({"type": it["type"], "text": str(it["text"])[:300]})
    return {"say": str(beat["say"]).strip(), "board": board}


def teach_section(generate, section: Section, mode: str) -> Section:
    """Turn one section into beats for the board and voice."""
    if mode == "Chalkboard":
        style = ("You are a patient maths teacher. Solve step by step. Every step goes "
                 "on the board as an equation, and you say what you are doing in words.")
    else:
        style = ("You are a warm tutor. Explain the ideas simply. Put key points on the "
                 "board as short notes.")
    prompt = f"{style}\n\n{BEAT_SCHEMA}\nSection: {section.title}\n\nMaterial:\n{section.text}"
    data = parse_json(generate(prompt))
    beats = data["beats"] if isinstance(data, dict) else data
    section.beats = [c for c in (clean_beat(b) for b in beats) if c]
    return section


# ───────────────────────── 4. Safe formula evaluator ─────────────────────────
# Replaces eval() on model-written formulas. Only allows arithmetic, x, and a
# short list of numpy functions. Anything else raises ValueError.
_BIN = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_FUNCS = {n: getattr(np, n) for n in
          ("sin", "cos", "tan", "exp", "log", "log10", "sqrt", "abs",
           "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh")}
_CONSTS = {"pi": np.pi, "e": np.e}


def safe_eval_formula(expr: str, x: np.ndarray) -> np.ndarray:
    """Evaluate e.g. 'np.sin(x) + x**2' for an array x, safely."""
    expr = expr.strip().replace("^", "**")
    if len(expr) > 200:
        raise ValueError("Formula too long")

    def walk(node):
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.Name):
            if node.id == "x":
                return x
            if node.id in _CONSTS:
                return _CONSTS[node.id]
            raise ValueError(f"Unknown name: {node.id}")
        if isinstance(node, ast.BinOp) and type(node.op) in _BIN:
            return _BIN[type(node.op)](walk(node.left), walk(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
            return _UNARY[type(node.op)](walk(node.operand))
        if isinstance(node, ast.Call) and len(node.args) == 1 and not node.keywords:
            fn = node.func
            name = fn.attr if isinstance(fn, ast.Attribute) and getattr(fn.value, "id", "") == "np" \
                else getattr(fn, "id", None)
            if name in _FUNCS:
                return _FUNCS[name](walk(node.args[0]))
        raise ValueError("Unsupported expression")

    result = walk(ast.parse(expr, mode="eval"))
    return np.broadcast_to(np.asarray(result, dtype=float), x.shape).copy()
