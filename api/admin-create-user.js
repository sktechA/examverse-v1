import { getSupabaseAdmin, verifyAdminAuth, withApiLogging } from './_shared.js';
async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const {name,email,phone,password,role='candidate'}=req.body||{};
    if(!name||!email||!password||String(password).length<8) return res.status(400).json({error:'Name, email and password (8+ characters) are required.'});
    const allowed=['candidate','sub_admin','question_manager','exam_manager','vacancy_manager','content_manager','support'];
    if(!allowed.includes(role)) return res.status(400).json({error:'Invalid role'});
    const sb=getSupabaseAdmin();
    if(!sb) return res.status(500).json({error:'Server is missing SUPABASE_SERVICE_ROLE_KEY.'});
    const auth=await verifyAdminAuth(req,sb);
    if(!auth.ok) return res.status(auth.statusCode||401).json({error:auth.error});
    const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!key) return res.status(500).json({error:'Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'});
    const r=await fetch(`${url}/auth/v1/admin/users`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({email:String(email).trim(),password,phone:phone||undefined,email_confirm:true,phone_confirm:!!phone,user_metadata:{full_name:String(name).trim(),phone:phone||null,role}})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) return res.status(r.status).json({error:j.msg||j.message||j.error_description||'Supabase user creation failed.'});
    const userId=j.id||j.user?.id;
    if(userId){await fetch(`${url}/rest/v1/profiles`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},body:JSON.stringify({id:userId,email:String(email).trim(),phone:phone||null,full_name:String(name).trim(),role})});}
    return res.status(200).json({ok:true,id:userId,email:String(email).trim(),role});
  }catch(e){return res.status(500).json({error:e?.message||'Unexpected error'});}
}

export default withApiLogging(handler, 'admin-create-user');
