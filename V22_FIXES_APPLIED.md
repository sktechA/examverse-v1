# SKTech Exam Portal V22 – Candidate UX + Gemini Pipeline Fixes

## Candidate UX
- Removed duplicate Login/Create Account buttons from public header; kept one hero action set.
- Public/candidate exam schedule now queries `exams` directly for published scheduled exams and refreshes every 30 seconds.
- Replaced placeholder “Published exams will appear here” copy with a live schedule status message.
- Candidate dashboard made compact by removing duplicated recruitment/trending/subject blocks from the dashboard; those remain available in their own navigation pages.
- Added Bright/Dark appearance controls and English/Hindi language controls to the account menu for both candidate and admin dashboards.
- Removed duplicate My Profile / Settings / Logout actions from the top account menu; those remain in the left navigation.
- Removed the “Supabase Database” label and exposed UID from candidate profile; profile now shows “Account Details”.
- Candidate Current Affairs page no longer shows the admin-only “Official Ingestion Sources” panel. Admin still sees it.

## Gemini / Question Pipeline
- Main daily pipeline no longer performs a mandatory second Gemini review call. It uses Gemini self-verification + deterministic validation + duplicate checks by default.
- Optional second review remains available only when `GEMINI_REQUIRE_SECOND_REVIEW=true` is explicitly enabled.
- Subject-wise generation keeps partial valid batches instead of discarding them.
- Subject generation has adaptive retry rounds and returns detailed diagnostics (`hint`, `generation_error`, `empty_generation_rounds`, insert errors).
- Daily question target is now independent of current-affairs feed article ingestion. CA articles do not reduce the question target.
- Daily delivery metrics now report actual question rows delivered, not CA article counts.
- Daily Automation UI now displays useful generation/DB error details when a subject returns 0.

## Validation
- TypeScript JSX transpile checks passed for `src/main.jsx` and `src/components/DailyAutomation.jsx`.
- `node --check` passed for server/API JavaScript files.
- Existing single catch-all Vercel API architecture is preserved.
- Existing Supabase question data is not deleted or modified by this package.
