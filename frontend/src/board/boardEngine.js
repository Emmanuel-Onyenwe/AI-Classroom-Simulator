/**
 * boardEngine.js — plays a lesson section: the teacher speaks one "beat" while
 * the matching lines are written on the board. Framework-free so it can be
 * tested in Node and reused by any UI.
 *
 * A beat looks like:
 *   { say: "text spoken aloud",
 *     board: [{ type: "write" | "equation" | "note", text: "..." }] }
 *
 * The voice is an adapter: speak(text) -> { finished, pause, resume, cancel }.
 * `timedVoice` below is a silent stand-in that takes realistic time. The real
 * voice chain (Google, Azure, ElevenLabs, Edge) plugs in here later.
 */

const TEXT_TYPES = new Set(["write", "equation", "note"]);
const VISUAL_KINDS = new Set(["flow", "compare", "timeline"]);
const MAX_ITEMS = 8;

/** Validate a visual spec from the model. Returns a clean spec or null (then it is simply skipped). */
export function normalizeVisual(item) {
  if (!item || !VISUAL_KINDS.has(item.kind) || !Array.isArray(item.items)) return null;
  const clip = (v, n) => String(v ?? "").trim().slice(0, n);
  const items = item.items
    .slice(0, MAX_ITEMS)
    .filter((r) => r && clip(r.label, 1))
    .map((r) => ({ label: clip(r.label, 140), detail: clip(r.detail, 220), left: clip(r.left, 140), right: clip(r.right, 140) }));
  if (items.length < 2) return null;
  const columns = Array.isArray(item.columns) ? item.columns.slice(0, 2).map((c) => clip(c, 40)) : [];
  if (item.kind === "compare" && (columns.length !== 2 || !items.every((r) => r.left && r.right))) return null;
  return { kind: item.kind, title: clip(item.title, 80), columns, items };
}

/** Plain-text version of a visual, for screen readers and the transcript. */
export function visualAlt(v) {
  const head = v.title || { flow: "Process", compare: "Comparison", timeline: "Timeline" }[v.kind];
  if (v.kind === "compare") {
    return `${head}, comparing ${v.columns[0]} and ${v.columns[1]}. ` + v.items.map((r) => `${r.label}: ${r.left}; ${r.right}.`).join(" ");
  }
  return `${head}: ` + v.items.map((r, i) => `${v.kind === "flow" ? `${i + 1}. ` : ""}${r.label}${r.detail ? `, ${r.detail}` : ""}`).join("; ") + ".";
}

function makeLines(beat, beatIdx) {
  const lines = [];
  (beat.board || []).forEach((i, n) => {
    const id = `${beatIdx}-${n}`;
    if (TEXT_TYPES.has(i.type) && i.text) {
      const full = prettyMath(i.text);
      lines.push({ id, beat: beatIdx, type: i.type, full, size: full.length, shown: 0 });
    } else if (i.type === "visual") {
      const visual = normalizeVisual(i);
      if (visual) lines.push({ id, beat: beatIdx, type: "visual", visual, full: "", size: visual.items.length, shown: 0 });
    }
  });
  return lines;
}

export const estimateMs = (text) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1200, (words / 2.6) * 1000);
};

const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺", n: "ⁿ" };

/** Light formatting so plain-text maths reads like maths: x^2 -> x², <= -> ≤.
 *  Same length rules apply per character, so the typing reveal still works.
 *  A full LaTeX renderer (KaTeX) can replace this later. */
export const prettyMath = (text) =>
  text
    .replace(/\^\{?(-?\d+|n)\}?/g, (_, p) => [...p].map((c) => SUP[c] ?? c).join(""))
    .replace(/<=/g, "≤").replace(/>=/g, "≥").replace(/ \* /g, " × ");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function timedVoice({ timeScale = 1 } = {}) {
  return {
    speak(text) {
      let remaining = estimateMs(text) * timeScale;
      let paused = false;
      let last = Date.now();
      let done;
      const finished = new Promise((r) => (done = r));
      const timer = setInterval(() => {
        const now = Date.now();
        if (!paused) remaining -= now - last;
        last = now;
        if (remaining <= 0) {
          clearInterval(timer);
          done();
        }
      }, 15);
      return {
        finished,
        pause: () => { paused = true; },
        resume: () => { paused = false; last = Date.now(); },
        cancel: () => { clearInterval(timer); done(); },
      };
    },
  };
}

export class LessonPlayer {
  constructor({ beats = [], voice = timedVoice(), reduceMotion = false, tickMs = 30, timeScale = 1, onChange = () => {} } = {}) {
    this.beats = beats;
    this.voice = voice;
    this.reduceMotion = reduceMotion;
    this.tickMs = tickMs;
    this.timeScale = timeScale;
    this.onChange = onChange;

    this.state = "idle"; // idle | playing | paused | listening | done
    this.index = 0;
    this.lines = [];
    this._run = 0;
    this._paused = false;
    this._waiters = [];
    this._speech = null;
  }

  get snapshot() {
    return {
      state: this.state,
      index: this.index,
      total: this.beats.length,
      said: this.beats.slice(0, this.index + (this.state === "idle" ? 0 : 1)).map((b) => b.say),
      lines: this.lines.map((l) => ({ ...l })),
    };
  }

  _emit() { this.onChange(this.snapshot); }

  _release() {
    const w = this._waiters;
    this._waiters = [];
    w.forEach((r) => r());
  }

  async _tick(runId) {
    await sleep(this.tickMs);
    while (this._paused && runId === this._run) {
      await new Promise((r) => this._waiters.push(r));
    }
    return runId === this._run;
  }

  start() {
    if (this.state === "playing") return;
    this._play();
  }

  async _play() {
    const runId = ++this._run;
    this._paused = false;
    this.state = "playing";
    this._emit();
    while (this.index < this.beats.length) {
      if (runId !== this._run) return;
      const completed = await this._beat(this.beats[this.index], this.index, runId);
      if (!completed || runId !== this._run) return;
      if (this.index < this.beats.length - 1) this.index += 1;
      else { this.state = "done"; this._emit(); return; }
    }
  }

  async _beat(beat, beatIdx, runId) {
    let mine = this.lines.filter((l) => l.beat === beatIdx);
    if (!mine.length) {
      mine = makeLines(beat, beatIdx);
      this.lines.push(...mine);
    }
    this._emit();

    this._speech = this.voice.speak(beat.say);
    const writing = this._write(mine, estimateMs(beat.say) * this.timeScale, runId);
    await Promise.all([this._speech.finished, writing]);
    return runId === this._run;
  }

  async _write(lines, totalMs, runId) {
    const pending = lines.filter((l) => l.shown < l.size);
    if (!pending.length) return;
    if (this.reduceMotion) {
      pending.forEach((l) => { l.shown = l.size; });
      this._emit();
      return;
    }
    // A visual counts as roughly 16 characters per step when sharing the beat's time.
    const weight = (l) => (l.type === "visual" ? l.size * 16 : l.size);
    const totalWeight = pending.reduce((n, l) => n + weight(l), 0);
    for (const line of pending) {
      const ms = Math.max(120, totalMs * 0.8 * (weight(line) / totalWeight));
      if (line.type === "visual") {
        const perStepTicks = Math.max(1, Math.round(ms / line.size / this.tickMs));
        while (line.shown < line.size) {
          for (let t = 0; t < perStepTicks; t++) if (!(await this._tick(runId))) return;
          line.shown += 1;
          this._emit();
        }
        continue;
      }
      const per = Math.max(1, Math.ceil(line.size / Math.max(1, Math.round(ms / this.tickMs))));
      while (line.shown < line.size) {
        if (!(await this._tick(runId))) return;
        line.shown = Math.min(line.size, line.shown + per);
        this._emit();
      }
    }
  }

  pause() {
    if (this.state !== "playing") return;
    this._paused = true;
    this.state = "paused";
    this._speech?.pause();
    this._emit();
  }

  resume() {
    if (this.state === "paused") {
      this._paused = false;
      this.state = "playing";
      this._speech?.resume();
      this._release();
      this._emit();
    } else if (this.state === "listening") {
      this._play(); // say the interrupted beat again, then carry on
    }
  }

  /** Student cuts in: stop talking, finish the current line instantly, listen. */
  interrupt() {
    if (this.state !== "playing" && this.state !== "paused") return;
    this._run += 1;
    this._paused = false;
    this._speech?.cancel();
    this._release();
    this.lines.filter((l) => l.beat === this.index).forEach((l) => { l.shown = l.size; });
    this.state = "listening";
    this._emit();
  }

  replay() {
    this._run += 1;
    this._speech?.cancel();
    this._release();
    if (this.state === "done") this.state = "idle";
    this._play();
  }

  stop() {
    this._run += 1;
    this._speech?.cancel();
    this._release();
  }
}
