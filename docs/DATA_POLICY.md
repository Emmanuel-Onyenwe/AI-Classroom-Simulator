# Data policy: logs now, our own model later

We are not training a model yet. We are making sure the option stays open and clean.

## What we log
Every AI call (who answered, which model, how long), the student's questions, and thumbs up/down.
Emails and phone numbers are removed before saving.

## What may ever be used for training
A record is trainable only if ALL of these hold. The rules live in `backend/interaction_log.py`.
1. **The provider's terms allow it.** Gemini outputs are never trainable: its terms bar using the service to develop competing models. Unknown providers are excluded until reviewed.
2. **The student agreed.** Consent is off by default and can be withdrawn. Withdrawing deletes their logs.
3. **We know the source material's rights.** Only `owned`, `user_authored` or `open_license` pass. A course PDF defaults to `unknown`, which is excluded.
4. **Nobody marked it unhelpful.**

Rules are re-checked at export time, so a policy change applies to old logs too.

## Still useful from excluded records
Gemini outputs stay in the logs for debugging, caching, and showing the student their lesson history. Using them to compare our model's quality is a grey area: ask before doing it.

## The documentation trail
`data_card()` summarises what is in the logs: counts by provider, how many are trainable, and why the rest were excluded. `export_training_set()` attaches provenance (provider, model, rights, source, policy version, date) to every example.
Keep a data card with every model we train.

## Where the data can come from (safe sources)
- Our own model's outputs, once it exists
- Lessons and corrections written by us or consenting students
- Material we own or that has an open licence, with the licence recorded
- Open-weight models whose licence permits it (record the licence before use)

## Shadow mode
Once an own model exists, it can run quietly next to Gemini on the same questions. Its answers are logged for comparison and never shown to the student. This tests it without any risk to a lesson.

## Not legal advice
This is engineering policy. Before training anything that real users will rely on, read the current terms of every provider involved.
