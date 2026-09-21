# V29 Candidate Runtime + Footer Fix

## Fixed
- Candidate portal runtime crash: `Error: role is not defined`.
  - `CandidateDashboard` was referencing `role` even though it does not receive a `role` prop.
  - Removed the invalid `adminMode={role==='admin'}` expression from the candidate-only dashboard.
- Dashboard/public footer centered at the bottom.
- Removed duplicated public footer text.
- Standardized footer to: `© 2026 SKTech Exam Portal. All Rights Reserved.`
- Fixed integrity test #25 mock review payload extraction. The Gemini review request places the JSON payload in `contents[0].parts[1]`; the test incorrectly read `contents[1]`, causing false `delivered=0` failures.

## Validation
- Question integrity suite: 25/25 passed in a dependency-stubbed test environment.
- Server/API syntax checks passed for daily scheduler, shared API helpers, integrity test, and Vercel catch-all API entry.
- A fresh Vite production build was not run because project dependencies are not installed in the audit environment.
