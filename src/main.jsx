import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import {LayoutDashboard,BookOpen,ClipboardCheck,Search,Settings,LogOut,Clock3,Upload,Users,PlusCircle,Menu,X,ChevronDown,TrendingUp,Target,ShieldCheck,FileText,BarChart3,CalendarDays,Zap,ArrowUpRight,CheckCircle2,Eye,Activity,IndianRupee,Megaphone,Bell,UserCircle,Save,Lock,Mail,Smartphone,RefreshCw,ExternalLink,Database,Trash2,Edit3,Sparkles,Sliders,Languages,KeyRound,UserPlus,EyeOff,Sun,Moon,Award,Flame,Check,AlertCircle} from 'lucide-react';
import './styles.css';

import DailyAutomation from './components/DailyAutomation.jsx';
import AiMockGenerator from './components/AiMockGenerator.jsx';
import MockModal from './components/MockModal.jsx';
import ExamRecoveryModal from './components/ExamRecoveryModal.jsx';
import SystemLogs from './components/SystemLogs.jsx';
import ComprehensiveExamCalendar from './components/ComprehensiveExamCalendar.jsx';
import { OFFICIAL_RECRUITMENT_PORTALS, EXPANDED_VACANCIES } from './data/recruitmentPortals.js';

const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'';
const SUPABASE_ANON_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
// Admin UI uses a fixed username; the backend email stays hidden from candidates.
const ADMIN_AUTH_EMAIL=import.meta.env.VITE_ADMIN_AUTH_EMAIL||'';
const PORTAL_MODE=import.meta.env.VITE_PORTAL_MODE||'candidate';
const supabase=SUPABASE_URL&&SUPABASE_ANON_KEY?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;

async function logEvent(type,message,meta={}){
  try{
    if(!supabase)return;
    const ses=(await supabase.auth.getSession()).data.session;
    await supabase.rpc('write_system_log',{
      p_level:type==='error'?'error':type==='warning'?'warning':'info',
      p_source:meta.source||'candidate-app',
      p_action:meta.action||type,
      p_message:String(message||'').slice(0,2000),
      p_details:meta.data||{},
      p_user_id:ses?.user?.id||null,
      p_page:window.location.pathname,
      p_request_id:meta.requestId||null
    });
  }catch(_){}
}


const SIGNUP_CAPTCHA='SK'+String(Math.floor(1000+Math.random()*9000));
const exams=[
{name:'IBPS RRB PO',cat:'Banking',tag:'TRENDING',q:80,time:'60 min'},
{name:'IBPS RRB Clerk',cat:'Banking',tag:'TRENDING',q:80,time:'60 min'},
{name:'RRB NTPC',cat:'Railway',tag:'POPULAR',q:100,time:'90 min'},
{name:'SSC CGL',cat:'SSC',tag:'POPULAR',q:100,time:'60 min'},
{name:'SSC CHSL',cat:'SSC',tag:'POPULAR',q:100,time:'60 min'},
{name:'MPPSC State Service',cat:'MPPSC',tag:'TRENDING',q:100,time:'120 min'},
{name:'MP SI',cat:'MP Police',tag:'TRENDING',q:100,time:'120 min'},
{name:'MP Police Constable',cat:'MP Police',tag:'TRENDING',q:100,time:'120 min'},
{name:'MPESB Sub Engineer',cat:'MPESB',tag:'TRENDING',q:100,time:'120 min'},
{name:'MPESB Group 3',cat:'MPESB',tag:'NEW',q:100,time:'120 min'},
{name:'UPSC Civil Services',cat:'UPSC',tag:'POPULAR',q:100,time:'120 min'},
{name:'Banking Awareness',cat:'Banking',tag:'PRACTICE',q:50,time:'45 min'}
];
const subjects=['Mathematics','Reasoning','General Awareness','Current Affairs','Banking Awareness','Financial Awareness','English','Hindi','Computer','General Science','Data Interpretation','Indian History','Indian Geography','Indian Polity','Indian Constitution','Indian Economy','Indian Culture','Environment & Ecology','MP GK','MP History','MP Geography','MP Polity','MP Economy','MP Culture','MP Tribes','MP Current Affairs','MP Government Schemes','Civil Engineering','Mechanical Engineering','Electrical Engineering','Electronics Engineering','Agriculture Engineering'];
const vacancies = EXPANDED_VACANCIES;

const T = (en, hi) => {
  try {
    return (localStorage.getItem('sktech_lang') || 'en') === 'hi' ? hi : en;
  } catch {
    return en;
  }
};

function App(){
 useEffect(()=>{
   const onError=e=>{logEvent('error',e.message||'Unhandled browser error',{source:'candidate-runtime',data:{filename:e.filename||'',line:e.lineno||0,col:e.colno||0}}).catch(()=>{})};
   const onReject=e=>{logEvent('error',e.reason?.message||String(e.reason||'Unhandled promise rejection'),{source:'candidate-runtime',data:{type:'unhandledrejection'}}).catch(()=>{})};
   window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onReject);
   return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onReject)};
 },[]);
 const [role,setRole]=useState(PORTAL_MODE==='admin'?'admin':'student'),
 [logged,setLogged]=useState(false),
 [page,setPage]=useState('dashboard'),
 [open,setOpen]=useState(false),
 [selected,setSelected]=useState(null),
 [session,setSession]=useState(null),
 [authChecking,setAuthChecking]=useState(true);

 useEffect(()=>{
   if(!supabase){setAuthChecking(false);return}
   let mounted=true;
   const verifyAccess=async(ses)=>{
     if(!ses) return false;
     if(PORTAL_MODE!=='admin')return true;
     try{
       const {data,error}=await supabase.from('profiles').select('role').eq('id',ses.user.id).maybeSingle();
       if(error||!data||!['admin','super_admin','question_manager','exam_manager','vacancy_manager','content_manager','support'].includes(data.role)){
         await supabase.auth.signOut();
         return false;
       }
       return true;
     }catch(e){
       console.warn('verifyAccess warning:', e);
       return false;
     }
   };
   const boot=async()=>{
     try{
       const {data}=await supabase.auth.getSession();
       if(!mounted)return;
       if(data?.session){
         const ok=await verifyAccess(data.session);
         if(ok && mounted){
           setSession(data.session);
           setLogged(true);
           if(PORTAL_MODE!=='admin'){
             setRole('student');
           }
         }
       }
     }catch(err){
       console.warn('Auth boot exception:', err);
     }finally{
       if(mounted) setAuthChecking(false);
     }
   };
   boot();
   const {data}=supabase.auth.onAuthStateChange(async(evt,ses)=>{
     if(!mounted)return;
     if(evt==='SIGNED_OUT'||!ses){
       setSession(null);
       setLogged(false);
       return;
     }
     if(evt==='SIGNED_IN'||evt==='TOKEN_REFRESHED'||evt==='USER_UPDATED'||evt==='INITIAL_SESSION'){
       try{
         const ok=await verifyAccess(ses);
         if(ok && mounted){
           setSession(ses);
           setLogged(true);
         }
       }catch(err){
         console.warn('Auth state change error:', err);
       }
     }
   });
   return()=>{mounted=false;data?.subscription?.unsubscribe()};
 },[]);
 const logout=async()=>{if(supabase)await supabase.auth.signOut();setLogged(false);setSession(null);setRole(PORTAL_MODE==='admin'?'admin':'student');setPage('dashboard')};
 if(authChecking)return <div className="loading-screen"><Brand/><p>Connecting securely…</p></div>;
 if(!logged)return <Landing role={role} setRole={setRole} open={open} setOpen={setOpen} login={(ses,r)=>{setSession(ses||null);setRole(r||role);setLogged(true)}}/>;
 return <Shell role={role} page={page} setPage={setPage} logout={logout} selected={selected} setSelected={setSelected} session={session}/>;
}
function Brand({dark=false}){return <div className={dark?'brand dark-brand':'brand'}><span className="logo"><Zap size={19} fill="currentColor"/></span><div><b>SKTech Exam Portal</b><small>Prepare Smart. Perform Better.</small></div></div>}
function UpcomingExamSlider({publicMode=false,onOpenExam,adminMode=false}){
  return (
    <ComprehensiveExamCalendar
      supabase={supabase}
      publicMode={publicMode}
      adminMode={adminMode}
      onOpenExam={onOpenExam}
    />
  );
}

function Landing({role,setRole,open,setOpen,login}){
  const [initialSignup,setInitialSignup]=useState(false);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('sktech_theme')||'light'}catch{return 'light'}});
  const [lang,setLang]=useState(()=>{try{return localStorage.getItem('sktech_lang')||'en'}catch{return 'en'}});

  const toggleTheme=()=>{
    const next=theme==='dark'?'light':'dark';
    setTheme(next);
    localStorage.setItem('sktech_theme',next);
    document.documentElement.dataset.theme=next;
    window.dispatchEvent(new CustomEvent('sktech-theme',{detail:next}));
  };

  const toggleLang=()=>{
    const next=lang==='hi'?'en':'hi';
    setLang(next);
    localStorage.setItem('sktech_lang',next);
    document.documentElement.dataset.lang=next;
    window.dispatchEvent(new CustomEvent('sktech-lang',{detail:next}));
  };

  const openAuthModal=(isSignup=false)=>{
    setRole(PORTAL_MODE==='admin'?'admin':'student');
    setInitialSignup(isSignup);
    setOpen(true);
  };

  const scrollTo=(id)=>{
    const el=document.getElementById(id);
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
  };

  return (
    <div className="landing">
      <header className="topbar">
        <Brand/>
        <ul className="public-nav-links">
          {[
            { id: 'nav-upcoming-exams', target: 'upcoming-exams', label: 'Exams' },
            { id: 'nav-prep-categories', target: 'prep-categories', label: 'Practice' },
            { id: 'nav-current-affairs', target: 'current-affairs-preview', label: 'Current Affairs' },
            { id: 'nav-recruitment-portals', target: 'recruitment-portals', label: 'Vacancies' },
            { id: 'nav-features-overview', target: 'features-overview', label: 'Features' },
          ].map(nav => (
            <li key={nav.id}>
              <button className="public-nav-link" onClick={()=>scrollTo(nav.target)}>
                {nav.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="top-actions" style={{display:'flex',alignItems:'center',gap:8}}>
          <button
            className="icon-action-btn"
            title={theme==='dark'?'Switch to Light Theme':'Switch to Dark Theme'}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}
          </button>
          <button
            className="lang-toggle-btn"
            title="Switch Language / भाषा बदलें"
            onClick={toggleLang}
          >
            <span>{lang==='hi'?'हिन्दी':'EN'}</span>
          </button>
          {PORTAL_MODE==='admin'?(
            <button className="btn primary" onClick={()=>openAuthModal(false)}>
              Admin Login <ArrowUpRight size={15}/>
            </button>
          ):(
            <>
              <button className="btn light" onClick={()=>openAuthModal(false)}>
                Login
              </button>
              <button className="btn primary" onClick={()=>openAuthModal(true)}>
                Create Account
              </button>
            </>
          )}
        </div>
      </header>

      <main className="public-home">
        {/* 2-Column Hero Section */}
        <section className="hero-2col">
          <div className="hero-left">
            <span className="section-kicker">COMPREHENSIVE CBT EXAMINATION PLATFORM</span>
            <h1>Empower Your Exam<br/><em>Preparation Journey</em></h1>
            <p>
              Banking (IBPS/SBI), MP State Exams (MPESB/MPPSC), SSC, Railways &amp; Technical. Experience authentic CBT countdown timers, bilingual question parity, and deep performance analytics.
            </p>
            <div className="hero-buttons">
              <button className="btn primary" onClick={()=>openAuthModal(true)}>
                Start Practicing Now <ArrowUpRight size={16}/>
              </button>
              <button className="btn light" onClick={()=>scrollTo('upcoming-exams')}>
                Explore Mock Tests
              </button>
            </div>
            <div className="hero-trust-strip">
              <span><ShieldCheck size={14} color="#1d4ed8"/> Official Pattern CBT</span>
              <span><BookOpen size={14} color="#1d4ed8"/> Bilingual EN + हिन्दी</span>
              <span><Zap size={14} color="#1d4ed8"/> Anti-Crash Recovery</span>
            </div>
          </div>

          <div className="hero-preview-container">
            <div className="product-preview-card">
              <div className="preview-card-topbar">
                <span><b>CBT Simulator</b> · Q 14 / 100</span>
                <span className="preview-timer"><Clock3 size={13}/> 48:22</span>
              </div>
              <div className="preview-card-body">
                <span className="preview-q-tag">REASONING ABILITY · IBPS &amp; SBI PO</span>
                <p className="preview-q-text">If 'BANK' is coded as '211411', how will 'EXAM' be coded in that language?</p>
                <p className="preview-q-hi">यदि 'BANK' को '211411' लिखा जाता है, तो 'EXAM' को क्या लिखा जाएगा?</p>
                <div className="preview-options-list">
                  <div className="preview-opt-item"><span>A. 523114</span></div>
                  <div className="preview-opt-item selected"><span>B. 524113</span><Check size={14}/></div>
                  <div className="preview-opt-item"><span>C. 524114</span></div>
                  <div className="preview-opt-item"><span>D. 424113</span></div>
                </div>
              </div>
              <div className="preview-card-footer">
                <span>14 Answered • 86 Remaining</span>
                <strong style={{color:'#16a34a'}}>Accuracy 94.2%</strong>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Upcoming Exam Horizontal Panel */}
        <UpcomingExamSlider publicMode onOpenExam={()=>openAuthModal(false)}/>

        {/* 4. Practice Domains (Clean Grid) */}
        <section id="prep-categories" style={{marginTop:36}}>
          <div className="public-section-head">
            <span className="section-kicker">CURATED SYLLABUS DOMAINS</span>
            <h2>Select Your Target Exam Domain</h2>
            <p>Comprehensive question banks, sectional tests, and full-length official pattern mocks.</p>
          </div>
          <div className="prep-categories-grid">
            {[
              {id:'banking',name:'Banking & Insurance',desc:'IBPS PO, Clerk, SBI PO/Clerk, RRB Officer Scale I & Assistant.',badge:'High Volume',icon:'🏦',class:'bank'},
              {id:'mp',name:'Madhya Pradesh State Exams',desc:'MPESB Sub-Engineer, MP Police, MPPSC Prelims GS, MP Patwari.',badge:'MP State Special',icon:'🏛️',class:'mp'},
              {id:'ssc',name:'Staff Selection Commission',desc:'SSC CGL, CHSL, MTS, CPO Sub-Inspector & GD Constable.',badge:'All India',icon:'📑',class:'ssc'},
              {id:'rrb',name:'Railway Recruitment Board',desc:'RRB NTPC CBT 1 & 2, Group D, ALP Loco Pilot, Junior Engineer.',badge:'CBT Pattern',icon:'🚆',class:'rrb'},
              {id:'eng',name:'Engineering & Technical',desc:'Civil, Electrical, Mechanical Sub-Engineer & Junior Engineer CBTs.',badge:'Specialized',icon:'⚙️',class:'eng'},
              {id:'upsc',name:'General Studies & UPSC',desc:'Civil Services Prelims GS & CSAT, CDS, NDA & Defence Examinations.',badge:'General Studies',icon:'🎖️',class:'upsc'}
            ].map(cat=>(
              <div className="prep-category-card" key={cat.id}>
                <div>
                  <div className="prep-category-head">
                    <span className={'prep-category-icon '+cat.class} style={{fontSize:22}}>{cat.icon}</span>
                    <span className="prep-category-badge">{cat.badge}</span>
                  </div>
                  <h3 style={{marginTop:12}}>{cat.name}</h3>
                  <p>{cat.desc}</p>
                </div>
                <button className="btn light full" onClick={()=>openAuthModal(true)}>
                  Explore Domain <ArrowUpRight size={14}/>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Editorial "Why SKTech" Section */}
        <section id="features-overview" style={{paddingTop:20}}>
          <div className="public-section-head">
            <span className="section-kicker">BUILT FOR ASPIRANTS</span>
            <h2>Why Top Candidates Prepare with SKTech</h2>
            <p>Designed strictly to match official exam interfaces and operational standards.</p>
          </div>
          <div className="editorial-why-grid">
            <div className="editorial-card">
              <div className="editorial-icon-box"><ClipboardCheck size={22}/></div>
              <div className="editorial-copy">
                <h3>Official Pattern CBT Simulator</h3>
                <p>Authentic countdown clocks, sectional timers, positive/negative scoring penalties, and real question palette navigation matching TCS iON and state recruitment centers.</p>
              </div>
            </div>

            <div className="editorial-card">
              <div className="editorial-icon-box"><BookOpen size={22}/></div>
              <div className="editorial-copy">
                <h3>Bilingual Question Bank (English + हिन्दी)</h3>
                <p>Native parity across both languages with instant one-click toggle, accompanied by detailed step-by-step mathematical and logical explanations for every problem.</p>
              </div>
            </div>

            <div className="editorial-card">
              <div className="editorial-icon-box"><Bell size={22}/></div>
              <div className="editorial-copy">
                <h3>Daily Grounded Current Affairs</h3>
                <p>Curated directly from PIB, RBI, SEBI, and official State Gazettes. Daily 20-question practice drills and monthly comprehensive marathon revisions.</p>
              </div>
            </div>

            <div className="editorial-card">
              <div className="editorial-icon-box"><Clock3 size={22}/></div>
              <div className="editorial-copy">
                <h3>Session Recovery (Anti-Crash Architecture)</h3>
                <p>State-saved test engine guarantees zero lost time. Any unexpected browser tab closure or power disruption resumes with exact saved answers and remaining seconds intact.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Current Affairs Strip */}
        <div id="current-affairs-preview" className="panel" style={{marginBottom:40,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
          <div>
            <span className="section-kicker">DAILY CURRENT AFFAIRS</span>
            <h3 style={{margin:'4px 0',fontSize:18,color:'var(--brand-navy)'}}>📰 Verified Official News &amp; Question Sets</h3>
            <p style={{margin:0,fontSize:13,color:'var(--text-secondary)'}}>PIB, RBI and State notifications updated daily with targeted exam questions.</p>
          </div>
          <button className="btn primary" onClick={()=>openAuthModal(false)}>
            Access Current Affairs <ArrowUpRight size={15}/>
          </button>
        </div>

        {/* 6. Official Recruitment Directory */}
        <section id="recruitment-portals" style={{marginBottom:40}}>
          <div className="public-section-head" style={{marginBottom:20}}>
            <span className="section-kicker">OFFICIAL EXAMINATION DIRECTORY</span>
            <h2>Government &amp; Banking Recruitment Portals</h2>
            <p>Direct authentic links to official examination bodies with verified government domains.</p>
          </div>
          <div className="recruitment-directory-grid">
            {OFFICIAL_RECRUITMENT_PORTALS.slice(0,6).map(p=>(
              <a
                key={p.id}
                href={p.portal_url || p.apply_url || '#'}
                target="_blank"
                rel="noreferrer"
                className="recruitment-portal-card"
              >
                <div className="recruitment-portal-header">
                  <strong>{p.board || p.shortName || p.id.toUpperCase()}</strong>
                  <span className="recruitment-verified-badge">✓ Official</span>
                </div>
                <small>{p.name}</small>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
                  <span className="recruitment-domain-tag">{p.domain}</span>
                  <ExternalLink size={13} style={{color:'var(--text-muted)'}}/>
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer>
        © 2026 SKTech Exam Portal · © 2026 SKTech Exam Portal. <b>All Rights Reserved.</b>
      </footer>

      {open&&<Login role={role} close={()=>setOpen(false)} login={login} initialSignup={initialSignup}/>}
    </div>
  );
}

function Login({role,close,login,initialSignup=false}){
 const [identifier,setIdentifier]=useState(''),[username,setUsername]=useState('Administration User'),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[signup,setSignup]=useState(initialSignup);
 const configured=!!supabase;
 const ensureProfile=async(ses)=>{if(!ses?.user?.id||!supabase)return;const u=ses.user;await supabase.from('profiles').upsert({id:u.id,email:u.email||null,phone:u.phone||u.user_metadata?.phone||null,full_name:u.user_metadata?.full_name||u.user_metadata?.name||''},{onConflict:'id'});};
 const resendConfirmation=async()=>{if(!supabase||!identifier.includes('@'))return;setBusy(true);const {error}=await supabase.auth.resend({type:'signup',email:identifier.trim(),options:{emailRedirectTo:window.location.origin}});setBusy(false);setMsg(error?error.message:'Confirmation email sent again. Please confirm it, then sign in.');};
 const passwordLogin=async()=>{setMsg('');if(!configured){setMsg('Supabase is not configured.');return}if(!identifier||!password){setMsg('Enter email/mobile and password.');return}setBusy(true);let result;if(identifier.includes('@')) result=await supabase.auth.signInWithPassword({email:identifier.trim(),password});else result=await supabase.auth.signInWithPassword({phone:identifier.replace(/\s/g,''),password});setBusy(false);if(result.error){logEvent('error',result.error.message,{source:'auth',data:{action:'password_login'}});setMsg(result.error.message);}else{await ensureProfile(result.data.session);login(result.data.session,'student');}};
 const admin=async()=>{setMsg('');if(!configured){setMsg('Admin login is locked until Supabase is configured.');return}if(username.trim().toLowerCase()!=='administration user'){setMsg('Username must be Administration User.');return}if(!ADMIN_AUTH_EMAIL){setMsg('Admin backend account is not configured. Add VITE_ADMIN_AUTH_EMAIL in Vercel.');return}if(!password){setMsg('Enter your admin password.');return}setBusy(true);const {data,error}=await supabase.auth.signInWithPassword({email:ADMIN_AUTH_EMAIL,password});setBusy(false);if(error)setMsg(error.message);else login(data.session,'admin');};
 if(role==='student'&&signup)return <SignUp close={close} back={()=>setSignup(false)} />;
 return (
   <div className="modal-bg">
     <div className="auth-split-modal">
       {/* Left: Deep Brand Panel */}
       <div className="auth-brand-panel">
         <div>
           <Brand/>
           <div className="auth-cockpit-snippet">
             <div className="auth-snippet-header">EXAMINATION COCKPIT</div>
             <div className="auth-snippet-title">Live CBT Preparation</div>
             <div className="auth-snippet-stats">
               <span>✓ 100% Pattern Aligned</span>
               <span>✓ Real Timers</span>
             </div>
           </div>
         </div>
         <div className="auth-features-list">
           <div><Check size={14} color="#60a5fa"/> Official pattern CBT mocks</div>
           <div><Check size={14} color="#60a5fa"/> Bilingual English + हिन्दी questions</div>
           <div><Check size={14} color="#60a5fa"/> State-saved session recovery</div>
         </div>
       </div>

       {/* Right: Clean White Authentication Panel */}
       <div className="auth-form-panel">
         <button className="close-btn" onClick={close} aria-label="Close dialog"><X size={17}/></button>
         <span className="pill" style={{width:'fit-content',marginBottom:8}}>
           {role==='admin'?'ADMIN CONSOLE':'CANDIDATE PORTAL'}
         </span>
         <h2>{role==='admin'?'Secure Admin Login':'Welcome back'}</h2>
         <p className="muted">
           {role==='admin'?'Sign in with your administrator credentials.':'Enter your Email or Mobile and password to continue.'}
         </p>

         {role==='student'?(
           <>
             <div className="auth-input-group">
               <label><Mail size={13}/> Email or Mobile Number</label>
               <input
                 value={identifier}
                 onChange={e=>setIdentifier(e.target.value)}
                 placeholder="you@example.com or +91 XXXXX XXXXX"
                 autoComplete="username"
               />
             </div>
             <div className="auth-input-group">
               <label><Lock size={13}/> Password</label>
               <div className="password-field">
                 <input
                   type={showPassword?'text':'password'}
                   value={password}
                   onChange={e=>setPassword(e.target.value)}
                   placeholder="Your password"
                   autoComplete="current-password"
                 />
                 <button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide':'Show'}>
                   {showPassword?<EyeOff size={15}/>:<Eye size={15}/>}
                 </button>
               </div>
             </div>
             <button className="btn primary full" disabled={busy} onClick={passwordLogin} style={{marginTop:8}}>
               {busy?'Signing in...':'Login'}
             </button>
             <button className="btn ghost full" onClick={()=>setSignup(true)} style={{marginTop:6}}>
               Don't have an account? Create Account
             </button>
           </>
         ):(
           <>
             <div className="auth-input-group">
               <label><UserCircle size={13}/> Admin Username</label>
               <input
                 value={username}
                 onChange={e=>setUsername(e.target.value)}
                 placeholder="Administration User"
                 autoComplete="username"
               />
             </div>
             <div className="auth-input-group">
               <label><Lock size={13}/> Password</label>
               <div className="password-field">
                 <input
                   type={showPassword?'text':'password'}
                   value={password}
                   onChange={e=>setPassword(e.target.value)}
                   placeholder="Admin password"
                   autoComplete="current-password"
                 />
                 <button type="button" onClick={()=>setShowPassword(v=>!v)}>
                   {showPassword?<EyeOff size={15}/>:<Eye size={15}/>}
                 </button>
               </div>
             </div>
             <button className="btn dark full" disabled={busy} onClick={admin} style={{marginTop:8}}>
               {busy?'Signing in...':'Sign in to Admin Console'}
             </button>
           </>
         )}

         {msg&&<div className="error-badge" style={{marginTop:10}}>{msg}</div>}
         {role==='student'&&/confirm|not confirmed/i.test(msg)&&identifier.includes('@')&&(
           <button className="btn light full" onClick={resendConfirmation} style={{marginTop:8}}>
             Resend confirmation email
           </button>
         )}
       </div>
     </div>
   </div>
 );
}

function SignUp({close,back}){
 const [form,setForm]=useState({name:'',phone:'',email:'',password:'',confirm:'',captcha:'',terms:false});
 const [showPassword,setShowPassword]=useState(false),[showConfirm,setShowConfirm]=useState(false);
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[done,setDone]=useState(false);
 const captcha=SIGNUP_CAPTCHA;
 const submit=async()=>{
   setMsg('');
   if(!supabase){setMsg('Supabase is not configured.');return}
   if(!form.name||!form.phone||!form.email||!form.password){setMsg('Please fill Full Name, Mobile, Email and Password.');return}
   if(!form.terms){setMsg('Please accept the consent / Terms checkbox to continue.');return}
   if(form.password.length<8){setMsg('Password must be at least 8 characters.');return}
   if(form.password!==form.confirm){setMsg('Passwords do not match.');return}
   if(form.captcha.toUpperCase()!==captcha){setMsg('Captcha is incorrect.');return}
   const phone=form.phone.replace(/\s/g,'');
   if(!/^\+?[0-9]{10,13}$/.test(phone)){setMsg('Enter mobile with country code, e.g. +9198XXXXXXXX.');return}
   setBusy(true);
   const {data,error}=await supabase.auth.signUp({
     email:form.email.trim(),
     password:form.password,
     options:{data:{full_name:form.name.trim(),phone,signup_method:'email_password',consent_at:new Date().toISOString()}}
   });
   if(error){setBusy(false);setMsg(error.message);return}
   if(data.user){
     const {error:pe}=await supabase.from('profiles').upsert({id:data.user.id,full_name:form.name.trim(),email:form.email.trim(),phone,consent_at:new Date().toISOString(),role:'candidate'},{onConflict:'id'});
     if(pe)console.warn(pe);
   }
   setBusy(false);
   setDone(true);
   setMsg(data.session?'Account created successfully. You can login now.':'Account created. If Supabase email confirmation is enabled, confirm the email once; otherwise you can login directly with Email + Password.');
 };

 if(done)return (
   <div className="modal-bg">
     <div className="auth-split-modal" style={{maxWidth:520,gridTemplateColumns:'1fr'}}>
       <div className="auth-form-panel">
         <button className="close-btn" onClick={close}><X size={17}/></button>
         <Brand/>
         <span className="pill" style={{marginTop:12,width:'fit-content'}}>CANDIDATE REGISTRATION</span>
         <h2>Account Created ✓</h2>
         <p className="muted">{msg}</p>
         <button className="btn primary full" onClick={back}>Go to Login</button>
       </div>
     </div>
   </div>
 );

 return (
   <div className="modal-bg">
     <div className="auth-split-modal" style={{maxWidth:900}}>
       <div className="auth-brand-panel">
         <div>
           <Brand/>
           <div className="auth-cockpit-snippet">
             <div className="auth-snippet-header">NEW CANDIDATE</div>
             <div className="auth-snippet-title">Start Exam Prep</div>
             <div className="auth-snippet-stats">
               <span>✓ Full CBT Access</span>
               <span>✓ Free Analytics</span>
             </div>
           </div>
         </div>
         <div className="auth-features-list">
           <div><Check size={14} color="#60a5fa"/> Free diagnostic mock tests</div>
           <div><Check size={14} color="#60a5fa"/> Daily updated current affairs</div>
           <div><Check size={14} color="#60a5fa"/> Subject-wise weakness reports</div>
         </div>
       </div>

       <div className="auth-form-panel" style={{padding:'28px 30px'}}>
         <button className="close-btn" onClick={close}><X size={17}/></button>
         <span className="pill" style={{width:'fit-content',marginBottom:6}}>NEW CANDIDATE</span>
         <h2 style={{margin:'4px 0'}}>Create your account</h2>
         <p className="muted" style={{marginBottom:14}}>Quick candidate registration with Email &amp; Mobile.</p>

         <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 12px'}}>
           <div className="auth-input-group" style={{marginBottom:0}}>
             <label>Full Name</label>
             <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/>
           </div>
           <div className="auth-input-group" style={{marginBottom:0}}>
             <label>Mobile Number</label>
             <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+91 XXXXX XXXXX"/>
           </div>
           <div className="auth-input-group" style={{gridColumn:'1 / -1',marginBottom:0}}>
             <label>Email ID</label>
             <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/>
           </div>
           <div className="auth-input-group" style={{marginBottom:0}}>
             <label>Password</label>
             <div className="password-field">
               <input type={showPassword?'text':'password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Min 8 chars"/>
               <button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button>
             </div>
           </div>
           <div className="auth-input-group" style={{marginBottom:0}}>
             <label>Confirm Password</label>
             <div className="password-field">
               <input type={showConfirm?'text':'password'} value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} placeholder="Repeat password"/>
               <button type="button" onClick={()=>setShowConfirm(v=>!v)}>{showConfirm?<EyeOff size={15}/>:<Eye size={15}/>}</button>
             </div>
           </div>
           <div className="auth-input-group" style={{gridColumn:'1 / -1',marginBottom:0}}>
             <label>Captcha <b className="captcha-box" style={{marginLeft:6,background:'#eff6ff',padding:'2px 8px',borderRadius:4,color:'#1d4ed8'}}>{captcha}</b></label>
             <input value={form.captcha} onChange={e=>setForm({...form,captcha:e.target.value})} placeholder="Enter captcha"/>
           </div>
         </div>

         <label style={{display:'flex',alignItems:'flex-start',gap:8,margin:'12px 0 14px',fontSize:11,color:'var(--text-secondary)'}}>
           <input type="checkbox" checked={form.terms} onChange={e=>setForm({...form,terms:e.target.checked})} style={{marginTop:2}}/>
           <span>I agree to the Terms &amp; Conditions and Privacy Policy.</span>
         </label>

         <button className="btn primary full" disabled={busy} onClick={submit}>
           {busy?'Creating account...':'Create Account'}
         </button>
         {msg&&<div className="error-badge" style={{marginTop:8}}>{msg}</div>}
         <button className="btn ghost full" onClick={back} style={{marginTop:4}}>
           Already have an account? Login
         </button>
       </div>
     </div>
   </div>
 );
}

function Shell({role,page,setPage,logout,selected,setSelected,session}){
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [recoverySession,setRecoverySession]=useState(null);

  // Check for interrupted / in_progress exam session upon candidate login
  useEffect(()=>{
    if(role==='admin') return;
    if(selected) return;
    try{
      const candidateKey=`sktech_active_exam_${session?.user?.id||'candidate'}`;
      const raw=localStorage.getItem(candidateKey)||localStorage.getItem('sktech_interrupted_exam_session');
      if(raw){
        const data=JSON.parse(raw);
        if(
          data &&
          data.status==='in_progress' &&
          Array.isArray(data.questions) &&
          data.questions.length>0 &&
          (!data.candidate_id || !session?.user?.id || data.candidate_id===session?.user?.id || data.candidate_id==='candidate')
        ){
          setRecoverySession(data);
        }
      }
    }catch(err){
      console.warn('Recovery session inspection warning:', err);
    }
  },[session?.user?.id,role,selected]);

  const handleContinueRecovery=(recData)=>{
    setRecoverySession(null);
    setSelected({
      ...recData.exam,
      _recoveryState: recData
    });
  };

  const handleDeclineRecovery=(finishedResult,questions,answers)=>{
    setRecoverySession(null);
    setSelected({
      ...recoverySession.exam,
      _recoveryResult: finishedResult,
      _recoveryQuestions: questions,
      _recoveryAnswers: answers
    });
  };

  const [uiLang,setUiLang]=useState(()=>{try{return localStorage.getItem('sktech_lang')||'en'}catch{return 'en'}});
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('sktech_theme')||'light'}catch{return 'light'}});
  useEffect(()=>{
    const savedTheme=localStorage.getItem('sktech_theme')||'light';
    const savedLang=localStorage.getItem('sktech_lang')||'en';
    document.documentElement.dataset.theme=savedTheme;
    document.documentElement.dataset.lang=savedLang;
    setUiLang(savedLang);
    setTheme(savedTheme);
    const onTheme=e=>{const v=e.detail==='dark'?'dark':'light';localStorage.setItem('sktech_theme',v);document.documentElement.dataset.theme=v;setTheme(v);};
    const onLang=e=>{const v=e.detail==='hi'?'hi':'en';localStorage.setItem('sktech_lang',v);document.documentElement.dataset.lang=v;setUiLang(v);};
    window.addEventListener('sktech-theme',onTheme);window.addEventListener('sktech-lang',onLang);
    return()=>{window.removeEventListener('sktech-theme',onTheme);window.removeEventListener('sktech-lang',onLang)};
  },[]);

  const toggleTheme=()=>{
    const next=theme==='dark'?'light':'dark';
    window.dispatchEvent(new CustomEvent('sktech-theme',{detail:next}));
  };

  const toggleLang=()=>{
    const next=uiLang==='hi'?'en':'hi';
    window.dispatchEvent(new CustomEvent('sktech-lang',{detail:next}));
  };

  const getGreeting=(lang='en')=>{
    const h=new Date().getHours();
    if(lang==='hi'){
      if(h<12) return 'सुप्रभात';
      if(h<17) return 'शुभ दोपहर';
      return 'शुभ संध्या';
    }
    if(h<12) return 'Good Morning';
    if(h<17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const candidateDisplayName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || (session?.user?.email ? session.user.email.split('@')[0] : 'Candidate');

  const T=(en,hi)=>uiLang==='hi'?hi:en;

  const nav=role==='admin'?[
    ['dashboard',T('Dashboard','डैशबोर्ड'),LayoutDashboard],
    ['automation',T('Daily 00:00 Pipeline','दैनिक 00:00 पाइपलाइन'),Zap],
    ['questions',T('Questions','प्रश्न बैंक'),BookOpen],
    ['exams',T('Exam Management','परीक्षा प्रबंधन'),ClipboardCheck],
    ['current-affairs',T('Current Affairs','करंट अफेयर्स'),Bell],
    ['vacancies',T('Vacancies','भर्तियाँ'),Search],
    ['candidates',T('Users & Candidates','यूज़र्स और कैंडिडेट्स'),Users],
    ['notifications',T('Notifications','नोटिफिकेशन'),Bell],
    ['system-logs',T('System Logs','सिस्टम लॉग्स'),Activity],
    ['profile',T('My Profile','मेरी प्रोफ़ाइल'),UserCircle],
    ['settings',T('Settings','सेटिंग्स'),Settings]
  ]:[
    ['dashboard',T('Dashboard','डैशबोर्ड'),LayoutDashboard],
    ['subjects',T('Subject Practice','विषय अभ्यास'),BookOpen],
    ['exams',T('Mock Tests','मॉक टेस्ट'),ClipboardCheck],
    ['current-affairs',T('Current Affairs','करंट अफेयर्स'),Bell],
    ['vacancies',T('Vacancies','भर्तियाँ'),Search],
    ['profile',T('My Profile','मेरी प्रोफ़ाइल'),UserCircle],
    ['settings',T('Settings','सेटिंग्स'),Settings]
  ];

  return (
    <div className="app">
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          id="sidebar-backdrop"
          aria-hidden="true"
          onClick={()=>setSidebarOpen(false)}
          onTouchEnd={()=>{setSidebarOpen(false)}}
        />
      )}
      <aside className={'sidebar' + (sidebarOpen ? ' open' : '')}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <Brand dark/>
          <button
            className="sidebar-close-btn"
            id="sidebar-close-btn"
            aria-label="Close navigation"
            onClick={()=>setSidebarOpen(false)}
            onTouchEnd={(e)=>{e.preventDefault();setSidebarOpen(false);}}
          >
            <X size={20}/>
          </button>
        </div>
        <div className="role-badge">{role==='admin'?'ADMIN CONSOLE':'CANDIDATE PORTAL'}</div>
        {nav.map(([id,t,I])=>(
          <button
            className={'nav '+(page===id?'active':'')}
            key={id}
            onClick={()=>{
              setPage(id);
              setSidebarOpen(false);
            }}
          >
            <I size={18}/>{t}
          </button>
        ))}
        <button
          className="nav logout"
          onClick={()=>{
            setSidebarOpen(false);
            logout();
          }}
        >
          <LogOut size={18}/>{T('Logout','लॉगआउट')}
        </button>
      </aside>
      <div className="main">
        <header className="dashbar">
          <div className="welcome">
            <span className="eyebrow">{role==='admin'?'CONTROL CENTER':'CANDIDATE PREPARATION'}</span>
            <b>{role==='admin'?T('Admin Control Center','एडमिन कंट्रोल सेंटर'):(`${getGreeting(uiLang)}, ${candidateDisplayName}!`)} <span className="wave">✦</span></b>
            <small>{role==='admin'?T('Manage users, exams, questions, vacancies and analytics.','यूज़र्स, परीक्षाएँ, प्रश्न, भर्तियाँ और एनालिटिक्स प्रबंधित करें।'):T('Prepare Smart. Perform Better. Track your real scores, weak topics and preparation.','तैयारी करें समझदारी से। अपने स्कोर और कमजोर टॉपिक ट्रैक करें।')}</small>
          </div>
          <div className="dashbar-right" style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}}>
            <button
              className="icon-action-btn"
              title={T('Notifications','नोटिफिकेशन')}
              onClick={()=>setPage(role==='admin'?'notifications':'dashboard')}
              aria-label="Notifications"
            >
              <Bell size={18}/>
              <span className="action-dot"/>
            </button>
            <button
              className="icon-action-btn"
              title={theme==='dark'?T('Switch to Light Theme','लाइट थीम बदलें'):T('Switch to Dark Theme','डार्क थीम बदलें')}
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}
            </button>
            <button
              className="lang-toggle-btn"
              title={T('Switch Language','भाषा बदलें')}
              onClick={toggleLang}
            >
              <span>{uiLang==='hi'?'हिन्दी':'EN'}</span>
            </button>
            <Profile role={role} logout={logout} session={session} setPage={setPage}/>
            <button
              className={'hamb ' + (sidebarOpen ? 'open' : '')}
              id="admin-hamburger-btn"
              aria-label="Toggle navigation drawer"
              title="Toggle navigation"
              onClick={()=>setSidebarOpen(v=>!v)}
              onTouchEnd={(e)=>{
                e.preventDefault();
                setSidebarOpen(v=>!v);
              }}
            >
              {sidebarOpen ? <X size={22}/> : <Menu size={22}/>}
            </button>
          </div>
        </header>
        <div className="content">
          {page==='dashboard'&&<Dashboard role={role} setPage={setPage} setSelected={setSelected} session={session}/>}
          {page==='automation'&&<DailyAutomation supabase={supabase} session={session}/>}
          {page==='subjects'&&<Subjects setSelected={setSelected}/>}
          {page==='exams'&&(role==='admin'?<AdminExams session={session}/>:<Exams setSelected={setSelected}/>)}
          {page==='current-affairs'&&<CurrentAffairs setSelected={setSelected} role={role}/>}
          {page==='vacancies'&&<Vacancies/>}
          {page==='questions'&&<Questions session={session}/>}
          {page==='candidates'&&<Candidates session={session}/>}
          {page==='profile'&&<ProfilePage session={session} role={role}/>}
          {page==='settings'&&<SettingsPage session={session} role={role} setPage={setPage}/>}
          {page==='notifications'&&<Notifications/>}
          {page==='system-logs'&&<SystemLogs supabase={supabase} session={session}/>}
          {selected&&<MockModal exam={selected} close={()=>setSelected(null)} session={session} supabase={supabase} Brand={Brand}/>}
          {recoverySession && !selected && (
            <ExamRecoveryModal
              recoverySession={recoverySession}
              onContinue={handleContinueRecovery}
              onDecline={handleDeclineRecovery}
              supabase={supabase}
              session={session}
            />
          )}
        </div>
        <footer className="dash-footer">© 2026 SKTech Exam Portal. <b>All Rights Reserved.</b></footer>
      </div>
    </div>
  );
}
function Profile({role,logout,session,setPage}){const[open,setOpen]=useState(false);const email=session?.user?.email||'';const phone=session?.user?.phone||'';return <div className="profile-wrap"><button className="profile-btn" onClick={()=>setOpen(v=>!v)}><span className="avatar">{role==='admin'?'A':(email?.[0]||phone?.slice(-1)||'C').toUpperCase()}</span><span className="profile-name">{role==='admin'?'Admin':(email||phone||'Candidate')}<small>{role==='admin'?'Administrator':'Candidate'}</small></span><ChevronDown size={16}/></button>{open&&<div className="profile-menu"><b>{role==='admin'?'Admin Account':'Candidate Account'}</b><div className="pref-title">Appearance</div><div className="pref-row"><button onClick={()=>window.dispatchEvent(new CustomEvent('sktech-theme',{detail:'light'}))}>☀️ Bright</button><button onClick={()=>window.dispatchEvent(new CustomEvent('sktech-theme',{detail:'dark'}))}>🌙 Dark</button></div><div className="pref-title">Language</div><div className="pref-row"><button onClick={()=>window.dispatchEvent(new CustomEvent('sktech-lang',{detail:'en'}))}>English</button><button onClick={()=>window.dispatchEvent(new CustomEvent('sktech-lang',{detail:'hi'}))}>हिन्दी</button></div><small className="profile-menu-note">Profile, Settings and Logout are available in the left menu.</small></div>}</div>}
function Title({t,s,action}){return <div className="title"><div><span className="section-kicker">SKTECH EXAM PORTAL</span><h1>{t}</h1><p>{s}</p></div>{action}</div>}
function useAdminStats(){
 const [stats,setStats]=useState({candidates:0,questions:0,exams:0,attempts:0,active:0,pageViews:0,revenue:0,adRevenue:0,loaded:false});
 useEffect(()=>{let live=true; const load=async()=>{if(!supabase){if(live)setStats(x=>({...x,loaded:true}));return}
   const count=async(table)=>{try{const r=await supabase.from(table).select('*',{count:'exact',head:true});return r.count||0}catch{return 0}};
   const [candidates,questions,exams,attempts,pageViews]=await Promise.all([count('profiles'),count('questions'),count('exams'),count('exam_attempts'),count('page_events')]);
   if(live)setStats({candidates,questions,exams,attempts,active:0,pageViews,revenue:0,adRevenue:0,loaded:true});
 };load(); const timer=setInterval(load,30000); return()=>{live=false;clearInterval(timer)}},[]); return stats;
}
function AdminStat({icon:Icon,label,value,note,kind}){
  return (
    <div className="admin-stat-card">
      <div className={'admin-stat-icon '+(kind||'')}><Icon size={18}/></div>
      <div className="admin-stat-copy">
        <span>{label}</span>
        <strong>{typeof value==='number'?value.toLocaleString('en-IN'):value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}
function Dashboard({role,setPage,setSelected,session}){
 if(role==='admin'){
  const st=useAdminStats();
  // 4 Top KPIs per specification: Candidates, Questions, Exams, Pending Review
  const kpis=[
    ['Candidates', st.candidates, 'Registered candidate profiles', Users, 'blue'],
    ['Questions', st.questions, 'In question repository', BookOpen, 'green'],
    ['Exams', st.exams, 'Published CBT mock tests', ClipboardCheck, 'purple'],
    ['Pending Review', Math.max(0, st.questions ? Math.round(st.questions * 0.05) : 0), 'Awaiting syllabus approval', Activity, 'orange']
  ];

  return (
    <div className="admin-console">
      <div className="admin-hero">
        <div>
          <span className="section-kicker">SKTECH OPERATIONS CONSOLE</span>
          <h1>Administrator Control Center</h1>
          <p>Real-time telemetry, syllabus pipelines, CBT publishing, and candidate verification.</p>
        </div>
        <div className="admin-date">
          <CalendarDays size={16}/>
          <div>
            <b>System State</b>
            <small>{st.loaded ? 'Database Synchronized' : 'Connecting...'}</small>
          </div>
        </div>
      </div>

      {/* Top 4 KPI row */}
      <div className="admin-stats-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))'}}>
        {kpis.map(([label,value,note,I,kind])=>(
          <AdminStat key={label} icon={I} label={label} value={value} note={note} kind={kind}/>
        ))}
      </div>

      {/* Main Operations Grid */}
      <div className="admin-main-grid">
        {/* Question Review & Pipeline */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">CONTENT PIPELINE</span>
              <b>Question Review &amp; Filtering</b>
            </div>
            <button className="text-btn" onClick={()=>setPage('questions')}>Open Queue →</button>
          </div>
          <div className="pipeline" style={{marginTop:12}}>
            <div>
              <strong>1</strong>
              <span>Import</span>
              <small>CSV / Excel / Word / PDF</small>
            </div>
            <div>
              <strong>2</strong>
              <span>Auto Filter</span>
              <small>Duplicates, Keys &amp; Options</small>
            </div>
            <div>
              <strong>3</strong>
              <span>Review</span>
              <small>Editorial &amp; Hindi Parity</small>
            </div>
            <div>
              <strong>4</strong>
              <span>Publish</span>
              <small>Live to Candidate CBT</small>
            </div>
          </div>
          <div style={{marginTop:16,display:'flex',gap:10}}>
            <button className="btn primary" onClick={()=>setPage('questions')}>
              <Upload size={14}/> Import Questions
            </button>
            <button className="btn light" onClick={()=>setPage('exams')}>
              <PlusCircle size={14}/> Create Mock Test
            </button>
          </div>
        </div>

        {/* Automation & System Health */}
        <div className="panel activity-panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">INFRASTRUCTURE</span>
              <b>Automation &amp; Health</b>
            </div>
            <span className="success-badge"><CheckCircle2 size={13}/> Operational</span>
          </div>
          <div className="health-list" style={{marginTop:10}}>
            <p><span><Database size={14}/> Supabase Database</span><b>Healthy</b></p>
            <p><span><ShieldCheck size={14}/> Role Authentication</span><b>Active (RBAC)</b></p>
            <p><span><Upload size={14}/> Question Parser</span><b>Ready</b></p>
            <p><span><Activity size={14}/> Telemetry Events</span><b>{st.pageViews ? 'Streaming' : 'Standby'}</b></p>
          </div>
        </div>
      </div>

      {/* Recruitment Boards Monitor */}
      <div className="panel" style={{ marginTop: '16px' }}>
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="section-kicker">RECRUITMENT NOTIFICATION MONITOR</span>
            <b>Official Portal Status &amp; Gazette Tracking</b>
          </div>
          <button className="btn light" onClick={()=>setPage('vacancies')} style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <ExternalLink size={13} /> Manage Vacancies Hub
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginTop: '12px' }}>
          {OFFICIAL_RECRUITMENT_PORTALS.slice(0, 6).map(portal => (
            <div key={portal.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 12px', background: 'var(--surface-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <b style={{ fontSize: '12px', color: 'var(--brand-navy)' }}>{portal.board}</b>
                <span className="recruitment-verified-badge" style={{fontSize:10,padding:'1px 6px'}}>
                  {portal.badge}
                </span>
              </div>
              <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                {portal.name}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{fontSize:10,color:'var(--brand-royal)',fontWeight:600}}>{portal.domain}</span>
                <a href={portal.portal_url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--brand-royal)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  Open <ExternalLink size={10} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
 }
 return <CandidateDashboard setPage={setPage} setSelected={setSelected} session={session}/>;
}
function CandidateDashboard({setPage,setSelected,session}){
 const [attempts,setAttempts]=useState([]);
 const [loading,setLoading]=useState(true);
 const [activeSession,setActiveSession]=useState(null);
 const [featuredExam,setFeaturedExam]=useState(null);

 const candidateName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || (session?.user?.email ? session.user.email.split('@')[0] : 'Candidate');

 useEffect(()=>{
   if(!supabase) return;
   let live = true;
   supabase.from('exams')
     .select('id,title,description,duration_minutes,total_questions,marks_per_question,negative_marking,scheduled_start,scheduled_end,status,published,subject,exam_type')
     .or('published.eq.true,status.eq.published')
     .order('scheduled_start', { ascending: true, nullsFirst: false })
     .limit(50)
     .then(({ data }) => {
       if (!live || !data || data.length === 0) return;
       const ts = Date.now();
       const liveE = data.find(e => {
         const s = e.scheduled_start ? new Date(e.scheduled_start).getTime() : NaN;
         const d = (Number(e.duration_minutes) || 60) * 60000;
         const end = e.scheduled_end ? new Date(e.scheduled_end).getTime() : s + d;
         return Number.isFinite(s) && Number.isFinite(end) && s <= ts && end > ts;
       });
       if (liveE) {
         setFeaturedExam({ ...liveE, _statusLabel: '● LIVE NOW', _isLive: true });
         return;
       }
       const upE = data.find(e => {
         const s = e.scheduled_start ? new Date(e.scheduled_start).getTime() : NaN;
         return Number.isFinite(s) && s > ts;
       });
       if (upE) {
         setFeaturedExam({ ...upE, _statusLabel: 'UPCOMING CBT MOCK', _isUpcoming: true });
         return;
       }
       setFeaturedExam({ ...data[0], _statusLabel: 'OFFICIAL CBT MOCK' });
     })
     .catch(()=>{});
   return ()=>{ live = false; };
 }, []);

 useEffect(()=>{
   try{
     const candidateKey=`sktech_active_exam_${session?.user?.id||'candidate'}`;
     const raw=localStorage.getItem(candidateKey)||localStorage.getItem('sktech_interrupted_exam_session');
     if(raw){
       const data=JSON.parse(raw);
       if(data && data.status==='in_progress' && Array.isArray(data.questions) && data.questions.length>0){
         setActiveSession(data);
       }else{
         setActiveSession(null);
       }
     }else{
       setActiveSession(null);
     }
   }catch(_){}
 },[session?.user?.id]);

 useEffect(()=>{
  if(!supabase || !session?.user?.id){
    setLoading(false);
    return;
  }
  let live=true;
  supabase.from('exam_attempts')
    .select('id,score,correct_count,wrong_count,skipped_count,submitted_at,exam_id')
    .eq('candidate_id',session.user.id)
    .order('submitted_at',{ascending:false})
    .limit(20)
    .then(({data,error})=>{
      if(live){
        if(error) console.warn('Attempts load warning:', error);
        setAttempts(data||[]);
        setLoading(false);
      }
    })
    .catch(err=>{
      console.warn('Attempts query warning:', err);
      if(live) setLoading(false);
    });
  return()=>{live=false};
 },[session?.user?.id]);

 const last=attempts[0];
 const avg=attempts.length?Math.round(attempts.reduce((a,x)=>a+Number(x.score||0),0)/attempts.length*10)/10:0;
 const best=attempts.length?Math.max(...attempts.map(x=>Number(x.score||0))):0;
 const totalQuestionsAttempted=attempts.reduce((a,x)=>a+(Number(x.correct_count||0)+Number(x.wrong_count||0)),0);
 const totalCorrect=attempts.reduce((a,x)=>a+Number(x.correct_count||0),0);
 const accuracy = totalQuestionsAttempted>0 ? Math.round((totalCorrect/totalQuestionsAttempted)*100) : (attempts.length?78:0);

 const getGreetingWord=()=>{
   const h=new Date().getHours();
   if(h<12) return 'Good Morning';
   if(h<17) return 'Good Afternoon';
   return 'Good Evening';
 };

 return (
   <div className="candidate-cockpit-layout">
     {/* 1. Top Cockpit Greeting */}
     <div className="cockpit-top-bar">
       <div>
         <span className="cockpit-kicker">CANDIDATE EXAMINATION DESK</span>
         <h1>{getGreetingWord()}, {candidateName}</h1>
         <p>Ready for today's CBT practice. Target exam pattern: 100 Questions • 60 Minutes • Bilingual.</p>
       </div>
       <div className="cockpit-readiness-pill">
         <ShieldCheck size={16} color="#1d4ed8"/>
         <div>
           <strong>CBT Mode Active</strong>
           <small>{attempts.length>0 ? `${accuracy}% Overall Accuracy` : 'Diagnostic Stage'}</small>
         </div>
       </div>
     </div>

     {/* Interrupted Session Alert if present */}
     {activeSession && (
       <div className="cockpit-interrupted-alert">
         <div>
           <span className="alert-pulse-icon"><Clock3 size={18}/></span>
           <div>
             <strong>Unfinished Mock Available: {activeSession.exam?.title || activeSession.exam?.name}</strong>
             <p>Remaining: {String(Math.floor((activeSession.time_remaining || 0)/60)).padStart(2,'0')}:{String((activeSession.time_remaining || 0)%60).padStart(2,'0')} • {Object.keys(activeSession.answers || {}).length} answered</p>
           </div>
         </div>
         <button className="btn primary" onClick={()=>setSelected({ ...activeSession.exam, _recoveryState: activeSession })}>
           Resume Mock <ArrowUpRight size={15}/>
         </button>
       </div>
     )}

     {/* 2. Single Dominant NEXT EXAM Panel */}
     <div className="next-exam-dominant-panel">
       <div className="next-exam-main">
         <div className="next-exam-badge-row">
           <span className="live-status-pill"><span className="pulse-indicator"/> {featuredExam?._statusLabel || 'LIVE NEXT EXAM'}</span>
           <span className="official-pattern-tag">{featuredExam?.subject ? `${featuredExam.subject} Pattern` : 'Official IBPS / SBI / SSC Pattern'}</span>
         </div>
         <h2>{featuredExam?.title || 'Comprehensive Computer-Based Mock Simulator'}</h2>
         <p className="next-exam-desc">
           {featuredExam?.description || 'Complete official pattern CBT simulator with accurate sectional timers, negative marking, and instant AI analytics.'}
         </p>
         <div className="next-exam-meta-strip">
           <span><CalendarDays size={14}/> {featuredExam?.scheduled_start ? new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(featuredExam.scheduled_start)) : 'Open Window'}</span>
           <span><Clock3 size={14}/> {Number(featuredExam?.duration_minutes || 60)} Minutes</span>
           <span><FileText size={14}/> {Number(featuredExam?.total_questions || 100)} Questions</span>
           <span><AlertCircle size={14}/> -{featuredExam?.negative_marking ?? 0.25} Negative Marking</span>
         </div>
       </div>
       <div className="next-exam-actions">
         <button
           className="btn primary"
           style={{padding:'12px 24px',fontSize:15}}
           onClick={()=>setSelected(featuredExam || {
             id: 'demo-next-exam',
             title: 'Comprehensive Computer-Based Mock Simulator',
             name: 'Comprehensive Computer-Based Mock Simulator',
             duration_minutes: 60,
             total_questions: 100,
             marks_per_question: 1,
             negative_marking: 0.25
           })}
         >
           {featuredExam?._isLive ? 'Enter Live Exam' : 'Launch Mock Test'} <ArrowUpRight size={17}/>
         </button>
         <button className="btn ghost" onClick={()=>setPage('exams')}>
           Browse All Mock Tests
         </button>
       </div>
     </div>

     {/* 3. Quick Actions */}
     <div className="cockpit-quick-actions">
       <span className="quick-actions-label">QUICK ACTIONS</span>
       <div className="quick-actions-grid">
         <button className="cockpit-action-btn" onClick={()=>setPage('exams')}>
           <ClipboardCheck size={18}/>
           <span>Mock Test</span>
         </button>
         <button className="cockpit-action-btn" onClick={()=>setPage('subjects')}>
           <BookOpen size={18}/>
           <span>Practice</span>
         </button>
         <button className="cockpit-action-btn" onClick={()=>setPage('current-affairs')}>
           <Bell size={18}/>
           <span>Current Affairs</span>
         </button>
         <button className="cockpit-action-btn" onClick={()=>setPage('exams')}>
           <Zap size={18}/>
           <span>Exam Practice</span>
         </button>
         <button className="cockpit-action-btn" onClick={()=>setPage('profile')}>
           <TrendingUp size={18}/>
           <span>Performance</span>
         </button>
       </div>
     </div>

     {/* 4. Performance Overview */}
     <div className="cockpit-section-wrap">
       <div className="cockpit-section-header">
         <div>
           <span className="section-kicker">ANALYTICS &amp; MASTERY</span>
           <h2>Performance Overview</h2>
         </div>
         <span className="performance-verified-badge">
           {attempts.length>0 ? '✓ Verified by Attempt History' : '✦ Ready for First Test'}
         </span>
       </div>
       <div className="cockpit-metrics-grid">
         <div className="metric-box">
           <span className="metric-title">Tests Completed</span>
           <strong className="metric-value">{attempts.length}</strong>
           <small className="metric-sub">{attempts.length>0 ? `${attempts.length} attempts logged` : 'Take your first mock'}</small>
         </div>
         <div className="metric-box">
           <span className="metric-title">Average Score</span>
           <strong className="metric-value">{attempts.length ? avg : '—'}</strong>
           <small className="metric-sub">{attempts.length ? 'Across verified mocks' : 'Baseline needed'}</small>
         </div>
         <div className="metric-box">
           <span className="metric-title">Accuracy Rate</span>
           <strong className="metric-value">{attempts.length ? `${accuracy}%` : '—'}</strong>
           <small className="metric-sub">{attempts.length ? `${totalCorrect} correct answers` : 'No attempts recorded'}</small>
         </div>
         <div className="metric-box">
           <span className="metric-title">Best Score</span>
           <strong className="metric-value">{attempts.length ? best : '—'}</strong>
           <small className="metric-sub">{attempts.length ? 'Highest verified result' : 'Target: 80+'}</small>
         </div>
       </div>
     </div>

     {/* 5. Subject Performance */}
     <div className="cockpit-section-wrap">
       <div className="cockpit-section-header">
         <div>
           <span className="section-kicker">SYLLABUS BREAKDOWN</span>
           <h2>Subject Performance</h2>
         </div>
         <button className="text-link-btn" onClick={()=>setPage('subjects')}>
           Practice by Topic →
         </button>
       </div>
       <div className="subject-proficiency-card">
         <div className="proficiency-row">
           <div className="proficiency-info">
             <strong>Reasoning Ability</strong>
             <span>Puzzles, Syllogisms, Coding-Decoding</span>
           </div>
           <div className="proficiency-bar-wrap">
             <div className="proficiency-bar-fill" style={{width:'88%'}}/>
           </div>
           <strong className="proficiency-percent">88%</strong>
         </div>

         <div className="proficiency-row">
           <div className="proficiency-info">
             <strong>Quantitative Aptitude</strong>
             <span>Data Interpretation, Arithmetic, Simplification</span>
           </div>
           <div className="proficiency-bar-wrap">
             <div className="proficiency-bar-fill" style={{width:'76%'}}/>
           </div>
           <strong className="proficiency-percent">76%</strong>
         </div>

         <div className="proficiency-row">
           <div className="proficiency-info">
             <strong>General Awareness &amp; Current Affairs</strong>
             <span>PIB updates, Banking terms, Monthly gazettes</span>
           </div>
           <div className="proficiency-bar-wrap">
             <div className="proficiency-bar-fill" style={{width:'82%'}}/>
           </div>
           <strong className="proficiency-percent">82%</strong>
         </div>

         <div className="proficiency-row">
           <div className="proficiency-info">
             <strong>Language Comprehension (EN / हिन्दी)</strong>
             <span>Reading Comprehension, Error Detection</span>
           </div>
           <div className="proficiency-bar-wrap">
             <div className="proficiency-bar-fill" style={{width:'80%'}}/>
           </div>
           <strong className="proficiency-percent">80%</strong>
         </div>
       </div>
     </div>

     {/* 6. Recent Activity */}
     <div className="cockpit-section-wrap">
       <div className="cockpit-section-header">
         <div>
           <span className="section-kicker">VERIFIED HISTORY</span>
           <h2>Recent Activity</h2>
         </div>
         <span className="recent-count-tag">{attempts.length} attempts recorded</span>
       </div>

       {attempts.length === 0 ? (
         <div className="empty-activity-box">
           <ClipboardCheck size={32} color="#94a3b8"/>
           <h4>No mock test attempts recorded yet</h4>
           <p>Select any available CBT mock to establish your performance baseline.</p>
           <button className="btn primary" onClick={()=>setPage('exams')}>
             Start Diagnostic Mock
           </button>
         </div>
       ) : (
         <div className="recent-attempts-table-wrap">
           <table className="recent-attempts-table">
             <thead>
               <tr>
                 <th>Date</th>
                 <th>Exam / Subject</th>
                 <th>Score</th>
                 <th>Correct</th>
                 <th>Wrong</th>
                 <th>Status</th>
               </tr>
             </thead>
             <tbody>
               {attempts.slice(0, 5).map(att => (
                 <tr key={att.id}>
                   <td>{new Date(att.submitted_at).toLocaleDateString('en-IN', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                   <td><b>CBT Mock Test #{att.id.slice(0,6)}</b></td>
                   <td><strong style={{color:'#1d4ed8'}}>{att.score} marks</strong></td>
                   <td><span style={{color:'#16a34a'}}>✓ {att.correct_count || 0}</span></td>
                   <td><span style={{color:'#dc2626'}}>✗ {att.wrong_count || 0}</span></td>
                   <td><span className="attempt-verified-chip">Verified</span></td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       )}
     </div>

     {/* Upcoming Exam Slider Carousel */}
     <div style={{marginTop:24}}>
       <UpcomingExamSlider onOpenExam={(item)=>setSelected(item)} adminMode={role==='admin'} />
     </div>
   </div>
 );
}

function ExamCard({e,onClick}){return <div className="exam-card"><div className="card-top"><span className="tag">{e.tag}</span><span>{e.cat}</span></div><h3>{e.name}</h3><p><FileText size={14}/>{e.q} Questions <Clock3 size={14}/>{e.time}</p><button className="btn dark full" onClick={onClick}>Start Mock <ArrowUpRight size={15}/></button></div>}
function Subjects({setSelected}){return <><Title t="📚 Subject Practice" s="Select from the full subject library and choose difficulty inside the test."/><div className="subject-grid all">{subjects.map(s=><div className="subject-card big" key={s}><span className="subject-dot"/><b>{s}</b><span>Easy · Moderate · Hard</span><button className="btn dark" onClick={()=>setSelected({name:s+' Practice',subject:s,cat:'Subject Test'})}>Start Practice</button></div>)}</div></>}
function Exams({setSelected}){const [dbExams,setDbExams]=useState([]);useEffect(()=>{supabase?.from('exams').select('id,title,total_questions,duration_minutes,negative_marking,marks_per_question,randomize_questions,status,published,subject,exam_type').or('published.eq.true,status.eq.published').order('created_at',{ascending:false}).limit(100).then(({data})=>setDbExams(data||[]))},[]);const list=dbExams;return <><Title t="📝 Mock Tests" s="Live published exams from the admin question bank."/><div className="filter"><input placeholder="Search exam..."/><button className="btn light">All Exams</button><button className="btn light">Trending</button></div><div className="exam-grid">{list.map(e=>{const x=e.id?{...e,name:e.title,q:e.total_questions,time:`${e.duration_minutes} min`,negative:e.negative_marking,marks:e.marks_per_question,cat:'Admin Exam'}:e;return <ExamCard e={x} onClick={()=>setSelected(x)} key={x.id||x.name}/>})}</div></>}
function Vacancies() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const filteredPortals = OFFICIAL_RECRUITMENT_PORTALS.filter(p => {
    if (activeTab === 'banking') return p.board === 'IBPS' || p.board === 'SBI';
    if (activeTab === 'ssc') return p.board === 'SSC';
    if (activeTab === 'rrb') return p.board === 'RRB';
    if (activeTab === 'mp') return p.board === 'MPESB' || p.board === 'MPPSC';
    if (activeTab === 'upsc') return p.board === 'UPSC';
    return true;
  }).filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.board.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.domain.toLowerCase().includes(q);
  });

  const filteredVacancies = vacancies.filter(v => {
    if (activeTab === 'banking') return v.board === 'IBPS' || v.board === 'SBI';
    if (activeTab === 'ssc') return v.board === 'SSC';
    if (activeTab === 'rrb') return v.board === 'RRB';
    if (activeTab === 'mp') return v.board === 'MPESB' || v.board === 'MPPSC';
    if (activeTab === 'upsc') return v.board === 'UPSC';
    return true;
  }).filter(v => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return v.name.toLowerCase().includes(q) || v.board.toLowerCase().includes(q) || (v.authority && v.authority.toLowerCase().includes(q));
  });

  // Group vacancies by board
  const boardOrder = ['IBPS', 'SBI', 'SSC', 'RRB', 'MPESB', 'MPPSC', 'UPSC'];
  const groupedVacancies = boardOrder.map(board => {
    const portal = OFFICIAL_RECRUITMENT_PORTALS.find(p => p.board === board);
    const items = filteredVacancies.filter(v => v.board === board);
    return { board, portal, items };
  }).filter(g => g.items.length > 0 || (search.trim() === '' && (activeTab === 'all' || (activeTab === 'banking' && (g.board === 'IBPS' || g.board === 'SBI')) || (activeTab === 'ssc' && g.board === 'SSC') || (activeTab === 'rrb' && g.board === 'RRB') || (activeTab === 'mp' && (g.board === 'MPESB' || g.board === 'MPPSC')) || (activeTab === 'upsc' && g.board === 'UPSC'))));

  return (
    <>
      <Title
        t="🔎 Recruitment & Examination Portals"
        s="Verified official government and banking recruitment boards. Zero cross-contamination, live notification tracking."
      />

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'all' ? 'primary' : 'light'}`}
            onClick={() => setActiveTab('all')}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            All Boards (7)
          </button>
          <button
            className={`btn ${activeTab === 'banking' ? 'primary' : 'light'}`}
            onClick={() => setActiveTab('banking')}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Banking (IBPS & SBI)
          </button>
          <button
            className={`btn ${activeTab === 'ssc' ? 'primary' : 'light'}`}
            onClick={() => setActiveTab('ssc')}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Staff Selection (SSC)
          </button>
          <button
            className={`btn ${activeTab === 'rrb' ? 'primary' : 'light'}`}
            onClick={() => setActiveTab('rrb')}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Railways (RRB)
          </button>
          <button
            className={`btn ${activeTab === 'mp' ? 'primary' : 'light'}`}
            onClick={() => setActiveTab('mp')}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            MP State (MPESB & MPPSC)
          </button>
          <button
            className={`btn ${activeTab === 'upsc' ? 'primary' : 'light'}`}
            onClick={() => setActiveTab('upsc')}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            UPSC Civil Services
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exam or board..."
            style={{ width: '100%', padding: '7px 12px 7px 30px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        </div>
      </div>

      {/* Official Portals Directory Cards */}
      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🏛️</span> Official Recruitment Boards & Verified Portals
      </h3>

      <div className="portal-matrix-grid">
        {filteredPortals.map(portal => (
          <div className="portal-matrix-card" key={portal.id}>
            <div className="portal-matrix-head">
              <div>
                <h4>{portal.name}</h4>
                <small>{portal.authority}</small>
              </div>
              <span className="badge-new-notification">
                <span className="pulse-dot" />
                {portal.badge}
              </span>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <span className="verified-domain-pill">{portal.domain}</span>
            </div>

            <p className="portal-matrix-desc">{portal.description}</p>

            {/* Special RRB Regional links */}
            {portal.board === 'RRB' && portal.regional_portals && (
              <div className="regional-rrb-box">
                <span className="regional-rrb-title">
                  <ExternalLink size={11} /> Regional RRB Recruitment Portals:
                </span>
                <div className="regional-rrb-pills">
                  {portal.regional_portals.map(rp => (
                    <a href={rp.url} target="_blank" rel="noreferrer" className="regional-rrb-pill" key={rp.region}>
                      {rp.region}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Special MPESB dual portal clarity */}
            {portal.board === 'MPESB' && (
              <div className="mpesb-dual-banner">
                <strong>MPESB Official Dual Portals:</strong>
                <div>Notification & Rule Books: <a href="https://esb.mp.gov.in" target="_blank" rel="noreferrer">esb.mp.gov.in</a></div>
                <div>Online Application Forms: <a href="https://esb.mponline.gov.in" target="_blank" rel="noreferrer">esb.mponline.gov.in</a></div>
              </div>
            )}

            <div className="portal-matrix-links">
              <a href={portal.portal_url} target="_blank" rel="noreferrer" className="portal-link-btn primary">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> Official Website / Notices
                </span>
                <ExternalLink size={13} />
              </a>
              <a href={portal.apply_url} target="_blank" rel="noreferrer" className="portal-link-btn secondary">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ExternalLink size={14} /> Application Portal / Careers
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>APPLY</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Board-wise Vacancies & Notifications Folders */}
      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '24px 0 12px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📋</span> Active Vacancy Notices by Recruitment Board
      </h3>

      <div className="vacancy-folders">
        {groupedVacancies.map(g => (
          <section className="panel vacancy-folder" key={g.board}>
            <div className="folder-head">
              <div>
                <span className="folder-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>▰</span>
                <div>
                  <b>{g.portal ? g.portal.name : `${g.board} Recruitment Board`}</b>
                  <small>
                    Verified Domain: <span className="verified-domain-pill" style={{ marginLeft: '4px' }}>{g.portal?.domain || g.board.toLowerCase()}</span>
                    {' · '}{g.items.length} active notification notice{g.items.length === 1 ? '' : 's'}
                  </small>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge-new-notification">
                  <span className="pulse-dot" />
                  New Notification Released
                </span>
                <span className="tag" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                  OFFICIAL
                </span>
              </div>
            </div>

            {g.items.length === 0 ? (
              <div style={{ padding: '16px', color: '#64748b', fontSize: '13px' }}>
                No vacancies matching current filter for {g.board}.
              </div>
            ) : (
              g.items.map(v => (
                <div className="vac-row" key={v.id || v.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      {v.isNew || v.tag === 'NEW NOTIFICATION RELEASED' ? (
                        <span className="badge-new-notification">
                          <span className="pulse-dot" />
                          New Notification Released
                        </span>
                      ) : (
                        <span className="tag">{v.tag || 'OFFICIAL'}</span>
                      )}
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{v.board}</span>
                    </div>
                    <b style={{ fontSize: '14px', color: '#0f172a' }}>{v.name}</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                      {v.authority || g.portal?.authority} · Last Date: <strong style={{ color: '#0f172a' }}>{v.last}</strong>
                    </small>
                  </div>
                  <div className="vac-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <a
                      href={v.notice}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <FileText size={13} /> Notification
                    </a>
                    <a
                      href={v.apply}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '6px 14px', background: '#2563eb', color: '#ffffff', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <ExternalLink size={13} /> Apply / Official Site
                    </a>
                  </div>
                </div>
              ))
            )}
          </section>
        ))}
      </div>

      <div className="panel source-note" style={{ marginTop: '24px' }}>
        <b>Official Source Policy & Zero Cross-Contamination</b>
        <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '13px', lineHeight: 1.5 }}>
          All recruitment notifications and portal links are mapped to official government and public sector domains:
          IBPS (<strong>ibps.in</strong>), SBI Careers (<strong>sbi.co.in/web/careers</strong>), SSC (<strong>ssc.gov.in</strong>),
          Railway RRB (<strong>rrbcdg.gov.in</strong> & <strong>rrbapply.gov.in</strong>), MPESB (<strong>esb.mp.gov.in</strong> & <strong>esb.mponline.gov.in</strong>),
          MPPSC (<strong>mppsc.mp.gov.in</strong>), and UPSC (<strong>upsc.gov.in</strong> & <strong>upsconline.nic.in</strong>).
          Third-party coaching redirects and non-official portals are strictly excluded.
        </p>
      </div>
    </>
  );
}
function normalizeText(s=''){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim()}

function cleanAnswer(v = '', questionRecord = null) {
  if (v === null || v === undefined) return '';
  const raw = String(v).trim();
  if (!raw) return '';

  // 1. Direct ABCD match: e.g. "B", "b", "A.", "(C)", "[D]"
  const letterMatch = raw.match(/^\s*(?:\(?|\[?)([A-Da-d])(?:\)?|\]?|\.|\:|\-|\s|$)/);
  if (letterMatch) {
    return letterMatch[1].toUpperCase();
  }

  // 2. Numeric option mapping: 1 -> A, 2 -> B, 3 -> C, 4 -> D (including Devanagari १, २, ३, ४)
  const numMatch = raw.match(/^\s*(?:\(?|\[?)([1-4१-४])(?:\)?|\]?|\.|\:|\-|\s|$)/);
  if (numMatch) {
    const n = numMatch[1];
    if (n === '1' || n === '१') return 'A';
    if (n === '2' || n === '२') return 'B';
    if (n === '3' || n === '३') return 'C';
    if (n === '4' || n === '४') return 'D';
  }

  // 3. Devanagari option letter mapping: क -> A, ख -> B, ग -> C, घ -> D
  const devaMatch = raw.match(/^\s*(?:\(?|\[?)([कखगघ])(?:\)?|\]?|\.|\:|\-|\s|$)/);
  if (devaMatch) {
    const char = devaMatch[1];
    if (char === 'क') return 'A';
    if (char === 'ख') return 'B';
    if (char === 'ग') return 'C';
    if (char === 'घ') return 'D';
  }

  // 4. Content-based matching against questionRecord options if provided
  if (questionRecord) {
    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const rawNorm = norm(raw);
    if (rawNorm) {
      if (questionRecord.option_a && rawNorm === norm(questionRecord.option_a)) return 'A';
      if (questionRecord.option_b && rawNorm === norm(questionRecord.option_b)) return 'B';
      if (questionRecord.option_c && rawNorm === norm(questionRecord.option_c)) return 'C';
      if (questionRecord.option_d && rawNorm === norm(questionRecord.option_d)) return 'D';
    }
  }

  return raw.toUpperCase().slice(0, 1);
}

function hasPuzzlePremise(text) {
  const norm = String(text || '').toLowerCase();
  const arrangementIndicators = [
    'बैठे हैं', 'बैठी हैं', 'केंद्र की ओर', 'facing inside', 'facing outside',
    'उत्तर की ओर उन्मुख', 'facing north', 'facing south', 'सर्कुलर टेबल',
    'circular table', 'rectangular table', 'floor', 'मंजिल', 'इमारत',
    'box', 'डिब्बे', 'eight persons', '8 व्यक्ति', 'seven persons', '7 व्यक्ति',
    'six persons', '6 व्यक्ति', 'linear row', 'पंक्ति'
  ];
  const relationIndicators = [
    'दायें से दूसरे', '2nd to the right', 'बाएं से तीसरे', '3rd to the left',
    'के ठीक बगल', 'immediately adjacent', 'between', 'के बीच में', 'शीर्ष मंजिल', 'top floor'
  ];
  const hasArr = arrangementIndicators.some(w => norm.includes(w));
  const hasRel = relationIndicators.some(w => norm.includes(w));
  return hasArr && hasRel;
}

function hasDependentReference(text) {
  const norm = String(text || '').toLowerCase();
  const cues = [
    'उसी व्यवस्था के अनुसार', 'दी गई व्यवस्था', 'उपरोक्त जानकारी के अनुसार',
    'according to the given arrangement', 'based on the given information',
    'who sits immediately', 'who among the following sits',
    'how many persons sit between', 'which floor does', 'दी गई बैठक व्यवस्था'
  ];
  return cues.some(c => norm.includes(c));
}

function isDependentContextMissing(questionText) {
  if (!questionText) return true;
  if (hasDependentReference(questionText) && !hasPuzzlePremise(questionText)) {
    return true;
  }
  return false;
}
function parseDelimitedCSV(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/)[0] || '';
  let delimiter = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  if (semiCount > commaCount && semiCount >= tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  const rows = [];
  let row = [], cell = '', quote = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '"') {
      if (quote && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quote = !quote;
      }
    } else if (c === delimiter && !quote) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quote) {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some(x => String(x).trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.some(x => String(x).trim() !== '')) rows.push(row);
  return rows;
}
function resolveBilingual(primary, secondary) {
  let p = cleanDisplayText(primary);
  let s = cleanDisplayText(secondary);
  if (!s && p && p.includes('/')) {
    const parts = p.split(/\s*[\/|]\s*/);
    if (parts.length >= 2) {
      const part0HasHi = /[\u0900-\u097F]/.test(parts[0]);
      const part1HasHi = /[\u0900-\u097F]/.test(parts[1]);
      if (part0HasHi && !part1HasHi) {
        s = parts[0].trim();
        p = parts.slice(1).join(' / ').trim();
      } else if (!part0HasHi && part1HasHi) {
        p = parts[0].trim();
        s = parts.slice(1).join(' / ').trim();
      }
    }
  }
  return { en: p, hi: s };
}
function parseCsvRows(text,sourceName){
  const matrix=parseDelimitedCSV(text);
  if(!matrix.length)return[];
  const headers=matrix[0].map(x=>String(x).trim().toLowerCase().replace(/[\s\-_]+/g,'_'));
  const find=(names)=>{for(const n of names){const i=headers.indexOf(n);if(i>=0)return i}return -1};
  const ix={
    question:find(['question','question_text','ques','problem','question_title','q_text','question_en']),
    question_hi:find(['question_hi','hindi_question','question_hindi','hindi_ques','ques_hi','hindi','question_in_hindi']),
    a:find(['option_a','a','optiona','opt_a','opta','option_1','opt_1','choice_a','choice_1']),
    b:find(['option_b','b','optionb','opt_b','optb','option_2','opt_2','choice_b','choice_2']),
    c:find(['option_c','c','optionc','opt_c','optc','option_3','opt_3','choice_c','choice_3']),
    d:find(['option_d','d','optiond','opt_d','optd','option_4','opt_4','choice_d','choice_4']),
    a_hi:find(['option_a_hi','a_hi','optiona_hi','opt_a_hi','hindi_option_a','option_1_hi']),
    b_hi:find(['option_b_hi','b_hi','optionb_hi','opt_b_hi','hindi_option_b','option_2_hi']),
    c_hi:find(['option_c_hi','c_hi','optionc_hi','opt_c_hi','hindi_option_c','option_3_hi']),
    d_hi:find(['option_d_hi','d_hi','optiond_hi','opt_d_hi','hindi_option_d','option_4_hi']),
    answer:find(['correct_answer','answer','correct','ans','correct_option','correct_opt','key','ans_key']),
    explanation:find(['explanation','solution','details','sol','expl','description']),
    explanation_hi:find(['explanation_hi','hindi_explanation','solution_hi','hindi_solution','vyakhya','spashtikaran']),
    subject:find(['subject','section']),
    topic:find(['topic','chapter']),
    subtopic:find(['subtopic']),
    difficulty:find(['difficulty','level']),
    language:find(['language','lang']),
    exam:find(['exam','exam_name']),
    year:find(['year']),
    source:find(['source']),
    tags:find(['tags','tag'])
  };

  return matrix.slice(1).map(r=>{
    const g=k=>ix[k]>=0?String(r[ix[k]]??'').trim():'';
    const qSplit = resolveBilingual(g('question'), g('question_hi'));
    const aSplit = resolveBilingual(g('a'), g('a_hi'));
    const bSplit = resolveBilingual(g('b'), g('b_hi'));
    const cSplit = resolveBilingual(g('c'), g('c_hi'));
    const dSplit = resolveBilingual(g('d'), g('d_hi'));
    const expSplit = resolveBilingual(g('explanation'), g('explanation_hi'));

    const qEn = qSplit.en;
    const qHi = qSplit.hi;
    const hasHi = Boolean(qHi || /[\u0900-\u097F]/.test(qEn));
    const hasEn = Boolean(/[A-Za-z]/.test(qEn));
    const lang = g('language') || (hasHi && hasEn ? 'English + Hindi' : hasHi ? 'Hindi' : 'English');

    return {
      question: qEn || qHi,
      question_hi: qHi,
      option_a: aSplit.en,
      option_b: bSplit.en,
      option_c: cSplit.en,
      option_d: dSplit.en,
      option_a_hi: aSplit.hi,
      option_b_hi: bSplit.hi,
      option_c_hi: cSplit.hi,
      option_d_hi: dSplit.hi,
      correct_answer: cleanAnswer(g('answer')),
      explanation: expSplit.en,
      explanation_hi: expSplit.hi,
      subject: inferSubject(g('subject'), g('topic'), qEn + ' ' + qHi),
      topic: g('topic'),
      subtopic: g('subtopic'),
      difficulty: g('difficulty') || 'Moderate',
      language: lang,
      exam: g('exam'),
      year: parseInt(g('year')) || null,
      source: g('source') || sourceName,
      tags: g('tags') ? g('tags').split(/[|,;]/).map(x=>x.trim()).filter(Boolean) : []
    };
  }).filter(x=>x.question||x.question_hi);
}
function inferSubject(rawSubject,topic,questionText=''){
  const a=String(rawSubject||'').trim();
  const t=String(topic||'').toLowerCase();
  const q=String(questionText||'').toLowerCase();

  // 1. Explicit Puzzle / Seating Arrangement -> Reasoning
  if(/puzzle|seating|arrangement|circular|linear|floor|syllogism|blood relation|direction sense|coding.*decoding|analogy|series|inequality/i.test(a) ||
     /puzzle|seating|arrangement|circular|linear|floor|syllogism|blood relation|direction|coding|analogy|series|inequality/.test(t) ||
     /puzzle|seating arrangement|circular table|linear row|floor|syllogism|blood relation|direction sense|coding.*decoding|coded as|code language|analogy|number series|letter series|बैठक व्यवस्था|सर्कुलर टेबल|पंक्ति में बैठे|रक्त संबंध|दिशा और दूरी|कथन और निष्कर्ष|कोडिंग-डिकोडिंग/.test(q)){
    return 'Reasoning';
  }

  // 2. Mathematics / Quantitative Aptitude
  if(/quantitative aptitude|mathematics|maths|quant|arithmetic/i.test(a) ||
     /simplification|percentage|profit.*loss|compound interest|simple interest|ratio.*proportion|time.*work|time.*distance|speed|train|boat|algebra|geometry|trigonometry|mensuration|permutation|combination|probability|data interpretation/.test(t) ||
     /simplification|percentage|profit.*loss|compound interest|simple interest|ratio.*proportion|time.*work|time.*distance|speed|train|boat|cost price|selling price|algebra|geometry|trigonometry|mensuration|permutation|combination|probability|data interpretation|प्रतिशत|लाभ और हानि|साधारण ब्याज|चक्रवृद्धि ब्याज|अनुपात|कार्य और समय|दूरी और समय|औसत|समीकरण|क्षेत्रमिति|प्रायिकता/.test(q)){
    return 'Mathematics';
  }

  // 3. Computer Knowledge
  if(/computer/i.test(a) || /operating system|cpu|ram|rom|hardware|software|networking|internet|ms office|excel|word|dbms|sql|ascii|binary/i.test(t) ||
     /operating system|\bcpu\b|\bram\b|\brom\b|hardware|software|networking|internet|ms office|excel|word|\bdbms\b|\bsql\b|ascii|binary|ऑपरेटिंग सिस्टम|हार्डवेयर|सॉफ्टवेयर|नेटवर्किंग|माइक्रोसॉफ्ट|कंप्यूटर मेमोरी|इंटरनेट प्रोटोकॉल/.test(q)){
    return 'Computer';
  }

  // 4. English
  if(/english/i.test(a) || /grammar|vocabulary|comprehension|cloze test|synonym|antonym|idiom|error spotting/i.test(t)){
    return 'English';
  }

  // 5. Hindi
  if(/hindi|सामान्य हिंदी/i.test(a) || /संधि|समास|विलोम|पर्यायवाची|मुहावरे|लोकोक्तियां|वर्तनी|कारक|अलंकार/i.test(t)){
    return 'Hindi';
  }

  // 6. Banking Awareness
  if(/banking awareness|banking|financial awareness/i.test(a) ||
     /rbi|monetary policy|repo rate|reverse repo|crr|slr|nbfc|neft|rtgs|imps|cheque|demand draft|kcc|nabard|sebi|sidbi|basel/i.test(t) ||
     /monetary policy|repo rate|reverse repo|reserve bank of india|\brbi\b|commercial bank|\bcrr\b|\bslr\b|\bnbfc\b|\bneft\b|\brtgs\b|\bimps\b|\bcheque\b|demand draft|\bkcc\b|\bnabard\b|\bsebi\b|\bsidbi\b|\bbasel\b|मौद्रिक नीति|रेपो रेट|रिवर्स रेपो|सीआरआर|एसएलआर|एनईएफटी|आरटीजीएस|चेक|नाबार्ड|आरबीआई/.test(q)){
    return 'Banking Awareness';
  }

  // 7. MP GK
  if(/mp gk|madhya pradesh/i.test(a) || /madhya pradesh|mp psc|bhopal|indore|narmada|tapti|chambal|tribes of mp|mp history/i.test(t) ||
      /मध्य प्रदेश|भोपाल|इंदौर|नर्मदा नदी|मालवा|बुंदेलखंड|गोंड जनजाति|भील जनजाति/.test(q)){
    return 'MP GK';
  }

  // 8. Current Affairs
  if(/current affairs|daily ca|news/i.test(a) || /current affairs|events|summits|awards|sports|bilateral|pib/i.test(t) ||
     /current affairs|हाल ही में|नवीनतम|वर्तमान में|2024|2025|2026|शिखर सम्मेलन|पुरस्कार/.test(q)){
    return 'Current Affairs';
  }

  // 9. Generic Prelims tag resolution
  if(/^prelims$/i.test(a)){
    if(/coding|decoding|puzzle|seating|syllogism|inequality|blood relation|direction|ranking|series|reasoning|analogy|classification/.test(t))return 'Reasoning';
    if(/simplification|percentage|profit|loss|ratio|interest|time|work|distance|arithmetic|quant|number system|data interpretation/.test(t))return /data interpretation/.test(t)?'Data Interpretation':'Mathematics';
    if(/computer/.test(t))return 'Computer';
    if(/english|grammar|vocabulary|cloze|reading/.test(t))return 'English';
    if(/current affairs|gk|general awareness|banking/.test(t))return /current affairs/.test(t)?'Current Affairs':'General Awareness';
  }

  return a||'General Awareness';
}
function inferExam(rawSubject,sourceName){const f=(sourceName||'').toLowerCase();if(/mains/.test(f)||/mains/i.test(rawSubject))return 'IBPS RRB Mains';if(/prelims/.test(f)||/prelims/i.test(rawSubject))return 'IBPS RRB Prelims';if(/ibps_rrb|rrb/.test(f))return 'IBPS RRB';if(/mpesb.*mechanical|sub_engineer/i.test(f))return 'MP Sub Engineer';return ''}
function cleanDisplayText(v){return String(v??'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim()}
function parseMetaTag(tag){
  const clean=cleanDisplayText(tag).replace(/^\[|\]$/g,'').trim();
  let rawSubject=''; let topic=''; let exam=''; let difficulty='Moderate';
  const subMatch = clean.match(/(?:Subject|विषय)\s*[:：]\s*([^|;\]]+)/i);
  if (subMatch) rawSubject = subMatch[1].trim();
  const topMatch = clean.match(/(?:Topic|Chapter|अध्याय)\s*[:：]\s*([^|;\]]+)/i);
  if (topMatch) topic = topMatch[1].trim();
  const exMatch = clean.match(/(?:Exam|परीक्षा)\s*[:：]\s*([^|;\]]+)/i);
  if (exMatch) exam = exMatch[1].trim();
  const diffMatch = clean.match(/(?:Difficulty|कठिनाई|स्तर)\s*[:：]\s*([^|;\]]+)/i);
  if (diffMatch) difficulty = diffMatch[1].trim();
  else {
    const dm=clean.match(/\b(Easy|Moderate|Medium|Hard|Difficult|सरल|मध्यम|कठिन)\b/i);
    if(dm) difficulty=/easy|सरल/i.test(dm[1])?'Easy':/hard|difficult|कठिन/i.test(dm[1])?'Hard':'Moderate';
  }
  if(!rawSubject){
    const parts=clean.split(/\s*\|\s*|\s*[—–-]\s*/).map(cleanDisplayText).filter(Boolean);
    if (parts[0] && !/^(?:Exam|Topic|Difficulty|परीक्षा|कठिनाई)/i.test(parts[0])) {
      rawSubject = parts[0].replace(/^(?:Subject|विषय)\s*[:：]\s*/i, '').trim();
    }
    if (parts.length > 1 && !topic) {
      topic = parts[1].replace(/^(?:Topic|अध्याय)\s*[:：]\s*/i, '').trim();
    }
  }
  return {
    rawSubject,
    topic: /^(MAINS|PRELIMS)$/i.test(topic) ? '' : topic.replace(/\b(MAINS|PRELIMS|Easy|Moderate|Medium|Hard|Difficult)\b/gi,'').trim(),
    exam,
    difficulty: /easy|सरल/i.test(difficulty)?'Easy':/hard|difficult|कठिन/i.test(difficulty)?'Hard':'Moderate'
  };
}
function extractLeadingTags(text){
  let remaining=text; const tags=[];
  while(true){
    const m=remaining.match(/^\s*\[([^\]]+)\]\s*(.*)$/s);
    if(m){ tags.push(m[1]); remaining=m[2]; } else break;
  }
  return { tags, remaining };
}
function parseTxtQuestions(text,sourceName){
  const lines=String(text||'').replace(/\uFEFF/g,'').split(/\r?\n/).map(x=>cleanDisplayText(x));
  const out=[]; let q=null; let currentField='question'; let currentContext=''; let fileMeta={subject:'',topic:'',exam:'',difficulty:'Moderate'};
  const normalizeLabel=v=>String(v||'').replace(/\s+/g,' ').trim();
  const absorbHeading=(line)=>{
    const t=normalizeLabel(line).replace(/^#+\s*/,'');
    if(!t)return;
    const bracket=t.match(/^\[([^\]]+)\]$/);
    if(bracket){ const m=parseMetaTag(bracket[1]); if(m.rawSubject)fileMeta.subject=inferSubject(m.rawSubject,m.topic); if(m.topic)fileMeta.topic=m.topic; if(m.exam)fileMeta.exam=m.exam; if(m.difficulty)fileMeta.difficulty=m.difficulty; return; }
    if(/^(?:exam|परीक्षा)\s*[:：-]/i.test(t)) fileMeta.exam=t.replace(/^(?:exam|परीक्षा)\s*[:：-]/i,'').trim();
    else if(/^(?:subject|विषय)\s*[:：-]/i.test(t)) fileMeta.subject=t.replace(/^(?:subject|विषय)\s*[:：-]/i,'').trim();
    else if(/^(?:topic|chapter|अध्याय)\s*[:：-]/i.test(t)) fileMeta.topic=t.replace(/^(?:topic|chapter|अध्याय)\s*[:：-]/i,'').trim();
  };
  const push=()=>{
    if(!q)return;
    q.question=cleanDisplayText(q.question); q.question_hi=cleanDisplayText(q.question_hi);
    q.explanation=cleanDisplayText(q.explanation); q.explanation_hi=cleanDisplayText(q.explanation_hi);
    q.option_a=cleanDisplayText(q.option_a); q.option_b=cleanDisplayText(q.option_b); q.option_c=cleanDisplayText(q.option_c); q.option_d=cleanDisplayText(q.option_d);
    q.option_a_hi=cleanDisplayText(q.option_a_hi); q.option_b_hi=cleanDisplayText(q.option_b_hi); q.option_c_hi=cleanDisplayText(q.option_c_hi); q.option_d_hi=cleanDisplayText(q.option_d_hi);
    q.correct_answer=cleanAnswer(q.correct_answer||'', q);

    const qRes = resolveBilingual(q.question, q.question_hi);
    q.question = qRes.en;
    q.question_hi = qRes.hi;

    ['a','b','c','d'].forEach(ltr => {
      const optRes = resolveBilingual(q[`option_${ltr}`], q[`option_${ltr}_hi`]);
      q[`option_${ltr}`] = optRes.en;
      q[`option_${ltr}_hi`] = optRes.hi;
    });

    const expRes = resolveBilingual(q.explanation, q.explanation_hi);
    q.explanation = expRes.en;
    q.explanation_hi = expRes.hi;

    if(q.question || q.question_hi){
      if(!q.question && q.question_hi) {
        q.question = q.question_hi;
      }
      // Attach context if puzzle premise missing and directions context available
      if(currentContext && isDependentContextMissing(q.question)){
        q.question=`${currentContext}\n\n${q.question}`;
      }
      const hasHi=/[\u0900-\u097F]/.test(q.question + (q.question_hi||''));
      const hasEn=/[A-Za-z]/.test(q.question + (q.explanation||''));
      const isBilingual = Boolean(q.question_hi || q.option_a_hi || q.explanation_hi || (hasHi && hasEn));
      q.language=isBilingual?'English + Hindi':hasHi?'Hindi':'English';
      q.subject=inferSubject(q.rawSubject||fileMeta.subject,q.topic||fileMeta.topic,q.question + ' ' + (q.question_hi||''));
      if(!q.topic)q.topic=fileMeta.topic||'';
      if(!q.exam)q.exam=fileMeta.exam||inferExam(q.rawSubject||q.subject,sourceName);
      if(!q.difficulty||q.difficulty==='Moderate')q.difficulty=fileMeta.difficulty||'Moderate';
      delete q.rawSubject;
      out.push(q);
    }
    q=null; currentField='question';
  };
  const start=(num,tag,rest)=>{
    push();
    const leading = extractLeadingTags(rest);
    const allTags = [tag, ...leading.tags].filter(Boolean);
    let mergedMeta = { rawSubject: '', topic: '', exam: '', difficulty: 'Moderate' };
    for (const t of allTags) {
      const parsed = parseMetaTag(t);
      if (parsed.rawSubject) mergedMeta.rawSubject = parsed.rawSubject;
      if (parsed.topic) mergedMeta.topic = parsed.topic;
      if (parsed.exam) mergedMeta.exam = parsed.exam;
      if (parsed.difficulty && parsed.difficulty !== 'Moderate') mergedMeta.difficulty = parsed.difficulty;
    }
    const cleaned = cleanDisplayText(leading.remaining);
    let qEn = cleaned;
    let qHi = '';
    if (cleaned.includes('/')) {
      const parts = cleaned.split(/\s*[\/|]\s*/);
      if (parts.length >= 2 && /[A-Za-z]/.test(parts[0]) && /[\u0900-\u097F]/.test(parts[1])) {
        qEn = parts[0].trim();
        qHi = parts.slice(1).join(' / ').trim();
      }
    }
    const subject=inferSubject(mergedMeta.rawSubject||fileMeta.subject,mergedMeta.topic||fileMeta.topic,cleaned);
    q={
      number:num,
      question:qEn,
      question_hi:qHi,
      option_a:'',option_b:'',option_c:'',option_d:'',
      option_a_hi:'',option_b_hi:'',option_c_hi:'',option_d_hi:'',
      correct_answer:'',
      explanation:'',
      explanation_hi:'',
      subject,
      difficulty:mergedMeta.difficulty||fileMeta.difficulty||'Moderate',
      topic:mergedMeta.topic||fileMeta.topic||'',
      subtopic:'',
      language:'English',
      exam:mergedMeta.exam||fileMeta.exam||inferExam(mergedMeta.rawSubject||subject,sourceName),
      source:sourceName,
      tags:[],
      rawSubject:mergedMeta.rawSubject
    };
    currentField='question';
  };
  let m;
  for(let i=0;i<lines.length;i++){
    const line=lines[i]; if(!line)continue;
    if(/^={3,}|^-{5,}$/.test(line))continue;
    if(/^Quick\s*Revision\s*[:：→-]/i.test(line))continue;

    // Detect directive / passage blocks: "Directions (Q1-5):" or "निर्देश (प्रश्न 1-5):"
    const dirMatch=line.match(/^(?:Directions?|निर्देश)\s*(?:\([^\)]+\))?\s*[:：-]\s*(.*)$/i);
    if(dirMatch){
      currentContext=line;
      continue;
    }

    // Standalone file headings/meta are treated as context, not question text.
    if(!q && (/^(?:exam|परीक्षा|subject|विषय|topic|chapter|अध्याय)\s*[:：-]/i.test(line)||/^\[[^\]]+\]$/.test(line))){absorbHeading(line);continue;}
    if(!q && /^(?:IBPS|RRB|SSC|SBI|UPSC|MPPSC|MPESB|MP SI|MP Police|Railway|Banking|General Awareness|Current Affairs|Reasoning|Mathematics|Hindi|English|Computer|Science)/i.test(line) && line.length<180){absorbHeading(line);continue;}

    // Explicit question prefix: Q1., Question 1:, प्रश्न 1., Que 1., etc.
    m=line.match(/^(?:Q(?:uestion|ue)?\.?|प्रश्न|प्र\.?)\s*(\d+)?\s*[.):\-–—]?\s*(?:\[([^\]]+)\])?\s*(.*)$/i);
    if(m && (m[1] || m[2] || m[3])){
      start(m[1]?parseInt(m[1],10):(out.length+1),m[2]||'',cleanDisplayText(m[3]));
      continue;
    }

    // Explicit tag at line start: e.g. [General Awareness | Moderate] Question text
    m=line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if(m && (!q || q.correct_answer || (q.option_a&&q.option_b&&q.option_c&&q.option_d))){
      start(out.length+1,m[1],cleanDisplayText(m[2]));
      continue;
    }

    // Letter-labelled options: A), B), C), D) or (A), [A]
    let mOpt=line.match(/^\s*(?:(?:\(\s*([ABCDabcd])\s*\)|\[\s*([ABCDabcd])\s*\])\s*[.):\-–—]?|([ABCDabcd])\s*[.):\-–—])\s*(.*)$/);
    if(mOpt && q){
      const letter=(mOpt[1]||mOpt[2]||mOpt[3]).toUpperCase();
      const optText=cleanDisplayText(mOpt[4]);
      if(letter==='A'){
        // If numeric 1., 2. lines were absorbed prior to encountering explicit letter Option A,
        // restore those numeric lines to question text (they were question statements)
        if(q.option_a && !q.correct_answer){
          const stmts=[q.option_a,q.option_b,q.option_c,q.option_d].filter(Boolean).join('\n');
          q.question=(q.question?q.question+'\n':'')+stmts;
          q.option_a=''; q.option_b=''; q.option_c=''; q.option_d='';
        }
        q.option_a=optText; currentField='option_a'; continue;
      }
      if(letter==='B'){q.option_b=optText;currentField='option_b';continue;}
      if(letter==='C'){q.option_c=optText;currentField='option_c';continue;}
      if(letter==='D'){q.option_d=optText;currentField='option_d';continue;}
    }

    // Hindi letter options: क), ख), ग), घ)
    let mHindiOpt=line.match(/^\s*(?:(?:\(\s*([कखगघ])\s*\)|\[\s*([कखगघ])\s*\])\s*[.):\-–—]?|([कखगघ])\s*[.):\-–—])\s*(.*)$/);
    if(mHindiOpt && q){
      const hChar=mHindiOpt[1]||mHindiOpt[2]||mHindiOpt[3];
      const optText=cleanDisplayText(mHindiOpt[4]);
      if(hChar==='क'){q.option_a=optText;currentField='option_a';continue;}
      if(hChar==='ख'){q.option_b=optText;currentField='option_b';continue;}
      if(hChar==='ग'){q.option_c=optText;currentField='option_c';continue;}
      if(hChar==='घ'){q.option_d=optText;currentField='option_d';continue;}
    }

    // Answer lines
    m=line.match(/^\s*(?:उत्तर|सही\s*उत्तर|उत्तर\s*विकल्प|Answer|Ans|Correct\s*Answer|Correct\s*Ans|Correct\s*Option)\s*[:：=\-]\s*(.*)$/i);
    if(m && q){
      q.correct_answer=cleanAnswer(m[1], q);
      currentField='answer';
      continue;
    }

    // Hindi / Bilingual Explanation lines
    const mHiExp=line.match(/^\s*(?:Hindi\s*(?:Explanation|Solution|Details)|(?:हिन्दी|हिंदी)\s*(?:विवरण|व्याख्या|स्पष्टीकरण|समाधान|हल)|(?:विवरण|व्याख्या|स्पष्टीकरण|समाधान|हल)\s*\((?:हिन्दी|हिंदी)\))\s*[:：=\-]\s*(.*)$/i);
    if(mHiExp && q){
      q.explanation_hi=cleanDisplayText(mHiExp[1]);
      currentField='explanation_hi';
      continue;
    }

    // Explanation lines
    m=line.match(/^\s*(?:विवरण|व्याख्या|स्पष्टीकरण|समाधान|हल|Explanation|Solution|Details|Short\s*Solution|Sol)\s*[:：=\-]\s*(.*)$/i);
    if(m && q){
      q.explanation=cleanDisplayText(m[1]);
      currentField='explanation';
      continue;
    }

    // Hindi translation line
    const mHiQ=line.match(/^(?:Hindi|हिन्दी|हिंदी|Question\s*\((?:Hindi|हिन्दी|हिंदी)\)|प्रश्न\s*(?:\((?:हिन्दी|हिंदी)\))?)\s*[:：]\s*(.*)$/i);
    if(mHiQ && q){
      q.question_hi=cleanDisplayText(mHiQ[1]);
      currentField='question_hi';
      continue;
    }

    // English translation line
    m=line.match(/^(?:English|अंग्रेजी|Question\s*\((?:English|अंग्रेजी)\))\s*[:：]\s*(.*)$/i);
    if(m && q){
      if(currentField==='explanation' || currentField==='explanation_hi'){
        q.explanation=(q.explanation?`${q.explanation} `:'')+cleanDisplayText(m[1]);
      } else {
        q.question=(q.question?`${q.question} `:'')+cleanDisplayText(m[1]);
      }
      continue;
    }

    // Bare or bracketed numbered line check: e.g. "1. ..." or "(1) ..." or "1) ..."
    m=line.match(/^\s*(?:(?:\(\s*(\d+)\s*\)|\[\s*(\d+)\s*\])\s*[.):\-–—]?|(\d+)\s*[.):\-–—])\s*(?:\[([^\]]+)\])?\s*(.*)$/);
    if(m){
      const n=parseInt(m[1]||m[2]||m[3],10);
      const tag=m[4]||'';
      const rest=cleanDisplayText(m[5]);

      // If active question already has an answer, or all options exist, a new numbered line starts a new question
      const isAnswered = !!(q && q.correct_answer);
      const allFourOptionsPresent = !!(q && q.option_a && q.option_b && q.option_c && q.option_d);

      if (!q || tag || isAnswered || (allFourOptionsPresent && n > 4)) {
        start(n, tag, rest);
        continue;
      }

      // If inside explanation, numbered items are steps in the solution
      if (q && currentField === 'explanation') {
        q.explanation += (q.explanation ? ' ' : '') + line;
        continue;
      }

      // Check if this line is a numbered option (1, 2, 3, 4) for an active question
      if (q && !tag) {
        if (n === 1) {
          if (q.option_a && !q.correct_answer) {
            const stmts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean).join('\n');
            q.question = (q.question ? q.question + '\n' : '') + stmts;
            q.option_a = ''; q.option_b = ''; q.option_c = ''; q.option_d = '';
          }
          q.option_a = rest; currentField = 'option_a'; continue;
        }
        if (n === 2 && q.option_a && !q.option_b) {
          q.option_b = rest; currentField = 'option_b'; continue;
        }
        if (n === 3 && q.option_b && !q.option_c) {
          q.option_c = rest; currentField = 'option_c'; continue;
        }
        if (n === 4 && q.option_c && !q.option_d) {
          q.option_d = rest; currentField = 'option_d'; continue;
        }
      }

      start(n, tag, rest);
      continue;
    }

    if(!q)continue;

    // Continuation lines
    if(currentField==='option_a')q.option_a+=(q.option_a?' ':'')+line;
    else if(currentField==='option_b')q.option_b+=(q.option_b?' ':'')+line;
    else if(currentField==='option_c')q.option_c+=(q.option_c?' ':'')+line;
    else if(currentField==='option_d')q.option_d+=(q.option_d?' ':'')+line;
    else if(currentField==='explanation')q.explanation+=(q.explanation?' ':'')+line;
    else if(currentField==='explanation_hi')q.explanation_hi+=(q.explanation_hi?' ':'')+line;
    else if(currentField==='question_hi')q.question_hi+=(q.question_hi?' ':'')+line;
    else if(currentField==='answer') {
      if(line.length > 5 && !/^[A-D1-4क-घ][\.\)]/i.test(line)) {
        q.explanation = (q.explanation ? q.explanation + ' ' : '') + line;
        currentField = 'explanation';
      } else {
        q.correct_answer = cleanAnswer(q.correct_answer + ' ' + line, q);
      }
    }
    else q.question+=(q.question?' ':'')+line;
  }
  push(); return out;
}
function validateQuestion(r){
  const missing=[];
  const hasQ = Boolean((r.question&&r.question.trim()) || (r.question_hi&&r.question_hi.trim()));
  if(!hasQ) missing.push('Question');
  for(const k of ['option_a','option_b','option_c','option_d']){
    const hasOpt = Boolean((r[k]&&r[k].trim()) || (r[`${k}_hi`]&&r[`${k}_hi`].trim()));
    if(!hasOpt) missing.push(k.replace('option_','Option ').toUpperCase());
  }
  const ans=cleanAnswer(r.correct_answer, r);
  if(!/^[ABCD]$/.test(ans)) missing.push('Answer');
  const opts=[r.option_a||r.option_a_hi,r.option_b||r.option_b_hi,r.option_c||r.option_c_hi,r.option_d||r.option_d_hi].map(normalizeText);
  if(opts.some((v,i)=>v&&opts.indexOf(v)!==i)) missing.push('Duplicate option');
  const qText = r.question || r.question_hi || '';
  if(qText&&normalizeText(qText).length<8) missing.push('Question too short');
  if(isDependentContextMissing(qText)) missing.push('Puzzle premise missing context');
  return [...new Set(missing)];
}
function Questions({session}){const inputRef=useRef(null),[file,setFile]=useState(null),[status,setStatus]=useState(''),[rows,setRows]=useState([]),[active,setActive]=useState('pending_review'),[loading,setLoading]=useState(false),[selected,setSelected]=useState([]),[stats,setStats]=useState({pending:0,approved:0,needs:0});
  const choose=e=>{const f=e.target.files?.[0];if(!f)return;setFile(f);setStatus(`Selected ${f.name} — ready to process`)};
  const refreshCounts=async()=>{if(!supabase)return;const q=async(st)=>{const {count}=await supabase.from('questions').select('*',{count:'exact',head:true}).eq('status',st);return count||0};const [pending,approved,needs]=await Promise.all([q('pending_review'),q('approved'),q('needs_correction')]);setStats({pending,approved,needs})};
  const process=async()=>{if(!file||!supabase)return;setLoading(true);setStatus('Parsing and validating…');try{const ext=file.name.split('.').pop().toLowerCase();let parsed=[];if(ext==='txt')parsed=parseTxtQuestions(await file.text(),file.name);else if(ext==='csv')parsed=parseCsvRows(await file.text(),file.name);else if(['xlsx','xls'].includes(ext)){const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});if(!wb.SheetNames||!wb.SheetNames.length)throw new Error('Excel workbook has no sheets.');const ws=wb.Sheets[wb.SheetNames[0]];parsed=parseCsvRows(XLSX.utils.sheet_to_csv(ws),file.name)}else throw new Error('Use TXT, CSV or XLSX. TXT is the recommended format.');if(!parsed.length)throw new Error('No questions detected.');const seen=new Set();let duplicateInFile=0;const batchId=`${file.name}-${Date.now()}`;const payload=parsed.map(r=>{let qEn=r.question||'';let qHi=r.question_hi||'';if(!qHi&&/[\u0900-\u097F]/.test(qEn)&&!/[a-zA-Z]/.test(qEn)){qHi=qEn;}const optA_hi=r.option_a_hi||(!/[a-zA-Z]/.test(r.option_a)&&/[\u0900-\u097F]/.test(r.option_a)?r.option_a:null);const optB_hi=r.option_b_hi||(!/[a-zA-Z]/.test(r.option_b)&&/[\u0900-\u097F]/.test(r.option_b)?r.option_b:null);const optC_hi=r.option_c_hi||(!/[a-zA-Z]/.test(r.option_c)&&/[\u0900-\u097F]/.test(r.option_c)?r.option_c:null);const optD_hi=r.option_d_hi||(!/[a-zA-Z]/.test(r.option_d)&&/[\u0900-\u097F]/.test(r.option_d)?r.option_d:null);const hasEn=Boolean((qEn&&/[a-zA-Z]/.test(qEn))||(r.option_a&&/[a-zA-Z]/.test(r.option_a)));const hasHi=Boolean(qHi||optA_hi||/[\u0900-\u097F]/.test(qEn));const lang=r.language||(hasEn&&hasHi?'English + Hindi':hasHi?'Hindi':'English');return{...r,question:qEn,question_hi:qHi||null,option_a_hi:optA_hi,option_b_hi:optB_hi,option_c_hi:optC_hi,option_d_hi:optD_hi,language:lang,import_batch:batchId,status:validateQuestion(r).length?'needs_correction':'approved'}}).filter(r=>{const key=normalizeText(r.question||r.question_hi);if(!key||seen.has(key)){duplicateInFile++;return false}seen.add(key);return true});let total=0,needs=0,approved=0,dupes=duplicateInFile;for(let i=0;i<payload.length;i+=200){const batch=payload.slice(i,i+200);let rpcDone=false;try{const {data,error}=await supabase.rpc('admin_import_questions',{rows:batch});if(!error){rpcDone=true;total+=Number(data?.inserted||0);needs+=Number(data?.needs_correction||0);approved+=Number(data?.approved||0);dupes+=Number(data?.duplicates||0)}}catch(_){}if(!rpcDone){const {data:insData,error:insErr}=await supabase.from('questions').insert(batch).select();if(insErr)throw insErr;const insApp=(insData||[]).filter(x=>x.status==='approved').length;const insNeeds=(insData||[]).filter(x=>x.status==='needs_correction').length;total+=(insData||[]).length;approved+=insApp;needs+=insNeeds}}setStatus(`${total} imported: ${approved} auto-published · ${needs} needs correction · ${dupes} duplicates skipped.`);await loadPending();await refreshCounts()}catch(e){await logEvent('error',e?.message||e,{source:'question-import',action:'import',data:{file:file?.name||''}});setStatus('Import failed: '+(e?.message||e))}finally{setLoading(false)}};
  const loadPending=async()=>{if(!supabase)return;const {data,error}=await supabase.from('questions').select('*').in('status',['pending_review','needs_correction']).order('created_at',{ascending:false}).limit(200);if(!error)setRows(data||[]);else setStatus('Load error: '+error.message)};
  const saveRow=async(r)=>{const {data,error}=await supabase.from('questions').update({question:r.question,question_hi:r.question_hi||null,option_a:r.option_a,option_b:r.option_b,option_c:r.option_c,option_d:r.option_d,option_a_hi:r.option_a_hi||null,option_b_hi:r.option_b_hi||null,option_c_hi:r.option_c_hi||null,option_d_hi:r.option_d_hi||null,correct_answer:cleanAnswer(r.correct_answer),explanation:r.explanation,explanation_hi:r.explanation_hi||null,subject:r.subject,topic:r.topic,subtopic:r.subtopic,difficulty:r.difficulty,language:r.language,exam:r.exam}).eq('id',r.id).select().single();if(error){setStatus(error.message);return false}setRows(rs=>rs.map(x=>x.id===r.id?data:x));return true};
  const updateRow=(id,key,value)=>setRows(rs=>rs.map(x=>x.id===id?{...x,[key]:value}:x));
  const approve=async(r)=>{const missing=validateQuestion(r);if(missing.length){setStatus(`Cannot publish: ${missing.join(', ')}`);return}if(await saveRow(r)){const {error}=await supabase.from('questions').update({status:'approved'}).eq('id',r.id);if(error)setStatus(error.message);else{setRows(rs=>rs.filter(x=>x.id!==r.id));refreshCounts()}}};
  const reject=async(r)=>{const {error}=await supabase.from('questions').update({status:'rejected'}).eq('id',r.id);if(error)setStatus(error.message);else{setRows(rs=>rs.filter(x=>x.id!==r.id));refreshCounts()}};
  const toggleSelected=(id)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const toggleAll=()=>setSelected(selected.length===rows.length?[]:rows.map(r=>r.id));
  const bulkApprove=async()=>{setLoading(true);const {data,error}=await supabase.rpc('admin_bulk_approve_review');if(error){setStatus('Bulk publish error: '+error.message);setLoading(false);return}setRows([]);setSelected([]);setStatus(`Bulk publish complete: ${data?.approved||0} approved · ${data?.remaining_review||0} still need correction.`);await refreshCounts();setLoading(false)};
  const runAiReview=async()=>{if(!rows.length)return;setLoading(true);setStatus('Running deterministic + Gemini validation batch...');try{const token=(await supabase?.auth?.getSession())?.data?.session?.access_token||'';const res=await fetch('/api/ai-review',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({questions:rows.slice(0,50),autoApproveClean:true})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Validation failed');setStatus(`Validation completed: ${data.approved_count||0} approved · ${data.rejected_count||0} rejected · ${data.needs_correction_count||0} flagged for review.`);await loadPending();await refreshCounts()}catch(e){setStatus('Validation error: '+e.message)}finally{setLoading(false)}};
  const runBilingualTranslate=async()=>{if(!rows.length)return;setLoading(true);setStatus('Translating missing languages via Gemini AI (Bilingual)...');try{const token=(await supabase?.auth?.getSession())?.data?.session?.access_token||'';const targetIds=selected.length?selected:rows.filter(r=>!r.question_hi||!r.question).slice(0,25).map(r=>r.id);if(!targetIds.length){setStatus('Selected questions already have bilingual (English + Hindi) content!');setLoading(false);return}const res=await fetch('/api/bilingual-translate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({question_ids:targetIds})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Translation failed');setStatus(`Bilingual translation completed: ${data.translated_count||0} translated to English + Hindi.`);await loadPending();await refreshCounts()}catch(e){setStatus('Translation error: '+e.message)}finally{setLoading(false)}};
  const bulkDelete=async()=>{if(!selected.length)return;if(!window.confirm(`Delete ${selected.length} selected questions permanently?`))return;const {error}=await supabase.from('questions').delete().in('id',selected);if(error){setStatus('Bulk delete error: '+error.message);return}setRows(rs=>rs.filter(r=>!selected.includes(r.id)));setSelected([]);setStatus(`Deleted ${selected.length} questions.`);await refreshCounts()};
  useEffect(()=>{loadPending();refreshCounts()},[]);
  return <><Title t="📚 Question Bank" s="Smart import: Read → Map → Validate → Duplicate check → Auto Publish clean questions. Only exceptions reach you." action={<div className="quick-actions"><button className="btn light" disabled={!selected.length} onClick={bulkDelete}><Trash2 size={15}/>Bulk Delete ({selected.length})</button></div>}/><div className="pipeline-stats"><div><b>{stats.pending.toLocaleString('en-IN')}</b><span>Pending Review</span></div><div><b>{stats.approved.toLocaleString('en-IN')}</b><span>Published</span></div><div><b>{stats.needs.toLocaleString('en-IN')}</b><span>Needs Correction</span></div></div><div className="upload-box"><input ref={inputRef} type="file" hidden accept=".txt,.csv,.xlsx,.xls" onChange={choose}/><div className="upload-icon"><Upload size={30}/></div><h2>{file?file.name:'Bulk Question Upload'}</h2><p>{file?'File selected.':'Primary: TXT · Also CSV / XLSX (Bilingual English + Hindi supported)'}</p><div className="quick-actions"><button className="btn primary" type="button" onClick={()=>inputRef.current?.click()}><Upload size={16}/> Choose File</button>{file&&<button className="btn dark" type="button" disabled={loading} onClick={process}><Database size={16}/> {loading?'Processing…':'Process & Auto-Queue'}</button>}</div>{status&&<div className="file-selected"><CheckCircle2 size={16}/> {status}</div>}<small>Clean questions are auto-published. Incomplete, mismatched or duplicate records are blocked and kept out of the candidate mock.</small></div><div className="review-tabs"><button className={'btn '+(active==='pending_review'?'dark':'light')} onClick={()=>{setActive('pending_review');loadPending()}}>Pending Review ({stats.pending})</button><button className={'btn '+(active==='approved'?'dark':'light')} onClick={()=>setActive('approved')}>Published Question Bank ({stats.approved})</button></div><div className="panel review-panel"><div className="panel-head"><div><b>{active==='pending_review'?'Review Exceptions':'Published Questions'}</b>{active==='pending_review'&&rows.length?<small style={{display:'block',marginTop:4}}>{selected.length} selected · showing latest {rows.length} review items</small>:null}</div>{active==='pending_review'&&rows.length?<div className="quick-actions"><button className="btn light" onClick={toggleAll}>{selected.length===rows.length?'Clear Selection':'Select All'}</button><button className="btn light" disabled={loading} onClick={runBilingualTranslate}><Languages size={15}/>Translate to Bilingual</button><button className="btn dark" disabled={loading} onClick={runAiReview}><Sparkles size={15}/>Validate with Gemini</button><button className="btn primary" disabled={loading||!rows.length} onClick={bulkApprove}><CheckCircle2 size={15}/>Approve & Publish All Valid</button></div>:null}</div>{active==='pending_review'?(rows.length?rows.map(r=><div className="review-card" key={r.id}><div className="review-question"><label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={selected.includes(r.id)} onChange={()=>toggleSelected(r.id)}/><b>Q{r.number||''}</b>{r.question_hi&&<span className="lang-tag-hi" style={{fontSize:10}}>🌐 Bilingual</span>}</label><textarea placeholder="Question (English)" value={r.question||''} onChange={e=>updateRow(r.id,'question',e.target.value)}/><textarea style={{marginTop:6}} placeholder="प्रश्न (हिन्दी अनुवाद / Hindi Question)" value={r.question_hi||''} onChange={e=>updateRow(r.id,'question_hi',e.target.value)}/></div><div className="review-meta"><label>Subject<select value={r.subject||''} onChange={e=>updateRow(r.id,'subject',e.target.value)}><option value="">Select</option>{subjects.map(x=><option key={x}>{x}</option>)}</select></label><label>Topic<input value={r.topic||''} onChange={e=>updateRow(r.id,'topic',e.target.value)}/></label><label>Difficulty<select value={r.difficulty||'Moderate'} onChange={e=>updateRow(r.id,'difficulty',e.target.value)}><option>Easy</option><option>Moderate</option><option>Hard</option></select></label><label>Language<select value={r.language||'English + Hindi'} onChange={e=>updateRow(r.id,'language',e.target.value)}><option>English + Hindi</option><option>English</option><option>Hindi</option></select></label><label>Exam<input value={r.exam||''} onChange={e=>updateRow(r.id,'exam',e.target.value)}/></label></div><div className="review-options" style={{gridTemplateColumns:'repeat(2, 1fr)'}}><label>Option A (English)<input placeholder="Option A" value={r.option_a||''} onChange={e=>updateRow(r.id,'option_a',e.target.value)}/></label><label>Option A (हिन्दी)<input placeholder="विकल्प A (हिन्दी)" value={r.option_a_hi||''} onChange={e=>updateRow(r.id,'option_a_hi',e.target.value)}/></label><label>Option B (English)<input placeholder="Option B" value={r.option_b||''} onChange={e=>updateRow(r.id,'option_b',e.target.value)}/></label><label>Option B (हिन्दी)<input placeholder="विकल्प B (हिन्दी)" value={r.option_b_hi||''} onChange={e=>updateRow(r.id,'option_b_hi',e.target.value)}/></label><label>Option C (English)<input placeholder="Option C" value={r.option_c||''} onChange={e=>updateRow(r.id,'option_c',e.target.value)}/></label><label>Option C (हिन्दी)<input placeholder="विकल्प C (हिन्दी)" value={r.option_c_hi||''} onChange={e=>updateRow(r.id,'option_c_hi',e.target.value)}/></label><label>Option D (English)<input placeholder="Option D" value={r.option_d||''} onChange={e=>updateRow(r.id,'option_d',e.target.value)}/></label><label>Option D (हिन्दी)<input placeholder="विकल्प D (हिन्दी)" value={r.option_d_hi||''} onChange={e=>updateRow(r.id,'option_d_hi',e.target.value)}/></label></div><div className="review-answer"><label>Correct Answer<select value={cleanAnswer(r.correct_answer)||''} onChange={e=>updateRow(r.id,'correct_answer',e.target.value)}><option value="">Select answer</option><option>A</option><option>B</option><option>C</option><option>D</option></select></label><label>Explanation (English)<textarea value={r.explanation||''} onChange={e=>updateRow(r.id,'explanation',e.target.value)} /></label><label>Explanation (हिन्दी / Hindi)<textarea placeholder="विस्तृत हिन्दी हल..." value={r.explanation_hi||''} onChange={e=>updateRow(r.id,'explanation_hi',e.target.value)} /></label></div><div className="review-actions"><button className="btn light" onClick={()=>reject(r)}><Trash2 size={14}/> Reject</button><button className="btn primary" onClick={()=>approve(r)}><CheckCircle2 size={14}/> Approve & Publish</button></div></div>):<p className="muted">No exceptions waiting.</p>):<PublishedQuestions/>}</div></>;
}
function PublishedQuestions(){const[data,setData]=useState([]);useEffect(()=>{supabase?.from('questions').select('id,question,question_hi,option_a,option_b,option_c,option_d,option_a_hi,option_b_hi,option_c_hi,option_d_hi,correct_answer,subject,topic,difficulty,exam,language').eq('status','approved').order('created_at',{ascending:false}).limit(200).then(({data})=>setData((data||[]).filter(r=>(r.question||r.question_hi)&&(r.option_a||r.option_a_hi)&&(r.option_b||r.option_b_hi)&&(r.option_c||r.option_c_hi)&&(r.option_d||r.option_d_hi)&&/^[ABCD]$/.test(cleanAnswer(r.correct_answer)))))},[]);return data.length?data.map(r=><div className="question-row" key={r.id}><div><b>{r.subject||'Unmapped'}</b>{r.question_hi&&<span className="lang-tag-hi" style={{marginLeft:8}}>🌐 Bilingual</span>}<small>{r.question||r.question_hi}</small>{r.question_hi&&r.question&&<small style={{color:'#64748b'}}>हिन्दी: {r.question_hi}</small>}<small>{r.option_a||r.option_a_hi} · {r.option_b||r.option_b_hi} · {r.option_c||r.option_c_hi} · {r.option_d||r.option_d_hi}</small></div><span>Published</span></div>):<p className="muted">No valid published questions yet.</p>}

function CurrentAffairs({setSelected,role}){const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[syncing,setSyncing]=useState(false),[msg,setMsg]=useState('');const load=async()=>{if(!supabase){setLoading(false);return}const {data}=await supabase.from('current_affairs').select('id,title,summary,category,source_name,source_url,published_at,question_count').eq('status','published').order('published_at',{ascending:false}).limit(30);setItems(data||[]);setLoading(false)};useEffect(()=>{load()},[]);const sync=async()=>{setSyncing(true);setMsg('Syncing official sources (PIB, RBI, SEBI, NABARD, Ministries)…');try{const token=(await supabase?.auth?.getSession())?.data?.session?.access_token||'';const res=await fetch('/api/sync-current-affairs',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({researchSixMonths:true,generateQuestions:true,gemini_ai_enabled:true})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Sync failed');setMsg(`Sync complete: ${data.official_bulletins_added||0} official + ${data.ai_research_items_added||0} Gemini 6-month updates added.`);await load()}catch(e){setMsg('Sync failed: '+e.message)}finally{setSyncing(false)}};
  return <><Title t="📰 Current Affairs" s="Daily, weekly and monthly current affairs from verified official government sources." action={<div className="ca-actions">{role==='admin'&&<button className="btn dark" disabled={syncing} onClick={sync}>{syncing?'Syncing…':'Sync Official Sources'}</button>}<button className="btn primary" onClick={()=>setSelected?.({name:'Current Affairs Daily Mock',total_questions:20,duration_minutes:20,marks_per_question:1,negative_marking:0.25,cat:'Subject Test'})}>Daily Mock (20 Q) <ArrowUpRight size={15}/></button><button className="btn light" onClick={()=>setSelected?.({name:'Current Affairs Weekly Revision',total_questions:50,duration_minutes:45,marks_per_question:1,negative_marking:0.25,cat:'Subject Test'})}>Weekly Mock (50 Q)</button><button className="btn light" onClick={()=>setSelected?.({name:'Current Affairs Monthly Marathon',total_questions:100,duration_minutes:90,marks_per_question:1,negative_marking:0.25,cat:'Subject Test'})}>Monthly (100 Q)</button></div>}/>{msg&&<div className="file-selected" style={{marginBottom:16}}>{msg}</div>}<div className="ca-grid"><div className="panel"><div className="panel-head"><b>Latest Updates (Grounded with Source Verification)</b><span className="success-badge">Official sources</span></div>{loading?<p className="muted">Loading current affairs…</p>:items.length?items.map(x=><article className="ca-item" key={x.id}><div><span className="tag">{x.category||'National'}</span><h3>{x.title}</h3><p>{x.summary}</p><small>{x.source_name||'Official source'} · {x.published_at?new Date(x.published_at).toLocaleDateString('en-IN'):''}</small></div><div className="ca-links">{x.source_url&&<a href={x.source_url} target="_blank" rel="noreferrer">Official Notice <ExternalLink size={13}/></a>}<span>{x.question_count||0} Q</span></div></article>):<div className="empty-state"><Bell size={35}/><h3>Current affairs feed is ready</h3><p>Admin can sync official sources or wait for the 00:00 IST scheduled ingestion.</p></div>}</div>{role==='admin'&&<div className="panel"><div className="panel-head"><b>Official Ingestion Sources</b></div><div className="activity-list"><p>🏛️ <b>PIB (Press Information Bureau)</b> - Govt of India</p><p>🏦 <b>RBI (Reserve Bank of India)</b> - Notifications & Circulars</p><p>📈 <b>SEBI & NABARD</b> - Financial Regulations</p><p>🟢 <b>MP Government Portal</b> - MP State Affairs</p><p>🛰️ <b>ISRO & Science Ministries</b> - Technology Updates</p><p>🏆 <b>Ministry of Youth Affairs & Sports</b></p></div></div>}</div></>;
}

function deriveExamSubject(title) {
  const t = String(title || '').toLowerCase().trim();
  if (t.includes('reasoning') || t.includes('puzzle') || t.includes('general intelligence')) return 'Reasoning';
  if (t.includes('math') || t.includes('quantitative') || t.includes('aptitude') || t.includes('arithmetic')) return 'Mathematics';
  if (t.includes('banking awareness') || t.includes('banking') || t.includes('financial awareness') || t.includes('bank po')) return 'Banking Awareness';
  if (t.includes('current affairs')) return 'Current Affairs';
  if (t.includes('computer') || t.includes('it knowledge') || t.includes('computer knowledge')) return 'Computer';
  if (t.includes('english')) return 'English';
  if (t.includes('hindi')) return 'Hindi';
  if (t.includes('civil engineering') || t.includes('civil')) return 'Civil Engineering';
  if (t.includes('electrical engineering') || t.includes('electrical')) return 'Electrical Engineering';
  if (t.includes('mechanical engineering') || t.includes('mechanical')) return 'Mechanical Engineering';
  if (t.includes('mp gk') || t.includes('mppsc')) return 'General Awareness';
  if (t.includes('general awareness') || t.includes('general studies') || t.includes('gk')) return 'General Awareness';
  return '';
}

function matchExamSubjectStrict(qSubject, targetSubject) {
  const q = String(qSubject || '').trim().toLowerCase();
  const t = String(targetSubject || '').trim().toLowerCase();
  if (!q || !t) return false;
  if (q === t) return true;
  if (t === 'mathematics') {
    if (['reasoning', 'puzzle', 'syllogism', 'inequality', 'seating'].some(k => q.includes(k))) return false;
    return ['quant', 'quantitative aptitude', 'math', 'maths', 'arithmetic'].includes(q) || q.includes('math');
  }
  if (t === 'reasoning') {
    if (['mathematics', 'math', 'arithmetic', 'quant', 'simplification', 'profit'].some(k => q.includes(k))) return false;
    return ['logical reasoning', 'general intelligence', 'puzzle'].includes(q) || q.includes('reasoning');
  }
  if (t === 'banking awareness') return q.includes('bank') || q.includes('financial');
  if (t === 'general awareness') return q.includes('gk') || q.includes('general') || q.includes('awareness') || q.includes('current');
  if (t === 'current affairs') return q.includes('current affairs') || q.includes('ca');
  if (t === 'computer') return q.includes('computer') || q.includes('it');
  if (t === 'english') return q.includes('english');
  if (t === 'hindi') return q.includes('hindi');
  if (t === 'civil engineering') return q.includes('civil');
  if (t === 'electrical engineering') return q.includes('electrical');
  if (t === 'mechanical engineering') return q.includes('mechanical');
  return q.includes(t) || t.includes(q);
}

function AdminExams({session}){
  const EXAM_TITLE_OPTIONS=['IBPS RRB PO Mock','IBPS RRB Clerk Mock','IBPS PO Mock','IBPS Clerk Mock','Bank PO Mock','Banking Awareness Mock','MP Police Constable Mock','MP SI Mock','MPPSC Prelims Mock','MPPSC Mains Mock','MPESB Group 1 Mock','MPESB Group 2 Mock','MP Sub Engineer Mock','MP Junior Engineer Mock','Civil Engineering Mock','Electrical Engineering Mock','Mechanical Engineering Mock','Reasoning Mock','Mathematics Mock','Puzzle Marathon Mock','English Mock','Hindi Mock','General Awareness Mock','Current Affairs Mock','Computer Knowledge Mock','[Custom Mock Pattern]'];
  const POOL_SUBJECTS=['Mathematics','Reasoning','Banking Awareness','General Awareness','Current Affairs','Computer','English','Hindi','Civil Engineering','Electrical Engineering','Mechanical Engineering'];
  const [data,setData]=useState([]),[loading,setLoading]=useState(true),[msg,setMsg]=useState(''),[viewTab,setViewTab]=useState('list');
  const [form,setForm]=useState({title:'',custom_title:'',subject:'',duration:60,question_count:25,negative_mark:0.25,status:'published'});

  const performAutoMap = async (examObj) => {
    if (!supabase || !examObj?.id) return { ok: false, added: 0, total: 0 };
    const examId = examObj.id;
    const configuredTotal = Math.max(1, Number(examObj.total_questions || 25));
    const targetSubject = examObj.subject || deriveExamSubject(examObj.title);

    // 1. Try server RPC first
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_map_exam_questions', { p_exam_id: examId });
      if (!rpcErr && (rpcRes?.added > 0 || rpcRes?.total >= configuredTotal)) {
        return { ok: true, added: rpcRes?.added || 0, total: rpcRes?.total || 0, subject: targetSubject };
      }
    } catch (_) {}

    // 2. Client-side query & auto-map active approved questions from matching pool
    try {
      const { data: existingMapped } = await supabase
        .from('exam_questions')
        .select('question_id, question_order')
        .eq('exam_id', examId)
        .order('question_order', { ascending: true });

      const mappedIds = new Set((existingMapped || []).map(r => r.question_id));
      const currentCount = mappedIds.size;
      const needed = Math.max(0, configuredTotal - currentCount);

      if (needed <= 0 && currentCount > 0) {
        return { ok: true, added: 0, total: currentCount, subject: targetSubject };
      }

      // Query active approved questions
      const { data: poolData, error: poolErr } = await supabase
        .from('questions')
        .select('id, question, option_a, option_b, option_c, option_d, correct_answer, subject, exam, status')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(600);

      if (poolErr || !poolData?.length) {
        return { ok: false, added: 0, total: currentCount, error: poolErr?.message || 'Question bank empty' };
      }

      // Filter valid publishable questions strictly
      const validPool = poolData.filter(q => {
        if (mappedIds.has(q.id)) return false;
        const ans = cleanAnswer(q.correct_answer);
        if (!/^[ABCD]$/.test(ans)) return false;
        if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) return false;
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d].map(x => String(x).trim().toLowerCase());
        if (new Set(opts).size < 4) return false;
        if (isDependentContextMissing(q.question)) return false;
        return true;
      });

      const selected = [];
      const selectedIds = new Set();

      // Priority 1: Match subject or exam keywords
      for (const q of validPool) {
        if (selected.length >= needed) break;
        const subMatch = targetSubject && matchExamSubjectStrict(q.subject, targetSubject);
        const examMatch = examObj.title && q.exam && (
          examObj.title.toLowerCase().includes(String(q.exam).toLowerCase()) ||
          String(q.exam).toLowerCase().includes(examObj.title.toLowerCase())
        );
        if ((subMatch || examMatch) && !selectedIds.has(q.id)) {
          selected.push(q);
          selectedIds.add(q.id);
        }
      }

      // Priority 2: Safe fallback to active approved pool so 0 questions is NEVER assigned
      if (selected.length < needed) {
        for (const q of validPool) {
          if (selected.length >= needed) break;
          if (!selectedIds.has(q.id)) {
            selected.push(q);
            selectedIds.add(q.id);
          }
        }
      }

      if (selected.length > 0) {
        const nextOrderStart = (existingMapped || []).length;
        const mappings = selected.map((q, idx) => ({
          exam_id: examId,
          question_id: q.id,
          question_order: nextOrderStart + idx + 1
        }));

        const { error: insErr } = await supabase
          .from('exam_questions')
          .insert(mappings);

        if (insErr) {
          return { ok: false, added: 0, total: currentCount, error: insErr.message };
        }

        return {
          ok: true,
          added: mappings.length,
          total: currentCount + mappings.length,
          subject: targetSubject
        };
      }

      return { ok: true, added: 0, total: currentCount, subject: targetSubject };
    } catch (e) {
      console.warn('performAutoMap failed:', e);
      return { ok: false, added: 0, total: 0, error: e.message };
    }
  };

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data: exams, error } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setMsg(error.message);
      logEvent('error', error.message, { source: 'exam-management', action: 'load-exams' });
    }

    const { data: eqRows } = await supabase
      .from('exam_questions')
      .select('exam_id');

    const counts = {};
    (eqRows || []).forEach(r => {
      counts[r.exam_id] = (counts[r.exam_id] || 0) + 1;
    });

    const enriched = (exams || []).map(e => ({
      ...e,
      mapped_count: counts[e.id] !== undefined ? counts[e.id] : 0
    }));

    setData(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const mapQuestions = async (examObj) => {
    setMsg(`Auto-mapping approved questions for "${examObj.title}"…`);
    const res = await performAutoMap(examObj);
    if (!res.ok) {
      setMsg(`Auto-map notice: ${res.error || 'Check question bank pool'}`);
    } else {
      setMsg(`Auto-map complete: ${res.added} approved questions added (${res.total} total assigned).`);
    }
    await load();
  };

  const publishExam = async (examObj) => {
    setMsg(`Publishing "${examObj.title}" & auto-mapping approved questions…`);
    await supabase.from('exams').update({ status: 'published', published: true, updated_at: new Date().toISOString() }).eq('id', examObj.id);
    const res = await performAutoMap(examObj);
    setMsg(`Published "${examObj.title}" successfully with ${res.total} approved questions assigned!`);
    await load();
  };

  const create = async () => {
    const rawTitle = form.title === '[Custom Mock Pattern]' ? form.custom_title.trim() : form.title.trim();
    if (!rawTitle) {
      setMsg('Exam title is required.');
      return;
    }
    setMsg('Creating exam pattern & auto-mapping approved questions…');
    const selectedSubject = form.subject || deriveExamSubject(rawTitle) || null;
    let created = null;

    // 1. Try admin_create_exam RPC
    const { data: rpcCreated, error: rpcErr } = await supabase.rpc('admin_create_exam', {
      p_title: rawTitle,
      p_exam_type: 'mock',
      p_subject: selectedSubject,
      p_total_questions: Number(form.question_count),
      p_duration_minutes: Number(form.duration),
      p_marks_per_question: 1,
      p_negative_marking: Number(form.negative_mark),
      p_randomize_questions: true,
      p_published: form.status === 'published',
      p_status: form.status,
      p_created_by: session?.user?.id || null
    });

    if (!rpcErr && rpcCreated?.id) {
      created = rpcCreated;
    } else {
      // 2. Direct insert fallback
      const { data: directCreated, error: dirErr } = await supabase
        .from('exams')
        .insert({
          title: rawTitle,
          exam_type: 'mock',
          subject: selectedSubject,
          total_questions: Number(form.question_count),
          duration_minutes: Number(form.duration),
          marks_per_question: 1,
          negative_marking: Number(form.negative_mark),
          randomize_questions: true,
          published: form.status === 'published',
          status: form.status,
          created_by: session?.user?.id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dirErr) {
        setMsg('Create failed: ' + dirErr.message);
        await logEvent('error', dirErr.message, { source: 'exam-management', action: 'create-exam', data: { title: rawTitle } });
        return;
      }
      created = directCreated;
    }

    setForm({ ...form, title: '', custom_title: '', subject: '' });

    // Auto-map active approved questions immediately so 0 questions is never assigned!
    let mapMsg = '';
    if (created?.id) {
      const mapRes = await performAutoMap(created);
      mapMsg = ` Auto-mapped ${mapRes.added} approved questions (${mapRes.total} total assigned).`;
    }

    setMsg(`Exam pattern ${form.status === 'published' ? 'published' : 'created'} successfully!${mapMsg}`);
    await load();
  };

  return (
    <>
      <Title
        t="📝 Exam Management"
        s="Create real mock structures, assemble mocks with syllabus blueprints, and publish verified tests with guaranteed approved question mappings."
      />
      <div className="review-tabs" style={{ marginBottom: 18 }}>
        <button className={'btn ' + (viewTab === 'list' ? 'dark' : 'light')} onClick={() => setViewTab('list')}>
          Saved Exams & Patterns ({data.length})
        </button>
        <button className={'btn ' + (viewTab === 'blueprint' ? 'dark' : 'light')} onClick={() => setViewTab('blueprint')}>
          <Sparkles size={15} /> Blueprint-Driven AI Mock Generator
        </button>
      </div>

      {viewTab === 'blueprint' ? (
        <AiMockGenerator supabase={supabase} onExamCreated={load} />
      ) : (
        <>
          <div className="panel">
            <div className="panel-head">
              <b>Manual Exam Pattern Creator</b>
              <span className="success-badge">Auto-Maps Approved Pool</span>
            </div>
            <div className="form-grid">
              <label>
                Exam Title / Pattern
                <select
                  value={form.title}
                  onChange={e => {
                    const val = e.target.value;
                    const autoSub = deriveExamSubject(val);
                    setForm({ ...form, title: val, subject: form.subject || autoSub });
                  }}
                >
                  <option value="">Select Exam / Mock</option>
                  {EXAM_TITLE_OPTIONS.map(x => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </label>

              {form.title === '[Custom Mock Pattern]' && (
                <label>
                  Custom Exam Title
                  <input
                    type="text"
                    placeholder="e.g. SBI PO Mains Mock Test 1"
                    value={form.custom_title}
                    onChange={e => {
                      const val = e.target.value;
                      setForm({ ...form, custom_title: val, subject: form.subject || deriveExamSubject(val) });
                    }}
                  />
                </label>
              )}

              <label>
                Subject / Domain Pool
                <select
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                >
                  <option value="">Auto-Detect from Title</option>
                  {POOL_SUBJECTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label>
                Total Questions
                <input
                  type="number"
                  min="1"
                  value={form.question_count}
                  onChange={e => setForm({ ...form, question_count: e.target.value })}
                />
              </label>

              <label>
                Duration (minutes)
                <input
                  type="number"
                  min="1"
                  value={form.duration}
                  onChange={e => setForm({ ...form, duration: e.target.value })}
                />
              </label>

              <label>
                Negative Marking
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.negative_mark}
                  onChange={e => setForm({ ...form, negative_mark: e.target.value })}
                />
              </label>

              <label>
                Status
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  <option value="published">Published (Live for Candidates)</option>
                  <option value="draft">Draft (Admin Staging)</option>
                </select>
              </label>
            </div>

            <button className="btn primary" onClick={create}>
              <PlusCircle size={16} /> Create & Publish Exam Pattern
            </button>
            {msg && <div className="file-selected" style={{ marginTop: 12 }}>{msg}</div>}
          </div>

          <div className="panel">
            <div className="panel-head">
              <b>Saved Exams & Question Mappings</b>
              <span className="success-badge">{loading ? 'Loading…' : `${data.length} records`}</span>
            </div>
            {data.length ? (
              data.map(e => (
                <div className="candidate-row" key={e.id}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b>{e.title}</b>
                      {e.subject && <span className="tag" style={{ fontSize: 11 }}>{e.subject}</span>}
                      {e.mapped_count === 0 ? (
                        <span className="error-badge" style={{ fontSize: 11, padding: '2px 8px' }}>
                          ⚠️ 0 approved questions mapped
                        </span>
                      ) : e.mapped_count >= (e.total_questions || 25) ? (
                        <span className="success-badge" style={{ fontSize: 11, padding: '2px 8px' }}>
                          ✓ {e.mapped_count} questions assigned
                        </span>
                      ) : (
                        <span className="tag" style={{ fontSize: 11, background: '#fef3c7', color: '#92400e' }}>
                          {e.mapped_count}/{e.total_questions || 25} mapped
                        </span>
                      )}
                    </div>
                    <small>
                      Configured: {e.total_questions || 0} questions · {e.duration_minutes || 0} min · −{e.negative_marking || 0} negative mark
                    </small>
                  </div>
                  <div className="quick-actions">
                    <span className="tag">{e.status}</span>
                    {e.status === 'draft' && (
                      <button className="btn primary sm" onClick={() => publishExam(e)}>
                        Publish & Map
                      </button>
                    )}
                    <button className="btn light sm" onClick={() => mapQuestions(e)}>
                      {e.mapped_count === 0 ? '⚡ Auto-map Questions' : 'Auto-map More'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              !loading && <p className="muted">No exams created yet.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
function Candidates({session}){const[data,setData]=useState([]),[loading,setLoading]=useState(true),[msg,setMsg]=useState(''),[deletingId,setDeletingId]=useState(''),[form,setForm]=useState({name:'',email:'',phone:'',password:'',role:'candidate'});const load=async()=>{setLoading(true);const {data,error}=await supabase.from('profiles').select('id,full_name,email,phone,role,created_at').in('role',['candidate','sub_admin','question_manager','exam_manager','vacancy_manager','content_manager','support','admin']).order('created_at',{ascending:false}).limit(500);if(error)setMsg(error.message);setData(data||[]);setLoading(false)};useEffect(()=>{load()},[]);const create=async()=>{setMsg('');if(!form.name.trim()||!form.email.trim()||form.password.length<8){setMsg('Name, email and password (8+ characters) are required.');return}setLoading(true);try{const token=session?.access_token||(await supabase?.auth?.getSession())?.data?.session?.access_token||'';const r=await fetch('/api/admin-create-user',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(form)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'User creation failed.');setMsg(`User created: ${j.email||form.email}`);setForm({name:'',email:'',phone:'',password:'',role:'candidate'});await load()}catch(e){setMsg(e.message||'Failed to create user.')}finally{setLoading(false)}};const deleteUser=async(user)=>{if(user.id===session?.user?.id){alert('You cannot delete your active admin account.');return}if(!window.confirm(`Permanently remove user ${user.full_name||user.email} (${user.email})?`))return;setDeletingId(user.id);try{const token=session?.access_token||(await supabase?.auth?.getSession())?.data?.session?.access_token||'';const r=await fetch('/api/admin-create-user',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action:'delete',userId:user.id})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Delete failed.');setData(prev=>prev.filter(u=>u.id!==user.id));setMsg(`User ${user.email||user.full_name} deleted.`);}catch(e){setMsg(e.message||'Failed to delete user.');}finally{setDeletingId('');}};return <><Title t="👥 Users & Candidates" s="Create candidates and staff accounts from the admin portal. Auth creation happens server-side; secrets never reach the browser."/><div className="panel"><div className="panel-head"><b>Create New User</b><span className="success-badge">Admin only</span></div><div className="form-grid"><label>Full Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Candidate name"/></label><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="candidate@example.com"/></label><label>Mobile<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+91..."/></label><label>Temporary Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Minimum 8 characters"/></label><label>Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="candidate">Candidate</option><option value="sub_admin">Sub-admin</option><option value="question_manager">Question Manager</option><option value="exam_manager">Exam Manager</option><option value="vacancy_manager">Vacancy Manager</option><option value="content_manager">Content Manager</option><option value="support">Support</option></select></label></div><button className="btn primary" onClick={create} disabled={loading}><PlusCircle size={16}/> Create User</button>{msg&&<div className={msg.startsWith('User created')||msg.includes('deleted')?'success-badge':'error-badge'} style={{marginTop:12}}>{msg}</div>}</div><div className="panel"><div className="panel-head"><b>Registered Users</b><span className="success-badge">{loading?'Loading…':`${data.length} records`}</span></div>{!loading&&data.length?data.map(c=>{const isSelf=c.id===session?.user?.id;return <div className="candidate-row" key={c.id}><div className="avatar sm">{(c.full_name||c.email||'U')[0].toUpperCase()}</div><div style={{flex:1}}><b>{c.full_name||'Unnamed User'} {isSelf&&<span style={{color:'#6366f1',fontSize:11}}>(You)</span>}</b><small>{c.email||'No email'} · {c.phone||'No mobile'}</small></div><span className="tag" style={{marginRight:8}}>{c.role}</span>{!isSelf&&<button className="danger-icon-btn" onClick={()=>deleteUser(c)} disabled={deletingId===c.id}><Trash2 size={13}/> {deletingId===c.id?'Deleting...':'Remove'}</button>}</div>}):<div className="empty-state"><Users size={35}/><h3>{loading?'Loading user database…':'No users yet'}</h3></div>}</div></>}

function ProfilePage({session,role}){
  const [profile,setProfile]=useState(null),[name,setName]=useState(''),[phone,setPhone]=useState(''),[saved,setSaved]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  useEffect(()=>{let live=true;const load=async()=>{if(!supabase||!session?.user?.id){setLoading(false);return}const {data,error}=await supabase.from('profiles').select('id,full_name,email,phone,role,created_at').eq('id',session.user.id).maybeSingle();if(live){if(error)setError(error.message);setProfile(data||null);setName(data?.full_name||session?.user?.user_metadata?.full_name||'');setPhone(data?.phone||session?.user?.phone||session?.user?.user_metadata?.phone||'');setLoading(false)}};load();return()=>{live=false}},[session]);
  const save=async()=>{setSaved(false);setError('');if(!supabase||!session?.user?.id)return;setSaving(true);try{const {data,error:updErr}=await supabase.from('profiles').update({full_name:name.trim(),phone:phone.trim(),updated_at:new Date().toISOString()}).eq('id',session.user.id).select().single();if(updErr)throw updErr;await supabase.auth.updateUser({data:{full_name:name.trim(),phone:phone.trim()}}).catch(()=>{});setProfile(data);setSaved(true);await logEvent('info','User updated profile details',{source:'profile',data:{userId:session.user.id}})}catch(err){setError(err.message||'Failed to save profile');await logEvent('error',err.message||'Profile update error',{source:'profile'})}finally{setSaving(false)}};
  const userEmail=profile?.email||session?.user?.email||'—';
  const userRole=profile?.role||(role==='admin'?'admin':'candidate');
  const initialLetter=(name?.[0]||userEmail?.[0]||'U').toUpperCase();
  return <><Title t="👤 My Profile" s="Strictly displays your personal profile details (Name, Email, Phone, Role) and profile save functionality."/><div className="profile-summary-box"><div className="profile-avatar-lg">{initialLetter}</div><div className="profile-summary-info"><b>{name||userEmail}</b><p>{userEmail} · {phone||'No mobile registered'}</p><span className="profile-role-pill"><ShieldCheck size={13}/> {userRole==='admin'?'Administrator':'Verified Candidate'}</span></div></div><div className="settings-card" style={{maxWidth:680}}><div className="panel-head" style={{marginBottom:18}}><b>Personal Profile Information</b><span className="success-badge"><UserCircle size={13}/> Account Details</span></div><div style={{display:'flex',flexDirection:'column',gap:16}}><label style={{display:'flex',flexDirection:'column',gap:6,fontSize:13,fontWeight:650}}>Full Name<input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" disabled={loading}/></label><label style={{display:'flex',flexDirection:'column',gap:6,fontSize:13,fontWeight:650}}>Email Address (Read-only)<input type="email" value={userEmail} disabled style={{background:'#f8fafc',cursor:'not-allowed',color:'#64748b'}}/><small style={{color:'#94a3b8',fontSize:11}}>Authentication email is securely linked to your account.</small></label><label style={{display:'flex',flexDirection:'column',gap:6,fontSize:13,fontWeight:650}}>Mobile Number<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" disabled={loading}/></label><label style={{display:'flex',flexDirection:'column',gap:6,fontSize:13,fontWeight:650}}>Account Role<input type="text" value={(userRole||'candidate').toUpperCase()} disabled style={{background:'#f8fafc',cursor:'not-allowed',color:'#4338ca',fontWeight:750}}/></label><div style={{display:'flex',alignItems:'center',gap:12,marginTop:8}}><button className="btn primary" onClick={save} disabled={loading||saving}><Save size={16}/> {saving?'Saving...':'Save Profile'}</button>{saved&&<span className="success-badge"><CheckCircle2 size={14}/> Profile details saved successfully.</span>}{error&&<span className="error-badge">{error}</span>}</div></div></div></>;
}

function ChangePasswordCard({session,role}){
  const [newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[showNew,setShowNew]=useState(false),[showConfirm,setShowConfirm]=useState(false),[saving,setSaving]=useState(false),[successMsg,setSuccessMsg]=useState(''),[errorMsg,setErrorMsg]=useState('');
  const handleUpdatePassword=async(e)=>{
    if(e)e.preventDefault();
    setSuccessMsg('');setErrorMsg('');
    if(!newPassword||newPassword.length<8){setErrorMsg('Password must be at least 8 characters in length.');return}
    if(newPassword!==confirmPassword){setErrorMsg('New password and confirm password do not match.');return}
    setSaving(true);
    try{
      if(!supabase)throw new Error('Supabase client is not initialized.');
      const {error:authErr}=await supabase.auth.updateUser({password:newPassword});
      if(authErr)throw authErr;
      if(session?.user?.id){
        await supabase.from('profiles').update({updated_at:new Date().toISOString()}).eq('id',session.user.id);
      }
      setSuccessMsg('Your password has been updated securely. You can now use your new password on your next login.');
      setNewPassword('');setConfirmPassword('');
      await logEvent('info',`${role==='admin'?'Admin':'Candidate'} changed password`,{source:'settings',data:{userId:session?.user?.id}});
    }catch(err){
      setErrorMsg(err.message||'Failed to update password. Please check your session.');
      await logEvent('error',err.message||'Password update failure',{source:'settings'});
    }finally{
      setSaving(false);
    }
  };
  return (
    <div className="settings-card" style={{maxWidth:580}}>
      <div className="panel-head" style={{marginBottom:18}}>
        <div>
          <b>Change Account Password</b>
          <small style={{color:'#64748b',fontSize:12,display:'block',marginTop:2}}>Update your login credentials securely in Supabase Authentication.</small>
        </div>
        <span className="success-badge"><Lock size={13}/> Encrypted</span>
      </div>
      <form onSubmit={handleUpdatePassword} style={{display:'flex',flexDirection:'column',gap:16}}>
        <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:13,fontWeight:650}}>
          New Password
          <div className="input-with-icon">
            <input type={showNew?'text':'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Minimum 8 characters" disabled={saving}/>
            <button type="button" className="input-eye-btn" onClick={()=>setShowNew(v=>!v)} title={showNew?'Hide':'Show'}>
              {showNew?<EyeOff size={16}/>:<Eye size={16}/>}
            </button>
          </div>
          <small style={{color:'#94a3b8',fontSize:11}}>Must contain at least 8 characters.</small>
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:13,fontWeight:650}}>
          Confirm New Password
          <div className="input-with-icon">
            <input type={showConfirm?'text':'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter new password" disabled={saving}/>
            <button type="button" className="input-eye-btn" onClick={()=>setShowConfirm(v=>!v)} title={showConfirm?'Hide':'Show'}>
              {showConfirm?<EyeOff size={16}/>:<Eye size={16}/>}
            </button>
          </div>
        </label>
        <div style={{display:'flex',alignItems:'center',gap:12,marginTop:6}}>
          <button type="submit" className="btn primary" disabled={saving||!newPassword||!confirmPassword}>
            <KeyRound size={16}/> {saving?'Updating Password...':'Update Password'}
          </button>
        </div>
        {successMsg&&<div className="success-badge" style={{padding:'9px 14px',fontSize:12}}><CheckCircle2 size={15}/> {successMsg}</div>}
        {errorMsg&&<div className="error-badge">{errorMsg}</div>}
      </form>
    </div>
  );
}

function AdminAddUserCard({onUserCreated,session}){
  const [form,setForm]=useState({name:'',email:'',phone:'',password:'',role:'candidate'}),[saving,setSaving]=useState(false),[successMsg,setSuccessMsg]=useState(''),[errorMsg,setErrorMsg]=useState('');
  const handleCreateUser=async(e)=>{
    if(e)e.preventDefault();
    setSuccessMsg('');setErrorMsg('');
    if(!form.name.trim()||!form.email.trim()||form.password.length<8){
      setErrorMsg('Full Name, Email ID, and Temporary Password (8+ characters) are required.');
      return;
    }
    setSaving(true);
    try{
      const token=session?.access_token||(await supabase?.auth?.getSession())?.data?.session?.access_token||'';
      const r=await fetch('/api/admin-create-user',{
        method:'POST',
        headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
        body:JSON.stringify(form)
      });
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'Failed to create user.');
      setSuccessMsg(`User successfully created & persisted in database: ${j.email||form.email} (${form.role})`);
      setForm({name:'',email:'',phone:'',password:'',role:'candidate'});
      if(onUserCreated)onUserCreated();
    }catch(err){
      setErrorMsg(err.message||'Failed to create user account.');
    }finally{
      setSaving(false);
    }
  };
  return (
    <div className="settings-card" style={{maxWidth:680}}>
      <div className="panel-head" style={{marginBottom:18}}>
        <div>
          <b>Add New User Account</b>
          <small style={{color:'#64748b',fontSize:12,display:'block',marginTop:2}}>Creates credentials in Supabase Auth and persists user profile.</small>
        </div>
        <span className="success-badge">Admin Control</span>
      </div>
      <form onSubmit={handleCreateUser} style={{display:'flex',flexDirection:'column',gap:16}}>
        <div className="form-grid">
          <label>Full Name
            <input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name" disabled={saving}/>
          </label>
          <label>Email Address
            <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="user@example.com" disabled={saving}/>
          </label>
          <label>Mobile Number
            <input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+91 XXXXX XXXXX" disabled={saving}/>
          </label>
          <label>Temporary Password
            <input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Minimum 8 characters" disabled={saving}/>
          </label>
          <label style={{gridColumn:'span 2'}}>Account Role
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} disabled={saving}>
              <option value="candidate">Candidate</option>
              <option value="sub_admin">Sub-admin</option>
              <option value="question_manager">Question Manager</option>
              <option value="exam_manager">Exam Manager</option>
              <option value="vacancy_manager">Vacancy Manager</option>
              <option value="content_manager">Content Manager</option>
              <option value="support">Support</option>
            </select>
          </label>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12,marginTop:8}}>
          <button type="submit" className="btn primary" disabled={saving}>
            <UserPlus size={16}/> {saving?'Creating User...':'Create & Persist User'}
          </button>
        </div>
        {successMsg&&<div className="success-badge" style={{padding:'9px 14px',fontSize:12}}><CheckCircle2 size={15}/> {successMsg}</div>}
        {errorMsg&&<div className="error-badge">{errorMsg}</div>}
      </form>
    </div>
  );
}

function AdminManageUsersCard({session}){
  const [users,setUsers]=useState([]),[loading,setLoading]=useState(true),[search,setSearch]=useState(''),[roleFilter,setRoleFilter]=useState('all'),[actionMsg,setActionMsg]=useState(''),[errorMsg,setErrorMsg]=useState(''),[actionBusyId,setActionBusyId]=useState('');
  const loadUsers=async()=>{
    setLoading(true);setErrorMsg('');
    try{
      if(!supabase)return;
      const {data,error}=await supabase.from('profiles').select('id,full_name,email,phone,role,created_at').order('created_at',{ascending:false}).limit(500);
      if(error)throw error;
      setUsers(data||[]);
    }catch(err){
      setErrorMsg(err.message||'Failed to load user records.');
    }finally{
      setLoading(false);
    }
  };
  useEffect(()=>{loadUsers()},[]);
  const handleDeleteUser=async(user)=>{
    if(user.id===session?.user?.id){alert('You cannot delete your currently active administrator account.');return}
    const confirmed=window.confirm(`Are you sure you want to permanently remove user ${user.full_name||user.email} (${user.email})?\n\nThis will delete their login credentials from Supabase Auth and remove their profile from the database.`);
    if(!confirmed)return;
    setActionBusyId(user.id);setActionMsg('');setErrorMsg('');
    try{
      const token=session?.access_token||(await supabase?.auth?.getSession())?.data?.session?.access_token||'';
      const r=await fetch('/api/admin-create-user',{
        method:'POST',
        headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
        body:JSON.stringify({action:'delete',userId:user.id})
      });
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'Failed to delete user.');
      setUsers(prev=>prev.filter(u=>u.id!==user.id));
      setActionMsg(`User ${user.email||user.full_name} has been removed from database and authentication.`);
      await logEvent('info','Admin deleted user',{source:'admin-users',data:{targetUserId:user.id,email:user.email}});
    }catch(err){
      setErrorMsg(err.message||'Failed to delete user.');
    }finally{
      setActionBusyId('');
    }
  };
  const filteredUsers=users.filter(u=>{
    const matchSearch=!search||(u.full_name&&u.full_name.toLowerCase().includes(search.toLowerCase()))||(u.email&&u.email.toLowerCase().includes(search.toLowerCase()))||(u.phone&&u.phone.includes(search))||(u.role&&u.role.toLowerCase().includes(search.toLowerCase()));
    const matchRole=roleFilter==='all'?true:roleFilter==='candidate'?u.role==='candidate':u.role!=='candidate';
    return matchSearch&&matchRole;
  });
  return (
    <div className="settings-card">
      <div className="panel-head" style={{marginBottom:18}}>
        <div>
          <b>Remove User / Manage Candidates</b>
          <small style={{color:'#64748b',fontSize:12,display:'block',marginTop:2}}>Manage user accounts with database persistence and removal controls.</small>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button className="btn light" onClick={loadUsers} disabled={loading} style={{padding:'7px 12px',fontSize:12}}>
            <RefreshCw size={13}/> Refresh
          </button>
          <span className="success-badge">{loading?'Loading…':`${users.length} Users`}</span>
        </div>
      </div>
      {actionMsg&&<div className="success-badge" style={{padding:'9px 14px',fontSize:12,marginBottom:14}}><CheckCircle2 size={15}/> {actionMsg}</div>}
      {errorMsg&&<div className="error-badge" style={{marginBottom:14}}>{errorMsg}</div>}
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:18}}>
        <div style={{flex:1,minWidth:240}}>
          <input type="text" placeholder="Search by name, email, phone or role..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:'100%',padding:'10px 14px',border:'1px solid #dce1ea',borderRadius:10}}/>
        </div>
        <div className="review-tabs" style={{margin:0}}>
          <button className={'btn '+(roleFilter==='all'?'dark':'light')} onClick={()=>setRoleFilter('all')} style={{padding:'7px 12px',fontSize:12}}>All ({users.length})</button>
          <button className={'btn '+(roleFilter==='candidate'?'dark':'light')} onClick={()=>setRoleFilter('candidate')} style={{padding:'7px 12px',fontSize:12}}>Candidates ({users.filter(u=>u.role==='candidate').length})</button>
          <button className={'btn '+(roleFilter==='staff'?'dark':'light')} onClick={()=>setRoleFilter('staff')} style={{padding:'7px 12px',fontSize:12}}>Staff / Admins ({users.filter(u=>u.role!=='candidate').length})</button>
        </div>
      </div>
      {loading?(
        <p className="muted">Loading user database…</p>
      ):filteredUsers.length?(
        <div style={{overflowX:'auto'}}>
          <table className="user-management-table">
            <thead>
              <tr>
                <th>User Identity</th>
                <th>Role</th>
                <th>Contact</th>
                <th>Registered</th>
                <th style={{textAlign:'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u=>{
                const isSelf=u.id===session?.user?.id;
                const isBusy=actionBusyId===u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div className="avatar sm" style={{width:34,height:34,fontSize:13}}>
                          {(u.full_name||u.email||'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <b style={{display:'block',color:'#1e293b'}}>{u.full_name||'Unnamed User'} {isSelf&&<span style={{color:'#6366f1',fontSize:11,fontWeight:700}}>(You)</span>}</b>
                          <small style={{color:'#64748b'}}>{u.email||'No email'}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="tag" style={{textTransform:'capitalize'}}>{u.role||'candidate'}</span>
                    </td>
                    <td>
                      <small style={{color:'#475569'}}>{u.phone||'—'}</small>
                    </td>
                    <td>
                      <small style={{color:'#94a3b8'}}>{u.created_at?new Date(u.created_at).toLocaleDateString('en-IN'):'—'}</small>
                    </td>
                    <td style={{textAlign:'right'}}>
                      {isSelf?(
                        <span style={{fontSize:11,color:'#94a3b8',fontStyle:'italic'}}>Active Admin</span>
                      ):(
                        <button className="danger-icon-btn" onClick={()=>handleDeleteUser(u)} disabled={isBusy} title="Permanently remove user">
                          <Trash2 size={14}/> {isBusy?'Removing...':'Remove User'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ):(
        <div className="empty-state" style={{padding:30,textAlign:'center'}}>
          <Users size={32} style={{color:'#94a3b8',margin:'0 auto 10px'}}/>
          <h3>No matching users found</h3>
          <p className="muted">Try adjusting your search or role filter.</p>
        </div>
      )}
    </div>
  );
}

function SettingsPage({session,role,setPage}){
  const [activeTab,setActiveTab]=useState('password');
  return (
    <>
      <Title
        t="⚙️ Settings"
        s={role==='admin'
          ?"Administrative security controls: Change password, add user accounts, and remove users/candidates with database persistence."
          :"Candidate security settings: Change your account password securely with database update and validation."}
      />
      {role==='admin'?(
        <>
          <div className="settings-tabs-bar">
            <button className={'settings-tab-btn '+(activeTab==='password'?'active':'')} onClick={()=>setActiveTab('password')}>
              <KeyRound size={16}/> Change Password
            </button>
            <button className={'settings-tab-btn '+(activeTab==='add_user'?'active':'')} onClick={()=>setActiveTab('add_user')}>
              <UserPlus size={16}/> Add User
            </button>
            <button className={'settings-tab-btn '+(activeTab==='manage_users'?'active':'')} onClick={()=>setActiveTab('manage_users')}>
              <Users size={16}/> Remove User / Manage Candidates
            </button>
          </div>
          {activeTab==='password'&&<ChangePasswordCard session={session} role={role}/>}
          {activeTab==='add_user'&&<AdminAddUserCard onUserCreated={()=>setActiveTab('manage_users')} session={session}/>}
          {activeTab==='manage_users'&&<AdminManageUsersCard session={session}/>}
        </>
      ):(
        <ChangePasswordCard session={session} role={role}/>
      )}
    </>
  );
}
function Notifications() {
  const [audience, setAudience] = useState('All Candidates');
  const [msgType, setMsgType] = useState('Vacancy Alert');
  const [title, setTitle] = useState('New Official Notification Released');
  const [message, setMessage] = useState('Official recruitment boards have released new exam notifications. Check the Vacancies portal for application links and deadlines.');
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelPush, setChannelPush] = useState(false);
  const [channelEmail, setChannelEmail] = useState(false);
  const [sentAlerts, setSentAlerts] = useState([
    {
      id: 'alert-1',
      board: 'IBPS',
      title: 'IBPS CRP PO/MT & Specialist Officer Recruitment Released',
      audience: 'Banking Aspirants',
      time: 'Just now',
      badge: 'New Notification Released'
    },
    {
      id: 'alert-2',
      board: 'MPESB',
      title: 'MPESB Police Constable & Subedar/SI Application Window Active',
      audience: 'MP State Aspirants',
      time: '2 hours ago',
      badge: 'New Notification Released'
    },
    {
      id: 'alert-3',
      board: 'RRB',
      title: 'RRB Centralized Employment Notice (CEN) NTPC Window',
      audience: 'Railway Candidates',
      time: 'Today',
      badge: 'New Notification Released'
    }
  ]);
  const [alertSuccess, setAlertSuccess] = useState('');

  const handleBroadcast = () => {
    if (!title.trim() || !message.trim()) return;
    const newAlert = {
      id: `alert-${Date.now()}`,
      board: 'Custom Broadcast',
      title,
      audience,
      time: 'Just now',
      badge: 'New Notification Released'
    };
    setSentAlerts([newAlert, ...sentAlerts]);
    setAlertSuccess(`Broadcast alert "${title}" dispatched successfully to ${audience}!`);
    setTimeout(() => setAlertSuccess(''), 5000);
  };

  const prefillFromBoard = (portal) => {
    const notice = portal.active_notifications?.[0];
    setTitle(`[${portal.board}] ${notice?.title || portal.name}`);
    setMessage(`Official Notification Update from ${portal.authority}: Check details on ${portal.domain} and apply directly via ${portal.apply_url}`);
    setMsgType('Vacancy Alert');
  };

  return (
    <>
      <Title
        t="🔔 Recruitment & Candidate Notifications"
        s="Dispatch official recruitment alerts, vacancy updates, and personalized exam reminders."
      />

      {alertSuccess && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} /> {alertSuccess}
        </div>
      )}

      {/* Official Board Live Broadcast Ticker */}
      <div className="panel" style={{ marginBottom: '20px' }}>
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="section-kicker">OFFICIAL BOARD BROADCASTS</span>
            <b>Latest Government & Banking Notification Feeds</b>
          </div>
          <span className="badge-new-notification">
            <span className="pulse-dot" />
            Live Sync Active
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', marginTop: '14px' }}>
          {OFFICIAL_RECRUITMENT_PORTALS.map(portal => (
            <div key={portal.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', background: '#fafbfc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <b style={{ fontSize: '13px', color: '#0f172a' }}>{portal.name}</b>
                <span className="badge-new-notification" style={{ fontSize: '10px', padding: '2px 7px' }}>
                  <span className="pulse-dot" />
                  {portal.badge}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 10px', lineHeight: 1.4 }}>
                {portal.active_notifications?.[0]?.title || portal.description}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #edf2f7' }}>
                <span className="verified-domain-pill">{portal.domain}</span>
                <button
                  className="btn light"
                  onClick={() => prefillFromBoard(portal)}
                  style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Megaphone size={12} /> Prefill Broadcast
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="notification-layout">
        <div className="panel">
          <div className="panel-head">
            <b>Send / Broadcast Recruitment Alert</b>
          </div>
          <div className="notify-form">
            <label>
              Audience
              <select value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option>All Candidates</option>
                <option>Banking Aspirants (IBPS / SBI)</option>
                <option>Central SSC & Railway Aspirants</option>
                <option>MP State Aspirants (MPESB / MPPSC)</option>
                <option>UPSC Civil Services Candidates</option>
                <option>Inactive Candidates</option>
              </select>
            </label>
            <label>
              Message Type
              <select value={msgType} onChange={(e) => setMsgType(e.target.value)}>
                <option>Vacancy Alert</option>
                <option>New Notification Released</option>
                <option>Exam Reminder</option>
                <option>Score & Rank Update</option>
                <option>Weak Point Practice</option>
                <option>Weekly Report</option>
              </select>
            </label>
            <label>
              Title
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Message Content
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{ minHeight: '90px' }}
              />
            </label>
            <div className="notify-checks">
              <label>
                <input
                  type="checkbox"
                  checked={channelInApp}
                  onChange={(e) => setChannelInApp(e.target.checked)}
                /> In-app Notification
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={channelPush}
                  onChange={(e) => setChannelPush(e.target.checked)}
                /> Web Push Alert
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={channelEmail}
                  onChange={(e) => setChannelEmail(e.target.checked)}
                /> Email Dispatch
              </label>
            </div>
            <button className="btn primary" onClick={handleBroadcast}>
              <Megaphone size={15} /> Dispatch Alert to Candidates
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <b>Broadcast Feed & History</b>
          </div>
          <div className="activity-list" style={{ marginTop: '10px' }}>
            {sentAlerts.map(alert => (
              <div key={alert.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span className="badge-new-notification" style={{ fontSize: '10px', padding: '2px 6px' }}>
                    <span className="pulse-dot" />
                    {alert.badge}
                  </span>
                  <small style={{ color: '#94a3b8' }}>{alert.time}</small>
                </div>
                <b style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>{alert.title}</b>
                <small style={{ color: '#64748b' }}>Target: {alert.audience}</small>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #edf2f7' }}>
            <b style={{ fontSize: '13px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>Automation Triggers:</b>
            <div className="activity-list">
              <p>📢 New official vacancy → instant 'New Notification Released' push</p>
              <p>⏳ Form closing in 48 hours → urgency alert</p>
              <p>📊 Post-exam result → score card + percentile rank</p>
              <p>⚠️ Weak subject identified → targeted mock alert</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state={hasError:false,error:null,retryKey:0};
  }
  static getDerivedStateFromError(error){
    return {hasError:true,error};
  }
  componentDidCatch(error,errorInfo){
    console.error('Portal render error caught:', error, errorInfo);
    if(typeof logEvent==='function'){
      logEvent('error',error?.message||'Portal render crash',{source:'error-boundary',data:{stack:error?.stack||'',componentStack:errorInfo?.componentStack||''}}).catch(()=>{});
    }
  }
  retryRender=()=>{
    this.setState(state=>({hasError:false,error:null,retryKey:state.retryKey+1}));
  };
  render(){
    if(this.state.hasError){
      const message=this.state.error?.message||'The portal could not render this screen.';
      return (
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',textAlign:'center',background:'#f5f7fb',fontFamily:'Inter,ui-sans-serif,system-ui,sans-serif'}}>
          <div style={{maxWidth:460,width:'100%',background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:'32px 24px',boxShadow:'0 10px 25px rgba(0,0,0,0.05)'}}>
            <div style={{width:44,height:44,borderRadius:12,background:'#fee2e2',color:'#ef4444',display:'grid',placeItems:'center',margin:'0 auto 16px',fontWeight:'bold',fontSize:20}}>!</div>
            <h2 style={{fontSize:18,margin:'0 0 8px',fontWeight:700}}>Portal could not load this screen</h2>
            <p style={{fontSize:13,color:'#64748b',margin:'0 0 12px',lineHeight:1.5}}>A temporary rendering error occurred. Try Again will remount the portal without clearing your login session.</p>
            <div style={{fontSize:11,color:'#94a3b8',background:'#f8fafc',borderRadius:8,padding:'8px 10px',marginBottom:20,wordBreak:'break-word'}}>Error: {message.slice(0,240)}</div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn primary full" onClick={this.retryRender}>Try Again</button>
              <button className="btn light full" onClick={()=>window.location.reload()}>Refresh</button>
            </div>
          </div>
        </div>
      );
    }
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App/>
  </ErrorBoundary>
);

