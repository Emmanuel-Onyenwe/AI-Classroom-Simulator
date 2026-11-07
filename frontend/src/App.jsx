import LessonRoom from "./room/LessonRoom.jsx";
import { sampleLesson } from "./data/sampleLesson.js";

// Demo wiring. Replace with data from the backend once /lesson endpoints exist.
export default function App() {
  return (
    <LessonRoom
      lesson={sampleLesson}
      askNotice="Questions are saved here for now. Answers arrive once the server is connected."
    />
  );
}
