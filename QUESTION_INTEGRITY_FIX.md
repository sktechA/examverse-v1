# SKTech Exam Portal — Question Integrity Fix

This build addresses a production content-integrity failure found in the V31 importer/exam flow.

## Fixed
1. Mathematics detection now recognizes HCF, LCM, Average/Mean, Percentage/% and Number System terms.
2. Unresolved subject detection no longer silently falls back to `General Awareness`.
3. Import validation now blocks obvious mathematical option mismatches:
   - average expected value missing from numeric options
   - HCF/LCM expected value missing
   - percentage expected value missing
   - speed expected value missing
   - non-numeric/unrelated options for these numeric question types
4. Admin exam mapping no longer fills a Mathematics/Reasoning/etc. section with questions from another subject when the requested subject pool is short.
5. Candidate mock loading no longer fills a subject exam with another subject as a fallback.
6. Candidate mock loading re-checks the above deterministic math integrity rules before showing a question.
7. Server-side mock generation also rejects questions failing deterministic integrity validation.

## Important
This prevents new/loaded invalid questions from reaching candidates. Existing already-approved bad records in Supabase still need to be audited/quarantined separately.

## Verification performed
- `node --check server/api/_shared.js` PASS
- `node --check server/api/mock-generator.js` PASS
- `node --check server/api/daily-scheduler.js` PASS
- `node --check api/[...path].js` PASS
- `node scripts-check-vercel-functions.mjs` PASS: 1/12 production API functions

A full Vite production build was not run in this environment because the ZIP has no installed `node_modules` and dependency installation was not completed.
