import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from lesson_engine import *

x = np.linspace(-2, 2, 5)
# formulas that should work
assert np.allclose(safe_eval_formula("np.sin(x)", x), np.sin(x))
assert np.allclose(safe_eval_formula("x**2 + 3*x - 1", x), x**2 + 3*x - 1)
assert np.allclose(safe_eval_formula("x^2", x), x**2)
assert np.allclose(safe_eval_formula("5", x), 5)
assert np.allclose(safe_eval_formula("sqrt(abs(x))", x), np.sqrt(np.abs(x)))
# attacks that must be rejected
for bad in ["__import__('os').system('ls')", "open('/etc/passwd')", "x.__class__",
            "[c for c in ().__class__.__bases__]", "np.os.system('ls')", "lambda: 1", "a+1", "9"*300]:
    try:
        safe_eval_formula(bad, x); print("NOT REJECTED:", bad[:40]); sys.exit(1)
    except (ValueError, SyntaxError, TypeError):
        pass

# chunking covers ALL pages (old code only read 16-19)
pages = [f"Page text {i} " * 80 for i in range(40)] + ["", "tail"]
secs = chunk_pages(pages, target=3000)
assert secs[0].first_page == 1 and secs[-1].last_page == len(pages)
covered = {p for s in secs for p in range(s.first_page, s.last_page + 1)}
assert all(i + 1 in covered for i, t in enumerate(pages) if t)

# scan detection
assert scan_warning(["", "", "x"]) is not None and scan_warning(["long text " * 20] * 5) is None

# JSON parsing with code fences
assert parse_json('```json\n{"beats":[1]}\n```') == {"beats": [1]}
assert parse_json('Sure! [{"id":0,"title":"A"}] done')[0]["title"] == "A"

# plan + beats with a fake model
fake = lambda p: '[{"id":0,"title":"Limits"}]' if "numbered section" in p else \
    '{"beats":[{"say":"Let us begin.","board":[{"type":"note","text":"Limits"}]},{"bad":1}]}'
s = build_lesson_plan(fake, secs[:1], "Seminar"); assert s[0].title == "Limits"
t = teach_section(fake, s[0], "Seminar"); assert len(t.beats) == 1
# visuals: good ones kept, bad ones dropped, plain beats untouched
good = {"type": "visual", "kind": "flow", "title": "T", "items": [{"label": "a", "detail": "x"}, {"label": "b"}]}
assert clean_visual(good)["items"][0]["detail"] == "x"
assert clean_visual({"type": "visual", "kind": "pie", "items": []}) is None
assert clean_visual({"type": "visual", "kind": "flow", "items": [{"label": "solo"}]}) is None
assert clean_visual({"type": "visual", "kind": "compare", "columns": ["A"], "items": [{"label": "a", "left": "1", "right": "2"}] * 2}) is None
assert clean_visual({"type": "visual", "kind": "flow", "items": [{"label": "<script>alert(1)</script>"}, {"label": "b"}]})["items"][0]["label"].startswith("<script>")  # kept as plain text; the front end never renders HTML
assert len(clean_visual({"kind": "flow", "items": [{"label": str(i)} for i in range(30)]})["items"]) == 8
fake_v = lambda p: '{"beats":[{"say":"Look.","board":[%s,{"type":"visual","kind":"flow","items":[{"label":"x"}]},{"type":"note","text":"n"}]},{"say":""}]}' % __import__("json").dumps(good)
sec = teach_section(fake_v, Section(0, 1, 1, "t", "T"), "Seminar")
assert len(sec.beats) == 1 and [i["type"] for i in sec.beats[0]["board"]] == ["visual", "note"]
print("ALL TESTS PASSED:", len(secs), "sections from", len(pages), "pages")
