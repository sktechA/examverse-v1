# SKTech Exam Portal V21 — AI Generation Reliability Fix

## What was fixed

1. **Subject-wise Gemini generation no longer requires a second Gemini review call by default.**
   - Gemini is instructed to self-check every question before returning it.
   - Deterministic validation still rejects missing fields, duplicate options, invalid answers, dependent-context questions, and duplicates against the database.
   - Optional second review remains available with `GEMINI_REQUIRE_SECOND_REVIEW=true`.

2. **Gemini generation timeout increased to 60 seconds** for the larger bilingual batches.

3. **Subject batch now reports database insert errors** instead of silently showing `0/100`.

4. **Manual Daily Automation now explicitly enables Gemini** when the admin presses the Run button.

5. **Current Affairs count display fixed.**
   - The UI was reading field names that the API does not return, so it could display `CA Added: 0` even when the backend had processed items.
   - It now displays official bulletins, Gemini 6-month research items, delivered questions, approvals and pending review correctly.

6. **Current Affairs admin sync now requests Gemini 6-month web research** and question generation in the same manual action.

7. **Gemini web research source fallback added.**
   - If Gemini does not place a `source_url` in an item, the system can use the corresponding Google Search grounding source via `source_index`.

## Important

- `GEMINI_API_KEY` must exist in Vercel Environment Variables.
- The current production model is `gemini-3.8-flash`.
- The Vercel Hobby architecture remains a single `api/[...path].js` function.
- No Supabase questions are deleted by this update.
