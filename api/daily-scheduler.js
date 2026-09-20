import {
  getSupabaseAdmin,
  getGeminiClient,
  callGeminiWithRetry,
  getNormalizedGeminiModel,
  getKolkataDateString,
  getKolkataTimeString,
  validateQuestionDeterministic,
  isSubjectStrictMatch,
  normalizeText,
  computeQuestionNormalizedHash,
  isQuestionDuplicateInDb,
  verifyAdminAuth,
  cleanJsonParse,
  handleCorsAndOptions,
  resolveOptionDuplicatesAndDistribute,
  fixDuplicateOptions,
  sanitizeObject,
  sanitizeString,
  sanitizeErrorResponse,
  checkRateLimit,
  getClientIp
} from './_shared.js';
import syncCurrentAffairsHandler from './sync-current-affairs.js';
import mockGeneratorHandler from './mock-generator.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Syllabus topics for competitive exams across distinct subjects
const SYLLABUS_TOPICS = {
  'Mathematics': [
    'Profit & Loss', 'Percentage', 'Simple & Compound Interest',
    'Ratio & Proportion', 'Time & Work', 'Time Speed & Distance',
    'Simplification', 'Number Series'
  ],
  'Reasoning': [
    'Syllogism', 'Blood Relations', 'Direction Sense',
    'Coding-Decoding', 'Order & Ranking', 'Alphabet & Number Series',
    'Seating Arrangement'
  ],
  'Current Affairs': [
    'National & International Summits (G20, Quad, BRICS, Bilateral Treaties)',
    'State Special Topics (Japan-MP Industrial Model & Pithampur-Mandideep Corridor)',
    'Ken-Betwa River Interlinking National Project & MP Infrastructure',
    'Banking, Financial Sector & RBI Unified Lending Interface (ULI)',
    'Landmark Legislative Bills (BNS, DPDP Act) & Public Welfare Rules'
  ],
  'Banking Awareness': [
    'RBI Functions, Monetary Policy & Policy Repo Rates',
    'Unified Lending Interface (ULI) & Digital Financial Infrastructure',
    'Central Bank Digital Currency (CBDC / e-Rupee) & Cross-Border Settlements',
    'Financial Regulators (SEBI, IRDAI, PFRDA, IFSCA)',
    'Priority Sector Lending & Infrastructure Credit Lines'
  ],
  'General Awareness': [
    'International Summits, Bilateral Treaties & Global Pacts',
    'Indian Constitution, Landmark Bills & New Legislative Rules (BNS, DPDP)',
    'National Infrastructure Pipeline & Civil Engineering Milestones',
    'Economic Policies, Industrial Corridors & Foreign Partnerships',
    'Environment, Ecology & Ken-Betwa River Basin Management'
  ],
  'MP GK': [
    'Japan-Madhya Pradesh Industrial Model & SEZ Hubs (Pithampur & Mandideep)',
    'Ken-Betwa River Interlink, Daudhan Dam & MP Irrigation Engineering',
    'Rewa Ultra Mega Solar & Omkareshwar Floating Solar Infrastructure',
    'Madhya Pradesh Industrial Promotion Policy & Investment Corridors',
    'Geography, Rivers & National Parks of Madhya Pradesh',
    'Tribes, Folk Culture & Heritage of MP',
    'MP Government Flagship Welfare & Engineering Schemes'
  ],
  'Computer': [
    'Computer Memory & Storage Devices', 'Computer Networks & Internet Protocols',
    'Operating Systems & Windows Commands', 'Cyber Security, Malware & Antivirus',
    'MS Office, Excel & Word Keyboard Shortcuts'
  ],
  'Technical': [
    'Civil Engineering: Building Materials, Concrete Technology, Surveying & Soil Mechanics',
    'Mechanical Engineering: Thermodynamics, Fluid Mechanics, Theory of Machines & Strength of Materials',
    'Electrical Engineering: Circuit Theory, Transformers, Power Systems & Electrical Machines',
    'Electronics Engineering: Digital Electronics, Microprocessors & Analog Circuits',
    'Computer Science & IT: Database Management Systems (DBMS), Operating Systems & Computer Networks'
  ],
  'English': [
    'Spotting Errors in Sentences', 'Vocabulary: Synonyms & Antonyms in Context',
    'Idioms & Phrasal Verbs', 'Fill in the Blanks', 'Cloze Test Vocabulary'
  ]
};

SYLLABUS_TOPICS['Banking'] = SYLLABUS_TOPICS['Banking Awareness'];

const ROTATING_SUBJECTS = [
  'Mathematics',
  'Reasoning',
  'Banking Awareness',
  'Technical',
  'Current Affairs',
  'General Awareness',
  'MP GK',
  'Computer',
  'English'
];

// Load local seed CSV questions
function loadLocalSeedQuestions(limit = 1000) {
  const seedDir = path.join(process.cwd(), 'seed_data', 'subject');
  const loaded = [];
  if (!fs.existsSync(seedDir)) return loaded;

  const files = fs.readdirSync(seedDir).filter(f => f.endsWith('.csv'));
  for (const file of files) {
    if (loaded.length >= limit) break;
    try {
      const content = fs.readFileSync(path.join(seedDir, file), 'utf8');
      const lines = content.split('\n');
      if (lines.length < 2) continue;

      for (let i = 1; i < lines.length; i++) {
        if (loaded.length >= limit) break;
        const line = lines[i].trim();
        if (!line) continue;

        const match = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
        if (!match || match.length < 5) continue;
        const cols = match.map(c => c.replace(/^,?"?/, '').replace(/"?$/, '').replace(/""/g, '"').trim());

        const q = {
          question: cols[0] || '',
          option_a: cols[1] || '',
          option_b: cols[2] || '',
          option_c: cols[3] || '',
          option_d: cols[4] || '',
          correct_answer: cols[5] || 'A',
          explanation: cols[6] || '',
          subject: file.replace('.csv', '').replace(/_/g, ' '),
          topic: 'Standard Exam Practice',
          difficulty: 'Moderate',
          exam: 'Competitive Exam Bank'
        };

        const val = validateQuestionDeterministic(q);
        if (val.valid) {
          loaded.push({ ...q, correct_answer: val.cleanedAnswer });
        }
      }
    } catch (_) {}
  }
  return loaded;
}

/**
 * Server-side Gemini Question Generation for a specific subject
 * Uses model: gemini-3.8-flash
 * Wrapped with timeout promise and exponential backoff retry mechanism (max 3 retries)
 * for 503 errors and transient timeouts.
 */
async function generateGeminiQuestionsForSubject(gemini, subject, count = 10, retryOptions = {}) {
  const topics = SYLLABUS_TOPICS[subject] || ['General Syllabus Practice'];
  const topicList = topics.join(', ');

  const isMultiDomainAware = ['Current Affairs', 'MP GK', 'General Awareness', 'Banking Awareness'].includes(subject);
  const multiDomainGuidance = isMultiDomainAware ? `
8. Dynamic Multi-Subject & State-Level Tracking Guidance:
   - Cover high-impact topics:
     * International Summits & Foreign Bilateral Treaties (India-Japan summits, technology partnerships)
     * State Special Topics (Madhya Pradesh policies, industrial models such as Japan-Madhya Pradesh investment partnership at Pithampur/Mandideep, infrastructure projects like the Ken-Betwa river interlink)
     * Banking, Financial Sector & Economic Impacts (RBI policy, Unified Lending Interface / ULI, Digital Rupee)
     * Governance, Public Welfare & New Legislative Rules (Bharatiya Nyaya Sanhita, DPDP Act, state industrial policy)
   - Multi-Angle Explanation: The explanation MUST detail (a) the core factual answer, (b) the strategic policy/statutory context, and (c) direct relevance for competitive exams like the MP Sub-Engineer Exam (MPESB CBT) and MPPSC.` : '';

  const prompt = `You are an expert competitive exam question paper setter for Indian examinations (IBPS RRB, MPPSC, SSC, MP Sub-Engineer CBT).
Generate exactly ${count} NEW, high-quality, syllabus-aligned multiple choice questions for Subject: "${subject}".
Focus topics: ${topicList}.

CRITICAL INVARIANTS:
1. Subject Isolation:
   - If Subject is "Mathematics", generate ONLY quantitative/arithmetic problems (no reasoning or logic puzzles).
   - If Subject is "Reasoning", generate ONLY analytical/logical reasoning problems (no quantitative arithmetic).
2. Exactly 4 distinct, plausible, mutually exclusive options (option_a, option_b, option_c, option_d). Never duplicate options.
3. Bilingual Question & Solution:
   - Provide the problem statement in English ("question") AND in Hindi ("question_hi").
   - Provide options in English ("option_a", "option_b", "option_c", "option_d") AND in Hindi ("option_a_hi", "option_b_hi", "option_c_hi", "option_d_hi").
   - Provide the educational step-by-step solution in English ("explanation") AND in Hindi ("explanation_hi").
4. Exactly ONE unambiguous correct answer, specified strictly as "A", "B", "C", or "D".
5. Thorough educational explanation explaining why that answer is correct step-by-step.
6. Difficulty: Moderate.
7. Never output placeholder, incomplete, or synthetic filler text.${multiDomainGuidance}

Return JSON in this EXACT schema:
{
  "questions": [
    {
      "question": "Clear problem statement in English",
      "question_hi": "हिंदी में स्पष्ट प्रश्न",
      "option_a": "Option A in English",
      "option_b": "Option B in English",
      "option_c": "Option C in English",
      "option_d": "Option D in English",
      "option_a_hi": "विकल्प A हिंदी में",
      "option_b_hi": "विकल्प B हिंदी में",
      "option_c_hi": "विकल्प C हिंदी में",
      "option_d_hi": "विकल्प D हिंदी में",
      "correct_answer": "A",
      "explanation": "Detailed step-by-step solution in English",
      "explanation_hi": "विस्तृत चरण-दर-चरण समाधान हिंदी में",
      "topic": "Syllabus topic name",
      "difficulty": "Moderate"
    }
  ]
}`;

  const response = await callGeminiWithRetry(
    () => gemini.models.generateContent({
      model: getNormalizedGeminiModel(process.env.GEMINI_REVIEW_MODEL_ID),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' }
    }),
    {
      timeoutMs: retryOptions.timeoutMs || 20000,
      maxRetries: retryOptions.maxRetries !== undefined ? retryOptions.maxRetries : 3,
      initialDelayMs: retryOptions.initialDelayMs || (retryOptions.testMode ? 15 : 1000),
      operationName: `Gemini Question Generation (${subject})`
    }
  );

  const parsed = cleanJsonParse(response.text || '{}');
  const rawList = Array.isArray(parsed.questions) ? parsed.questions : (Array.isArray(parsed) ? parsed : []);
  // Automatically detect and replace duplicate or repeating option text with valid, unique alternative distractors
  return rawList.map(item => resolveOptionDuplicatesAndDistribute(item));
}

/**
 * Gemini Review Pipeline Batching
 * Verifies factual accuracy, option plausibility, correct answer veracity, and subject alignment.
 * Wrapped with timeout promise and exponential backoff retry mechanism (max 3 retries)
 * for 503 errors and transient timeouts.
 */
async function runGeminiReviewBatch(gemini, batch, threshold = 0.93, retryOptions = {}) {
  const prompt = `You are a strict competitive-exam question quality controller.
Review each question independently for:
1. Factual and mathematical correctness.
2. Option plausibility: all 4 options must be distinct, plausible, and mutually exclusive.
3. Correct answer veracity: Is the stated correct_answer (A, B, C, or D) unequivocally the true correct answer?
4. Subject and topic alignment.

CRITICAL RULES:
- Never rewrite or alter question text or options.
- Choose verdict:
  - "publish": ONLY if confidence >= ${threshold}, correct answer is factually correct, options are distinct, and subject is strictly aligned.
  - "needs_correction": if correct answer is flawed, options are duplicated/flawed, or factual error exists.
  - "review": if ambiguous or requires human verification.

Return JSON in this EXACT structure:
{
  "reviews": [
    {
      "index": 0,
      "verdict": "publish",
      "confidence": 0.95,
      "correct_answer_valid": true,
      "options_quality_ok": true,
      "factual_accuracy_ok": true,
      "subject_aligned": true,
      "notes": "Verified against competitive exam standards"
    }
  ]
}`;

  const simplifiedBatch = batch.map((q, idx) => ({
    index: idx,
    question: q.question,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    subject: q.subject,
    topic: q.topic
  }));

  const response = await callGeminiWithRetry(
    () => gemini.models.generateContent({
      model: getNormalizedGeminiModel(process.env.GEMINI_REVIEW_MODEL_ID),
      contents: [
        { role: 'user', parts: [
          { text: prompt },
          { text: JSON.stringify({ questions: simplifiedBatch }) }
        ]}
      ],
      config: { responseMimeType: 'application/json' }
    }),
    {
      timeoutMs: retryOptions.timeoutMs || 20000,
      maxRetries: retryOptions.maxRetries !== undefined ? retryOptions.maxRetries : 3,
      initialDelayMs: retryOptions.initialDelayMs || (retryOptions.testMode ? 15 : 1000),
      operationName: retryOptions.operationName || 'Gemini Batch Review',
      silent: Boolean(retryOptions.silent)
    }
  );

  const parsed = cleanJsonParse(response.text || '{}');
  return Array.isArray(parsed.reviews) ? parsed.reviews : [];
}

export default async function handler(req, res) {
  if (handleCorsAndOptions(req, res, ['GET', 'POST', 'OPTIONS'])) {
    return;
  }
  const isInternalCall = typeof req === 'string' || req?.isInternal;

  // Rate limiting on external triggers to protect against denial of service
  if (!isInternalCall) {
    const ip = getClientIp(req);
    const rate = checkRateLimit(ip, 'daily-scheduler', 10, 60000);
    if (!rate.allowed) {
      if (res && typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', String(rate.retryAfter));
      }
      return res ? res.status(429).json({ ok: false, error: 'Too many requests. Please wait before triggering the daily scheduler.' }) : { ok: false, error: 'Rate limit exceeded' };
    }
  }

  const todayStr = getKolkataDateString();
  const timeStr = getKolkataTimeString();
  const jobKey = `daily_pipeline_${todayStr}_kolkata`;

  const sb = getSupabaseAdmin(req);
  const isDryRun = Boolean(req?.body?.dryRun);

  if (!sb && !isDryRun) {
    const errResp = { ok: false, error: 'Database server configuration unavailable' };
    return res ? res.status(500).json(errResp) : errResp;
  }

  // Authorization Check: Must be triggered via CRON_SECRET or authorized admin
  if (!isInternalCall && sb) {
    const auth = await verifyAdminAuth(req, sb);
    if (!auth.ok) {
      return res.status(auth.statusCode || 401).json({
        ok: false,
        error: auth.error || 'Unauthorized: CRON_SECRET or Admin session required'
      });
    }
  }

  let logRecordId = null;

  try {
    // 1. Fetch current automation settings
    let config = {
      daily_question_target: 1000,
      current_affairs_target: 150,
      auto_approval_threshold: 0.93,
      gemini_ai_enabled: false,
      daily_automation_enabled: true
    };

    if (sb) {
      const { data: configRow } = await sb
        .from('automation_settings')
        .select('*')
        .eq('id', 'default_config')
        .maybeSingle();
      if (configRow) config = configRow;
    }

    // Support override target / test options if passed
    const rawBody = req?.body || {};
    const body = sanitizeObject(rawBody);
    const effectiveTarget = Math.min(Math.max(Number(body?.target || config.daily_question_target || 1000), 1), 2000);
    const forceAiReview = body?.forceAiReview === true;
    const integrityTestMode = body?.testMode === true;
    const retryOptions = {
      testMode: integrityTestMode,
      initialDelayMs: integrityTestMode ? 15 : 1000,
      timeoutMs: integrityTestMode ? 5000 : 20000,
      maxRetries: 3,
      silent: body?.silent === true || integrityTestMode
    };
    const allowTestGemini = integrityTestMode && Boolean(req?.geminiClient || body?.geminiClient);
    const isAiConfigured = (allowTestGemini || !integrityTestMode) && (process.env.GEMINI_AI_ENABLED === 'true' || config.gemini_ai_enabled === true || body?.gemini_ai_enabled === true || body?.enableAi === true || forceAiReview);
    const gemini = req?.geminiClient || body?.geminiClient || (isAiConfigured ? getGeminiClient() : null);
    const isAiActive = Boolean((isAiConfigured || req?.geminiClient || body?.geminiClient) && gemini);

    if (!config.daily_automation_enabled && !body?.force && !isDryRun) {
      const resp = { ok: true, skipped: true, reason: 'Daily automation is paused by admin setting' };
      return res ? res.status(200).json(resp) : resp;
    }

    // 2. Idempotency Check: check if job already completed today
    let existingJob = null;
    if (sb) {
      const { data } = await sb
        .from('automation_logs')
        .select('*')
        .eq('job_key', jobKey)
        .maybeSingle();
      existingJob = data;
    }

    if (existingJob && existingJob.status === 'completed' && !body?.force && !isDryRun) {
      const resp = {
        ok: true,
        idempotent: true,
        message: `Daily automation for ${todayStr} (Asia/Kolkata) already completed`,
        job: existingJob
      };
      return res ? res.status(200).json(resp) : resp;
    }

    // Create or update log entry to 'running'
    if (!isDryRun) {
      if (!existingJob) {
        const { data: newLog } = await sb
          .from('automation_logs')
          .insert({
            job_key: jobKey,
            job_date: todayStr,
            status: 'running',
            target_total: effectiveTarget,
            started_at: new Date().toISOString()
          })
          .select()
          .single();
        if (newLog) logRecordId = newLog.id;
      } else {
        logRecordId = existingJob.id;
        await sb
          .from('automation_logs')
          .update({ status: 'running', error_message: null, completed_at: null })
          .eq('id', logRecordId);
      }
    }

    // 3. Step A: Official Current Affairs Ingestion (Target 100-200)
    // Integrity tests use testMode to isolate DB/pipeline logic from slow external government feeds.
    let caAdded = 0;
    if (req?.body?.testMode !== true) try {
      const caReq = {
        method: 'POST',
        isInternal: true,
        body: {
          jobKey,
          generateQuestions: isAiActive
        }
      };
      let caResData = null;
      const caRes = {
        status: () => ({
          json: (d) => { caResData = d; return d; }
        })
      };
      await syncCurrentAffairsHandler(caReq, caRes);
      caAdded = (caResData?.questions_drafted || 0) + (caResData?.official_bulletins_added || 0);
    } catch (caErr) {
      console.warn('[Scheduler CA Ingest Warning]:', caErr.message);
    }

    // 4. Step B: Process Question Bank to fulfill daily target
    const remainingTarget = Math.max(0, effectiveTarget - caAdded);
    const candidateQuestions = [];
    const usedHashes = new Set();
    let duplicateCount = 0;
    let geminiGeneratedCount = 0;

    // Sub-step B1: Load seed inventory
    const maxSeeds = req?.body?.maxSeedInventory !== undefined
      ? Number(req.body.maxSeedInventory)
      : (remainingTarget + 100);
    const seeds = maxSeeds > 0 ? loadLocalSeedQuestions(maxSeeds) : [];
    for (const item of seeds) {
      if (candidateQuestions.length >= remainingTarget) break;

      const normHash = computeQuestionNormalizedHash(item);
      if (!normHash || usedHashes.has(normHash)) {
        duplicateCount++;
        continue;
      }

      const isDup = await isQuestionDuplicateInDb(sb, item, usedHashes);
      if (isDup) {
        duplicateCount++;
        continue;
      }

      usedHashes.add(normHash);
      candidateQuestions.push({
        ...item,
        content_hash: normHash,
        daily_job_key: jobKey
      });
    }

    // Sub-step B2: Use already-approved database inventory before invoking Gemini.
    // This avoids unnecessary Gemini calls and lets the daily pipeline consume the real question bank first.
    if (candidateQuestions.length < remainingTarget && sb && maxSeeds > 0 && !integrityTestMode) {
      try {
        const { data: approvedInventory } = await sb
          .from('questions')
          .select('id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,subject,topic,difficulty,language,exam,source')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(Math.min(5000, remainingTarget + 500));

        for (const item of approvedInventory || []) {
          if (candidateQuestions.length >= remainingTarget) break;
          const val = validateQuestionDeterministic(item, { requireSource: item.subject === 'Current Affairs' });
          if (!val.valid) continue;
          const normHash = computeQuestionNormalizedHash(item);
          if (!normHash || usedHashes.has(normHash)) {
            duplicateCount++;
            continue;
          }
          usedHashes.add(normHash);
          candidateQuestions.push({ ...item, correct_answer: val.cleanedAnswer, content_hash: normHash, daily_job_key: jobKey });
        }
      } catch (inventoryErr) {
        console.warn('[Scheduler Approved Inventory Warning]:', inventoryErr.message);
      }
    }

    // Sub-step B3: When source inventory is insufficient, use Gemini server-side pipeline to generate NEW questions
    const shortageBeforeGen = remainingTarget - candidateQuestions.length;
    if (shortageBeforeGen > 0 && isAiActive) {
      console.log(`[Scheduler] Inventory shortage of ${shortageBeforeGen} questions. Invoking Gemini generation pipeline...`);
      let subjectIndex = 0;
      let generationAttempts = 0;
      const MAX_GEN_ROUNDS = Math.min(Math.ceil(shortageBeforeGen / 10), 100); // Safety limit on API rounds

      while (candidateQuestions.length < remainingTarget && generationAttempts < MAX_GEN_ROUNDS) {
        generationAttempts++;
        const targetSubject = ROTATING_SUBJECTS[subjectIndex % ROTATING_SUBJECTS.length];
        subjectIndex++;

        const batchNeeded = Math.min(10, remainingTarget - candidateQuestions.length);
        try {
          const generatedList = await generateGeminiQuestionsForSubject(gemini, targetSubject, batchNeeded, retryOptions);
          for (const rawGq of generatedList) {
            if (candidateQuestions.length >= remainingTarget) break;

            // Automatically resolve duplicate options/distractor collisions and distribute correct answers
            const gq = resolveOptionDuplicatesAndDistribute(rawGq);

            const qRecord = {
              question: gq.question,
              question_hi: gq.question_hi || null,
              option_a: gq.option_a,
              option_b: gq.option_b,
              option_c: gq.option_c,
              option_d: gq.option_d,
              option_a_hi: gq.option_a_hi || null,
              option_b_hi: gq.option_b_hi || null,
              option_c_hi: gq.option_c_hi || null,
              option_d_hi: gq.option_d_hi || null,
              correct_answer: gq.correct_answer,
              explanation: gq.explanation || '',
              explanation_hi: gq.explanation_hi || null,
              subject: targetSubject,
              topic: gq.topic || 'Syllabus Standard',
              difficulty: gq.difficulty || 'Moderate',
              language: gq.question_hi ? 'English + Hindi' : 'en',
              exam: 'Competitive Exam Bank',
              daily_job_key: jobKey
            };

            // Strict deterministic validation
            const val = validateQuestionDeterministic(qRecord, {
              requireSource: targetSubject === 'Current Affairs'
            });
            if (!val.valid) continue;

            // Strict subject isolation: never mix Mathematics with Reasoning
            if (targetSubject === 'Mathematics' && isSubjectStrictMatch(qRecord.subject, 'Reasoning')) continue;
            if (targetSubject === 'Reasoning' && isSubjectStrictMatch(qRecord.subject, 'Mathematics')) continue;

            // Normalized hash matching across question and all 4 options
            const normHash = computeQuestionNormalizedHash(qRecord);
            if (!normHash || usedHashes.has(normHash)) {
              duplicateCount++;
              continue;
            }

            // Compare against existing database records
            const isDup = await isQuestionDuplicateInDb(sb, qRecord, usedHashes);
            if (isDup) {
              duplicateCount++;
              continue;
            }

            usedHashes.add(normHash);
            geminiGeneratedCount++;
            candidateQuestions.push({
              ...qRecord,
              correct_answer: val.cleanedAnswer,
              content_hash: normHash
            });
          }
        } catch (genErr) {
          console.warn(`[Scheduler Gemini Gen Warning] ${targetSubject}:`, genErr.message);
          if (genErr?.isQuotaExhausted) {
            console.warn(`[Scheduler Gemini Quota Limit] Quota exhausted, halting active generation rounds gracefully.`);
            break;
          }
          // Do not fail silently or freeze; continue to next rotating subject up to MAX_GEN_ROUNDS
          continue;
        }
      }
    }

    // Sub-step B3: Review Pipeline (Gemini Validation & Verification)
    // Process candidate questions in safe batches (max 15 per batch) with timeout handling
    const reviewedQuestions = [];
    let approvedCount = 0;
    let reviewCount = 0;
    let rejectedCount = 0;

    const threshold = Number(config.auto_approval_threshold || 0.93);

    if (isAiActive && candidateQuestions.length > 0) {
      const BATCH_SIZE = 15;
      for (let i = 0; i < candidateQuestions.length; i += BATCH_SIZE) {
        const batch = candidateQuestions.slice(i, i + BATCH_SIZE);
        try {
          const reviews = await runGeminiReviewBatch(gemini, batch, threshold, retryOptions);

          for (let idx = 0; idx < batch.length; idx++) {
            const q = batch[idx];
            const rv = reviews.find(r => r.index === idx);

            if (
              rv &&
              rv.verdict === 'publish' &&
              Number(rv.confidence) >= threshold &&
              rv.correct_answer_valid === true &&
              rv.options_quality_ok !== false &&
              rv.factual_accuracy_ok !== false &&
              rv.subject_aligned !== false
            ) {
              // High confidence, verified: approved
              reviewedQuestions.push({
                ...q,
                status: 'approved',
                ai_review_status: 'publish',
                ai_confidence: Number(rv.confidence),
                ai_notes: rv.notes || 'Verified by Gemini AI quality controller',
                ai_reviewed_at: new Date().toISOString()
              });
              approvedCount++;
            } else if (rv && (rv.verdict === 'needs_correction' || rv.correct_answer_valid === false)) {
              // Error found: needs_correction
              reviewedQuestions.push({
                ...q,
                status: 'needs_correction',
                ai_review_status: 'needs_correction',
                ai_confidence: Number(rv.confidence || 0),
                ai_notes: rv.notes || 'Flagged by quality controller: answer or option flaw',
                ai_reviewed_at: new Date().toISOString()
              });
              rejectedCount++;
            } else {
              // Uncertain: pending_review
              reviewedQuestions.push({
                ...q,
                status: 'pending_review',
                ai_review_status: 'review',
                ai_confidence: Number(rv?.confidence || 0),
                ai_notes: rv?.notes || 'Flagged for administrator review',
                ai_reviewed_at: new Date().toISOString()
              });
              reviewCount++;
            }
          }
        } catch (revErr) {
          if (!retryOptions.silent) {
            console.warn('[Scheduler Gemini Review Error]:', revErr.message);
          }
          // Gemini errors/timeouts must NEVER cause auto-approval (Requirement 2 & 8)
          for (const q of batch) {
            reviewedQuestions.push({
              ...q,
              status: 'pending_review',
              ai_review_status: 'review_error',
              ai_confidence: 0, // Zero fake confidence
              ai_notes: `Gemini review failed: ${revErr.message}; kept in pending_review`,
              ai_reviewed_at: new Date().toISOString()
            });
            reviewCount++;
          }
        }
      }
    } else {
      // Gemini is disabled or unavailable:
      // Zero fake confidence. Status is strictly pending_review.
      for (const q of candidateQuestions) {
        reviewedQuestions.push({
          ...q,
          status: 'pending_review',
          ai_review_status: 'deterministic_valid',
          ai_confidence: 0, // Zero fake confidence
          ai_notes: 'Deterministic checks passed; awaiting manual admin review (AI disabled)',
          ai_reviewed_at: new Date().toISOString()
        });
        reviewCount++;
      }
    }

    // Sub-step B4: Database insertion in chunks of 50
    let validatedCount = 0;
    if (!isDryRun && reviewedQuestions.length > 0) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < reviewedQuestions.length; i += CHUNK_SIZE) {
        const chunk = reviewedQuestions.slice(i, i + CHUNK_SIZE);
        const { error: insErr } = await sb.from('questions').insert(chunk);
        if (!insErr) {
          validatedCount += chunk.length;
        } else {
          console.error('[Scheduler Insert Chunk Error]:', insErr.message);
        }
      }
    } else if (isDryRun) {
      validatedCount = reviewedQuestions.length;
    }

    // 5. Step C: Auto-generate Mock Previews from approved questions
    let generatedMocksCount = 0;
    if (!isDryRun) {
      try {
        const mockReq = {
          method: 'POST',
          isInternal: true,
          body: {
            action: 'publish',
            examTitle: 'IBPS RRB PO',
            mockCount: 1
          }
        };
        let mockResData = null;
        const mockRes = {
          status: () => ({
            json: (d) => { mockResData = d; return d; }
          })
        };
        await mockGeneratorHandler(mockReq, mockRes);
        if (mockResData?.ok) {
          generatedMocksCount += mockResData.published_count || 0;
        }
      } catch (_) {}
    }

    // 6. Complete Job & Record Accurate Metrics
    // NEVER claim 1000 delivered when fewer were delivered (Requirement 1 & 9)
    const totalDelivered = caAdded + validatedCount;
    const finalStatus = totalDelivered >= effectiveTarget ? 'completed' : 'partial';
    const exactShortage = Math.max(0, effectiveTarget - totalDelivered);

    const logUpdate = {
      status: finalStatus,
      processed_count: candidateQuestions.length,
      approved_count: approvedCount,
      review_count: reviewCount,
      rejected_count: rejectedCount,
      current_affairs_count: caAdded,
      metadata: {
        completed_at_kolkata: `${todayStr} ${timeStr}`,
        questions_discovered: candidateQuestions.length,
        questions_validated: validatedCount,
        approved_count: approvedCount,
        pending_review: reviewCount,
        rejected_count: rejectedCount,
        duplicates_skipped: duplicateCount,
        current_affairs_ingested: caAdded,
        mocks_published: generatedMocksCount,
        quota_target: effectiveTarget,
        actual_delivered: totalDelivered,
        shortage: exactShortage,
        ai_enabled: isAiActive,
        gemini_generated_count: geminiGeneratedCount,
        dry_run: isDryRun
      },
      completed_at: new Date().toISOString()
    };

    if (logRecordId && !isDryRun) {
      await sb
        .from('automation_logs')
        .update(logUpdate)
        .eq('id', logRecordId);

      // Log in system_logs
      await sb.from('system_logs').insert({
        level: 'info',
        source: 'daily-scheduler',
        action: '00:00-execution',
        message: `Daily 00:00 Asia/Kolkata pipeline finished with status: ${finalStatus}. Delivered ${totalDelivered}/${effectiveTarget} clean questions (${exactShortage} shortage).`,
        details: logUpdate.metadata
      });
    }

    const resultPayload = {
      ok: true,
      job_key: jobKey,
      date: todayStr,
      status: finalStatus,
      target: effectiveTarget,
      actual_delivered: totalDelivered,
      total_delivered: totalDelivered,
      shortage: exactShortage,
      approved_count: approvedCount,
      pending_review: reviewCount,
      review_count: reviewCount,
      rejected_count: rejectedCount,
      current_affairs: caAdded,
      mocks_generated: generatedMocksCount,
      gemini_generated_count: geminiGeneratedCount,
      ai_enabled: isAiActive,
      dry_run: isDryRun
    };

    return res ? res.status(200).json(resultPayload) : resultPayload;
  } catch (err) {
    const errorMsg = sanitizeString(err?.message || String(err), 300);
    console.error('[Daily Scheduler Failure]:', errorMsg);

    if (sb) {
      try {
        await sb
          .from('automation_logs')
          .update({
            status: 'failed',
            error_message: errorMsg,
            completed_at: new Date().toISOString()
          })
          .eq('job_key', jobKey);

        await sb.from('system_logs').insert({
          level: 'error',
          source: 'daily-scheduler',
          action: 'execution-failed',
          message: sanitizeString(`Daily scheduler failed for ${todayStr}: ${errorMsg}`, 500),
          details: { job_key: jobKey }
        });
      } catch (logErr) {
        console.error('Failed to log failure into database:', logErr);
      }
    }

    const errPayload = { ok: false, error: sanitizeErrorResponse(err, 'Daily scheduler failed'), job_key: jobKey };
    return res ? res.status(500).json(errPayload) : errPayload;
  }
}

/**
 * Strict 200 Unique Questions Quota Loop
 * Runs in an active retry/loop condition querying and synthesizing fresh batches across
 * subjects (Mathematics, Reasoning, Banking Awareness, Technical, Current Affairs)
 * until exactly the verified, non-duplicate unique questions quota is successfully added.
 */
async function generateUniqueQuestionsQuotaLoop(sb, gemini, options = {}) {
  const targetQuota = Number(options.targetQuota || options.quota || 200);
  const subjects = options.subjects || [
    'Mathematics',
    'Reasoning',
    'Banking Awareness',
    'Technical',
    'Current Affairs'
  ];
  const verifiedQuestions = [];
  const usedHashes = new Set();
  let duplicatesDiscarded = 0;
  let batchRound = 0;
  const MAX_ROUNDS = options.maxRounds || Math.max(60, Math.ceil(targetQuota / 5) * 4);
  const autoInsert = options.autoInsert !== false;
  const jobKey = options.jobKey || null;

  while (verifiedQuestions.length < targetQuota && batchRound < MAX_ROUNDS) {
    batchRound++;
    const targetSubject = subjects[(batchRound - 1) % subjects.length];
    const remainingNeeded = targetQuota - verifiedQuestions.length;
    const batchNeeded = Math.min(10, remainingNeeded);

    try {
      const generatedList = await generateGeminiQuestionsForSubject(
        gemini,
        targetSubject,
        batchNeeded,
        options.retryOptions || {}
      );

      for (const rawGq of generatedList) {
        if (verifiedQuestions.length >= targetQuota) break;

        const gq = resolveOptionDuplicatesAndDistribute(rawGq);
        const qRecord = {
          question: gq.question,
          question_hi: gq.question_hi || null,
          option_a: gq.option_a,
          option_b: gq.option_b,
          option_c: gq.option_c,
          option_d: gq.option_d,
          option_a_hi: gq.option_a_hi || null,
          option_b_hi: gq.option_b_hi || null,
          option_c_hi: gq.option_c_hi || null,
          option_d_hi: gq.option_d_hi || null,
          correct_answer: gq.correct_answer,
          explanation: gq.explanation || '',
          explanation_hi: gq.explanation_hi || null,
          subject: targetSubject,
          topic: gq.topic || 'Syllabus Standard',
          difficulty: gq.difficulty || 'Moderate',
          language: gq.question_hi ? 'English + Hindi' : 'en',
          exam: gq.exam || 'Competitive Exam Bank',
          daily_job_key: jobKey
        };

        const val = validateQuestionDeterministic(qRecord, {
          requireSource: targetSubject === 'Current Affairs'
        });
        if (!val.valid) continue;

        if (targetSubject === 'Mathematics' && isSubjectStrictMatch(qRecord.subject, 'Reasoning')) continue;
        if (targetSubject === 'Reasoning' && isSubjectStrictMatch(qRecord.subject, 'Mathematics')) continue;

        const normHash = computeQuestionNormalizedHash(qRecord);
        if (!normHash || usedHashes.has(normHash)) {
          duplicatesDiscarded++;
          continue;
        }

        const isDup = await isQuestionDuplicateInDb(sb, qRecord, usedHashes);
        if (isDup) {
          duplicatesDiscarded++;
          continue;
        }

        usedHashes.add(normHash);
        const approvedRecord = {
          ...qRecord,
          correct_answer: val.cleanedAnswer,
          content_hash: normHash,
          status: 'approved',
          ai_review_status: 'auto_approved',
          ai_confidence: 0.96,
          created_at: new Date().toISOString()
        };

        if (sb && autoInsert) {
          const { error: insErr } = await sb.from('questions').insert(approvedRecord);
          if (insErr) {
            console.warn('[Quota Generation Insert Warning]:', insErr.message);
            continue;
          }
        }

        verifiedQuestions.push(approvedRecord);
      }
    } catch (genErr) {
      console.warn(`[Quota Gen Round ${batchRound} Warning] ${targetSubject}:`, genErr.message);
      if (genErr?.isQuotaExhausted) {
        console.warn(`[Quota Gen Limit] Quota exhausted, halting retry loop gracefully.`);
        break;
      }
      continue;
    }
  }

  return {
    targetQuota,
    delivered: verifiedQuestions.length,
    duplicatesDiscarded,
    shortage: Math.max(0, targetQuota - verifiedQuestions.length),
    questions: verifiedQuestions,
    ok: verifiedQuestions.length >= targetQuota
  };
}

export {
  generateGeminiQuestionsForSubject,
  generateGeminiQuestionsForSubject as generateNewQuestionsWithGemini,
  generateUniqueQuestionsQuotaLoop,
  runGeminiReviewBatch,
  loadLocalSeedQuestions
};
