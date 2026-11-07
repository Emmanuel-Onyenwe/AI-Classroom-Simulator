import { useState } from "react";
import { Hand, Pause, Play, RotateCcw, SendHorizontal, List, FileText } from "lucide-react";
import Board from "../board/Board.jsx";
import { usePlayer } from "../board/usePlayer.js";
import Drawer from "./Drawer.jsx";

const STATUS = {
  idle: "Ready when you are.",
  playing: "Teaching. Interrupt any time.",
  paused: "Paused. Resume when you're ready.",
  listening: "Your turn. Ask below, then resume the lesson.",
  done: "That's the section. Replay it or move on.",
};

export default function LessonRoom({ lesson, onAsk, askNotice }) {
  const [sectionIdx, setSectionIdx] = useState(0);
  const [drawer, setDrawer] = useState(null); // "map" | "transcript" | null
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState([]);

  const section = lesson.sections[sectionIdx];
  const [snap, player] = usePlayer(section.beats);
  const s = snap.state;
  const hasNext = sectionIdx < lesson.sections.length - 1;
  const progress = s === "idle" ? 0 : ((snap.index + (s === "done" ? 1 : 0.5)) / snap.total) * 100;

  const goTo = (i) => { setSectionIdx(i); setDrawer(null); };

  const submit = (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    player.current?.interrupt();
    setAsked((a) => [...a, q]);
    setQuestion("");
    onAsk?.(q, section);
  };

  const empty = (
    <div className="board-empty">
      <h2>{section.title}</h2>
      <p>Your teacher will explain and write on the board as they go. Cut in whenever you have a question.</p>
      <button className="btn btn-chalk" onClick={() => player.current.start()}>
        <Play className="icon" aria-hidden="true" /> Start the lesson
      </button>
    </div>
  );

  return (
    <div className="room">
      <header className="strip">
        <button className="icon-btn" onClick={() => setDrawer("map")} aria-label="Open lesson map" title="Lesson map">
          <List className="icon" aria-hidden="true" />
        </button>
        <div className="strip-text">
          <span className="meta">Section {sectionIdx + 1} of {lesson.sections.length}</span>
          <h1 className="strip-title">{section.title}</h1>
        </div>
        <button className="icon-btn" onClick={() => setDrawer("transcript")} aria-label="Open transcript" title="Transcript">
          <FileText className="icon" aria-hidden="true" />
        </button>
      </header>
      <div className="progress" role="progressbar" aria-label="Section progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <main className="stage"><Board lines={snap.lines} empty={empty} live={s === "playing" || s === "paused"} /></main>

      <footer className="controls">
        <div className="controls-inner">
          <p className="status" role="status">{STATUS[s]}</p>

          <div className="actions">
            {s === "listening" ? (
              <button className="btn btn-primary" onClick={() => player.current.resume()}>
                <Play className="icon" aria-hidden="true" /> <span className="btn-label">Resume lesson</span>
              </button>
            ) : s === "done" && hasNext ? (
              <button className="btn btn-primary" onClick={() => goTo(sectionIdx + 1)}>
                <Play className="icon" aria-hidden="true" /> <span className="btn-label">Start next section</span>
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => player.current.interrupt()} disabled={s !== "playing" && s !== "paused"}>
                <Hand className="icon" aria-hidden="true" /> <span className="btn-label">Interrupt</span>
              </button>
            )}
            {s === "paused" ? (
              <button className="btn btn-secondary" title="Resume" onClick={() => player.current.resume()}>
                <Play className="icon" aria-hidden="true" /> <span className="btn-label">Resume</span>
              </button>
            ) : (
              <button className="btn btn-secondary" title="Pause" onClick={() => player.current.pause()} disabled={s !== "playing"}>
                <Pause className="icon" aria-hidden="true" /> <span className="btn-label">Pause</span>
              </button>
            )}
            <button className="btn btn-secondary" title="Replay" onClick={() => player.current.replay()} disabled={s === "idle"}>
              <RotateCcw className="icon" aria-hidden="true" /> <span className="btn-label">Replay</span>
            </button>
          </div>

          <form className="ask" onSubmit={submit}>
            <label htmlFor="ask">Ask a question</label>
            <div className="ask-row">
              <input id="ask" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Why do we add the numbers?" autoComplete="off" />
              <button className="icon-btn" type="submit" aria-label="Send question" title="Send question"><SendHorizontal className="icon" aria-hidden="true" /></button>
            </div>
          </form>
        </div>
      </footer>

      {drawer === "map" && (
        <Drawer title="Lesson map" onClose={() => setDrawer(null)}>
          <ul className="list">
            {lesson.sections.map((sec, i) => (
              <li key={sec.id}>
                <button className="map-item" aria-current={i === sectionIdx} onClick={() => goTo(i)}>
                  <span>{sec.title}</span>
                  {i === sectionIdx && <span className="meta">Current</span>}
                </button>
              </li>
            ))}
          </ul>
        </Drawer>
      )}

      {drawer === "transcript" && (
        <Drawer title="Transcript" onClose={() => setDrawer(null)}>
          <h3>Your teacher</h3>
          {snap.said.length ? <ul className="list">{snap.said.map((t, i) => <li key={i}><p>{t}</p></li>)}</ul>
            : <p className="empty-line">Nothing said yet. Start the lesson and it appears here.</p>}
          <h3>Your questions</h3>
          {asked.length ? <ul className="list">{asked.map((t, i) => <li key={i}><p>{t}</p></li>)}</ul>
            : <p className="empty-line">You haven't asked anything yet.</p>}
          {asked.length > 0 && askNotice && <p className="empty-line" style={{ marginTop: "var(--space-3)" }}>{askNotice}</p>}
        </Drawer>
      )}
    </div>
  );
}
