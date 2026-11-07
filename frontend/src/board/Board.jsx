import { useEffect, useRef } from "react";
import Visual from "../visuals/Visual.jsx";

/** The board. Written text appears; unwritten text reserves its space so nothing jumps. */
export default function Board({ lines, empty, live = false }) {
  const lastVisual = [...lines].reverse().find((l) => l.type === "visual")?.id;
  const endRef = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [lines.length]);

  return (
    <section className="board" aria-label="Board" tabIndex={0}>
      {lines.length === 0 ? empty : lines.map((l) => l.type === "visual" ? (
        <Visual key={l.id} id={l.id} visual={l.visual} step={l.shown} live={live && l.id === lastVisual} />
      ) : (
        <p key={l.id} className={`line line-${l.type}`}>
          <span>{l.full.slice(0, l.shown)}</span>
          <span className="ghost" aria-hidden="true">{l.full.slice(l.shown)}</span>
        </p>
      ))}
      <div ref={endRef} />
    </section>
  );
}
