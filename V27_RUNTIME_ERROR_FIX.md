# V27 Runtime Error / Portal Display Fix

- Replaced the misleading “Portal Display Restored / transient viewport issue” error screen.
- Error boundary now reports the actual render error message (truncated for safety).
- “Try Again” now remounts the entire App tree instead of only clearing the boundary state.
- Error logging now includes both the error stack and React component stack.
- Login/session state is preserved during Try Again.
- No additional Vercel API function added.

Validation: Node syntax checks PASS for the existing server/API files checked during packaging. A fresh Vite production build could not be run in this environment because npm dependency installation timed out.
