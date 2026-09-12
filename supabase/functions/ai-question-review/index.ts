import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

function normalize(s = '') {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim()
}

async function openAIReview(question: any, candidates: any[]) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const payload = {
    model: Deno.env.get('OPENAI_REVIEW_MODEL') || 'gpt-5-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are an exam-question quality controller. Return strict JSON. Check correctness, option consistency, language completeness, metadata, and whether the question duplicates any candidate. Never invent a correct answer. If uncertain, send to human review.' },
      { role: 'user', content: JSON.stringify({
        task: 'review_question',
        question,
        duplicate_candidates: candidates.slice(0, 12),
        output_schema: {
          verdict: 'publish|duplicate|review|reject',
          confidence: '0..1',
          duplicate_index: 'integer|null',
          correct_answer_valid: 'boolean|null',
          bilingual_complete: 'boolean',
          metadata_ok: 'boolean',
          notes: 'short string',
          normalized_topic: 'string'
        }
      }) }
    ]
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  })
  if (!r.ok) throw new Error(`OpenAI error ${r.status}: ${await r.text()}`)
  const j = await r.json()
  return JSON.parse(j.choices?.[0]?.message?.content || '{}')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { question_id } = await req.json()
    if (!question_id) throw new Error('question_id is required')

    const { data: q, error: qe } = await supabase.from('questions').select('*').eq('id', question_id).single()
    if (qe || !q) throw new Error(qe?.message || 'Question not found')

    const key = normalize(`${q.question} ${q.question_hi || ''}`)
    const { data: pool } = await supabase.from('questions')
      .select('id,question,question_hi,option_a,option_b,option_c,option_d,correct_answer,subject,topic,subtopic')
      .eq('subject', q.subject || '')
      .neq('id', q.id).limit(100)

    const exact = (pool || []).find((x: any) => normalize(`${x.question} ${x.question_hi || ''}`) === key)
    let review: any
    if (exact) {
      review = { verdict: 'duplicate', confidence: 0.99, duplicate_id: exact.id, notes: 'Exact normalized duplicate.' }
    } else {
      review = await openAIReview(q, pool || [])
      if (review.duplicate_index != null && pool?.[review.duplicate_index]) review.duplicate_id = pool[review.duplicate_index].id
    }

    let status = 'pending'
    if (review.verdict === 'duplicate' && Number(review.confidence) >= 0.95) status = 'rejected'
    else if (review.verdict === 'publish' && Number(review.confidence) >= 0.93 && review.correct_answer_valid !== false && review.bilingual_complete !== false) status = 'approved'
    else if (review.verdict === 'reject' && Number(review.confidence) >= 0.93) status = 'rejected'

    const { error: ue } = await supabase.from('questions').update({
      status,
      ai_review_status: review.verdict || 'review',
      ai_confidence: Number(review.confidence || 0),
      ai_notes: review.notes || null,
      duplicate_of: review.duplicate_id || null,
      ai_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', question_id)
    if (ue) throw ue

    return new Response(JSON.stringify({ ok: true, status, review }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
