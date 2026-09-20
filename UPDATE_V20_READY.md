# SKTech Exam Portal — V20 Ready-to-Go Update

## Scope
This update preserves the existing project architecture and backend routes. Only the requested candidate UX, exam-mode responsiveness, Gemini current-affairs research, and subject-wise question automation are changed.

## Candidate changes
- Public candidate landing page now shows the scheduled published exam countdown slider before login.
- Candidate dashboard also shows the same live upcoming-exam slider after login.
- Slider auto-rotates when multiple published exams exist.
- Countdown updates every second without polling Supabase every second.
- Candidate-facing "Upload Question" feature card has been removed from the public landing page.
- Candidate login is limited to Email/Mobile + Password plus Create Account.
- OTP and Google buttons are removed from the candidate UI.
- Show/Hide Password is available on login, admin login, and candidate registration.
- Candidate registration retains full name, phone, email, password, confirm password, captcha, and terms/consent.
- Exam mode uses the full available viewport and attempts browser Fullscreen API when supported.
- Exam mode locks page scrolling; question content and question palette use controlled internal scrolling.
- Mobile, tablet, and laptop layouts were added for the exam screen to avoid horizontal page scrolling.

## Gemini / automation changes
- Current-affairs sync can now use Gemini with Google Search grounding to research the last six months of exam-relevant events.
- Existing official-source ingestion remains in place; Gemini research is additive and deduplicated.
- A subject-wise worker can generate up to 100 fresh questions for one subject per request.
- Generated questions go through deterministic validation, duplicate/content-hash checks, and Gemini quality review before approval.
- If a generated question fails validation/review, it is rejected and the worker requests fresh questions, with a safety retry limit.
- Admin automation UI includes a sequential "Generate 100 / Subject" action for the configured major subjects.

## Vercel / deployment safety
- Vercel production API surface remains a single catch-all function: `api/[...path].js`.
- Existing API route names continue to dispatch to their original handlers under `server/api/`.
- The prebuild function-count guard reports 1/12 production functions.
- No `url.parse()` monkey patch is used.
- `.vercelignore` keeps tests, seed data, SQL/text setup files, and local-only material out of the Vercel deployment payload.
- Supabase Edge Functions remain separate from Vercel Serverless Functions.

## Required one-time Supabase migration
Run the updated `supabase/master_fix.sql` once in the existing Supabase project. It adds a restricted `published_exam_schedule` view containing only public exam-schedule fields for the landing-page slider. It does not delete or modify questions, candidates, attempts, or exam records.

## Deployment rule
Do not merge this update with an older repository tree. Upload this ZIP as a clean repository root so old `/api/*.js` files do not return and recreate the Hobby function-count problem.
