import assert from "node:assert/strict";
import { LessonPlayer, timedVoice, prettyMath, normalizeVisual, visualAlt } from "./boardEngine.js";

const beats = [
  { say: "First we write the equation on the board now.", board: [{ type: "write", text: "Solve" }, { type: "equation", text: "x^2 + 5x + 6 = 0" }] },
  { say: "Then we factor it into two brackets for you.", board: [{ type: "equation", text: "(x+2)(x+3) = 0" }, { type: "graph", text: "ignored" }] },
];
const make = (extra = {}) => {
  const log = [];
  const p = new LessonPlayer({ beats, timeScale: 0.05, tickMs: 5, voice: timedVoice({ timeScale: 0.05 }), onChange: (s) => log.push(s), ...extra });
  return { p, log };
};
const until = async (fn, ms = 4000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 5)); } };
const full = (p) => p.lines.every((l) => l.shown === l.full.length);

// 1. plays through, writes everything, ignores unsupported types
{ const { p } = make(); p.start(); await until(() => p.state === "done");
  assert.equal(p.lines.length, 3); assert.ok(full(p)); assert.ok(!p.lines.some((l) => l.full === "ignored")); }

// 2. text is revealed progressively, never all at once
{ const { p, log } = make(); p.start(); await until(() => p.state === "done");
  const partial = log.some((s) => s.lines.some((l) => l.shown > 0 && l.shown < l.full.length));
  assert.ok(partial, "should see partially written lines"); }

// 3. reduced motion writes instantly
{ const { p, log } = make({ reduceMotion: true }); p.start(); await until(() => p.state === "done");
  assert.ok(!log.some((s) => s.lines.some((l) => l.shown > 0 && l.shown < l.full.length))); }

// 4. pause freezes writing, resume continues
{ const { p } = make({ timeScale: 0.5, voice: timedVoice({ timeScale: 0.5 }) }); p.start();
  await until(() => p.lines.some((l) => l.shown > 0)); p.pause(); assert.equal(p.state, "paused");
  const frozen = p.lines.map((l) => l.shown).join(); await new Promise((r) => setTimeout(r, 120));
  assert.equal(p.lines.map((l) => l.shown).join(), frozen, "no progress while paused");
  p.resume(); await until(() => p.state === "done"); assert.ok(full(p)); }

// 5. interrupt stops, completes the current line, listens; resume repeats that beat then continues
{ const { p } = make({ timeScale: 0.5, voice: timedVoice({ timeScale: 0.5 }) }); p.start();
  await until(() => p.lines.some((l) => l.shown > 0)); p.interrupt();
  assert.equal(p.state, "listening"); assert.equal(p.index, 0);
  assert.ok(p.lines.filter((l) => l.beat === 0).every((l) => l.shown === l.full.length));
  const before = p.lines.length; await new Promise((r) => setTimeout(r, 150));
  assert.equal(p.lines.length, before, "nothing new while listening");
  p.resume(); await until(() => p.state === "done");
  assert.equal(p.lines.filter((l) => l.beat === 0).length, 2, "beat 0 lines not duplicated"); assert.ok(full(p)); }

// 6. replay after finishing works and does not duplicate lines
{ const { p } = make(); p.start(); await until(() => p.state === "done"); const n = p.lines.length;
  p.replay(); await until(() => p.state === "done"); assert.equal(p.lines.length, n); }

// 7. stop() ends everything cleanly
{ const { p } = make({ timeScale: 1, voice: timedVoice({ timeScale: 1 }) }); p.start(); p.stop(); await new Promise((r) => setTimeout(r, 100)); assert.notEqual(p.state, "done"); }

// 8. maths formatting keeps one character per symbol so the typing reveal stays in step
assert.equal(prettyMath("x^2 + 5x + 6 = 0"), "x² + 5x + 6 = 0");
assert.equal(prettyMath("a^{-1} <= b^n"), "a⁻¹ ≤ bⁿ");
assert.equal(prettyMath("3 * 4 >= 12"), "3 × 4 ≥ 12");

// 9. visuals are validated: bad specs are dropped, good ones are trimmed
assert.equal(normalizeVisual({ kind: "pie", items: [{ label: "a" }, { label: "b" }] }), null);
assert.equal(normalizeVisual({ kind: "flow", items: [{ label: "only one" }] }), null);
assert.equal(normalizeVisual({ kind: "compare", columns: ["A"], items: [{ label: "x", left: "1", right: "2" }, { label: "y", left: "1", right: "2" }] }), null);
assert.equal(normalizeVisual({ kind: "compare", columns: ["A", "B"], items: [{ label: "x", left: "1" }, { label: "y", left: "1", right: "2" }] }), null);
const many = normalizeVisual({ kind: "flow", items: Array.from({ length: 20 }, (_, i) => ({ label: "step " + i })) });
assert.equal(many.items.length, 8);
assert.ok(visualAlt(many).startsWith("Process: 1. step 0"));
assert.ok(visualAlt(normalizeVisual({ kind: "compare", columns: ["A", "B"], title: "T", items: [{ label: "x", left: "1", right: "2" }, { label: "y", left: "3", right: "4" }] })).includes("x: 1; 2."));

// 10. a visual is revealed step by step, in time with the beat, and ends fully shown
const vbeats = [{ say: "Here are the three steps of the method for you to follow now.", board: [
  { type: "visual", kind: "flow", title: "Method", items: [{ label: "one" }, { label: "two" }, { label: "three" }] },
  { type: "visual", kind: "flow", items: [{ label: "bad" }] } ] }];
{ const log = []; const p = new LessonPlayer({ beats: vbeats, timeScale: 0.1, tickMs: 5, voice: timedVoice({ timeScale: 0.1 }), onChange: (s) => log.push(s) });
  p.start(); await until(() => p.state === "done");
  assert.equal(p.lines.length, 1, "invalid visual dropped");
  assert.equal(p.lines[0].shown, 3);
  const steps = new Set(log.map((s) => s.lines[0]?.shown).filter((n) => n !== undefined));
  assert.ok(steps.has(1) && steps.has(2), "saw intermediate steps: " + [...steps]); }

// 11. reduced motion shows the whole visual at once; interrupt completes it
{ const p = new LessonPlayer({ beats: vbeats, reduceMotion: true, timeScale: 0.1, tickMs: 5, voice: timedVoice({ timeScale: 0.1 }) });
  p.start(); await until(() => p.state === "done"); assert.equal(p.lines[0].shown, 3); }
{ const p = new LessonPlayer({ beats: vbeats, timeScale: 1, tickMs: 5, voice: timedVoice({ timeScale: 1 }) });
  p.start(); await until(() => p.lines.length && p.lines[0].shown >= 1); p.interrupt();
  assert.equal(p.lines[0].shown, 3); assert.equal(p.state, "listening"); }

console.log("board engine: all 11 tests passed");
process.exit(0);
