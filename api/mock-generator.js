import {
  getSupabaseAdmin,
  getGeminiClient,
  isSubjectStrictMatch,
  isDependentContextMissing,
  computeQuestionNormalizedHash,
  isQuestionDuplicateInDb,
  verifyAdminAuth,
  handleCorsAndOptions,
  sanitizeObject,
  sanitizeString,
  sanitizeErrorResponse,
  checkRateLimit,
  getClientIp
} from './_shared.js';
import { generateUniqueQuestionsQuotaLoop } from './daily-scheduler.js';

export const BLUEPRINT_PRESETS = {
  'IBPS RRB PO': {
    title: 'IBPS RRB Officer Scale-I (PO) Prelims Mock',
    total_questions: 80,
    duration_minutes: 45,
    marks_per_question: 1.0,
    negative_marking: 0.25,
    sections: [
      { subject: 'Reasoning', count: 40 },
      { subject: 'Mathematics', count: 40 }
    ]
  },
  'IBPS RRB Clerk': {
    title: 'IBPS RRB Office Assistant (Clerk) Prelims Mock',
    total_questions: 80,
    duration_minutes: 45,
    marks_per_question: 1.0,
    negative_marking: 0.25,
    sections: [
      { subject: 'Reasoning', count: 40 },
      { subject: 'Mathematics', count: 40 }
    ]
  },
  'MP Sub Engineer': {
    title: 'MP Sub Engineer General Studies & Technical Mock',
    total_questions: 100,
    duration_minutes: 60,
    marks_per_question: 1.0,
    negative_marking: 0.0,
    sections: [
      { subject: 'General Awareness', count: 30 },
      { subject: 'Reasoning', count: 20 },
      { subject: 'Mathematics', count: 25 },
      { subject: 'Computer', count: 25 }
    ]
  },
  'MP Sub Engineer Technical & GS': {
    title: 'MP Sub Engineer Technical & General Studies CBT Mock',
    total_questions: 100,
    duration_minutes: 60,
    marks_per_question: 1.0,
    negative_marking: 0.0,
    sections: [
      { subject: 'Technical', count: 40 },
      { subject: 'General Awareness', count: 20 },
      { subject: 'Reasoning', count: 15 },
      { subject: 'Mathematics', count: 15 },
      { subject: 'Computer', count: 10 }
    ]
  },
  'Banking & Financial Awareness': {
    title: 'Banking & Financial Sector Special Mock',
    total_questions: 50,
    duration_minutes: 35,
    marks_per_question: 1.0,
    negative_marking: 0.25,
    sections: [
      { subject: 'Banking Awareness', count: 30 },
      { subject: 'Current Affairs', count: 20 }
    ]
  },
  'MPPSC Prelims': {
    title: 'MPPSC State Service Prelims Paper-I (GS) Mock',
    total_questions: 100,
    duration_minutes: 120,
    marks_per_question: 2.0,
    negative_marking: 0.0,
    sections: [
      { subject: 'MP GK', count: 35 },
      { subject: 'General Awareness', count: 35 },
      { subject: 'Current Affairs', count: 30 }
    ]
  },
  'Daily Current Affairs': {
    title: 'Daily Current Affairs Practice Test',
    total_questions: 25,
    duration_minutes: 20,
    marks_per_question: 1.0,
    negative_marking: 0.25,
    sections: [
      { subject: 'Current Affairs', count: 25 }
    ]
  }
};

export default async function handler(req, res) {
  if (handleCorsAndOptions(req, res, ['POST', 'OPTIONS'])) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST required' });
  }

  // 1. Autonomous Rate Limiting (Prevents computational & DB exhaustion)
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, 'mock-generator', 20, 60000);
  if (!rate.allowed) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', String(rate.retryAfter));
    }
    return res.status(429).json({ ok: false, error: 'Too many requests. Please wait before generating more mock exams.' });
  }

  const sb = getSupabaseAdmin(req);
  if (!sb) {
    return res.status(500).json({ ok: false, error: 'Database server configuration unavailable' });
  }

  // 2. Authorization Check
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) {
    return res.status(auth.statusCode || 401).json({ ok: false, error: auth.error });
  }

  try {
    const body = sanitizeObject(req.body || {});

    // Strict 200 Unique Questions Quota Loop Handler
    if (['generate_quota', 'generate_questions', 'strict_quota_loop'].includes(body.action) || body.generateQuota) {
      const gemini = req.geminiClient || (process.env.GEMINI_AI_ENABLED === 'true' ? getGeminiClient() : null);
      if (!gemini) {
        return res.status(503).json({
          ok: false,
          error: 'Gemini AI service is not enabled or configured for dynamic generation'
        });
      }
      const quotaResult = await generateUniqueQuestionsQuotaLoop(sb, gemini, {
        targetQuota: body.quota || 200,
        subjects: body.subjects || ['Mathematics', 'Reasoning', 'Banking Awareness', 'Technical', 'Current Affairs'],
        retryOptions: { maxRetries: 3 }
      });
      return res.status(200).json({
        ok: true,
        action: 'generate_quota',
        ...quotaResult
      });
    }

    const examTitle = sanitizeString(body.examTitle || 'IBPS RRB PO', 100);
    const action = body.action === 'publish' ? 'publish' : 'preview';
    const rawMockCount = Number(body.mockCount || 1);
    const mockCount = Math.min(Math.max(rawMockCount, 1), 10);
    const blueprint = body.blueprint || null;

    const selectedBlueprint = blueprint || BLUEPRINT_PRESETS[examTitle] || {
      title: `${examTitle} Practice Mock`,
      total_questions: 50,
      duration_minutes: 45,
      marks_per_question: 1.0,
      negative_marking: 0.25,
      sections: [{ subject: 'General Awareness', count: 50 }]
    };

    // CRITICAL REQUIREMENT 6: Only pull status='approved' questions!
    // Never pull pending_review, needs_correction, or rejected questions.
    const { data: approvedPool, error: poolErr } = await sb
      .from('questions')
      .select('id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, subject, topic, difficulty, exam')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (poolErr) throw poolErr;

    // Never let malformed/duplicate records reach a candidate mock.
    const seenQuestionHashes = new Set();
    const allApproved = (approvedPool || []).filter(q => {
      const answer = String(q.correct_answer || '').trim().toUpperCase().match(/^[ABCD]$/)?.[0] || '';
      const fieldsComplete = [q.question, q.option_a, q.option_b, q.option_c, q.option_d].every(v => String(v || '').trim());
      if (!fieldsComplete || !answer) return false;
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d].map(x => String(x).toLowerCase().trim());
      if (new Set(opts).size < 4) return false;
      if (isDependentContextMissing(q.question)) return false;
      const normHash = computeQuestionNormalizedHash(q);
      if (!normHash || seenQuestionHashes.has(normHash)) return false;
      seenQuestionHashes.add(normHash);
      return true;
    });
    const generatedMocks = [];
    const shortages = [];

    for (let m = 1; m <= mockCount; m++) {
      const mockQuestions = [];
      const usedIdsInThisMock = new Set();

      for (const section of selectedBlueprint.sections) {
        // Strict Subject Isolation (Requirement 5):
        // Mathematics never gets Reasoning, Reasoning never gets Mathematics!
        const matchingForSection = allApproved.filter(q =>
          !usedIdsInThisMock.has(q.id) &&
          isSubjectStrictMatch(q.subject, section.subject)
        );

        if (matchingForSection.length < section.count) {
          shortages.push({
            section: section.subject,
            required: section.count,
            available: matchingForSection.length,
            shortage: section.count - matchingForSection.length
          });
        }

        // Take available matching questions up to count
        const selectedForSection = matchingForSection.slice(0, section.count);
        for (const q of selectedForSection) {
          usedIdsInThisMock.add(q.id);
          // Atomic record: keeps all options and answers strictly bundled together
          mockQuestions.push({
            id: q.id,
            question: q.question,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            subject: q.subject,
            topic: q.topic,
            difficulty: q.difficulty
          });
        }
      }

      const mockTitle = mockCount > 1
        ? `${selectedBlueprint.title} - Set ${m}`
        : selectedBlueprint.title;

      generatedMocks.push({
        title: mockTitle,
        total_questions: mockQuestions.length,
        required_questions: selectedBlueprint.total_questions,
        duration_minutes: selectedBlueprint.duration_minutes,
        marks_per_question: selectedBlueprint.marks_per_question,
        negative_marking: selectedBlueprint.negative_marking,
        has_shortage: mockQuestions.length < selectedBlueprint.total_questions,
        questions: mockQuestions
      });
    }

    // If 'publish' action was requested, insert into exams and exam_questions tables
    const publishedExams = [];
    if (action === 'publish') {
      for (const mock of generatedMocks) {
        // Insert exam with exact database configuration (Requirement 8)
        const { data: newExam, error: exErr } = await sb
          .from('exams')
          .insert({
            title: mock.title,
            description: `Official Practice Mock generated from approved question bank.`,
            total_questions: mock.total_questions,
            duration_minutes: mock.duration_minutes,
            marks_per_question: mock.marks_per_question,
            negative_marking: mock.negative_marking,
            randomize_questions: true,
            status: 'published',
            exam_type: 'mock',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (exErr) throw exErr;

        // Map atomic questions into exam_questions
        if (newExam && mock.questions.length > 0) {
          const mappings = mock.questions.map((q, idx) => ({
            exam_id: newExam.id,
            question_id: q.id,
            question_order: idx + 1
          }));

          const { error: mapErr } = await sb
            .from('exam_questions')
            .insert(mappings);

          if (mapErr) throw mapErr;
        }

        publishedExams.push(newExam);
      }
    }

    return res.status(200).json({
      ok: true,
      action,
      blueprint: selectedBlueprint.title,
      requested_mocks: mockCount,
      published_count: publishedExams.length,
      published_exams: publishedExams,
      shortages: shortages.length > 0 ? shortages : null,
      mocks: generatedMocks.map(g => ({
        title: g.title,
        questions_count: g.total_questions,
        required_count: g.required_questions,
        duration_minutes: g.duration_minutes,
        negative_marking: g.negative_marking,
        has_shortage: g.has_shortage
      }))
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: sanitizeErrorResponse(err, 'Mock generation failed')
    });
  }
}

export { generateUniqueQuestionsQuotaLoop };
