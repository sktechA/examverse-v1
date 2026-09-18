import {
  getSupabaseAdmin,
  getGeminiClient,
  normalizeText,
  validateQuestionDeterministic,
  verifyAdminAuth,
  cleanJsonParse,
  callGeminiWithRetry,
  getNormalizedGeminiModel,
  handleCorsAndOptions,
  sanitizeObject,
  sanitizeString,
  sanitizeErrorResponse,
  checkRateLimit,
  getClientIp
} from './_shared.js';

async function writeLog(sb, level, source, action, message, details = {}, user_id = null) {
  try {
    await sb
      .from('system_logs')
      .insert({
        level: sanitizeString(level, 20),
        source: sanitizeString(source, 50),
        action: sanitizeString(action, 50),
        message: sanitizeString(message, 1000),
        details,
        user_id
      });
  } catch (_) {}
}

/**
 * Gemini Batch Question Review
 * Validates syllabus alignment, option plausibility, and answer veracity.
 * Enforces timeout and error safety.
 */
async function geminiBatchReview(questions, geminiClient) {
  const prompt = `You are a strict competitive-exam question quality controller. Review each question independently.
CRITICAL RULES:
1. Never invent facts or rewrite questions.
2. Verify if declared correct_answer is factually and logically the correct option.
3. Auto-publish ('publish') ONLY if confidence >= 0.93 and options are distinct and unambiguous.
4. If uncertain or error found, choose 'review'.
Return JSON only in format:
{
  "reviews": [
    {
      "index": 0,
      "verdict": "publish",
      "confidence": 0.95,
      "correct_answer_valid": true,
      "metadata_ok": true,
      "notes": "Verified against syllabus standards"
    }
  ]
}`;

  // 15 second timeout protection with exponential backoff retry against hung calls
  const response = await callGeminiWithRetry(
    () =>
      geminiClient.models.generateContent({
        model: getNormalizedGeminiModel(process.env.GEMINI_REVIEW_MODEL_ID),
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { text: JSON.stringify({ questions }) }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      }),
    {
      operationName: 'Gemini AI Batch Review',
      maxRetries: 3,
      timeoutMs: 15000,
      initialDelayMs: 1000
    }
  );

  const parsed = cleanJsonParse(response?.text || '{}');
  return Array.isArray(parsed.reviews) ? parsed.reviews : [];
}

export default async function handler(req, res) {
  if (handleCorsAndOptions(req, res, ['POST', 'OPTIONS'])) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST required' });
  }

  // 1. Autonomous Rate Limiting (Protects Gemini quota & server load)
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, 'ai-review', 20, 60000);
  if (!rate.allowed) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', String(rate.retryAfter));
    }
    return res.status(429).json({ ok: false, error: 'Too many requests. Please wait before triggering another AI review batch.' });
  }

  const sb = getSupabaseAdmin(req);
  if (!sb) {
    return res.status(500).json({ ok: false, error: 'Database server configuration unavailable' });
  }

  // 2. Admin Authorization Verification
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) {
    return res.status(auth.statusCode || 401).json({ ok: false, error: auth.error });
  }

  const user = auth.user;

  try {
    // 3. Batch Limit Protection (Max 25 per request to prevent cost abuse)
    const body = sanitizeObject(req.body || {});
    const rawLimit = Number(body?.limit || 20);
    const limit = Math.min(Math.max(rawLimit, 1), 25);

    // Fetch questions needing review that haven't been reviewed yet
    const { data: qs, error: qErr } = await sb
      .from('questions')
      .select('*')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (qErr) throw qErr;
    if (!qs?.length) {
      return res.status(200).json({ ok: true, processed: 0, approved: 0, rejected: 0, review: 0, needs: 0 });
    }

    let processed = 0, approved = 0, rejected = 0, review = 0, needs = 0;
    const deterministicValidCandidates = [];

    // 3. Deterministic Validation Pass
    for (const q of qs) {
      const val = validateQuestionDeterministic(q, {
        requireSource: q.subject === 'Current Affairs'
      });

      if (!val.valid) {
        // Marked as needs_correction, NEVER modified or rewritten automatically (Requirement 4)
        await sb
          .from('questions')
          .update({
            status: 'needs_correction',
            ai_review_status: 'needs_correction',
            ai_verdict: 'needs_correction',
            ai_confidence: 0,
            ai_notes: val.errors.join('; '),
            ai_reviewed_at: new Date().toISOString()
          })
          .eq('id', q.id);
        processed++;
        needs++;
        continue;
      }

      // Check duplicates against pool
      const { data: pool } = await sb
        .from('questions')
        .select('id, question, option_a, option_b, option_c, option_d, correct_answer, subject')
        .in('status', ['approved', 'pending_review'])
        .neq('id', q.id)
        .eq('subject', q.subject || '')
        .limit(100);

      const normQ = normalizeText(q.question);
      const exactDup = (pool || []).find(x => normalizeText(x.question) === normQ);

      if (exactDup) {
        await sb
          .from('questions')
          .update({
            status: 'rejected',
            ai_review_status: 'duplicate',
            ai_verdict: 'duplicate',
            ai_confidence: 0.99,
            ai_notes: 'Exact duplicate of existing question in question bank',
            duplicate_of: exactDup.id,
            ai_reviewed_at: new Date().toISOString()
          })
          .eq('id', q.id);
        processed++;
        rejected++;
        continue;
      }

      deterministicValidCandidates.push(q);
    }

    // 4. Gemini AI Review Pass (Strict Behavior: Item 2 & 3)
    const isGeminiEnabled = (process.env.GEMINI_AI_ENABLED === 'true') || Boolean(req.geminiClient);
    const geminiClient = req.geminiClient || (isGeminiEnabled ? getGeminiClient() : null);

    for (const q of deterministicValidCandidates) {
      let status = 'pending_review';
      let aiVerdict = 'deterministic_valid';
      let confidence = 0;
      let notes = 'Passed deterministic checks; pending admin approval';
      let aiReviewedAt = new Date().toISOString();

      if (isGeminiEnabled && geminiClient) {
        try {
          const aiInput = [{
            question: q.question,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            subject: q.subject,
            topic: q.topic,
            exam: q.exam
          }];

          const reviews = await geminiBatchReview(aiInput, geminiClient);
          const rv = reviews[0];

          if (rv && rv.verdict === 'publish' && Number(rv.confidence) >= 0.93 && rv.correct_answer_valid !== false) {
            status = 'approved';
            aiVerdict = 'publish';
            confidence = Number(rv.confidence);
            notes = rv.notes || 'Verified by Gemini AI quality check';
            approved++;
          } else if (rv && (rv.verdict === 'reject' || rv.verdict === 'duplicate')) {
            status = 'rejected';
            aiVerdict = rv.verdict;
            confidence = Number(rv.confidence || 0);
            notes = rv.notes || 'Flagged by quality controller';
            rejected++;
          } else {
            status = 'pending_review';
            aiVerdict = 'review';
            confidence = Number(rv?.confidence || 0);
            notes = rv?.notes || 'Flagged for admin manual review';
            review++;
          }
        } catch (aiErr) {
          // If Gemini fails/times out: DO NOT AUTO-APPROVE (Requirement 2 & 3)
          console.warn('[Gemini AI Review Error]:', aiErr.message);
          status = 'pending_review';
          aiVerdict = 'review_error';
          confidence = 0; // Zero fake confidence
          notes = `Gemini review failed (${aiErr.message}); kept in pending_review`;
          review++;

          await writeLog(
            sb,
            'warning',
            'gemini-review',
            'api-error',
            `Gemini evaluation error for question ${q.id}: ${aiErr.message}`,
            { question_id: q.id },
            user?.id
          );
        }
      } else {
        // Gemini is DISABLED:
        // Do NOT pretend Gemini ran. Zero fake confidence. Status is pending_review.
        status = 'pending_review';
        aiVerdict = 'deterministic_valid';
        confidence = 0;
        notes = 'Passed deterministic validation; awaiting manual admin review (AI disabled)';
        review++;
      }

      // Update question record WITHOUT rewriting any question or option text (Requirement 4 & 5)
      await sb
        .from('questions')
        .update({
          status,
          ai_review_status: aiVerdict,
          ai_verdict: aiVerdict,
          ai_confidence: confidence,
          ai_notes: notes,
          ai_reviewed_at: aiReviewedAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', q.id);

      processed++;
    }

    await writeLog(
      sb,
      'info',
      'gemini-review',
      'batch-review-completed',
      `Review completed: ${processed} processed (${approved} approved, ${rejected} rejected, ${review} pending review, ${needs} needs correction).`,
      { limit, ai_enabled: isGeminiEnabled },
      user?.id
    );

    return res.status(200).json({ ok: true, processed, approved, rejected, review, needs });
  } catch (err) {
    if (sb) {
      await writeLog(
        sb,
        'error',
        'gemini-review',
        'review-handler-failure',
        err?.message || String(err),
        {},
        user?.id
      );
    }
    return res.status(500).json({ ok: false, error: sanitizeErrorResponse(err, 'AI review process failed') });
  }
}
