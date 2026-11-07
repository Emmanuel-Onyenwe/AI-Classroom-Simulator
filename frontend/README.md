# AI Classroom — front end

React + Vite. Free to host as a static site.

```
npm install
npm run dev     # http://localhost:5173
npm test        # board engine tests (plain Node, no install needed)
```

## What is here
- `src/board/boardEngine.js` — plays a section: the teacher speaks one beat while its lines are written on the board. Pause, interrupt, resume, replay, reduced motion. Framework-free and tested.
- `src/room/LessonRoom.jsx` — the Lesson room (custom screen, accepted outside the standard page patterns).
- `src/styles/tokens.css` — colours, type, spacing. Matches `.ux-profile.md`.
- `src/visuals/Visual.jsx` — infographic templates (flow, compare, timeline), drawn by us from a validated spec. The model never writes markup or code. Items appear in time with the voice; tap a flow card for detail; every visual has a text version for screen readers.
- `src/data/sampleLesson.js` — demo lesson in the same shape `lesson_engine.teach_section()` returns.

## Not connected yet
- **Voice:** `timedVoice` is a silent stand-in. The voice chain plugs in through `voice.speak(text)`.
- **Server:** the demo reads `sampleLesson`. Questions are saved in the transcript only.
- **Interrupt by speaking:** the Interrupt button works; voice capture comes with the voice step.
- **Graph template:** `plot` beats are still skipped; it needs a safe formula reader in the browser.
- **Visual placement:** the lesson prompt asks for at most one visual per section; real PDFs will show whether that is the right amount.
- **LaTeX:** `plot` beats are skipped. Powers and symbols use light formatting (x²). KaTeX can replace it.
- **Shortcuts:** no keyboard shortcuts yet (Space to pause is a good first one).

## Checked
Engine tests (11), including visual validation and step-by-step reveal. Layout in Chromium at 375px and 1280px, light and dark: no sideways overflow, no text under 12px, tap targets at least 44px, three font weights.

## Not checked
The React build itself (no network here to install packages), the drawer focus trap in a real browser, reduced-motion scrolling.
