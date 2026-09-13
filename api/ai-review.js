import { createClient } from '@supabase/supabase-js';

const normalize = (s='') => s.toLowerCase().replace(/\s+/g,' ').replace(/[^\p{L}\p{N}\s]/gu,'').trim();
const valid = q => !!(q.question?.trim() && q.option_a?.trim() && q.option_b?.trim() && q.option_c?.trim() && q.option_d?.trim() && /^[ABCD]$/.test(String(q.correct_answer||'').trim().toUpperCase()));

async function writeLog(sb, level, source, action, message, details={}, user_id=null){
  try { await sb.from('system_logs').insert({level,source,action,message:String(message).slice(0,2000),details,user_id}); } catch (_) {}
}

async function aiBatch(questions, key) {
  const payload = {
    model: process.env.OPENAI_REVIEW_MODEL || 'gpt-5-mini',
    response_format: {type:'json_object'},
    messages: [
      {role:'system', content:'You are a strict competitive-exam question quality controller. Review every question independently. Never invent facts or answers. Return JSON only: {"reviews":[{"index":0,"verdict":"publish|duplicate|review|reject","confidence":0.0,"correct_answer_valid":true,"metadata_ok":true,"duplicate_index":null,"notes":""}]}. Auto-publish only if confidence >= 0.93 and supplied answer is valid. Use review when uncertain.'},
      {role:'user', content: JSON.stringify({questions})}
    ]
  };
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!r.ok) throw new Error(`OpenAI error ${r.status}: ${await r.text()}`);
  const j=await r.json();
  const parsed=JSON.parse(j.choices?.[0]?.message?.content||'{}');
  return Array.isArray(parsed.reviews)?parsed.reviews:[];
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'POST required'});
  let sb=null, user=null;
  try{
    const url=process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openai=process.env.OPENAI_API_KEY;
    if(!url||!serviceKey) throw new Error('Vercel server env missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY');
    if(!openai) throw new Error('Vercel server env missing OPENAI_API_KEY');
    sb=createClient(url,serviceKey);
    const auth=req.headers.authorization||'';
    const token=auth.replace(/^Bearer\s+/i,'');
    if(!token) throw new Error('Authentication required');
    const anon=process.env.VITE_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||'';
    const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
    const got=await userClient.auth.getUser(); user=got.data?.user;
    if(!user) throw new Error('Authentication required');
    const {data:profile}=await sb.from('profiles').select('role').eq('id',user.id).maybeSingle();
    if(!['admin','super_admin','question_manager','content_manager'].includes(profile?.role)) throw new Error('Not authorized as admin');
    const limit=Math.min(Math.max(Number(req.body?.limit||100),1),100);
    const {data:qs,error}=await sb.from('questions').select('*').eq('status','pending_review').order('created_at',{ascending:true}).limit(limit);
    if(error) throw error;
    if(!qs?.length) return res.status(200).json({ok:true,processed:0,approved:0,rejected:0,review:0,needs:0});

    let processed=0,approved=0,rejected=0,review=0,needs=0;
    const candidates=[];
    for(const q of qs){
      if(!valid(q)){
        await sb.from('questions').update({status:'needs_correction',ai_review_status:'needs_correction',ai_verdict:'needs_correction',ai_confidence:1,ai_notes:'Required question/options/answer field missing or invalid.',ai_reviewed_at:new Date().toISOString()}).eq('id',q.id);
        processed++;needs++;continue;
      }
      const {data:pool}=await sb.from('questions').select('id,question,question_hi,option_a,option_b,option_c,option_d,correct_answer,subject,topic,subtopic').in('status',['approved','pending_review']).neq('id',q.id).eq('subject',q.subject||'').limit(150);
      const key=normalize(`${q.question} ${q.question_hi||''}`);
      const exact=(pool||[]).find(x=>normalize(`${x.question} ${x.question_hi||''}`)===key);
      if(exact){
        await sb.from('questions').update({status:'rejected',ai_review_status:'duplicate',ai_verdict:'duplicate',ai_confidence:.99,ai_notes:'Exact normalized duplicate.',duplicate_of:exact.id,ai_reviewed_at:new Date().toISOString()}).eq('id',q.id);
        processed++;rejected++;continue;
      }
      candidates.push(q);
    }

    // Review up to 20 questions per OpenAI request to avoid one-request-per-question timeouts.
    for(let i=0;i<candidates.length;i+=20){
      const batch=candidates.slice(i,i+20);
      const reviews=await aiBatch(batch.map(q=>({question:q.question,question_hi:q.question_hi,option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,correct_answer:q.correct_answer,explanation:q.explanation,subject:q.subject,topic:q.topic,difficulty:q.difficulty,language:q.language,exam:q.exam})),openai);
      for(let j=0;j<batch.length;j++){
        const q=batch[j],rv=reviews[j]||{verdict:'review',confidence:0,notes:'AI did not return a complete review.'};
        let status='pending_review';
        if(rv.verdict==='publish'&&Number(rv.confidence)>=.93&&rv.correct_answer_valid!==false&&rv.metadata_ok!==false){status='approved';approved++;}
        else if((rv.verdict==='duplicate'||rv.verdict==='reject')&&Number(rv.confidence)>=.95){status='rejected';rejected++;}
        else review++;
        await sb.from('questions').update({status,ai_review_status:rv.verdict||'review',ai_verdict:rv.verdict||'review',ai_confidence:Number(rv.confidence||0),ai_notes:rv.notes||null,ai_reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',q.id);
        processed++;
      }
    }
    await writeLog(sb,'info','ai-review','bulk-review',`AI review completed: ${processed} processed, ${approved} approved, ${rejected} rejected, ${review} review, ${needs} needs correction.`,{limit},user.id);
    return res.status(200).json({ok:true,processed,approved,rejected,review,needs});
  }catch(e){
    if(sb) await writeLog(sb,'error','ai-review','bulk-review-error',e?.message||String(e),{limit:req.body?.limit||null},user?.id||null);
    return res.status(400).json({ok:false,error:e?.message||String(e)});
  }
}
