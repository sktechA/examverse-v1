import {
  getSupabaseAdmin,
  getGeminiClient,
  normalizeText,
  validateQuestionDeterministic,
  verifyAdminAuth,
  cleanJsonParse,
  handleCorsAndOptions
} from './_shared.js';

export default async function handler(req, res) {
  if (handleCorsAndOptions(req, res, ['POST', 'OPTIONS'])) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST required' });
  }

  const sb = getSupabaseAdmin(req);
  if (!sb) {
    return res.status(500).json({ error: 'Database server configuration unavailable' });
  }

  // Authorization Check
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) {
    return res.status(auth.statusCode || 401).json({ error: auth.error });
  }

  try {
    const {
      questions = [],
      threshold = 0.93,
      forceAi = false,
      saveToDb = false
    } = req.body || {};

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions array is required' });
    }

    // Clamped batch limit (max 25 questions)
    const limitedQuestions = questions.slice(0, 25);
    const gemini = getGeminiClient();
    const isAiGloballyEnabled = (process.env.GEMINI_AI_ENABLED === 'true') || forceAi;

    const results = [];
    let approvedCount = 0;
    let reviewCount = 0;
    let rejectedCount = 0;

    // Load pool of existing questions for duplicate check
    let existingPool = [];
    try {
      const { data } = await sb
        .from('questions')
        .select('id, question, option_a, option_b, option_c, option_d')
        .limit(300);
      existingPool = data || [];
    } catch (_) {}

    // Step 1: Deterministic validation on each question
    const pendingForAi = [];
    for (let i = 0; i < limitedQuestions.length; i++) {
      const q = limitedQuestions[i];
      const det = validateQuestionDeterministic(q, {
        requireSource: q.subject === 'Current Affairs'
      });

      const normText = normalizeText(q.question);
      const isDuplicate = existingPool.some(
        ex => ex.id !== q.id && normalizeText(ex.question) === normText
      );

      if (!det.valid) {
        results.push({
          index: i,
          id: q.id,
          question: q.question,
          status: 'needs_correction',
          approved: false,
          deterministic_valid: false,
          duplicate: isDuplicate,
          confidence: 0,
          notes: det.errors.join('; '),
          ai_validated: false
        });
        reviewCount++;
      } else if (isDuplicate) {
        results.push({
          index: i,
          id: q.id,
          question: q.question,
          status: 'rejected',
          approved: false,
          deterministic_valid: true,
          duplicate: true,
          confidence: 0.99,
          notes: 'Exact duplicate of existing question in question bank',
          ai_validated: false
        });
        rejectedCount++;
      } else {
        pendingForAi.push({ index: i, questionData: q });
      }
    }

    // Step 2: Gemini validation
    if (pendingForAi.length > 0) {
      if (isAiGloballyEnabled && gemini) {
        try {
          const aiBatchInput = pendingForAi.map(p => ({
            index: p.index,
            question: p.questionData.question,
            option_a: p.questionData.option_a,
            option_b: p.questionData.option_b,
            option_c: p.questionData.option_c,
            option_d: p.questionData.option_d,
            correct_answer: p.questionData.correct_answer,
            explanation: p.questionData.explanation || '',
            subject: p.questionData.subject || '',
            topic: p.questionData.topic || ''
          }));

          const prompt = `You are a competitive-exam quality controller. Verify each question independently.
Check accuracy, single correct answer, and distinct plausible options.
Return JSON:
{
  "reviews": [
    {
      "index": 0,
      "confidence": 0.95,
      "correct_answer_verified": true,
      "options_quality_ok": true,
      "factual_accuracy_ok": true,
      "notes": "Verified against syllabus standards"
    }
  ]
}`;

          const response = await Promise.race([
            gemini.models.generateContent({
              model: process.env.GEMINI_REVIEW_MODEL_ID || 'gemini-3.8-flash',
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: prompt },
                    { text: JSON.stringify({ questions: aiBatchInput }) }
                  ]
                }
              ],
              config: { responseMimeType: 'application/json' }
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Gemini validation request timed out after 15s')), 15000)
            )
          ]);

          const rawText = response.text || '{}';
          const parsed = cleanJsonParse(rawText);
          const reviews = Array.isArray(parsed.reviews) ? parsed.reviews : [];

          for (const item of pendingForAi) {
            const rev = reviews.find(r => r.index === item.index);
            const conf = Number(rev?.confidence || 0);

            const meetsThreshold =
              rev &&
              conf >= threshold &&
              rev.correct_answer_verified !== false &&
              rev.options_quality_ok !== false &&
              rev.factual_accuracy_ok !== false;

            if (meetsThreshold) {
              results.push({
                index: item.index,
                id: item.questionData.id,
                question: item.questionData.question,
                status: 'approved',
                approved: true,
                deterministic_valid: true,
                duplicate: false,
                confidence: conf,
                notes: rev.notes || 'Verified by Gemini AI',
                ai_validated: true
              });
              approvedCount++;
            } else {
              // Failed confidence threshold or quality check
              results.push({
                index: item.index,
                id: item.questionData.id,
                question: item.questionData.question,
                status: 'pending_review',
                approved: false,
                deterministic_valid: true,
                duplicate: false,
                confidence: conf,
                notes: rev?.notes || `Confidence ${conf} < threshold ${threshold}; kept in pending_review`,
                ai_validated: true
              });
              reviewCount++;
            }
          }
        } catch (aiErr) {
          // GEMINI FAILED/TIMED OUT: NEVER AUTO-APPROVE (Requirement 2 & 3)
          console.warn('[Gemini Validate Fallback]:', aiErr.message);
          for (const item of pendingForAi) {
            results.push({
              index: item.index,
              id: item.questionData.id,
              question: item.questionData.question,
              status: 'pending_review',
              approved: false,
              deterministic_valid: true,
              duplicate: false,
              confidence: 0, // Zero fake confidence
              notes: `AI validation failed (${aiErr.message}); flagged for admin review`,
              ai_validated: false
            });
            reviewCount++;
          }
        }
      } else {
        // GEMINI IS DISABLED:
        // Do NOT pretend that Gemini ran. Zero fake confidence. Status is pending_review.
        for (const item of pendingForAi) {
          results.push({
            index: item.index,
            id: item.questionData.id,
            question: item.questionData.question,
            status: 'pending_review',
            approved: false,
            deterministic_valid: true,
            duplicate: false,
            confidence: 0,
            notes: 'Passed deterministic checks; awaiting manual admin review (AI disabled)',
            ai_validated: false
          });
          reviewCount++;
        }
      }
    }

    // Step 3: Save to DB if requested and id is present
    if (saveToDb && sb) {
      for (const resItem of results) {
        if (!resItem.id) continue;
        await sb
          .from('questions')
          .update({
            status: resItem.status,
            ai_review_status: resItem.status,
            ai_confidence: resItem.confidence,
            ai_notes: resItem.notes,
            ai_reviewed_at: new Date().toISOString()
          })
          .eq('id', resItem.id);
      }
    }

    return res.status(200).json({
      ok: true,
      total_tested: limitedQuestions.length,
      approved_count: approvedCount,
      review_count: reviewCount,
      rejected_count: rejectedCount,
      results
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Validation request failed'
    });
  }
}
