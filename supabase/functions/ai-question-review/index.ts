// LEGACY OPENAI EDGE FUNCTION - DECOMMISSIONED & ISOLATED
// Per project requirement: Google Gemini server-side is the single active AI validation engine.
// Legacy OpenAI pipeline is disabled to prevent duplicate pipelines or secret exposure.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  return new Response(
    JSON.stringify({
      ok: false,
      deprecated: true,
      message: "This legacy OpenAI edge function is decommissioned. Use the server-side Gemini validation pipeline at /api/ai-review."
    }),
    {
      status: 410,
      headers: { ...cors, "Content-Type": "application/json" }
    }
  );
});
