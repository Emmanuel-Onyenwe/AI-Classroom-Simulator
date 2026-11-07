"""
llm.py — every AI call goes through here, so models are swappable and logged.

  router = ModelRouter(
      providers={"gemini": CallableProvider("gemini", "gemini-2.5-flash", my_safe_generate),
                 "own_model": OwnModelProvider()},          # reserved slot
      routes={"default": ["gemini"]},                       # later: ["own_model", "gemini"]
      logger=InteractionLogger(JsonlSink("logs/interactions.jsonl")),
      shadow="own_model")                                   # optional: run it quietly alongside
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable, Protocol

from interaction_log import InteractionLogger, InteractionRecord


class NotConfigured(RuntimeError):
    pass


class LLMProvider(Protocol):
    name: str
    model: str
    def generate(self, prompt: str) -> str: ...


@dataclass
class CallableProvider:
    """Wrap any function(prompt) -> text, such as your existing Gemini helper."""
    name: str
    model: str
    fn: Callable[[str], str]
    def generate(self, prompt: str) -> str:
        return self.fn(prompt)


class OwnModelProvider:
    """Reserved slot for our own model. Not connected until we pass a function."""
    name = "own_model"
    def __init__(self, model: str = "unset", fn: Callable[[str], str] | None = None):
        self.model, self._fn = model, fn
    def generate(self, prompt: str) -> str:
        if self._fn is None:
            raise NotConfigured("own model is not connected yet")
        return self._fn(prompt)


class ModelRouter:
    def __init__(self, providers: dict, routes: dict, logger: InteractionLogger, shadow: str | None = None):
        self.providers, self.routes, self.logger, self.shadow = providers, routes, logger, shadow

    def _call(self, name: str, task: str, prompt: str, ctx: dict) -> str:
        prov = self.providers[name]
        t0 = time.time()
        out = prov.generate(prompt)
        self.logger.log(InteractionRecord(
            kind="model_output", provider=prov.name, model=prov.model, task=task, prompt=prompt, response=out,
            latency_ms=int((time.time() - t0) * 1000), **ctx))
        return out

    def generate(self, task: str, prompt: str, *, user_id: str | None = None, consent: bool = False,
                 source_rights: str = "unknown", source_ref: str = "") -> str:
        ctx = {"user_id": user_id, "consent": consent, "source_rights": source_rights, "source_ref": source_ref}
        order = self.routes.get(task) or self.routes["default"]
        last: Exception | None = None
        for name in order:
            if name not in self.providers:
                continue
            try:
                result = self._call(name, task, prompt, ctx)
            except NotConfigured:
                continue
            except Exception as e:  # provider down or rate-limited: try the next one
                last = e
                continue
            if self.shadow and self.shadow != name and self.shadow in self.providers:
                try:  # shadow output is logged for comparison; the student never sees it
                    self._call(self.shadow, f"shadow:{task}", prompt, ctx)
                except Exception:
                    pass
            return result
        raise RuntimeError("No model could answer this request") from last

    def record_feedback(self, rec_id: str, value: str, user_id: str | None = None):
        """Thumbs up/down. Saved as its own record linked to the answer; export joins them."""
        self.logger.log(InteractionRecord(kind="feedback", provider="human", user_id=user_id,
                                          feedback=value, meta={"target": rec_id}))
