import {
  getSupabaseAdmin,
  getGeminiClient,
  getOpenAIConfig,
  callGeminiWithRetry,
  callOpenAIJsonWithRetry,
  cleanJsonParse,
  verifyAdminAuth,
  handleCorsAndOptions,
  sanitizeObject,
  sanitizeString,
  writeAiPipelineLog,
  checkRateLimit,
  getClientIp
} from './_shared.js';

async function handler(req, res) {
  if (handleCorsAndOptions(req, res, ['POST', 'OPTIONS'])) return;
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST required' });
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, 'ai-chat', 30, 60000);
  if (!rate.allowed) return res.status(429).json({ ok:false, error:'Too many AI chat requests. Please wait.' });

  const sb = getSupabaseAdmin(req);
  if (!sb) return res.status(500).json({ ok:false, error:'Database server configuration unavailable' });
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) return res.status(auth.statusCode || 401).json({ ok:false, error:auth.error });

  const body = sanitizeObject(req.body || {});
  const message = sanitizeString(body.message, 4000).trim();
  if (!message) return res.status(400).json({ ok:false, error:'Message is required.' });

  const started = Date.now();
  const geminiEnabled = process.env.GEMINI_AI_ENABLED === 'true';
  const gemini = geminiEnabled ? getGeminiClient() : null;
  const openai = getOpenAIConfig();
  let provider = null;
  let model = null;
  let answer = '';
  let lastError = null;

  const systemPrompt = `You are the SKTech Exam Portal admin diagnostic assistant. Answer the administrator clearly and briefly. You may explain question-generation, review, repair, database, API and pipeline behavior. Do not claim an AI provider is healthy unless this request actually receives a response. Current request: ${message}`;

  if (gemini) {
    try {
      const r = await callGeminiWithRetry(() => gemini.models.generateContent({
        model: process.env.GEMINI_CHAT_MODEL_ID || process.env.GEMINI_REVIEW_MODEL_ID || 'gemini-3.8-flash',
        contents: [{ role:'user', parts:[{ text:systemPrompt }] }]
      }), { operationName:'Gemini Admin Diagnostic Chat', timeoutMs:15000, maxRetries:2 });
      answer = String(r?.text || '').trim();
      if (answer) { provider='gemini'; model=process.env.GEMINI_CHAT_MODEL_ID || process.env.GEMINI_REVIEW_MODEL_ID || 'gemini-3.8-flash'; }
    } catch (e) { lastError=e; }
  }

  if (!answer && openai.enabled) {
    try {
      const r = await callOpenAIJsonWithRetry(`Return JSON only: {"answer":"brief helpful answer"}. ${systemPrompt}`, { operationName:'OpenAI Admin Diagnostic Chat', timeoutMs:15000, maxRetries:2 });
      const parsed = cleanJsonParse(r.text || '{}');
      answer = String(parsed?.answer || '').trim();
      if (answer) { provider='openai'; model=openai.model; }
    } catch (e) { lastError=e; }
  }

  if (!answer) {
    await writeAiPipelineLog(sb, { level:'error', source:'ai-chat', action:'chat-failed', message:'Admin AI diagnostic chat failed for all configured providers.', details:{ gemini_configured:Boolean(gemini), openai_configured:openai.enabled, error:lastError?.message || 'No provider response', status:lastError?.status || null, latency_ms:Date.now()-started }, user_id:auth.user?.id || null });
    return res.status(503).json({ ok:false, error:lastError?.message || 'No AI provider returned a response.', diagnostics:{ gemini_configured:Boolean(gemini), openai_configured:openai.enabled } });
  }

  await writeAiPipelineLog(sb, { level:'info', source:'ai-chat', action:'chat-success', message:`Admin AI chat responded via ${provider}.`, details:{ provider, model, latency_ms:Date.now()-started }, user_id:auth.user?.id || null });
  return res.status(200).json({ ok:true, answer, provider, model, latency_ms:Date.now()-started });
}

export default handler;
