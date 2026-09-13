import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const supa= Deno.env.get('SUPABASE_URL')!; const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sources=[
   {name:'PIB',url:'https://www.pib.gov.in/PressReleasePage.aspx'},
   {name:'RBI',url:'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx'},
   {name:'SEBI',url:'https://www.sebi.gov.in/media-and-notifications/press-releases.html'}
  ];
  let added=0;
  // Non-AI sync creates source placeholders safely; admin can open the official source and review/publish updates.
  for(const x of sources){
   const r=await fetch(`${supa}/rest/v1/current_affairs?external_id=eq.${encodeURIComponent('official:'+x.name)}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
   const existing=await r.json();
   if(!Array.isArray(existing)||!existing.length){
    const ins=await fetch(`${supa}/rest/v1/current_affairs`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({title:`${x.name} official current affairs feed`,summary:`Official source feed is connected. Review the source before publishing individual updates.`,category:'National',source_name:x.name,source_url:x.url,status:'draft',external_id:'official:'+x.name,question_count:0})});
    if(ins.ok)added++;
   }
  }
  return new Response(JSON.stringify({ok:true,added}),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({error:e?.message||String(e)}),{status:500,headers:{...cors,'Content-Type':'application/json'}})}
});
