# Built for growth: decisions made now so scaling later is a config change

Today: one student plus a few friends, all on free tiers.
Goal: no rewrite if it grows. Each item below is cheap now and expensive to retrofit.

## 1. Data isolation in the database, not in code
- Every table has `user_id` and Supabase Row Level Security: `user_id = auth.uid()`.
- The current app filters by `user_id` in Python. RLS makes the database enforce it, so a bug in app code cannot leak one student's notes to another.

## 2. A stateless backend
- The API server keeps nothing in memory between requests. All state lives in Postgres and Storage.
- Running two servers instead of one then needs no code change.

## 3. Usage metering from day one
- A `usage` table records characters of speech and AI tokens per user per day.
- It protects the free tiers (the voice chain switches before a limit is hit), enforces fair use between friends, and becomes the basis for plans if the app ever charges.

## 4. Providers behind adapters
- `LLM`, `TTS` and `STT` are small interfaces. Gemini and Google voices are the first implementations.
- Adding a paid tier or a new provider is one new file, not a refactor.

## 5. Caching that saves real money
- Generated lesson plans are cached by a hash of the PDF text. Audio is cached by a hash of text plus voice.
- Per-user cache first. Sharing a cache across users is a later decision that needs a privacy check.

## 6. Keys never reach the browser
- All provider keys live on the server. Per-user rate limits sit in front of every AI endpoint.

## 7. Files out of memory
- Uploaded PDFs go to Supabase Storage. Long PDFs are processed as background jobs once volume needs it.

## 8. Know the real ceiling
- Free tiers are limits per project, not per user. A few friends is fine. Dozens of daily users will hit them.
- Free scaling path: let each user optionally add their own Gemini key (bring your own key).
- Paid path: the metering table and adapters mean switching on a paid tier is configuration.

## 9. See problems early
- Structured error logs and a simple status page from the first deploy. Free hosting sleeps when idle, so measure the cold start and show a friendly "waking up" state.
