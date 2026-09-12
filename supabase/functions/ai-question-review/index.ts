import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function normalize(s = '') { return s.toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim() }

async function openAIReview(question: any, candidates: any[]) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured in Supabase Edge Function secrets')
  const payload = {
    model: Deno.env.get('OPENAI_REVIEW_MODEL') || 'gpt-5-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are an exam-question quality controller. Return strict JSON. Check correctness, option consistency, language completeness, metadata, and semantic duplication. Never invent a correct answer. If uncertain, send to human review.' },
      { role: 'user', content: JSON.stringify({ task: 'review_question', question, duplicate_candidates: candidates.slice(0, 12), output_schema: { verdict:'publish|duplicate|review|reject', confidence:'0..1', duplicate_index:'integer|null', correct_answer_valid:'boolean|null', bilingual_complete:'boolean', metadata_ok:'boolean', notes:'short string', normalized_topic:'string' } }) }
    ]
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method:'POST', headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'}, body:JSON.stringify(payload) })
  if (!r.ok) throw new Error(`OpenAI error ${r.status}: ${await r.text()}`)
  const j = await r.json(); return JSON.parse(j.choices?.[0]?.message?.content || '{}')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '', { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
    const { data: { user } } = await auth.auth.getUser()
    if (!user) throw new Error('Authentication required')
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const allowed = user.email?.toLowerCase() === 'skt22tripathi@gmail.com' || ['admin','super_admin','question_manager','content_manager'].includes(profile?.role)
    if (!allowed) throw new Error('Not authorized as admin')

    const body = await req.json().catch(()=>({}))
    const limit = Math.min(Math.max(Number(body?.limit || 50), 1), 100)
    const { data: qs, error: qe } = await admin.from('questions').select('*').eq('status','pending_review').order('created_at',{ascending:true}).limit(limit)
    if (qe) throw qe

    let processed = 0, approved = 0, rejected = 0, review = 0
    for (const q of (qs || [])) {
      const { data: pool } = await admin.from('questions').select('id,question,question_hi,option_a,option_b,option_c,option_d,correct_answer,subject,topic,subtopic').eq('subject', q.subject || '').neq('id', q.id).limit(100)
      const key = normalize(`${q.question} ${q.question_hi || ''}`)
      const exact = (pool || []).find((x:any) => normalize(`${x.question} ${x.question_hi || ''}`) === key)
      let rv:any = exact ? {verdict:'duplicate',confidence:0.99,duplicate_id:exact.id,notes:'Exact normalized duplicate.'} : await openAIReview(q, pool || [])
      if (rv.duplicate_index != null && pool?.[rv.duplicate_index]) rv.duplicate_id = pool[rv.duplicate_index].id
      let status = 'pending_review'
      if (rv.verdict === 'duplicate' && Number(rv.confidence) >= 0.95) { status='rejected'; rejected++ }
      else if (rv.verdict === 'publish' && Number(rv.confidence) >= 0.93 && rv.correct_answer_valid !== false && rv.bilingual_complete !== false) { status='approved'; approved++ }
      else if (rv.verdict === 'reject' && Number(rv.confidence) >= 0.93) { status='rejected'; rejected++ }
      else review++
      const { error: ue } = await admin.from('questions').update({ status, ai_review_status:rv.verdict||'review', ai_confidence:Number(rv.confidence||0), ai_notes:rv.notes||null, duplicate_of:rv.duplicate_id||null, ai_reviewed_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq('id',q.id)
      if (ue) throw ue
      processed++
    }
    return new Response(JSON.stringify({ok:true,processed,approved,rejected,review}),{headers:{...cors,'Content-Type':'application/json'}})
  } catch (e) {
    return new Response(JSON.stringify({ok:false,error:String((e as any)?.message||e)}),{status:400,headers:{...cors,'Content-Type':'application/json'}})
  }
})
