import { useState } from "react";
import { visualAlt } from "../board/boardEngine.js";

/**
 * Infographic templates drawn by us from a small validated spec.
 * The model never writes markup or code, so every visual matches the app and stays safe.
 * `step` = how many items the teacher has reached; `live` = lesson is running.
 */
export default function Visual({ id, visual, step, live }) {
  const [open, setOpen] = useState({});
  const toggle = (i) => setOpen((o) => ({ ...o, [i]: !o[i] }));
  const state = (i) => (i < step ? "shown" : "hidden"); // hidden items keep their space: no layout jump
  const active = (i) => live && i === step - 1;
  const descId = `vis-desc-${id}`;

  return (
    <figure className="line line-visual" aria-describedby={descId}>
      {visual.title && <figcaption className="vis-title">{visual.title}</figcaption>}
      <p className="sr-only" id={descId}>{visualAlt(visual)}</p>

      {visual.kind === "flow" && (
        <ol className="vis vis-flow">
          {visual.items.map((it, i) => (
            <li key={i} className="vis-item" data-state={state(i)} data-active={active(i)}>
              <span className="vis-step">Step {i + 1}</span>
              {it.detail ? (
                <>
                  <button className="vis-card" aria-expanded={!!open[i]} onClick={() => toggle(i)}>
                    <span className="vis-label">{it.label}</span>
                  </button>
                  {open[i] && <p className="vis-detail">{it.detail}</p>}
                </>
              ) : (
                <div className="vis-card"><span className="vis-label">{it.label}</span></div>
              )}
            </li>
          ))}
        </ol>
      )}

      {visual.kind === "timeline" && (
        <ol className="vis vis-timeline">
          {visual.items.map((it, i) => (
            <li key={i} className="vis-item" data-state={state(i)} data-active={active(i)}>
              <span className="vis-when">{it.label}</span>
              {it.detail && <span className="vis-event">{it.detail}</span>}
            </li>
          ))}
        </ol>
      )}

      {visual.kind === "compare" && (
        <table className="vis-compare">
          <thead>
            <tr><td /><th scope="col">{visual.columns[0]}</th><th scope="col">{visual.columns[1]}</th></tr>
          </thead>
          <tbody>
            {visual.items.map((it, i) => (
              <tr key={i} className="vis-row" data-state={state(i)} data-active={active(i)}>
                <th scope="row">{it.label}</th><td>{it.left}</td><td>{it.right}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}
