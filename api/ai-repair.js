import { getSupabaseAdmin, getGeminiClient, verifyAdminAuth, normalizeText, cleanAnswer } from './_shared.js';

const TIMEOUT_MS = 20000;
const THRESHOLD = 0.98;

function validShape(r) {
  const opts = [r.option_a, r.option_b, r.option_c, r.option_d].map(x => String(x || '').trim());
  const norm = opts.map(normalizeText);
  return Boolean(r.question && opts.every(Boolean) && /^[ABCD]$/.test(cleanAnswer(r.correct_answer)) && new Set(norm).size === 4);
}

async function repairWithGemini(gemini, q) {
  const prompt = `Repair this competitive-exam MCQ only when a single correct answer can be established from the question itself. Preserve the subject. Fix missing/duplicate/non-matching options, correct_answer and explanation. Do not invent uncertain facts. Return JSON only.\nQuestion: ${q.question}\nA: ${q.option_a}\nB: ${q.option_b}\nC: ${q.option_c}\nD: ${q.option_d}\nDeclared answer: ${q.correct_answer}\nExplanation: ${q.explanation || ''}\nSubject: ${q.subject || ''}\nReturn {"verdict":"repair"|"keep_review","question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A|B|C|D","explanation":"...","confidence":0-1,"notes":"..."}.`;
  const result = await Promise.race([
    gemini.models.generateContent({ model: 'gemini-3.8-flash', contents: prompt, config: { responseMimeType: 'application/json' } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini repair timeout')), TIMEOUT_MS))
  ]);
  const text = result?.text || '{}';
  return JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(500).json({ error: 'Database connection unavailable' });
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) return res.status(auth.statusCode || 401).json({ error: auth.error });
  if (process.env.GEMINI_AI_ENABLED !== 'true') return res.status(400).json({ error: 'Gemini AI is disabled. Enable GEMINI_AI_ENABLED and configure GEMINI_API_KEY on the server.' });
  const gemini = getGeminiClient();
  if (!gemini) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  const ids = Array.isArray(req.body?.question_ids) ? req.body.question_ids.slice(0, 50) : [];
  if (!ids.length) return res.status(400).json({ error: 'No question_ids supplied' });
  const { data: rows, error } = await sb.from('questions').select('*').in('id', ids).in('status', ['pending_review','needs_correction']);
  if (error) return res.status(500).json({ error: error.message });
  let repaired = 0, approved = 0, kept = 0;
  const results = [];
  for (const q of rows || []) {
    try {
      const rv = await repairWithGemini(gemini, q);
      const candidate = { ...q, question: rv.question, option_a: rv.option_a, option_b: rv.option_b, option_c: rv.option_c, option_d: rv.option_d, correct_answer: cleanAnswer(rv.correct_answer), explanation: rv.explanation || q.explanation };
      if (rv.verdict === 'repair' && Number(rv.confidence) >= THRESHOLD && validShape(candidate)) {
        const { error: upErr } = await sb.from('questions').update({ question: candidate.question, option_a: candidate.option_a, option_b: candidate.option_b, option_c: candidate.option_c, option_d: candidate.option_d, correct_answer: candidate.correct_answer, explanation: candidate.explanation, status: 'approved', ai_review_status: 'repaired_approved', ai_verdict: 'repair', ai_confidence: Number(rv.confidence), ai_notes: rv.notes || 'AI repaired and passed deterministic validation', ai_reviewed_at: new Date().toISOString() }).eq('id', q.id);
        if (upErr) throw upErr;
        repaired++; approved++; results.push({ id: q.id, status: 'approved', confidence: Number(rv.confidence) });
      } else {
        await sb.from('questions').update({ ai_review_status: 'needs_correction', ai_verdict: 'keep_review', ai_confidence: 0, ai_notes: rv.notes || 'AI could not safely repair; manual review required', ai_reviewed_at: new Date().toISOString() }).eq('id', q.id);
        kept++; results.push({ id: q.id, status: 'pending_review', confidence: 0 });
      }
    } catch (e) {
      await sb.from('questions').update({ ai_review_status: 'repair_error', ai_verdict: 'review', ai_confidence: 0, ai_notes: `AI repair failed: ${e.message}`, ai_reviewed_at: new Date().toISOString() }).eq('id', q.id);
      kept++; results.push({ id: q.id, status: 'pending_review', confidence: 0 });
    }
  }
  return res.status(200).json({ ok: true, processed: rows?.length || 0, repaired, approved, kept, results });
}
