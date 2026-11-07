"""
interaction_log.py — records every model call and student action, with the
answer to "may this ever be used for training?" decided by rules, not by hand.

Why: some providers (Gemini included) forbid using their outputs to develop
competing models. Their outputs are still useful for debugging, caching and
showing the lesson to the student, but they must never reach a training set.
Student data is only trainable with the student's consent. Anything whose
rights are unknown is excluded by default.
This is engineering policy, not legal advice. Re-check provider terms.
"""
from __future__ import annotations

import json
import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path

POLICY_VERSION = 1

# Provider rules. Unknown providers default to "not trainable".
PROVIDER_POLICY = {
    "gemini":    {"train": False, "why": "Gemini API terms bar using the service to develop competing models"},
    "own_model": {"train": True,  "why": "our own model's outputs"},
    "human":     {"train": True,  "why": "written by the student (needs consent)"},
}
# Rights labels for the source material behind a record.
TRAINABLE_RIGHTS = {"owned", "user_authored", "open_license"}  # everything else, incl. "unknown", is excluded

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"\+?\d[\d\s().-]{7,}\d")


def redact(text: str) -> str:
    return _PHONE.sub("[phone]", _EMAIL.sub("[email]", text or ""))


@dataclass
class InteractionRecord:
    kind: str                      # model_output | student_input | feedback
    provider: str                  # gemini | own_model | human | ...
    model: str = ""
    task: str = ""                 # plan | teach | answer | ...
    user_id: str | None = None
    prompt: str = ""
    response: str = ""
    consent: bool = False          # student agreed their data may train our model
    source_rights: str = "unknown" # owned | user_authored | open_license | copyrighted | unknown
    source_ref: str = ""           # e.g. PDF hash or document name, for the data card
    feedback: str | None = None    # "up" | "down" | None
    latency_ms: int = 0
    meta: dict = field(default_factory=dict)
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    ts: float = field(default_factory=time.time)
    policy_version: int = POLICY_VERSION


def downvoted_ids(records) -> set[str]:
    """Feedback is its own record, linked to the answer it rates."""
    return {r.meta.get("target") for r in records if r.kind == "feedback" and r.feedback == "down"}


def exclusion_reason(rec: InteractionRecord, downvoted: frozenset | set = frozenset()) -> str | None:
    """None means trainable. Otherwise says why not. Recomputed at export time."""
    if rec.kind == "feedback":
        return "feedback record, not training text"
    if rec.id in downvoted:
        return "student marked it unhelpful"
    rule = PROVIDER_POLICY.get(rec.provider)
    if rule is None:
        return f"unknown provider '{rec.provider}'"
    if not rule["train"]:
        return rule["why"]
    if not rec.consent:
        return "no consent from the student"
    if rec.source_rights not in TRAINABLE_RIGHTS:
        return f"source rights are '{rec.source_rights}'"
    return None


def is_trainable(rec: InteractionRecord, downvoted: frozenset | set = frozenset()) -> bool:
    return exclusion_reason(rec, downvoted) is None


class MemorySink:
    def __init__(self): self.records: list[InteractionRecord] = []
    def write(self, rec): self.records.append(rec)
    def read(self): return list(self.records)


class JsonlSink:
    """One JSON object per line. Fine for dev and a few users; swap for Supabase later."""
    def __init__(self, path): self.path = Path(path); self.path.parent.mkdir(parents=True, exist_ok=True)
    def write(self, rec):
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(rec), ensure_ascii=False) + "\n")
    def read(self):
        if not self.path.exists(): return []
        return [InteractionRecord(**json.loads(l)) for l in self.path.read_text(encoding="utf-8").splitlines() if l.strip()]


class InteractionLogger:
    def __init__(self, sink, redact_text: bool = True):
        self.sink, self.redact_text = sink, redact_text

    def log(self, rec: InteractionRecord) -> InteractionRecord:
        if self.redact_text:
            rec.prompt, rec.response = redact(rec.prompt), redact(rec.response)
        self.sink.write(rec)
        return rec


# ───────── the documentation trail ─────────
def export_training_set(records) -> list[dict]:
    """Only records that pass the rules today, each with its provenance attached."""
    down = downvoted_ids(records)
    return [
        {"prompt": r.prompt, "response": r.response,
         "provenance": {"id": r.id, "provider": r.provider, "model": r.model,
                        "source_rights": r.source_rights, "source_ref": r.source_ref,
                        "policy_version": POLICY_VERSION, "logged_at": r.ts}}
        for r in records if is_trainable(r, down)
    ]


def data_card(records) -> dict:
    """Plain summary of what is in the logs and what would be used. Keep this with every trained model."""
    card = {"policy_version": POLICY_VERSION, "total": 0, "trainable": 0, "by_provider": {}, "excluded_because": {}}
    down = downvoted_ids(records)
    for r in records:
        card["total"] += 1
        card["by_provider"][r.provider] = card["by_provider"].get(r.provider, 0) + 1
        why = exclusion_reason(r, down)
        if why is None: card["trainable"] += 1
        else: card["excluded_because"][why] = card["excluded_because"].get(why, 0) + 1
    return card
