import sys, tempfile, os
sys.path.insert(0, os.path.dirname(__file__))
from interaction_log import *
from llm import *

def make(shadow=None, own=None, gem=None):
    sink = MemorySink()
    r = ModelRouter(
        providers={"gemini": CallableProvider("gemini", "g-test", gem or (lambda p: "gemini says " + p)),
                   "own_model": OwnModelProvider("tiny-1", own)},
        routes={"default": ["own_model", "gemini"]}, logger=InteractionLogger(sink), shadow=shadow)
    return r, sink

# 1. own-model slot is empty -> falls through to gemini, nothing breaks
r, sink = make(); out = r.generate("teach", "hello"); assert out == "gemini says hello"
assert [x.provider for x in sink.read()] == ["gemini"]

# 2. once connected, own model answers first
r, sink = make(own=lambda p: "own says " + p); assert r.generate("teach", "hi") == "own says hi"

# 3. provider failure falls back to the next one
def boom(p): raise TimeoutError("down")
r, sink = make(own=boom); assert r.generate("teach", "x") == "gemini says x"

# 4. everything failing raises a clear error
r, _ = make(own=boom, gem=boom)
try: r.generate("teach", "x"); assert False
except RuntimeError as e: assert "No model" in str(e)

# 5. GEMINI OUTPUT IS NEVER TRAINABLE, even with consent and owned material
r, sink = make(); r.generate("teach", "q", user_id="u1", consent=True, source_rights="owned")
g = sink.read()[0]; assert not is_trainable(g) and "competing" in exclusion_reason(g)
assert export_training_set(sink.read()) == []

# 6. own-model output is trainable only with consent AND known rights
for consent, rights, ok in [(True, "owned", True), (False, "owned", False), (True, "unknown", False), (True, "copyrighted", False)]:
    r, sink = make(own=lambda p: "ok"); r.generate("teach", "q", consent=consent, source_rights=rights)
    assert is_trainable(sink.read()[0]) is ok, (consent, rights)

# 7. unknown provider defaults to excluded
assert exclusion_reason(InteractionRecord(kind="model_output", provider="mystery", consent=True, source_rights="owned")).startswith("unknown provider")

# 8. thumbs-down removes an otherwise trainable record; thumbs-down is its own record
r, sink = make(own=lambda p: "good"); r.generate("teach", "q", consent=True, source_rights="owned")
rec = sink.read()[0]; assert len(export_training_set(sink.read())) == 1
r.record_feedback(rec.id, "down"); assert export_training_set(sink.read()) == []

# 9. shadow mode logs the own model quietly, and a failing shadow never hurts the student
r, sink = make(shadow="own_model", own=None); r.routes["default"] = ["gemini"]
r.providers["own_model"] = OwnModelProvider("tiny-1", lambda p: "shadow out")
assert r.generate("teach", "q") == "gemini says q"
assert sorted(x.provider for x in sink.read()) == ["gemini", "own_model"]
r.providers["own_model"] = OwnModelProvider("tiny-1", boom); assert r.generate("teach", "q2") == "gemini says q2"

# 10. personal details are redacted before saving
r, sink = make(); r.generate("answer", "mail me at ada@example.com or +234 801 234 5678")
assert "ada@example.com" not in sink.read()[0].prompt and "[email]" in sink.read()[0].prompt and "[phone]" in sink.read()[0].prompt

# 11. JSONL sink round-trips; data card explains the lot
with tempfile.TemporaryDirectory() as d:
    sink = JsonlSink(os.path.join(d, "logs", "i.jsonl")); lg = InteractionLogger(sink)
    r = ModelRouter({"gemini": CallableProvider("gemini", "g", lambda p: "a"), "own_model": OwnModelProvider("t", lambda p: "b")},
                    {"default": ["own_model"], "plan": ["gemini"]}, lg)
    r.generate("plan", "p", consent=True, source_rights="owned"); r.generate("teach", "p", consent=True, source_rights="owned")
    recs = sink.read(); assert len(recs) == 2
    card = data_card(recs); assert card["total"] == 2 and card["trainable"] == 1 and card["by_provider"] == {"gemini": 1, "own_model": 1}
    assert len(export_training_set(recs)) == 1 and export_training_set(recs)[0]["provenance"]["provider"] == "own_model"
print("llm + log: all 11 tests passed")
