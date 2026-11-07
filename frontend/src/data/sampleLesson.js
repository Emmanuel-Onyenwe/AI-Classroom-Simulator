// Sample lesson so the room runs before the server is connected.
// Shape matches what lesson_engine.teach_section() produces.
export const sampleLesson = {
  title: "Sample course",
  sections: [
    {
      id: 0,
      title: "Quadratic equations",
      beats: [
        { say: "Today we solve a quadratic equation by factoring. Let's take x squared plus five x plus six equals zero.",
          board: [{ type: "write", text: "Solve by factoring" }, { type: "equation", text: "x^2 + 5x + 6 = 0" }] },
        { say: "We need two numbers that multiply to six and add to five. Those are two and three.",
          board: [{ type: "note", text: "product 6, sum 5" }, { type: "equation", text: "(x + 2)(x + 3) = 0" }] },
        { say: "Each bracket can be zero, so x is minus two, or minus three. Here is the method as four steps.",
          board: [{ type: "equation", text: "x = -2   or   x = -3" },
                  { type: "visual", kind: "flow", title: "Solving by factoring", items: [
                    { label: "Write the equation as something equals zero", detail: "Move every term to one side first." },
                    { label: "Find two numbers: product c, sum b", detail: "For x^2 + 5x + 6, that is 2 and 3." },
                    { label: "Write them as two brackets", detail: "(x + 2)(x + 3) = 0" },
                    { label: "Set each bracket to zero", detail: "Each one gives you a root." }] }] },
        { say: "Quick check. What are the roots of x squared minus four equals zero?",
          board: [{ type: "note", text: "Your turn: x^2 - 4 = 0" }] },
      ],
    },
    {
      id: 1,
      title: "Supply and demand",
      beats: [
        { say: "Price settles where the amount buyers want matches the amount sellers offer.",
          board: [{ type: "write", text: "Equilibrium" }, { type: "note", text: "demand = supply" }] },
        { say: "If the price is too high, sellers have unsold stock, so the price drops. If it is too low, shelves empty and the price rises.",
          board: [{ type: "visual", kind: "compare", title: "Away from equilibrium", columns: ["Price too high", "Price too low"], items: [
            { label: "Buyers want", left: "Less than is on offer", right: "More than is on offer" },
            { label: "Sellers have", left: "Unsold stock", right: "Empty shelves" },
            { label: "Price moves", left: "Down", right: "Up" }] }] },
      ],
    },
    {
      id: 2,
      title: "How information spread",
      beats: [
        { say: "Each of these changes made information cheaper to share, and reach more people, than the one before.",
          board: [{ type: "visual", kind: "timeline", title: "Sample timeline", items: [
            { label: "c. 1440", detail: "Gutenberg's printing press: books become cheaper to copy." },
            { label: "1969", detail: "ARPANET sends its first message between computers." },
            { label: "1989", detail: "Tim Berners-Lee proposes the World Wide Web." },
            { label: "1998", detail: "Google is founded to search the growing web." }] }] },
      ],
    },
  ],
};
