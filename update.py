from pathlib import Path
p=Path('/mnt/data/work/src/main.jsx')
s=p.read_text()
# add Eye import already there. Insert slider component before Landing.
marker='function Landing({role,setRole,open,setOpen,login}){'
assert marker in s
slider=r'''function UpcomingExamSlider({publicMode=false,onOpenExam}){
 const [items,setItems]=useState([]);
 const [index,setIndex]=useState(0);
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{
  let live=true;
  const load=async()=>{
   if(!supabase){if(live)setItems([]);return}
   try{
    const {data,error}=await supabase.from('exams').select('id,title,description,duration_minutes,scheduled_start,scheduled_end,status,published,subject,exam_type').eq('published',true).eq('status','published').not('scheduled_start','is',null).order('scheduled_start',{ascending:true}).limit(20);
    if(!live)return;
    if(error){console.warn('Upcoming exam slider query warning:',error.message);setItems([]);return;}
    const ts=Date.now();
    const list=(data||[]).filter(e=>{
      const start=new Date(e.scheduled_start).getTime();
      const end=e.scheduled_end?new Date(e.scheduled_end).getTime():start+86400000;
      return Number.isFinite(start)&&Number.isFinite(end)&&end>=ts;
    });
    setItems(list);
    setIndex(i=>Math.min(i,Math.max(0,list.length-1)));
   }catch(err){console.warn('Upcoming exam slider warning:',err)}
  };
  load();
  const refresh=setInterval(load,60000);
  return()=>{live=false;clearInterval(refresh)};
 },[]);
 useEffect(()=>{
  const t=setInterval(()=>setNow(Date.now()),1000);
  return()=>clearInterval(t);
 },[]);
 useEffect(()=>{
  if(items.length<2)return;
  const t=setInterval(()=>setIndex(i=>(i+1)%items.length),7000);
  return()=>clearInterval(t);
 },[items.length]);
 const item=items[index];
 const formatDate=(value)=>{try{return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return value}};
 const countdown=(exam)=>{
  const start=new Date(exam.scheduled_start).getTime();
  const end=exam.scheduled_end?new Date(exam.scheduled_end).getTime():start+86400000;
  if(now>=start&&now<=end)return {live:true,total:Math.max(0,end-now)};
  return {live:false,total:Math.max(0,start-now)};
 };
 const parts=(ms)=>{let total=Math.max(0,Math.floor(ms/1000));const d=Math.floor(total/86400);total%=86400;const h=Math.floor(total/3600);total%=3600;const m=Math.floor(total/60);const sec=total%60;return {d,h,m,sec}};
 if(!item)return <section className="exam-slider empty"><div><span className="section-kicker">UPCOMING EXAMS</span><h2>Published exams will appear here</h2><p>As soon as an admin publishes an exam with a schedule, its live countdown will automatically appear on this screen.</p></div></section>;
 const cd=parts(countdown(item).total);
 const live=countdown(item).live;
 return <section className={'exam-slider '+(publicMode?'public':'candidate')}>
  <div className="exam-slider-glow"/>
  <div className="exam-slider-copy"><span className="pill">{live?'● LIVE EXAM':'UPCOMING EXAM'}</span><h2>{item.title}</h2><p>{item.description||'Prepare with SKTech Exam Portal and be ready before the exam starts.'}</p><div className="exam-meta-row"><span><CalendarDays size={15}/> {formatDate(item.scheduled_start)}</span><span><Clock3 size={15}/> {Number(item.duration_minutes||0)} Minutes</span>{item.subject&&<span><BookOpen size={15}/> {item.subject}</span>}</div></div>
  <div className="exam-countdown"><div className="countdown-label">{live?'EXAM ENDS IN':'EXAM STARTS IN'}</div><div className="countdown-grid"><div><strong>{String(cd.d).padStart(2,'0')}</strong><span>Days</span></div><div><strong>{String(cd.h).padStart(2,'0')}</strong><span>Hours</span></div><div><strong>{String(cd.m).padStart(2,'0')}</strong><span>Minutes</span></div><div><strong>{String(cd.sec).padStart(2,'0')}</strong><span>Seconds</span></div></div><button className="btn primary" onClick={()=>onOpenExam?.(item)}>{live?'Open Exam':'Login to Attempt'} <ArrowUpRight size={15}/></button></div>
  {items.length>1&&<div className="exam-slider-nav"><button onClick={()=>setIndex(i=>(i-1+items.length)%items.length)} aria-label="Previous exam">‹</button><div>{items.map((_,i)=><button key={i} className={i===index?'active':''} onClick={()=>setIndex(i)} aria-label={'Exam '+(i+1)}/>)}</div><button onClick={()=>setIndex(i=>(i+1)%items.length)} aria-label="Next exam">›</button><small>{index+1} / {items.length}</small></div>}
 </section>;
}

'''
s=s.replace(marker,slider+marker)
# replace Landing body exact function up to Login
start=s.index('function Landing({role,setRole,open,setOpen,login}){')
end=s.index('\nfunction Login({role,close,login}){',start)
landing=r'''function Landing({role,setRole,open,setOpen,login}){return <div className="landing"><header className="topbar"><Brand/><div className="top-actions">{PORTAL_MODE==='admin'?<button className="btn dark" onClick={()=>{setRole('admin');setOpen(true)}}>Admin Login</button>:<><button className="btn ghost" onClick={()=>{setRole('student');setOpen(true)}}>Login</button><button className="btn primary" onClick={()=>{setRole('student');setOpen(true)}}>Create Account</button></>}</div></header><main className="public-home"><div className="public-intro"><div><span className="pill"><Zap size={13}/> SMART EXAM PREPARATION</span><h1>Prepare smart.<br/><em>Perform better.</em></h1><p>See upcoming exams, live countdowns, practice tools and your preparation journey in one clean portal.</p><div className="hero-buttons">{PORTAL_MODE==='admin'?<button className="btn primary" onClick={()=>{setRole('admin');setOpen(true)}}>Admin Login <ArrowUpRight size={17}/></button>:<><button className="btn primary" onClick={()=>{setRole('student');setOpen(true)}}>Login <ArrowUpRight size={17}/></button><button className="btn light" onClick={()=>{setRole('student');setOpen(true)}}>Create Account</button></>}</div></div></div><UpcomingExamSlider publicMode onOpenExam={()=>{setRole('student');setOpen(true)}}/><section className="feature-grid public-features">{[[BookOpen,'Subject Practice','Easy · Moderate · Hard'],[ClipboardCheck,'Live Exam Mocks','CBT-style timing'],[Search,'Official Vacancies','Direct official links'],[Clock3,'Smart Timer','5 min & 1 min alerts'],[Target,'Daily Questions','Fresh practice every day'],[BarChart3,'Performance','Track score and weak areas']].map(([I,x,s])=><div className="feature" key={x}><span className="feature-icon"><I size={18}/></span><b>{x}</b><span>{s}</span></div>)}</section></main><footer>© 2026 SKTech Exam Portal · Powered by <b>SKTech All Right Reserved</b></footer>{open&&<Login role={role} close={()=>setOpen(false)} login={login}/>}</div>}
'''
s=s[:start]+landing+s[end:]
# replace Login + SignUp block until Shell
start=s.index('function Login({role,close,login}){')
end=s.index('\nfunction Shell(',start)
login=r'''function Login({role,close,login}){
 const [identifier,setIdentifier]=useState(''),[username,setUsername]=useState('Administration User'),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[signup,setSignup]=useState(false);
 const configured=!!supabase;
 const ensureProfile=async(ses)=>{if(!ses?.user?.id||!supabase)return;const u=ses.user;await supabase.from('profiles').upsert({id:u.id,email:u.email||null,phone:u.phone||u.user_metadata?.phone||null,full_name:u.user_metadata?.full_name||u.user_metadata?.name||''},{onConflict:'id'});};
 const resendConfirmation=async()=>{if(!supabase||!identifier.includes('@'))return;setBusy(true);const {error}=await supabase.auth.resend({type:'signup',email:identifier.trim(),options:{emailRedirectTo:window.location.origin}});setBusy(false);setMsg(error?error.message:'Confirmation email sent again. Please confirm it, then sign in.');};
 const passwordLogin=async()=>{setMsg('');if(!configured){setMsg('Supabase is not configured.');return}if(!identifier||!password){setMsg('Enter email/mobile and password.');return}setBusy(true);let result;if(identifier.includes('@')) result=await supabase.auth.signInWithPassword({email:identifier.trim(),password});else result=await supabase.auth.signInWithPassword({phone:identifier.replace(/\s/g,''),password});setBusy(false);if(result.error){logEvent('error',result.error.message,{source:'auth',data:{action:'password_login'}});setMsg(result.error.message);}else{await ensureProfile(result.data.session);login(result.data.session,'student');}};
 const admin=async()=>{setMsg('');if(!configured){setMsg('Admin login is locked until Supabase is configured.');return}if(username.trim().toLowerCase()!=='administration user'){setMsg('Username must be Administration User.');return}if(!ADMIN_AUTH_EMAIL){setMsg('Admin backend account is not configured. Add VITE_ADMIN_AUTH_EMAIL in Vercel.');return}if(!password){setMsg('Enter your admin password.');return}setBusy(true);const {data,error}=await supabase.auth.signInWithPassword({email:ADMIN_AUTH_EMAIL,password});setBusy(false);if(error)setMsg(error.message);else login(data.session,'admin');};
 if(role==='student'&&signup)return <SignUp close={close} back={()=>setSignup(false)} />;
 return <div className="modal-bg"><div className="modal"><button className="close" onClick={close}><X/></button><Brand/><span className="pill modal-pill">{role==='admin'?'ADMIN CONSOLE':'CANDIDATE PORTAL'}</span><h2>{role==='admin'?'Secure Admin Login':'Welcome back'}</h2><p className="muted">{role==='admin'?'Sign in to the administration console.':'Login with your Email or Mobile and Password.'}</p>{role==='student'?<><label><Mail size={14}/> Email or Mobile Number</label><input value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="Email or +91 XXXXX XXXXX" autoComplete="username"/><label><Lock size={14}/> Password</label><div className="password-field"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div><button className="btn dark full" disabled={busy} onClick={passwordLogin}>{busy?'Signing in...':'Login'}</button><button className="btn light full" onClick={()=>setSignup(true)}>Create Account</button></>:<><label><UserCircle size={14}/> Admin Username</label><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Administration User" autoComplete="username"/><label><Lock size={14}/> Password</label><div className="password-field"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Admin password" autoComplete="current-password"/><button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div><button className="btn dark full" disabled={busy} onClick={admin}>{busy?'Signing in...':'Sign in to Admin Console'}</button></>} {msg&&<div className="error-badge">{msg}</div>}{role==='student'&&/confirm|not confirmed/i.test(msg)&&identifier.includes('@')&&<button className="btn light full" onClick={resendConfirmation}>Resend confirmation email</button>}</div></div>
}
function SignUp({close,back}){
 const [form,setForm]=useState({name:'',phone:'',email:'',password:'',confirm:'',captcha:'',terms:false});const [showPassword,setShowPassword]=useState(false),[showConfirm,setShowConfirm]=useState(false);const [busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[done,setDone]=useState(false);const captcha=SIGNUP_CAPTCHA;
 const submit=async()=>{setMsg('');if(!supabase){setMsg('Supabase is not configured.');return}if(!form.name||!form.phone||!form.email||!form.password){setMsg('Please fill Full Name, Mobile, Email and Password.');return}if(!form.terms){setMsg('Please accept the consent / Terms checkbox to continue.');return}if(form.password.length<8){setMsg('Password must be at least 8 characters.');return}if(form.password!==form.confirm){setMsg('Passwords do not match.');return}if(form.captcha.toUpperCase()!==captcha){setMsg('Captcha is incorrect.');return}const phone=form.phone.replace(/\s/g,'');if(!/^\+?[0-9]{10,13}$/.test(phone)){setMsg('Enter mobile with country code, e.g. +9198XXXXXXXX.');return}setBusy(true);const {data,error}=await supabase.auth.signUp({email:form.email.trim(),password:form.password,options:{data:{full_name:form.name.trim(),phone,signup_method:'email_password',consent_at:new Date().toISOString()}}});if(error){setBusy(false);setMsg(error.message);return}if(data.user){const {error:pe}=await supabase.from('profiles').upsert({id:data.user.id,full_name:form.name.trim(),email:form.email.trim(),phone,consent_at:new Date().toISOString(),role:'candidate'},{onConflict:'id'});if(pe)console.warn(pe)}setBusy(false);setDone(true);setMsg(data.session?'Account created successfully. You can login now.':'Account created. If Supabase email confirmation is enabled, confirm the email once; otherwise you can login directly with Email + Password.');};
 if(done)return <div className="modal-bg"><div className="modal"><button className="close" onClick={close}><X/></button><Brand/><span className="pill modal-pill">CANDIDATE REGISTRATION</span><h2>Account Created ✓</h2><p className="muted">{msg}</p><button className="btn dark full" onClick={back}>Go to Login</button></div></div>;
 return <div className="modal-bg"><div className="modal wide-modal"><button className="close" onClick={close}><X/></button><Brand/><span className="pill modal-pill">NEW CANDIDATE</span><h2>Create your account</h2><p className="muted">Create a simple Email + Password candidate account.</p><div className="form-grid"><label>Full Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/></label><label>Mobile Number<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+91 XXXXX XXXXX"/></label><label>Email ID<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label><label>Create Password><div className="password-field"><input type={showPassword?'text':'password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Minimum 8 characters"/><button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><label>Confirm Password<div className="password-field"><input type={showConfirm?'text':'password'} value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} placeholder="Repeat password"/><button type="button" onClick={()=>setShowConfirm(v=>!v)}>{showConfirm?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><label>Captcha <b className="captcha-box">{captcha}</b><input value={form.captcha} onChange={e=>setForm({...form,captcha:e.target.value})} placeholder="Enter captcha"/></label></div><label className="consent-row"><input type="checkbox" checked={form.terms} onChange={e=>setForm({...form,terms:e.target.checked})}/><span>I voluntarily provide the above information to this portal and agree to its Terms & Conditions and Privacy Policy.</span></label><button className="btn primary full" disabled={busy} onClick={submit}>{busy?'Creating account...':'Create Account'}</button>{msg&&<div className="error-badge">{msg}</div>}<button className="btn light full" onClick={back}>Already have an account? Login</button></div></div>
}
'''
s=s[:start]+login+s[end:]
# Candidate dashboard insert slider immediately before interrupted session and title
needle=' return <>\n   {activeSession && ('
assert needle in s
replacement=' return <>\n   <UpcomingExamSlider onOpenExam={(item)=>setSelected(item)} />\n   {activeSession && ('
s=s.replace(needle,replacement,1)
p.write_text(s)
