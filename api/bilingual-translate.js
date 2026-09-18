import {
  getSupabaseAdmin,
  getGeminiClient,
  verifyAdminAuth,
  callGeminiWithRetry,
  getNormalizedGeminiModel,
  cleanJsonParse,
  cleanAnswer,
  withApiLogging,
  isValidUuid,
  sanitizeObject,
  sanitizeErrorResponse,
  checkRateLimit,
  getClientIp
} from './_shared.js';

/**
 * Translates a competitive-exam MCQ between English and Hindi using Gemini.
 * Preserves the exact 1-to-1 option mapping and mathematical/factual integrity.
 */
async function translateQuestionWithGemini(gemini, q) {
  const hasEn = Boolean(q.question && /[a-zA-Z]/.test(q.question));
  const hasHi = Boolean(
    q.question_hi ||
    (q.question && /[\u0900-\u097F]/.test(q.question))
  );

  let sourceLang = 'en';
  let targetLang = 'hi';

  if (!hasEn && hasHi) {
    sourceLang = 'hi';
    targetLang = 'en';
  }

  const prompt = `You are an expert bilingual competitive examination translator for Indian public exams (IBPS, SSC, State PSC, Railway).
Translate this multiple choice question from ${sourceLang === 'en' ? 'English to Hindi (Devanagari script)' : 'Hindi to English'}.

CRITICAL REQUIREMENTS:
1. Translate accurately into standard Indian competitive exam terminology.
2. Keep numbers, algebraic expressions, mathematical symbols, proper nouns, and formulas exact.
3. Keep the 4 options strictly aligned with the source options (Option A must translate Option A, Option B must translate Option B, etc.).
4. Do NOT change the correct answer or invent new facts.
5. Return JSON only with format:
{
  "question": "string (translated question)",
  "option_a": "string (translated option A)",
  "option_b": "string (translated option B)",
  "option_c": "string (translated option C)",
  "option_d": "string (translated option D)",
  "explanation": "string (translated explanation or step-by-step solution)"
}

Source Question Details:
- Question: ${sourceLang === 'en' ? (q.question || '') : (q.question_hi || q.question || '')}
- Option A: ${sourceLang === 'en' ? (q.option_a || '') : (q.option_a_hi || q.option_a || '')}
- Option B: ${sourceLang === 'en' ? (q.option_b || '') : (q.option_b_hi || q.option_b || '')}
- Option C: ${sourceLang === 'en' ? (q.option_c || '') : (q.option_c_hi || q.option_c || '')}
- Option D: ${sourceLang === 'en' ? (q.option_d || '') : (q.option_d_hi || q.option_d || '')}
- Explanation: ${sourceLang === 'en' ? (q.explanation || '') : (q.explanation_hi || q.explanation || '')}
- Subject: ${q.subject || ''}`;

  const response = await callGeminiWithRetry(
    () =>
      gemini.models.generateContent({
        model: getNormalizedGeminiModel(process.env.GEMINI_REVIEW_MODEL_ID),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json'
        }
      }),
    {
      operationName: `Bilingual Translation (${sourceLang} -> ${targetLang})`,
      maxRetries: 3,
      timeoutMs: 20000
    }
  );

  const parsed = cleanJsonParse(response?.text || '{}');

  if (sourceLang === 'en') {
    return {
      question: q.question,
      question_hi: parsed.question || q.question_hi || '',
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      option_a_hi: parsed.option_a || q.option_a_hi || '',
      option_b_hi: parsed.option_b || q.option_b_hi || '',
      option_c_hi: parsed.option_c || q.option_c_hi || '',
      option_d_hi: parsed.option_d || q.option_d_hi || '',
      explanation: q.explanation,
      explanation_hi: parsed.explanation || q.explanation_hi || '',
      language: 'English + Hindi'
    };
  } else {
    return {
      question: parsed.question || q.question || '',
      question_hi: q.question_hi || q.question || '',
      option_a: parsed.option_a || q.option_a || '',
      option_b: parsed.option_b || q.option_b || '',
      option_c: parsed.option_c || q.option_c || '',
      option_d: parsed.option_d || q.option_d || '',
      option_a_hi: q.option_a_hi || q.option_a || '',
      option_b_hi: q.option_b_hi || q.option_b || '',
      option_c_hi: q.option_c_hi || q.option_c || '',
      option_d_hi: q.option_d_hi || q.option_d || '',
      explanation: parsed.explanation || q.explanation || '',
      explanation_hi: q.explanation_hi || q.explanation || '',
      language: 'English + Hindi'
    };
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST method required' });
  }

  // 1. Autonomous Rate Limiting (Defense against abusive Gemini queries)
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, 'bilingual-translate', 20, 60000);
  if (!rate.allowed) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', String(rate.retryAfter));
    }
    return res.status(429).json({ ok: false, error: 'Too many requests. Please wait before triggering another translation batch.' });
  }

  const sb = getSupabaseAdmin(req);
  if (!sb) {
    return res.status(500).json({ ok: false, error: 'Database connection unavailable' });
  }

  // Admin auth check
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) {
    return res.status(auth.statusCode || 401).json({ ok: false, error: auth.error });
  }

  const gemini = req?.geminiClient || getGeminiClient();
  if (!gemini) {
    return res.status(503).json({
      ok: false,
      error: 'GEMINI_API_KEY is not configured on the server. AI translation unavailable.'
    });
  }

  // Request can pass either question_ids (to update DB directly) or questions array (for uploaded items)
  const body = sanitizeObject(req.body || {});
  const rawQuestionIds = Array.isArray(body?.question_ids) ? body.question_ids : [];
  const questionIds = rawQuestionIds
    .filter(id => typeof id === 'string' && isValidUuid(id.trim()))
    .map(id => id.trim())
    .slice(0, 30);

  const rawQuestions = Array.isArray(body?.questions)
    ? body.questions.slice(0, 30).map(q => sanitizeObject(q))
    : [];

  let itemsToTranslate = [];

  if (questionIds.length) {
    const { data, error } = await sb
      .from('questions')
      .select('*')
      .in('id', questionIds);
    if (error) {
      return res.status(500).json({ ok: false, error: sanitizeErrorResponse(error, 'Database error during question translation lookup') });
    }
    itemsToTranslate = data || [];
  } else if (rawQuestions.length) {
    itemsToTranslate = rawQuestions;
  } else {
    // If no questions passed, grab up to 15 pending questions that are not yet bilingual
    const { data, error } = await sb
      .from('questions')
      .select('*')
      .in('status', ['pending_review', 'approved', 'needs_correction'])
      .or('question_hi.is.null,question_hi.eq.""')
      .order('created_at', { ascending: false })
      .limit(15);
    if (error) {
      return res.status(500).json({ ok: false, error: sanitizeErrorResponse(error, 'Database query error for untranslated questions') });
    }
    itemsToTranslate = data || [];
  }

  if (!itemsToTranslate.length) {
    return res.status(200).json({
      ok: true,
      translated_count: 0,
      message: 'No questions requiring translation found.',
      results: []
    });
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let quotaExceeded = false;
  let quotaNotice = '';

  for (const item of itemsToTranslate) {
    try {
      const translated = await translateQuestionWithGemini(gemini, item);

      // If item has a DB ID, update it in Supabase
      if (item.id) {
        const updatePayload = {
          question: translated.question,
          question_hi: translated.question_hi,
          option_a: translated.option_a,
          option_b: translated.option_b,
          option_c: translated.option_c,
          option_d: translated.option_d,
          option_a_hi: translated.option_a_hi,
          option_b_hi: translated.option_b_hi,
          option_c_hi: translated.option_c_hi,
          option_d_hi: translated.option_d_hi,
          explanation: translated.explanation,
          explanation_hi: translated.explanation_hi,
          language: 'English + Hindi'
        };

        const { error: upErr } = await sb
          .from('questions')
          .update(updatePayload)
          .eq('id', item.id);

        if (upErr) {
          console.warn(`[Translate] Failed to update question ${item.id}:`, upErr.message);
        }
      }

      results.push({
        id: item.id || null,
        success: true,
        ...translated
      });
      successCount++;
    } catch (err) {
      const isQuota = err?.isQuotaExhausted || /quota|resource_exhausted|429/i.test(err?.message || '');
      console.warn(`[Translate] Translation stopped for question ${item.id || 'record'}:`, isQuota ? 'Gemini Free-Tier Quota Limit Reached' : err.message);
      results.push({
        id: item.id || null,
        success: false,
        error: isQuota ? 'Gemini Free-tier API rate/quota limit reached. Batch safely halted.' : err.message,
        ...item
      });
      failCount++;

      if (isQuota) {
        quotaExceeded = true;
        quotaNotice = 'Gemini API free-tier quota limit reached. Translation batch safely paused to prevent further failed attempts.';
        console.info(`[Translate] Pausing remaining ${itemsToTranslate.length - results.length} items to preserve quota.`);
        break;
      }
    }
  }

  return res.status(200).json({
    ok: true,
    translated_count: successCount,
    failed_count: failCount,
    total: itemsToTranslate.length,
    quota_exceeded: quotaExceeded,
    message: quotaExceeded
      ? `${quotaNotice} Successfully translated ${successCount} question(s). You can resume after quota resets or upgrade API tier in Google AI Studio.`
      : `Successfully processed ${successCount}/${itemsToTranslate.length} questions.`,
    results
  });
}

export default withApiLogging(handler, 'bilingual-translate');
