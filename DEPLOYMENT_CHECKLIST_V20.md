# Deployment Checklist — V20

1. Keep the currently working V1/V2 deployment as backup.
2. Create a clean GitHub repository or completely replace the old repository tree.
3. Upload the extracted ZIP contents, not the ZIP file itself.
4. Repository root must contain `api/[...path].js`, `server/api/`, `src/`, `package.json`, `vite.config.js`.
5. There must NOT be old standalone files such as `api/ai-review.js`, `api/mock-generator.js`, `api/daily-scheduler.js`, etc.
6. Keep only the single Vercel catch-all function under `/api`.
7. Set Vercel environment variables from `.env.example`; never commit real secrets.
8. Existing Supabase project and data stay unchanged.
9. Run `supabase/master_fix.sql` once in the existing Supabase SQL Editor.
10. Deploy to Vercel.
11. Confirm build log contains `Vercel Hobby protection: 1/12 production API function.`
12. Confirm Vite build finishes with `built` and deployment becomes Ready.
13. Test public candidate URL on laptop and phone.
14. Test Login/Create Account and Show Password.
15. Test published exam countdown slider before and after login.
16. Start an exam and verify full-screen/viewport behavior, timer, navigation and no horizontal page scrolling.
17. In Admin → Daily Automation, verify Gemini is enabled before using AI generation.
18. Test one subject batch first. Confirm accepted questions are unique and validated before running the full subject sequence.
19. Test Current Affairs six-month Gemini research only after the Gemini API key is configured.
