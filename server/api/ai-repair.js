import {
  getSupabaseAdmin,
  getGeminiClient,
  verifyAdminAuth,
  normalizeText,
  normalizeOptionValue,
  cleanAnswer,
  cleanJsonParse,
  callGeminiWithRetry,
  callOpenAIJsonWithRetry,
  getOpenAIConfig,
  getNormalizedGeminiModel,
  writeAiPipelineLog,
  resolveOptionDuplicatesAndDistribute,
  withApiLogging,
  isValidUuid,
  sanitizeObject,
  sanitizeErrorResponse,
  checkRateLimit,
  getClientIp
} from './_shared.js';

const TIMEOUT_MS = 20000;
const THRESHOLD = 0.98;

function validShape(r) {
  const opts = [r.option_a, r.option_b, r.option_c, r.option_d].map(x => String(x || '').trim());
  const norm = opts.map(normalizeText);
  const normVal = opts.map(normalizeOptionValue);
  return Boolean(
    r.question &&
    opts.every(Boolean) &&
    /^[ABCD]$/.test(cleanAnswer(r.correct_answer, r)) &&
    new Set(norm).size === 4 &&
    new Set(normVal).size === 4
  );
}

async function repairWithGemini(gemini, q) {
  const prompt = `Repair this competitive-exam MCQ only when a single correct answer can be established from the question itself. Preserve the subject. Fix missing/duplicate/non-matching options, correct_answer and explanation. Do not invent uncertain facts. Return JSON only.\nQuestion: ${q.question || ''}\nA: ${q.option_a || ''}\nB: ${q.option_b || ''}\nC: ${q.option_c || ''}\nD: ${q.option_d || ''}\nDeclared answer: ${q.correct_answer || ''}\nExplanation: ${q.explanation || ''}\nSubject: ${q.subject || ''}\nReturn {"verdict":"repair"|"keep_review","question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A|B|C|D","explanation":"...","confidence":0-1,"notes":"..."}.`;

  const response = await callGeminiWithRetry(
    () =>
      gemini.models.generateContent({
        model: getNormalizedGeminiModel(process.env.GEMINI_REVIEW_MODEL_ID),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      }),
    {
      operationName: `Gemini AI Repair (${q.id || 'question'})`,
      maxRetries: 3,
      timeoutMs: TIMEOUT_MS,
      initialDelayMs: 1000
    }
  );

  return cleanJsonParse(response?.text || '{}');
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Autonomous Rate Limiting (Protects Gemini quota & server load)
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, 'ai-repair', 15, 60000);
  if (!rate.allowed) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', String(rate.retryAfter));
    }
    return res.status(429).json({ error: 'Too many requests. Please wait before triggering another AI repair batch.' });
  }

  const sb = req?.supabaseClient || req?.sb || getSupabaseAdmin(req);
  if (!sb) return res.status(500).json({ error: 'Database connection unavailable' });
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) return res.status(auth.statusCode || 401).json({ error: auth.error });

  if (process.env.GEMINI_AI_ENABLED !== 'true' && !req?.geminiClient) {
    return res.status(400).json({ error: 'Gemini AI is disabled. Enable GEMINI_AI_ENABLED and configure GEMINI_API_KEY on the server.' });
  }
  const gemini = req?.geminiClient || getGeminiClient();
  if (!gemini) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });

  const body = sanitizeObject(req.body || {});
  const rawIds = Array.isArray(body?.question_ids) ? body.question_ids : [];
  // Strict UUID validation on question IDs
  const ids = rawIds
    .filter(id => typeof id === 'string' && isValidUuid(id.trim()))
    .map(id => id.trim())
    .slice(0, 50);

  if (!ids.length) {
    return res.status(400).json({ error: 'No valid question_ids (UUID format) supplied.' });
  }

  const { data: rows, error } = await sb.from('questions').select('*').in('id', ids).in('status', ['pending_review','needs_correction']);
  if (error) return res.status(500).json({ error: sanitizeErrorResponse(error, 'Database query error during question repair.') });
  let repaired = 0, approved = 0, kept = 0;
  const results = [];
  for (const q of rows || []) {
    try {
      let rv;
      try {
        rv = await repairWithGemini(gemini, q);
      } catch (geminiErr) {
        const openai = getOpenAIConfig();
        if (!openai.enabled) throw geminiErr;
        await writeAiPipelineLog(sb, { level:'warning', source:'ai-repair', action:'gemini-repair-fallback', message:'Gemini repair failed; OpenAI fallback repair was used.', details:{ question_id:q.id, error:geminiErr?.message || String(geminiErr), status:geminiErr?.status || null, timeout:Boolean(geminiErr?.isTimeout), quota:Boolean(geminiErr?.isQuotaExhausted) }, user_id:auth.user?.id || null });
        const fallback = await callOpenAIJsonWithRetry(`Repair this competitive-exam MCQ only if a single correct answer can be established. Return JSON only: {"verdict":"repair|keep_review","question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A|B|C|D","explanation":"...","confidence":0.99,"notes":"..."}. Preserve subject. Question data: ${JSON.stringify(q)}`, { operationName:'OpenAI Question Repair Fallback', timeoutMs:15000, maxRetries:2 });
        rv = cleanJsonParse(fallback.text || '{}');
      }
      const rawCandidate = {
        ...q,
        question: rv.question || q.question,
        option_a: rv.option_a || q.option_a,
        option_b: rv.option_b || q.option_b,
        option_c: rv.option_c || q.option_c,
        option_d: rv.option_d || q.option_d,
        correct_answer: cleanAnswer(rv.correct_answer || q.correct_answer),
        explanation: rv.explanation || q.explanation
      };
      const candidate = resolveOptionDuplicatesAndDistribute(rawCandidate, { distribute: false });
      if (rv.verdict === 'repair' && Number(rv.confidence) >= THRESHOLD && validShape(candidate)) {
        const { error: upErr } = await sb.from('questions').update({
          question: candidate.question,
          option_a: candidate.option_a,
          option_b: candidate.option_b,
          option_c: candidate.option_c,
          option_d: candidate.option_d,
          correct_answer: candidate.correct_answer,
          explanation: candidate.explanation,
          status: 'approved',
          ai_review_status: 'repaired_approved',
          ai_verdict: 'repair',
          ai_confidence: Number(rv.confidence),
          ai_notes: rv.notes || 'AI repaired and passed deterministic validation',
          ai_reviewed_at: new Date().toISOString()
        }).eq('id', q.id);
        if (upErr) throw upErr;
        repaired++; approved++; results.push({ id: q.id, status: 'approved', confidence: Number(rv.confidence) });
      } else {
        await sb.from('questions').update({
          ai_review_status: 'needs_correction',
          ai_verdict: 'keep_review',
          ai_confidence: 0,
          ai_notes: rv.notes || 'AI could not safely repair; manual review required',
          ai_reviewed_at: new Date().toISOString()
        }).eq('id', q.id);
        kept++; results.push({ id: q.id, status: 'pending_review', confidence: 0 });
      }
    } catch (e) {
      await sb.from('questions').update({
        ai_review_status: 'repair_error',
        ai_verdict: 'review',
        ai_confidence: 0,
        ai_notes: `AI repair process interrupted: ${sanitizeString(e?.message || 'Unknown processing error', 100)}`,
        ai_reviewed_at: new Date().toISOString()
      }).eq('id', q.id);
      kept++; results.push({ id: q.id, status: 'pending_review', confidence: 0 });
    }
  }
  return res.status(200).json({ ok: true, processed: rows?.length || 0, repaired, approved, kept, results });
}

export default withApiLogging(handler, 'ai-repair');
