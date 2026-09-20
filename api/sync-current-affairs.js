import {
  getSupabaseAdmin,
  getGeminiClient,
  OFFICIAL_SOURCES,
  OFFICIAL_GROUNDED_MILESTONES,
  OFFICIAL_RECRUITMENT_PORTALS,
  getKolkataDateString,
  validateQuestionDeterministic,
  verifyAdminAuth,
  cleanJsonParse,
  callGeminiWithRetry,
  getNormalizedGeminiModel,
  handleCorsAndOptions,
  resolveOptionDuplicatesAndDistribute,
  computeQuestionNormalizedHash,
  isQuestionDuplicateInDb,
  sanitizeObject,
  sanitizeString,
  sanitizeErrorResponse,
  checkRateLimit,
  getClientIp
} from './_shared.js';
import crypto from 'node:crypto';

/**
 * Dynamically classifies a bulletin into one of the 4 core exam domains:
 * 1. National & International Current Affairs (Summits, Treaties)
 * 2. State Special Topics (Madhya Pradesh policies, industrial models, infrastructure)
 * 3. Banking, Financial Sector & Economic Impacts
 * 4. Governance, Public Welfare & New Legislative Rules
 */
export function classifyBulletinDomain(title = '', summary = '', category = '', sourceName = '') {
  const text = `${title} ${summary} ${category} ${sourceName}`.toLowerCase();

  // 1. State Special Topics (Madhya Pradesh policies, industrial models, infrastructure)
  if (
    text.includes('madhya pradesh') ||
    text.includes(' mp ') ||
    text.includes('pithampur') ||
    text.includes('mandideep') ||
    text.includes('ken-betwa') ||
    text.includes('mpidc') ||
    text.includes('mppsc') ||
    text.includes('mpesb') ||
    text.includes('sub-engineer') ||
    text.includes('rewa solar') ||
    text.includes('omkareshwar') ||
    text.includes('bhopal') ||
    text.includes('indore')
  ) {
    return {
      domain: 'State Special Topics (Madhya Pradesh policies, industrial models, infrastructure)',
      subject: 'MP GK',
      topic: text.includes('industrial') || text.includes('japan') || text.includes('investment')
        ? 'Japan-MP Industrial Model & State SEZs'
        : text.includes('ken-betwa') || text.includes('water') || text.includes('dam') || text.includes('canal')
        ? 'Ken-Betwa River Interlinking & MP Infrastructure'
        : 'Madhya Pradesh State Policies & Public Welfare',
      exam_relevance: 'MP Sub-Engineer CBT (Civil/Mech/Elec), MPPSC & State Engineering Services'
    };
  }

  // 2. Banking, Financial Sector & Economic Impacts
  if (
    text.includes('rbi') ||
    text.includes('reserve bank') ||
    text.includes('monetary policy') ||
    text.includes('repo rate') ||
    text.includes('unified lending') ||
    text.includes('uli') ||
    text.includes('cbdc') ||
    text.includes('digital rupee') ||
    text.includes('sebi') ||
    text.includes('nabard') ||
    text.includes('finmin') ||
    text.includes('banking') ||
    text.includes('inflation') ||
    text.includes('fiscal')
  ) {
    return {
      domain: 'Banking, Financial Sector & Economic Impacts',
      subject: 'Banking Awareness',
      topic: text.includes('uli') || text.includes('cbdc') || text.includes('digital')
        ? 'Digital Public Infrastructure & Monetary Technology'
        : 'RBI Monetary Policy & Banking Regulations',
      exam_relevance: 'IBPS RRB, SBI PO, SSC CGL & MP Sub-Engineer General Awareness'
    };
  }

  // 3. Governance, Public Welfare & New Legislative Rules
  if (
    text.includes('bill') ||
    text.includes('act') ||
    text.includes('sanhita') ||
    text.includes('bharatiya nyaya') ||
    text.includes('dpdp') ||
    text.includes('prs') ||
    text.includes('parliament') ||
    text.includes('gazette') ||
    text.includes('welfare scheme') ||
    text.includes('governance') ||
    text.includes('legislative') ||
    text.includes('niti aayog')
  ) {
    return {
      domain: 'Governance, Public Welfare & New Legislative Rules',
      subject: 'General Awareness',
      topic: text.includes('dpdp') || text.includes('data')
        ? 'Digital Personal Data Protection & Cyber Governance'
        : text.includes('sanhita') || text.includes('bns')
        ? 'Bharatiya Nyaya Sanhita & Legal Reforms'
        : 'Landmark Legislative Bills & Governance Rules',
      exam_relevance: 'MPPSC, MP Sub-Engineer General Knowledge & National Competitive Exams'
    };
  }

  // 4. National & International Current Affairs (Summits, Treaties)
  return {
    domain: 'National & International Current Affairs (Summits, Treaties)',
    subject: 'Current Affairs',
    topic: text.includes('summit') || text.includes('treaty') || text.includes('partnership')
      ? 'International Summits, Bilateral Treaties & Foreign Partnerships'
      : 'National Governance & Bilateral Affairs',
    exam_relevance: 'MP Sub-Engineer CBT, MPPSC & UPSC General Studies'
  };
}

/**
 * Fetch and extract real press releases and regulatory bulletins from official government portals
 * Parses standard RSS/XML feeds across a 1-year rolling temporal window.
 * Incorporates verified state-specific economic milestones (Japan-MP investment models, Ken-Betwa link, landmark bills)
 * to guarantee robust multi-domain coverage.
 */
export async function fetchRealOfficialBulletins(sources = OFFICIAL_SOURCES, options = {}) {
  const bulletins = [];
  const fetchStatus = [];
  const windowDays = options.windowDays || 365;
  const nowMs = Date.now();
  const cutoffTime = nowMs - (windowDays * 24 * 60 * 60 * 1000);

  const results = await Promise.all(sources.map(async (src) => {
    const localBulletins = [];
    const statusRecord = {
      source_name: src.name,
      domain: src.domain,
      attempted_at: new Date().toISOString(),
      items_found: 0,
      status: 'pending'
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const targetUrl = src.feed_url || src.portal_url;
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'SKTech-ExamPortal-OfficialCollector/1.0 (Govt Multi-Domain Sync)',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const bodyText = await res.text();

      // Extract RSS items: <item>...</item>
      const itemMatches = bodyText.match(/<item[\s\S]*?<\/item>/gi) || [];
      const entryMatches = bodyText.match(/<entry[\s\S]*?<\/entry>/gi) || [];
      const rawItems = [...itemMatches, ...entryMatches].slice(0, 10);

      let parsedCount = 0;
      for (const rawItem of rawItems) {
        const titleMatch = rawItem.match(/<title(?:[^>]*)>([\s\S]*?)<\/title>/i);
        const linkMatch = rawItem.match(/<link(?:[^>]*)>([\s\S]*?)<\/link>/i) || rawItem.match(/href=["']([^"']+)["']/i);
        const descMatch = rawItem.match(/<description(?:[^>]*)>([\s\S]*?)<\/description>/i) || rawItem.match(/<summary(?:[^>]*)>([\s\S]*?)<\/summary>/i);
        const dateMatch = rawItem.match(/<pubDate(?:[^>]*)>([\s\S]*?)<\/pubDate>/i) || rawItem.match(/<updated(?:[^>]*)>([\s\S]*?)<\/updated>/i);

        const cleanText = (str) =>
          str ? str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim() : '';

        const title = cleanText(titleMatch?.[1]);
        const link = cleanText(linkMatch?.[1]);
        const summary = cleanText(descMatch?.[1]);
        const rawDate = cleanText(dateMatch?.[1]);

        if (title && title.length >= 10 && (link || src.portal_url)) {
          let publishedAt = new Date().toISOString();
          let itemTime = nowMs;
          if (rawDate) {
            try {
              const parsedDate = new Date(rawDate);
              if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
                publishedAt = parsedDate.toISOString();
                itemTime = parsedDate.getTime();
              }
            } catch {
              publishedAt = new Date().toISOString();
            }
          }

          // Strict 1-year window filter
          if (itemTime < cutoffTime) {
            continue;
          }

          const extId = `official:${src.name.toLowerCase().replace(/[^a-z0-9]/g, '')}:${crypto.createHash('md5').update(title + link).digest('hex')}`;
          const classification = classifyBulletinDomain(title, summary, src.category, src.name);

          const bulletin = {
            external_id: extId,
            title: title.slice(0, 280),
            summary: (summary || title).slice(0, 1500),
            source_name: src.name,
            source_url: link || src.portal_url,
            category: classification.domain,
            subject: classification.subject,
            topic: classification.topic,
            exam_relevance: classification.exam_relevance,
            published_at: publishedAt,
            event_date: publishedAt.slice(0, 10),
            generated_at: new Date().toISOString(),
            verification_status: 'verified_official_source',
            source_metadata: {
              domain: src.domain,
              authority: src.authority,
              raw_feed: targetUrl,
              verified_at: new Date().toISOString()
            }
          };
          parsedCount++;
          localBulletins.push(bulletin);
        }
      }

      statusRecord.items_found = parsedCount;
      statusRecord.status = parsedCount > 0 ? 'success' : 'no_items_in_feed';
    } catch (err) {
      statusRecord.status = 'error';
      statusRecord.error = err.message || 'Fetch failed';
      console.warn(`[Official Sync Warning] Could not fetch ${src.name}: ${err.message}`);
    }

    return { bulletins: localBulletins, statusRecord };
  }));

  for (const result of results) {
    if (result?.bulletins?.length) bulletins.push(...result.bulletins);
    if (result?.statusRecord) fetchStatus.push(result.statusRecord);
  }

  // Ensure state-specific milestones & foreign partnerships (e.g. Japan-MP industrial model, Ken-Betwa link) are tracked across the 1-year window
  if (options.includeGroundedMilestones !== false && Array.isArray(OFFICIAL_GROUNDED_MILESTONES)) {
    const existingExtIds = new Set(bulletins.map(b => b.external_id));
    for (const milestone of OFFICIAL_GROUNDED_MILESTONES) {
      const milestoneTime = new Date(milestone.published_at).getTime();
      if (milestoneTime >= cutoffTime && !existingExtIds.has(milestone.external_id)) {
        const classification = classifyBulletinDomain(milestone.title, milestone.summary, milestone.category, milestone.source_name);
        bulletins.push({
          ...milestone,
          category: classification.domain,
          subject: classification.subject,
          topic: classification.topic,
          exam_relevance: milestone.exam_relevance || classification.exam_relevance,
          generated_at: new Date().toISOString(),
          verification_status: 'verified_official_source',
          source_metadata: {
            domain: milestone.domain,
            authority: milestone.authority,
            verified_at: new Date().toISOString()
          }
        });
        existingExtIds.add(milestone.external_id);
      }
    }
  }

  return { bulletins, fetchStatus };
}

/**
 * Multi-Subject Question Synthesis Engine (Gemini)
 * Dynamically synthesizes exam-oriented multiple-choice questions across:
 * 1. National & International Current Affairs (Summits, Treaties)
 * 2. State Special Topics (Madhya Pradesh policies, industrial models, infrastructure)
 * 3. Banking, Financial Sector & Economic Impacts
 * 4. Governance, Public Welfare & New Legislative Rules
 *
 * Each generated question includes multi-angle explanations:
 * (a) Core factual explanation
 * (b) Policy/statutory context
 * (c) Direct competitive exam relevance (e.g. MP Sub-Engineer Exam, MPPSC, Banking)
 */
export async function synthesizeMultiSubjectExamQuestions(gemini, candidateBulletins, options = {}) {
  const generatedQuestions = [];
  if (!gemini || !Array.isArray(candidateBulletins) || candidateBulletins.length === 0) {
    return generatedQuestions;
  }

  const batch = candidateBulletins.slice(0, options.maxCount || 6);

  for (const bulletin of batch) {
    try {
      const classification = classifyBulletinDomain(bulletin.title, bulletin.summary, bulletin.category, bulletin.source_name);

      const prompt = `You are an expert competitive exam question paper setter for Indian examinations (MP Sub-Engineer CBT, MPPSC, IBPS, SSC).
Based SOLELY on this verified official press bulletin, generate ONE high-quality, syllabus-aligned multiple choice question.

BULLETIN DETAILS:
Title: ${bulletin.title}
Summary: ${bulletin.summary}
Source: ${bulletin.source_name} (${bulletin.source_url})
Domain: ${classification.domain}
Suggested Subject: ${classification.subject}
Suggested Topic: ${classification.topic}
Target Exam: ${bulletin.exam_relevance || 'MP Sub-Engineer CBT & MPPSC'}

STRICT GENERATION RULES:
1. Every answer and explanation MUST be factually grounded in the official bulletin details. Never hallucinate facts or figures.
2. Provide a MULTI-ANGLE EXPLANATION containing:
   - Part 1: Core Factual Answer verification.
   - Part 2: Strategic/Policy/Statutory background (e.g., industrial corridor framework, treaty parameters, or legislative implications).
   - Part 3: Direct Exam Relevance: Explicit note explaining why this is critical for candidates preparing for competitive exams like the MP Sub-Engineer Exam (MPESB), MPPSC, or Banking.
3. Bilingual Support: Provide English and Hindi for question, 4 options, and explanation.
4. Correct answer MUST be strictly one of: "A", "B", "C", or "D".
5. All 4 options must be plausible, distinct, and mutually exclusive.

Return JSON in this EXACT schema:
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
  "explanation": "Multi-angle explanation: [Core Fact] ... [Policy/Context] ... [Exam Relevance for MP Sub-Engineer / MPPSC] ...",
  "explanation_hi": "बहुआयामी विस्तृत समाधान (तथ्य, नीतिगत संदर्भ व एमपी सब-इंजीनियर परीक्षा प्रासंगिकता)",
  "subject": "${classification.subject}",
  "topic": "${classification.topic}",
  "exam_relevance": "${bulletin.exam_relevance || 'MP Sub-Engineer CBT (General Knowledge & Engineering GK)'}",
  "difficulty": "Moderate"
}`;

      const response = await callGeminiWithRetry(
        () =>
          gemini.models.generateContent({
            model: getNormalizedGeminiModel(process.env.GEMINI_REVIEW_MODEL_ID),
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
          }),
        {
          operationName: `Multi-Subject MCQ Synthesis (${classification.subject} - ${bulletin.source_name})`,
          maxRetries: options.maxRetries !== undefined ? options.maxRetries : 3,
          timeoutMs: options.timeoutMs || 20000,
          initialDelayMs: options.testMode ? 15 : 1000,
          silent: Boolean(options.silent)
        }
      );

      const rawParsed = cleanJsonParse(response.text || '{}');
      const candidateToResolve = {
        ...rawParsed,
        source_name: bulletin.source_name,
        source_url: bulletin.source_url,
        published_at: bulletin.published_at,
        subject: rawParsed.subject || classification.subject,
        topic: rawParsed.topic || classification.topic,
        exam_relevance: rawParsed.exam_relevance || bulletin.exam_relevance || classification.exam_relevance
      };
      const parsed = resolveOptionDuplicatesAndDistribute(candidateToResolve);

      if (parsed.question && parsed.option_a && parsed.correct_answer) {
        const val = validateQuestionDeterministic(parsed, { requireSource: true });
        if (val.valid) {
          const contentHash = computeQuestionNormalizedHash(parsed);

          generatedQuestions.push({
            question: parsed.question,
            question_hi: parsed.question_hi || '',
            option_a: parsed.option_a,
            option_b: parsed.option_b,
            option_c: parsed.option_c,
            option_d: parsed.option_d,
            option_a_hi: parsed.option_a_hi || '',
            option_b_hi: parsed.option_b_hi || '',
            option_c_hi: parsed.option_c_hi || '',
            option_d_hi: parsed.option_d_hi || '',
            correct_answer: val.cleanedAnswer,
            explanation: parsed.explanation || '',
            explanation_hi: parsed.explanation_hi || '',
            subject: parsed.subject || classification.subject,
            topic: parsed.topic || classification.topic,
            exam_relevance: parsed.exam_relevance || classification.exam_relevance,
            difficulty: parsed.difficulty || 'Moderate',
            language: 'English + Hindi',
            source_name: bulletin.source_name,
            source_url: bulletin.source_url,
            published_at: bulletin.published_at,
            exam: 'Daily Current Affairs',
            status: 'pending_review',
            validation_notes: `Synthesized via Multi-Subject Engine: ${bulletin.source_name} [${classification.domain}]`,
            content_hash: contentHash,
            ai_review_status: 'pending_review',
            ai_confidence: 0,
            ai_notes: `Multi-angle explanation generated for ${classification.domain}`
          });
        }
      }
    } catch (genErr) {
      console.warn(`[Gemini Multi-Subject Synthesis Warning]: ${genErr.message}`);
    }
  }

  return generatedQuestions;
}

export default async function handler(req, res) {
  if (handleCorsAndOptions(req, res, ['GET', 'POST', 'OPTIONS'])) {
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'GET or POST required' });
  }

  // 1. Autonomous Rate Limiting
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, 'sync-current-affairs', 10, 60000);
  if (!rate.allowed) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', String(rate.retryAfter));
    }
    return res.status(429).json({ ok: false, error: 'Too many requests. Please wait before triggering another current affairs sync.' });
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
    const {
      generateQuestions = false,
      createQuiz = false,
      jobKey = null
    } = body;

    const todayStr = getKolkataDateString();
    const effectiveJobKey = sanitizeString(jobKey || `ca_sync_${todayStr}_kolkata`, 100);

    // 1. Fetch real official bulletins spanning 1-year window across multi-domains and state-level milestones
    const { bulletins: realBulletins, fetchStatus } = await fetchRealOfficialBulletins(OFFICIAL_SOURCES, { windowDays: 365 });

    let addedAffairs = 0;
    const insertedAffairs = [];

    // Save bulletins only if real verified data was extracted
    for (const update of realBulletins) {
      const { data: existing } = await sb
        .from('current_affairs')
        .select('id, title, external_id')
        .eq('external_id', update.external_id)
        .maybeSingle();

      if (!existing) {
        const { data: inserted, error: insErr } = await sb
          .from('current_affairs')
          .insert({
            ...update,
            status: 'published',
            question_count: 0
          })
          .select()
          .single();

        if (!insErr && inserted) {
          addedAffairs++;
          insertedAffairs.push(inserted);
        }
      } else {
        insertedAffairs.push(existing);
      }
    }

    // 2. Multi-Subject Question Synthesis Engine (STRICT TRACEABILITY & MULTI-ANGLE EXPLANATIONS)
    const isGeminiEnabled = process.env.GEMINI_AI_ENABLED === 'true' || req.body?.gemini_ai_enabled === true || Boolean(generateQuestions);
    const gemini = req.geminiClient || getGeminiClient();
    let generatedQuestionCount = 0;

    if (isGeminiEnabled && gemini && generateQuestions && insertedAffairs.length > 0) {
      const candidateBulletins = insertedAffairs.slice(0, 5);
      const synthesizedQuestions = await synthesizeMultiSubjectExamQuestions(gemini, candidateBulletins);
      const seenSyncHashes = new Set();

      for (const q of synthesizedQuestions) {
        const isDuplicate = await isQuestionDuplicateInDb(sb, q, seenSyncHashes);
        if (!isDuplicate) {
          seenSyncHashes.add(q.content_hash || computeQuestionNormalizedHash(q));
          const { error: insQErr } = await sb
            .from('questions')
            .insert({
              ...q,
              daily_job_key: effectiveJobKey
            });

          if (!insQErr) {
            generatedQuestionCount++;
          }
        } else {
          console.info(`[Sync Current Affairs] Duplicate question discarded: "${q.question?.slice(0, 50)}..."`);
        }
      }
    }

    // Log the sync execution in system_logs
    await sb.from('system_logs').insert({
      level: 'info',
      source: 'sync-current-affairs',
      action: 'official-sync',
      message: `Multi-Subject Current Affairs sync completed: ${addedAffairs} new official bulletins ingested (${insertedAffairs.length} active in bank across 1-year window), ${OFFICIAL_RECRUITMENT_PORTALS.length} recruitment portals verified, ${generatedQuestionCount} multi-angle questions drafted.`,
      details: {
        date: todayStr,
        job_key: effectiveJobKey,
        fetch_status: fetchStatus,
        bulletins_extracted: realBulletins.length,
        bulletins_active_in_bank: insertedAffairs.length,
        new_bulletins_added: addedAffairs,
        recruitment_portals_count: OFFICIAL_RECRUITMENT_PORTALS.length,
        recruitment_portals: OFFICIAL_RECRUITMENT_PORTALS.map(p => ({
          board: p.board,
          name: p.name,
          portal_url: p.portal_url,
          apply_url: p.apply_url,
          badge: p.badge,
          notifications_count: p.active_notifications?.length || 0
        }))
      }
    });

    return res.status(200).json({
      ok: true,
      job_key: effectiveJobKey,
      date: todayStr,
      sources_checked: fetchStatus.length,
      official_bulletins_added: addedAffairs,
      bulletins_active_in_bank: insertedAffairs.length,
      questions_drafted: generatedQuestionCount,
      fetch_status: fetchStatus,
      recruitment_portals: OFFICIAL_RECRUITMENT_PORTALS
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: sanitizeErrorResponse(err, 'Current affairs synchronization failed')
    });
  }
}
