import { useEffect, useRef, useState } from "react";
import { LessonPlayer } from "./boardEngine.js";

const EMPTY = { state: "idle", index: 0, total: 0, said: [], lines: [] };

/** One player per section. Switching sections stops the old one. */
export function usePlayer(beats) {
  const [snap, setSnap] = useState(EMPTY);
  const ref = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const player = new LessonPlayer({ beats, reduceMotion: reduce, onChange: setSnap });
    ref.current = player;
    setSnap(player.snapshot);
    return () => player.stop();
  }, [beats]);

  return [snap, ref];
}
