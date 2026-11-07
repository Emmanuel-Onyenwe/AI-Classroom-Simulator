import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Slide-over: full height, Esc closes, focus is trapped and returned. */
export default function Drawer({ title, onClose, children }) {
  const panel = useRef(null);
  // Keep the latest onClose without re-running the focus logic on every parent render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const focusable = () => panel.current.querySelectorAll("button, [href], input, [tabindex]:not([tabindex='-1'])");
    focusable()[0]?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") { closeRef.current(); return; }
      if (e.key !== "Tab") return;
      const items = [...focusable()];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); opener?.focus?.(); };
  }, []);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close"><X className="icon" aria-hidden="true" /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}
