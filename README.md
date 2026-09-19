<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/982a76ab-9650-43aa-9e27-be95d19411fa

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## V18.3 production deployment fix
- Automation settings reload now maps database field names back to the admin UI fields.
- Question TXT parser now distinguishes numbered questions from numbered options and requires strict option labels.
- First numbered question is no longer skipped when no active question exists.
- `Answer:` is no longer misread as option A.
- Letter options no longer retain the delimiter (`A. text` -> `text`).
- Approved mock generation filters incomplete/duplicate records before candidate delivery.
- Daily scheduler consumes approved database inventory before invoking Gemini, reducing unnecessary Gemini calls/timeouts.
- Removed the legacy `node:url` monkey-patch and all `url.parse()` usage from the shared server runtime.
- Kept the production question-integrity API deployed; only the local exhaustive test runner remains excluded from Vercel Functions.
- No production deployment is performed by this package change.
