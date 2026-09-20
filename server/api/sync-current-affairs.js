import {
  getSupabaseAdmin,
  getGeminiClient,
  OFFICIAL_SOURCES,
  OFFICIAL_RECRUITMENT_PORTALS,
  getKolkataDateString,
  validateQuestionDeterministic,
  verifyAdminAuth,
  cleanJsonParse,
  callGeminiWithRetry,
  getNormalizedGeminiModel,
  handleCorsAndOptions,
  resolveOptionDuplicatesAndDistribute,
  sanitizeObject,
  sanitizeString,
  sanitizeErrorResponse,
  checkRateLimit,
  getClientIp
} from './_shared.js';
import crypto from 'node:crypto';

/**
 * Fetch and extract real press releases and regulatory bulletins from official government portals
 * Parses standard RSS/XML feeds or official public notification listings.
 * Times out after 6 seconds per source to prevent hanging.
 * If source fails to fetch: DOES NOT FABRICATE DATA. Returns empty/error record.
 */
async function fetchRealOfficialBulletins(sources = OFFICIAL_SOURCES) {
  const bulletins = [];
  const fetchStatus = [];

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
      // Real HTTP fetch with timeout and standard User-Agent
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const targetUrl = src.feed_url || src.portal_url;
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'SKTech-ExamPortal-OfficialCollector/1.0 (Govt Portal Sync)',
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
          if (rawDate) {
            try {
              const parsedDate = new Date(rawDate);
              if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
                publishedAt = parsedDate.toISOString();
              }
            } catch {
              publishedAt = new Date().toISOString();
            }
          }
          const extId = `official:${src.name.toLowerCase()}:${crypto.createHash('md5').update(title + link).digest('hex')}`;

          const bulletin = {
            external_id: extId,
            title: title.slice(0, 280),
            summary: (summary || title).slice(0, 1500),
            source_name: src.name,
            source_url: link || src.portal_url,
            category: src.category,
            subject: 'Current Affairs',
            topic: src.category,
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

  return { bulletins, fetchStatus };
}


async function researchSixMonthsWithGemini(gemini, sb, jobKey) {
  if (!gemini || !sb) return { added: 0, researched: 0, error: 'Gemini or database unavailable' };
  const prompt = `Use Google Search grounding to research the last 6 months of exam-relevant current affairs for India and Madhya Pradesh as of today. Cover national and international developments, summits, expos, conferences, awards, appointments, government schemes, economy, banking/RBI/SEBI, defence, science/technology/space, sports, environment, reports/indexes, books/authors, important days, major organizations and important MP state events. Prioritize facts that are likely to appear in competitive exams (UPSC, MPPSC, MPESB, SSC, Banking, Railway).\n\nRules:\n- Search the web; do not rely only on model memory.\n- Prefer primary/official sources (government ministries, PIB, RBI, SEBI, ISRO, UN, official event sites, MP government/MPPSC/MPESB) and reputable sources for context.\n- Do not invent facts, dates, numbers or names.\n- Return up to 80 distinct factual items, spread across categories and months.\n- Each item must have a title, concise summary, event_date (YYYY-MM-DD when known), category, source_name and source_url.\n- Return JSON only: {"items":[{"title":"...","summary":"...","event_date":"YYYY-MM-DD","category":"...","source_name":"...","source_url":"https://..."}]}`;
  const response = await callGeminiWithRetry(
    () => gemini.models.generateContent({
      model: getNormalizedGeminiModel(process.env.GEMINI_REVIEW_MODEL_ID),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', tools: [{ googleSearch: {} }] }
    }),
    { operationName: 'Gemini Six-Month Current Affairs Research', timeoutMs: 45000, maxRetries: 3, initialDelayMs: 1500 }
  );
  const parsed = cleanJsonParse(response.text || '{}');
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  let added = 0;
  for (const item of items.slice(0, 80)) {
    const title = String(item.title || '').trim();
    const summary = String(item.summary || '').trim();
    const sourceUrl = String(item.source_url || '').trim();
    if (!title || !summary || !/^https?:\/\//i.test(sourceUrl)) continue;
    const externalId = `gemini6m:${crypto.createHash('sha256').update(`${title}|${sourceUrl}`).digest('hex')}`;
    const { data: existing } = await sb.from('current_affairs').select('id').eq('external_id', externalId).maybeSingle();
    if (existing) continue;
    const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(String(item.event_date || '')) ? String(item.event_date) : new Date().toISOString().slice(0,10);
    const { error } = await sb.from('current_affairs').insert({
      external_id: externalId,
      title: title.slice(0,280),
      summary: summary.slice(0,1800),
      source_name: String(item.source_name || 'Gemini web research').slice(0,120),
      source_url: sourceUrl,
      category: String(item.category || 'General Current Affairs').slice(0,120),
      subject: 'Current Affairs',
      topic: String(item.category || 'General Current Affairs').slice(0,120),
      published_at: new Date(`${eventDate}T00:00:00Z`).toISOString(),
      event_date: eventDate,
      generated_at: new Date().toISOString(),
      verification_status: 'gemini_web_researched_pending_review',
      source_metadata: { research_window: 'last_6_months', job_key: jobKey, grounded_by: 'Google Search' },
      status: 'published',
      question_count: 0
    });
    if (!error) added++;
  }
  return { added, researched: items.length };
}

export default async function handler(req, res) {
  if (handleCorsAndOptions(req, res, ['GET', 'POST', 'OPTIONS'])) {
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'GET or POST required' });
  }

  // 1. Autonomous Rate Limiting (Prevents flood of outbound feed scrapes & Gemini generation)
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
      researchSixMonths = false,
      jobKey = null
    } = body;

    const todayStr = getKolkataDateString();
    const effectiveJobKey = sanitizeString(jobKey || `ca_sync_${todayStr}_kolkata`, 100);

    // 1. Fetch real official bulletins
    const { bulletins: realBulletins, fetchStatus } = await fetchRealOfficialBulletins();

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

    const gemini = req.geminiClient || getGeminiClient();
    let aiResearchAdded = 0;
    let aiResearchCount = 0;
    if (researchSixMonths) {
      try {
        const research = await researchSixMonthsWithGemini(gemini || getGeminiClient(), sb, effectiveJobKey);
        aiResearchAdded = research.added || 0;
        aiResearchCount = research.researched || 0;
      } catch (researchErr) {
        console.warn('[Gemini 6M Current Affairs Research Warning]:', researchErr.message);
      }
    }

    // 2. Question Generation (STRICT TRACEABILITY)
    // Questions are ONLY generated if real official source bulletins exist
    // Never invent facts, dates, figures or schemes.
    const isGeminiEnabled = process.env.GEMINI_AI_ENABLED === 'true' || req.body?.gemini_ai_enabled === true || Boolean(generateQuestions);
    let generatedQuestionCount = 0;

    if (isGeminiEnabled && gemini && generateQuestions && insertedAffairs.length > 0) {
      // Limit to 5 bulletins per batch to prevent uncontrolled Gemini cost/abuse
      const candidateBulletins = insertedAffairs.slice(0, 5);
      for (const bulletin of candidateBulletins) {
        try {
          const prompt = `You are a strict quality controller for competitive exam question generation.
Based SOLELY on this verified official press bulletin, generate ONE factual multiple-choice question:
Title: ${bulletin.title}
Summary: ${bulletin.summary}
Source: ${bulletin.source_name} (${bulletin.source_url})

RULES:
1. Every answer and explanation MUST be explicitly supported by the text above. Never invent facts or figures.
2. Return JSON only:
{
  "question": "Clear factual question",
  "option_a": "Option text",
  "option_b": "Option text",
  "option_c": "Option text",
  "option_d": "Option text",
  "correct_answer": "A",
  "explanation": "Exact factual explanation citing the official release"
}`;

          const response = await callGeminiWithRetry(
            () =>
              gemini.models.generateContent({
                model: getNormalizedGeminiModel(process.env.GEMINI_REVIEW_MODEL_ID),
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { responseMimeType: 'application/json' }
              }),
            {
              operationName: `Current Affairs MCQ Generation (${bulletin.source_name || 'bulletin'})`,
              maxRetries: 3,
              timeoutMs: 20000,
              initialDelayMs: 1000
            }
          );

          const rawParsed = cleanJsonParse(response.text || '{}');
          const parsed = resolveOptionDuplicatesAndDistribute(rawParsed);
          if (parsed.question && parsed.option_a && parsed.correct_answer) {
            const val = validateQuestionDeterministic(parsed, { requireSource: true });
            if (val.valid) {
              const contentHash = crypto
                .createHash('sha256')
                .update(`${parsed.question}:${parsed.option_a}:${val.cleanedAnswer}`)
                .digest('hex');

              const { data: existingQ } = await sb
                .from('questions')
                .select('id')
                .eq('content_hash', contentHash)
                .maybeSingle();

              if (!existingQ) {
                const { error: insQErr } = await sb
                  .from('questions')
                  .insert({
                    question: parsed.question,
                    option_a: parsed.option_a,
                    option_b: parsed.option_b,
                    option_c: parsed.option_c,
                    option_d: parsed.option_d,
                    correct_answer: val.cleanedAnswer,
                    explanation: parsed.explanation || '',
                    subject: 'Current Affairs',
                    topic: bulletin.category || 'National Governance',
                    difficulty: 'Moderate',
                    language: 'en',
                    exam: 'Daily Current Affairs',
                    source_url: bulletin.source_url,
                    status: 'pending_review', // Requires admin verification, NEVER auto-approved without manual review
                    validation_notes: `Grounded in official bulletin: ${bulletin.source_name}`,
                    content_hash: contentHash,
                    daily_job_key: effectiveJobKey,
                    ai_review_status: 'pending_review',
                    ai_confidence: 0, // Zero fake confidence until reviewed
                    ai_notes: `Generated from official release: ${bulletin.title.slice(0, 100)}`
                  });

                if (!insQErr) {
                  generatedQuestionCount++;
                }
              }
            }
          }
        } catch (genErr) {
          console.warn('[Gemini Current Affairs Error]:', genErr.message);
        }
      }
    }

    // Log the sync execution in system_logs
    await sb.from('system_logs').insert({
      level: 'info',
      source: 'sync-current-affairs',
      action: 'official-sync',
      message: `Current Affairs sync completed: ${addedAffairs} official bulletins + ${aiResearchAdded} Gemini web-researched 6-month items; ${generatedQuestionCount} questions drafted.`,
      details: {
        date: todayStr,
        job_key: effectiveJobKey,
        fetch_status: fetchStatus,
        bulletins_extracted: realBulletins.length,
        bulletins_active_in_bank: insertedAffairs.length,
        new_bulletins_added: addedAffairs,
        ai_research_6_months: Boolean(researchSixMonths),
        ai_research_items_found: aiResearchCount,
        ai_research_items_added: aiResearchAdded,
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
      ai_research_6_months: Boolean(researchSixMonths),
      ai_research_items_found: aiResearchCount,
      ai_research_items_added: aiResearchAdded,
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
