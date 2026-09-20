# SKTech Exam Portal — Vercel Hobby Safe

SKTech Exam Portal is a Vite/React + Supabase + Google Gemini application.

## Production architecture

- Vercel serves the React/Vite frontend.
- Vercel exposes **one** Serverless Function at `api/[...path].js`.
- Existing API URLs such as `/api/ai-review`, `/api/mock-generator`, `/api/daily-scheduler`, etc. are routed through that single gateway.
- Actual handlers live under `server/api/` and are not counted by Vercel as separate Serverless Functions.
- Supabase Edge Functions under `supabase/functions/` are independent of Vercel's function-count limit.
- Production scheduling uses the Vercel cron entry in `vercel.json`.

## Required server environment variables

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `GEMINI_REVIEW_MODEL_ID` (optional)
- `ADMIN_AUTH_EMAIL` or `VITE_ADMIN_AUTH_EMAIL`
- `CRON_SECRET` (recommended)

Never commit real secrets. `.env` files are ignored by Git.

## Local development

```bash
npm install
npm run check:functions
npm run build
npm run dev
```

The production function count must remain at `1/12`.
