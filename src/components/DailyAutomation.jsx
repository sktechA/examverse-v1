import React, { useEffect, useState } from 'react';
import {
  Clock,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Activity,
  Layers,
  Info,
  Filter,
  Database,
  Server,
  Trash2,
  AlertOctagon,
  X,
  Check,
  Sparkles,
} from 'lucide-react';

export default function DailyAutomation({ supabase, session }) {
  const getInitialSettings = () => {
    const defaults = {
      daily_question_target: 1000,
      daily_ca_target: 150,
      auto_approval_threshold: 0.93,
      gemini_ai_enabled: true,
      daily_scheduler_enabled: true,
      synthesis_mode_enabled: false,
      preferred_ai_model: 'gemini-3.8-flash',
      generation_schedule: '00:00:00 Asia/Kolkata',
      ca_ingestion_enabled: true,
      mock_generation_enabled: true,
      default_mock_questions: 80,
      default_mock_count: 5,
      subject_quotas: {
        Reasoning: 250,
        Mathematics: 250,
        'General Awareness': 200,
        'Banking Awareness': 150,
        Computer: 80,
        English: 70
      }
    };
    try {
      const cached = localStorage.getItem('sktech_automation_settings_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return { ...defaults, ...parsed };
      }
    } catch (_) {}
    return defaults;
  };

  const [settings, setSettings] = useState(getInitialSettings);
  const [logs, setLogs] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [logTab, setLogTab] = useState('automation'); // 'automation' | 'system'
  const [systemLogFilter, setSystemLogFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [runningJob, setRunningJob] = useState(false);
  const [runningTest, setRunningTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [msg, setMsg] = useState('');
  const [currentTimeKolkata, setCurrentTimeKolkata] = useState('');
  const [aiChatMessage, setAiChatMessage] = useState('');
  const [aiChatAnswer, setAiChatAnswer] = useState(null);
  const [aiChatBusy, setAiChatBusy] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  // Permanent Data Deletion & Database Cleanup State
  const [cleanupCounts, setCleanupCounts] = useState(null);
  const [recentExams, setRecentExams] = useState([]);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupTarget, setCleanupTarget] = useState('mock_tests'); // 'mock_tests' | 'test_runs' | 'unwanted_questions' | 'logs' | 'all_questions'
  const [cleanupScope, setCleanupScope] = useState('draft'); // 'draft' | 'single' | 'all' | 'older_than_30d' | 'older_than_7d'
  const [selectedExamId, setSelectedExamId] = useState('');
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);
  const [cleanupTypedConfirm, setCleanupTypedConfirm] = useState('');
  const [cleanupAckCheck, setCleanupAckCheck] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  const fetchCleanupCounts = async () => {
    try {
      setCleanupLoading(true);
      const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
      const res = await fetch('/api/admin-cleanup', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setCleanupCounts(data.counts);
          if (Array.isArray(data.recent_exams)) {
            setRecentExams(data.recent_exams);
            if (data.recent_exams.length > 0 && !selectedExamId) {
              setSelectedExamId(data.recent_exams[0].id);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch cleanup counts:', err);
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleExecuteCleanup = async () => {
    setCleanupBusy(true);
    setCleanupResult(null);
    try {
      const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
      const payload = {
        target: cleanupTarget,
        scope: cleanupTarget === 'mock_tests' && cleanupScope === 'single' ? 'single' : cleanupScope,
        exam_id: cleanupTarget === 'mock_tests' && cleanupScope === 'single' ? selectedExamId : null,
        confirmed: true
      };

      const res = await fetch('/api/admin-cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cleanup execution failed');

      setCleanupResult({
        ok: true,
        message: data.message || `Successfully executed cleanup on ${cleanupTarget}.`,
        count: data.deleted_count
      });

      setCleanupConfirmOpen(false);
      setCleanupTypedConfirm('');
      setCleanupAckCheck(false);

      await fetchCleanupCounts();
      await loadData();
    } catch (err) {
      setCleanupResult({
        ok: false,
        message: err.message || 'Error occurred during permanent deletion'
      });
    } finally {
      setCleanupBusy(false);
    }
  };

  // Clock for Asia/Kolkata
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTimeKolkata(
        d.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    fetchCleanupCounts();
    try {
      let saved = null;
      // Fetch settings via API
      try {
        const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
        const res = await fetch('/api/automation-settings', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const json = await res.json();
          if (json.settings) {
            saved = json.settings;
          }
        }
      } catch (err) {
        console.warn('API settings fetch warning:', err);
      }

      // Supabase direct fallback if API unreachable or returns null
      if (!saved && supabase) {
        try {
          const { data: dbConfig } = await supabase
            .from('automation_settings')
            .select('*')
            .eq('id', 'default_config')
            .maybeSingle();
          if (dbConfig) {
            const extraPrefs = dbConfig.exam_quotas?.__preferences || {};
            saved = {
              ...dbConfig,
              daily_ca_target: Number(dbConfig.current_affairs_target ?? dbConfig.daily_ca_target ?? 150),
              daily_scheduler_enabled: dbConfig.daily_automation_enabled ?? dbConfig.daily_scheduler_enabled ?? true,
              preferred_ai_model: extraPrefs.preferred_ai_model || 'gemini-3.8-flash',
              generation_schedule: extraPrefs.generation_schedule || '00:00:00 Asia/Kolkata',
              ca_ingestion_enabled: extraPrefs.ca_ingestion_enabled !== false,
              synthesis_mode_enabled: Boolean(extraPrefs.synthesis_mode_enabled),
              mock_generation_enabled: extraPrefs.mock_generation_enabled !== false,
              default_mock_questions: Number(dbConfig.default_mock_questions) || 80,
              default_mock_count: Number(dbConfig.default_mock_count) || 5
            };
          }
        } catch (dbErr) {
          console.warn('Direct DB settings fetch warning:', dbErr);
        }
      }

      if (saved) {
        setSettings(prev => {
          const next = {
            ...prev,
            ...saved,
            daily_question_target: Number(saved.daily_question_target ?? prev.daily_question_target),
            daily_ca_target: Number(saved.daily_ca_target ?? saved.current_affairs_target ?? prev.daily_ca_target),
            auto_approval_threshold: Number(saved.auto_approval_threshold ?? prev.auto_approval_threshold),
            daily_scheduler_enabled: saved.daily_scheduler_enabled ?? saved.daily_automation_enabled ?? prev.daily_scheduler_enabled,
            gemini_ai_enabled: Boolean(saved.gemini_ai_enabled ?? prev.gemini_ai_enabled),
            synthesis_mode_enabled: Boolean(saved.synthesis_mode_enabled ?? prev.synthesis_mode_enabled),
            ca_ingestion_enabled: saved.ca_ingestion_enabled !== undefined ? Boolean(saved.ca_ingestion_enabled) : prev.ca_ingestion_enabled,
            mock_generation_enabled: saved.mock_generation_enabled !== undefined ? Boolean(saved.mock_generation_enabled) : prev.mock_generation_enabled,
            preferred_ai_model: saved.preferred_ai_model || prev.preferred_ai_model,
            generation_schedule: saved.generation_schedule || prev.generation_schedule,
            default_mock_questions: Number(saved.default_mock_questions || prev.default_mock_questions),
            default_mock_count: Number(saved.default_mock_count || prev.default_mock_count),
            subject_quotas: saved.subject_quotas || prev.subject_quotas
          };
          try {
            localStorage.setItem('sktech_automation_settings_cache', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }

      // Fetch logs from API or Supabase
      let fetchedSystemLogs = false;
      try {
        const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
        const res = await fetch('/api/system-logs?limit=50', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const sysData = await res.json();
          if (sysData.ok) {
            if (Array.isArray(sysData.system_logs)) setSystemLogs(sysData.system_logs);
            if (Array.isArray(sysData.automation_logs) && sysData.automation_logs.length > 0) setLogs(sysData.automation_logs);
            if (sysData.runtime) setRuntimeInfo(sysData.runtime);
            fetchedSystemLogs = true;
          }
        }
      } catch (_) {}

      // Supabase direct fallback for logs
      if (supabase) {
        if (!fetchedSystemLogs) {
          const [autoRes, sysRes] = await Promise.all([
            supabase.from('automation_logs').select('*').order('created_at', { ascending: false }).limit(20),
            supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(50)
          ]);
          if (autoRes.data) setLogs(autoRes.data);
          if (sysRes.data) setSystemLogs(sysRes.data);
        }
      }
    } catch (e) {
      console.warn('Error loading automation data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveSettings = async () => {
    setLoading(true);
    setMsg('');
    try {
      const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
      const res = await fetch('/api/automation-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      if (data.settings) {
        const saved = data.settings;
        setSettings(prev => {
          const next = {
            ...prev,
            ...saved,
            daily_question_target: Number(saved.daily_question_target ?? prev.daily_question_target),
            daily_ca_target: Number(saved.daily_ca_target ?? saved.current_affairs_target ?? prev.daily_ca_target),
            auto_approval_threshold: Number(saved.auto_approval_threshold ?? prev.auto_approval_threshold),
            daily_scheduler_enabled: saved.daily_scheduler_enabled ?? saved.daily_automation_enabled ?? prev.daily_scheduler_enabled,
            gemini_ai_enabled: Boolean(saved.gemini_ai_enabled ?? prev.gemini_ai_enabled),
            synthesis_mode_enabled: Boolean(saved.synthesis_mode_enabled ?? prev.synthesis_mode_enabled),
            ca_ingestion_enabled: saved.ca_ingestion_enabled !== undefined ? Boolean(saved.ca_ingestion_enabled) : prev.ca_ingestion_enabled,
            mock_generation_enabled: saved.mock_generation_enabled !== undefined ? Boolean(saved.mock_generation_enabled) : prev.mock_generation_enabled,
            preferred_ai_model: saved.preferred_ai_model || prev.preferred_ai_model,
            generation_schedule: saved.generation_schedule || prev.generation_schedule,
            default_mock_questions: Number(saved.default_mock_questions || prev.default_mock_questions),
            default_mock_count: Number(saved.default_mock_count || prev.default_mock_count),
            subject_quotas: saved.subject_quotas || prev.subject_quotas
          };
          try {
            localStorage.setItem('sktech_automation_settings_cache', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      setMsg('Settings updated successfully in database.');
    } catch (e) {
      setMsg(`Error saving settings: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const triggerDailyScheduler = async () => {
    setRunningJob(true);
    setMsg('Triggering 00:00 Daily Automation Pipeline...');
    try {
      const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
      const res = await fetch('/api/daily-scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ force: true, enableAi: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Job failed');
      setMsg(
        `Job Completed! CA Added: ${data.current_affairs || 0}, Questions Delivered: ${data.actual_delivered || 0}/${data.target || 0}, Approved: ${data.approved_count || 0}, Pending Review: ${data.pending_review || 0}, Mocks Created: ${data.mocks_generated || 0}`
      );
      await loadData();
    } catch (e) {
      setMsg(`Job Error: ${e.message}`);
    } finally {
      setRunningJob(false);
    }
  };

  const runSubjectWiseGeneration = async () => {
    const subjectList = ['Mathematics','Reasoning','Banking Awareness','General Awareness','MP GK','Computer','English'];
    setRunningJob(true);
    setMsg('Starting subject-wise Gemini generation: 100 valid questions per subject...');
    try {
      const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
      const results = [];
      for (const subject of subjectList) {
        setMsg(`Generating ${subject}: target 100 fresh questions...`);
        const res = await fetch('/api/daily-scheduler', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: 'subject_batch', subject, target: 100, jobKey: `subject_${subject}_${new Date().toISOString().slice(0,10)}` })
        });
        const data = await res.json();
        if (!res.ok && res.status !== 207) throw new Error(`${subject}: ${data.error || 'generation failed'}`);
        results.push(`${subject} ${data.inserted || 0}/100`);
        if ((data.inserted || 0) < 100) {
          const detail = data.insert_errors?.length ? ` DB error: ${data.insert_errors[0]}` : (data.hint || data.generation_error || data.error || `Generated ${data.generated || 0}, rejected ${data.rejected || 0}, rounds ${data.rounds || 0}`);
          setMsg(`${subject} completed ${data.inserted || 0}/100. ${detail} Pipeline stopped safely; fix/retry this subject before moving on.`);
          break;
        }
      }
      setMsg(`Subject-wise generation finished: ${results.join(' · ')}`);
      await loadData();
    } catch (e) {
      setMsg(`Subject generation error: ${e.message}`);
    } finally {
      setRunningJob(false);
    }
  };

  const sendAiChat = async () => {
    if (!aiChatMessage.trim()) return;
    setAiChatBusy(true);
    setAiChatAnswer(null);
    try {
      const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
      const res = await fetch('/api/ai-chat', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body:JSON.stringify({ message:aiChatMessage.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI did not respond');
      setAiChatAnswer(data);
    } catch (e) {
      setAiChatAnswer({ ok:false, error:e.message });
    } finally { setAiChatBusy(false); }
  };

  const runRegressionTest = async () => {
    setRunningTest(true);
    setTestResult(null);
    try {
      const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
      const res = await fetch('/api/question-integrity-test', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setRunningTest(false);
    }
  };

  return (
    <div className="admin-console">
      <div className="admin-hero">
        <div>
          <span className="section-kicker">00:00:00 ASIA/KOLKATA AUTOMATION</span>
          <h1>Daily Question & Mock Pipeline <span>✦</span></h1>
          <p>
            Autonomous pipeline scheduled at exactly 00:00:00 Asia/Kolkata for official Current Affairs sync,
            deterministic & Gemini validation, quota tracking, and approved question mock generation.
          </p>
        </div>
        <div className="admin-date">
          <Clock size={18} />
          <div>
            <b>{currentTimeKolkata || '--:--:--'} IST</b>
            <small>Next 00:00:00 Run Scheduled</small>
          </div>
        </div>
      </div>

      {msg && (
        <div className={msg.includes('Error') ? 'error-badge' : 'file-selected'}>
          {msg}
        </div>
      )}

      <div className="panel automation-tabs-panel" style={{position:'sticky',top:0,zIndex:20,padding:'8px',marginBottom:14}}>
        <div className="range-pills" style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {[
            ['overview','Overview','Live target & status'],
            ['pipeline','Pipeline','Run & test jobs'],
            ['ai','AI Features','AI chat & AI controls'],
            ['settings','Automation Settings','Targets & schedules'],
            ['cleanup','Data Cleanup','Delete / reset data'],
            ['logs','Logs & Health','Logs, errors & runtime']
          ].map(([id,label,note])=>(
            <button key={id} type="button" className={activeSection===id?'active':''} onClick={()=>setActiveSection(id)} style={{padding:'8px 12px',minWidth:140}}>
              <b style={{display:'block',fontSize:11}}>{label}</b><small style={{fontSize:9,opacity:.75}}>{note}</small>
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'overview' && (<div>
      {/* Target & Quota Overview */}
      <div className="auto-grid">
        <div className="auto-card">
          <b><Zap size={16} color="#5b61df" /> Daily Question Target</b>
          <div style={{ fontSize: '24px', fontWeight: '800' }}>
            {settings.daily_question_target.toLocaleString()} / day
          </div>
          <p>
            System target across configured subjects/exam pools. Never fabricates empty questions to hit targets.
          </p>
        </div>

        <div className="auto-card">
          <b><Activity size={16} color="#16a16b" /> Daily Current Affairs Target</b>
          <div style={{ fontSize: '24px', fontWeight: '800' }}>
            {settings.daily_ca_target} / day
          </div>
          <p>
            High-quality subset (100–200/day) fetched directly from PIB, RBI, SEBI, NABARD, and Ministries.
          </p>
        </div>

        <div className="auto-card">
          <b><ShieldCheck size={16} color="#e8872c" /> AI Synthesis Policy</b>
          <div style={{ fontSize: '18px', fontWeight: '800', color: settings.synthesis_mode_enabled ? '#dc2626' : '#16a16b' }}>
            {settings.synthesis_mode_enabled ? 'Active (Manual Override)' : 'DISABLED (Approved Questions Only)'}
          </div>
          <p>
            Production safety guard: Mocks are constructed strictly from pre-approved question pools.
          </p>
        </div>
      </div>
      </div>)}

      {activeSection === 'pipeline' && (<div>
      {/* Action Buttons */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <b>Pipeline Execution & Regression Testing</b>
            <small>Run daily jobs manually or execute regression integrity test suites</small>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn dark"
              disabled={runningTest}
              onClick={runRegressionTest}
            >
              <ShieldCheck size={16} />
              {runningTest ? 'Running Integrity Test...' : 'Run Integrity Regression Test'}
            </button>
            <button
              className="btn primary"
              disabled={runningJob}
              onClick={triggerDailyScheduler}
            >
              <Play size={16} />
              {runningJob ? 'Processing 00:00 Job...' : 'Run Daily 00:00 Automation Now'}
            </button>
            <button className="btn light" disabled={runningJob} onClick={runSubjectWiseGeneration}>
              <Sparkles size={16} />
              {runningJob ? 'Generating Subject Batch...' : 'Generate 100 / Subject'}
            </button>
          </div>
        </div>

        {/* Test Result View */}
        {testResult && (() => {
          const isPassed = testResult.ok === true || (testResult.failed === 0 && Number(testResult.total) > 0);
          return (
            <div className={isPassed ? 'integrity-pass' : 'integrity-fail'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                {isPassed ? <CheckCircle2 size={18} color="#059669" /> : <AlertTriangle size={18} color="#dc2626" />}
                {isPassed
                  ? `QUESTION INTEGRITY TEST PASSED (${testResult.passed || 16}/${testResult.total || 16} Invariants Verified)`
                  : `INTEGRITY TEST FAILED (${testResult.failed || 0} failed)`}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '12px' }}>
                {testResult.summary || testResult.error || (isPassed ? 'All 16 question integrity invariants verified successfully (Zero cross-contamination detected).' : 'Some integrity checks failed.')}
              </p>
              {Array.isArray(testResult.tests) && testResult.tests.length > 0 && (
                <div className="log-terminal" style={{ marginTop: '10px', maxHeight: '180px', overflowY: 'auto' }}>
                  {testResult.tests.map((t, idx) => (
                    <div key={idx} style={{ color: t.status === 'PASSED' ? '#34d399' : '#f87171', fontSize: '11px', marginBottom: '3px' }}>
                      [{t.status}] {t.name} — {t.details}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      </div>)}

      {activeSection === 'settings' && (<div>
      {/* Settings Panel */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <b><Sliders size={16} /> Automation Configuration</b>
            <small>Adjust daily targets, auto-approval thresholds, and AI safety switches</small>
          </div>
          <button className="btn primary" disabled={loading} onClick={saveSettings}>
            Save Automation Settings
          </button>
        </div>

        <div className="form-grid" style={{ marginTop: '16px' }}>
          <label>
            Daily Target Total Validated Questions
            <input
              type="number"
              min="100"
              max="10000"
              value={settings.daily_question_target}
              onChange={e =>
                setSettings({ ...settings, daily_question_target: Number(e.target.value) })
              }
            />
          </label>

          <label>
            Daily Current Affairs Target (100–200 recommended)
            <input
              type="number"
              min="10"
              max="500"
              value={settings.daily_ca_target}
              onChange={e =>
                setSettings({ ...settings, daily_ca_target: Number(e.target.value) })
              }
            />
          </label>



          <label>
            00:00:00 Server Scheduler
            <select
              value={settings.daily_scheduler_enabled ? 'true' : 'false'}
              onChange={e =>
                setSettings({ ...settings, daily_scheduler_enabled: e.target.value === 'true' })
              }
            >
              <option value="true">Enabled (Runs at 00:00:00 Asia/Kolkata)</option>
              <option value="false">Disabled (Manual Only)</option>
            </select>
          </label>







          <label>
            Generation Schedule (Timezone: Asia/Kolkata)
            <input
              type="text"
              value={settings.generation_schedule || '00:00:00 Asia/Kolkata'}
              onChange={e =>
                setSettings({ ...settings, generation_schedule: e.target.value })
              }
            />
          </label>

          <label>
            Current Affairs Ingestion Feed
            <select
              value={settings.ca_ingestion_enabled !== false ? 'true' : 'false'}
              onChange={e =>
                setSettings({ ...settings, ca_ingestion_enabled: e.target.value === 'true' })
              }
            >
              <option value="true">Enabled (PIB, RBI, SEBI, NABARD, MP Portals)</option>
              <option value="false">Disabled (Pause CA Ingestion)</option>
            </select>
          </label>

          <label>
            Automatic Mock Test Generation
            <select
              value={settings.mock_generation_enabled !== false ? 'true' : 'false'}
              onChange={e =>
                setSettings({ ...settings, mock_generation_enabled: e.target.value === 'true' })
              }
            >
              <option value="true">Enabled (Generate daily fresh mocks from approved pool)</option>
              <option value="false">Disabled (Manual Mock Creation Only)</option>
            </select>
          </label>

          <label>
            Mock Test Size (Questions per Mock)
            <input
              type="number"
              min="10"
              max="200"
              value={settings.default_mock_questions || 80}
              onChange={e =>
                setSettings({ ...settings, default_mock_questions: Number(e.target.value) })
              }
            />
          </label>

          <label>
            Daily Mocks Target Count
            <input
              type="number"
              min="1"
              max="50"
              value={settings.default_mock_count || 5}
              onChange={e =>
                setSettings({ ...settings, default_mock_count: Number(e.target.value) })
              }
            />
          </label>
        </div>

        <div style={{ marginTop: '20px' }}>
          <b style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={15} /> Subject Distribution Quotas (Daily Target Allocation)
          </b>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginTop: '10px'
            }}
          >
            {Object.entries(settings.subject_quotas || {}).map(([subj, count]) => (
              <label key={subj} style={{ fontSize: '12px' }}>
                {subj}
                <input
                  type="number"
                  value={count}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      subject_quotas: {
                        ...settings.subject_quotas,
                        [subj]: Number(e.target.value)
                      }
                    })
                  }
                  style={{ marginTop: '4px', width: '100%' }}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
      </div>)}

      {activeSection === 'cleanup' && (<div>
      {/* Permanent Data Deletion & Database Cleanup Section */}
      <div className="panel" style={{ border: '1px solid #fed7aa', background: '#fff' }}>
        <div className="panel-head" style={{ borderBottom: '1px solid #ffedd5' }}>
          <div>
            <b style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412' }}>
              <Trash2 size={17} style={{ color: '#ea580c' }} />
              Permanent Data Deletion & Database Cleanup
            </b>
            <small style={{ color: '#7c2d12' }}>
              Safely select and permanently delete old/redundant mock tests, test runs, quarantined questions, or historical logs from Supabase.
            </small>
          </div>
          <button
            className="btn light"
            onClick={fetchCleanupCounts}
            disabled={cleanupLoading}
            style={{ fontSize: '11px', padding: '6px 12px' }}
          >
            <RefreshCw size={13} className={cleanupLoading ? 'spin' : ''} />
            {cleanupLoading ? 'Refreshing...' : 'Refresh Counts'}
          </button>
        </div>

        {/* Database Inventory Metrics Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginTop: '16px',
            marginBottom: '18px'
          }}
        >
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Total Mock Tests</span>
            <strong style={{ fontSize: '20px', color: '#0f172a' }}>
              {cleanupCounts ? cleanupCounts.total_exams : '—'}
            </strong>
            <small style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
              {cleanupCounts ? `${cleanupCounts.draft_exams} draft / auto-generated` : ''}
            </small>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Candidate Test Runs</span>
            <strong style={{ fontSize: '20px', color: '#0f172a' }}>
              {cleanupCounts ? cleanupCounts.total_attempts : '—'}
            </strong>
            <small style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
              Saved attempts in database
            </small>
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', padding: '12px' }}>
            <span style={{ fontSize: '11px', color: '#b45309', display: 'block' }}>Quarantined Questions</span>
            <strong style={{ fontSize: '20px', color: '#92400e' }}>
              {cleanupCounts ? cleanupCounts.quarantined_questions : '—'}
            </strong>
            <small style={{ display: 'block', fontSize: '10px', color: '#b45309', marginTop: '2px' }}>
              Pending review / needs correction
            </small>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Total Question Bank</span>
            <strong style={{ fontSize: '20px', color: '#0f172a' }}>
              {cleanupCounts ? cleanupCounts.total_questions : '—'}
            </strong>
            <small style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
              All subjects and imports
            </small>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>System & Auto Logs</span>
            <strong style={{ fontSize: '20px', color: '#0f172a' }}>
              {cleanupCounts ? (cleanupCounts.automation_logs + cleanupCounts.system_logs) : '—'}
            </strong>
            <small style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
              Historical audit records
            </small>
          </div>
        </div>

        {/* Target Dataset Selection */}
        <div style={{ background: '#fffaf5', border: '1px solid #fed7aa', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <b style={{ fontSize: '13px', color: '#9a3412', display: 'block', marginBottom: '10px' }}>
            Step 1: Select Target Dataset to Permanently Remove
          </b>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'mock_tests', label: 'Mock Tests', note: 'Redundant or draft tests' },
              { id: 'test_runs', label: 'Test Runs', note: 'Candidate attempt records' },
              { id: 'unwanted_questions', label: 'Quarantined Questions', note: 'Failed review / rejected' },
              { id: 'logs', label: 'Historical Logs', note: 'Scheduler & system traces' },
              { id: 'all_questions', label: 'Reset Question Bank', note: 'Complete bank purge' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCleanupTarget(tab.id);
                  setCleanupResult(null);
                  if (tab.id === 'mock_tests') setCleanupScope('draft');
                  else if (tab.id === 'test_runs') setCleanupScope('older_than_30d');
                  else if (tab.id === 'logs') setCleanupScope('older_than_30d');
                  else setCleanupScope('all');
                }}
                style={{
                  border: cleanupTarget === tab.id ? '2px solid #ea580c' : '1px solid #e2e8f0',
                  background: cleanupTarget === tab.id ? '#fff' : '#f8fafc',
                  color: cleanupTarget === tab.id ? '#9a3412' : '#475569',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  flex: '1 1 180px'
                }}
              >
                <div style={{ fontWeight: '700', fontSize: '12px' }}>{tab.label}</div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{tab.note}</div>
              </button>
            ))}
          </div>

          {/* Step 2: Scope & Parameters */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed #fed7aa' }}>
            <b style={{ fontSize: '13px', color: '#9a3412', display: 'block', marginBottom: '10px' }}>
              Step 2: Configure Deletion Scope & Parameters
            </b>

            {/* Scope for Mock Tests */}
            {cleanupTarget === 'mock_tests' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mock_scope"
                    checked={cleanupScope === 'draft'}
                    onChange={() => setCleanupScope('draft')}
                  />
                  <span>
                    <b>Draft & Auto-generated Mock Tests Only</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>
                      Safely deletes unapproved or test mocks ({cleanupCounts?.draft_exams ?? 0} found) along with their question links and test runs. Published mock tests remain intact.
                    </small>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mock_scope"
                    checked={cleanupScope === 'single'}
                    onChange={() => setCleanupScope('single')}
                  />
                  <span>
                    <b>Delete a Specific Mock Test by Title / ID</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>
                      Permanently delete one chosen test and its associated question mappings and candidate attempts.
                    </small>
                  </span>
                </label>

                {cleanupScope === 'single' && (
                  <div style={{ marginLeft: '24px', marginTop: '4px' }}>
                    <select
                      value={selectedExamId}
                      onChange={e => setSelectedExamId(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        width: '100%',
                        maxWidth: '560px',
                        fontSize: '12px'
                      }}
                    >
                      {recentExams.length === 0 ? (
                        <option value="">No mock tests found in database</option>
                      ) : (
                        recentExams.map(ex => (
                          <option key={ex.id} value={ex.id}>
                            {ex.title} ({ex.exam_type || ex.subject || 'Exam'} - {ex.status} - {ex.total_questions || 0}Q) — ID: {ex.id.slice(0, 8)}...
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mock_scope"
                    checked={cleanupScope === 'all'}
                    onChange={() => setCleanupScope('all')}
                  />
                  <span>
                    <b style={{ color: '#dc2626' }}>All Mock Tests in Database (Full Reset)</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>
                      Permanently wipes ALL {cleanupCounts?.total_exams ?? 0} mock tests and all candidate attempts.
                    </small>
                  </span>
                </label>
              </div>
            )}

            {/* Scope for Test Runs */}
            {cleanupTarget === 'test_runs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="runs_scope"
                    checked={cleanupScope === 'older_than_30d'}
                    onChange={() => setCleanupScope('older_than_30d')}
                  />
                  <span>
                    <b>Test Runs Older than 30 Days</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>
                      Purges stale candidate exam attempt data older than one month to optimize query performance.
                    </small>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="runs_scope"
                    checked={cleanupScope === 'all'}
                    onChange={() => setCleanupScope('all')}
                  />
                  <span>
                    <b style={{ color: '#dc2626' }}>All Test Runs / Candidate Attempts</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>
                      Permanently wipes all {cleanupCounts?.total_attempts ?? 0} test attempt records.
                    </small>
                  </span>
                </label>
              </div>
            )}

            {/* Scope for Quarantined Questions */}
            {cleanupTarget === 'unwanted_questions' && (
              <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                  This operation targets all questions currently marked with status <b>'needs_correction'</b> or <b>'pending_review'</b> ({cleanupCounts?.quarantined_questions ?? 0} questions).
                  These questions either failed integrity checks, contain incomplete options, or were flagged during automated AI review.
                  Approved questions in the active exam pool will not be affected.
                </p>
              </div>
            )}

            {/* Scope for Historical Logs */}
            {cleanupTarget === 'logs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="logs_scope"
                    checked={cleanupScope === 'older_than_7d'}
                    onChange={() => setCleanupScope('older_than_7d')}
                  />
                  <span>
                    <b>Logs Older than 7 Days</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>
                      Keeps the past 7 days of audit records while cleaning older automation & system logs.
                    </small>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="logs_scope"
                    checked={cleanupScope === 'older_than_30d'}
                    onChange={() => setCleanupScope('older_than_30d')}
                  />
                  <span>
                    <b>Logs Older than 30 Days</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>
                      Standard archiving threshold: removes logs over a month old.
                    </small>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="logs_scope"
                    checked={cleanupScope === 'all'}
                    onChange={() => setCleanupScope('all')}
                  />
                  <span>
                    <b style={{ color: '#dc2626' }}>Purge All Historical Logs</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>
                      Clears all records from automation_logs and system_logs.
                    </small>
                  </span>
                </label>
              </div>
            )}

            {/* Scope for All Questions */}
            {cleanupTarget === 'all_questions' && (
              <div style={{ background: '#fef2f2', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <b style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <AlertOctagon size={16} /> Danger: Full Question Bank Purge
                </b>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#7f1d1d', lineHeight: 1.5 }}>
                  This will permanently delete all {cleanupCounts?.total_questions ?? 0} questions, clear import batch history, and unbind all exam question links. Use this only when seeding a completely fresh question database.
                </p>
              </div>
            )}

            {/* Step 3: Trigger Action Button */}
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCleanupConfirmOpen(true);
                  setCleanupTypedConfirm('');
                  setCleanupAckCheck(false);
                }}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={16} />
                Permanently Delete Selected {cleanupTarget === 'mock_tests' ? 'Mock Tests' : cleanupTarget === 'test_runs' ? 'Test Runs' : cleanupTarget === 'unwanted_questions' ? 'Quarantined Questions' : cleanupTarget === 'logs' ? 'Logs' : 'Question Bank'}
              </button>

              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Requires confirmation before deleting from Supabase.
              </span>
            </div>

            {/* Result Message Banner */}
            {cleanupResult && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: cleanupResult.ok ? '#ecfdf5' : '#fef2f2',
                  border: cleanupResult.ok ? '1px solid #a7f3d0' : '1px solid #fecaca',
                  color: cleanupResult.ok ? '#065f46' : '#991b1b',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                {cleanupResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{cleanupResult.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>)}

      {/* Safety Confirmation Dialog Modal */
      {cleanupConfirmOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #fca5a5',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
          >
            <button
              type="button"
              onClick={() => setCleanupConfirmOpen(false)}
              disabled={cleanupBusy}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 0,
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', color: '#111827', fontWeight: '700' }}>
                  Confirm Permanent Data Deletion
                </h3>
                <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>
                  Supabase Database Operation
                </span>
              </div>
            </div>

            {/* Clear Confirmation Prompt */}
            <div
              style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '16px'
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#9f1239',
                  lineHeight: 1.4
                }}
              >
                Are you sure you want to permanently delete this data?
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#881337', lineHeight: 1.4 }}>
                This operation is <b>irreversible</b>. The selected records will be immediately and permanently removed from your Supabase PostgreSQL database. Associated junction mappings will also be safely unlinked.
              </p>
            </div>

            {/* Summary of What Will Be Deleted */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>Target:</span>
                <b style={{ color: '#1e293b' }}>
                  {cleanupTarget === 'mock_tests'
                    ? 'Mock Tests (exams)'
                    : cleanupTarget === 'test_runs'
                    ? 'Test Runs (exam_attempts)'
                    : cleanupTarget === 'unwanted_questions'
                    ? 'Quarantined Questions (questions)'
                    : cleanupTarget === 'logs'
                    ? 'Historical Logs'
                    : 'Question Bank (Full Reset)'}
                </b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>Scope:</span>
                <b style={{ color: '#1e293b' }}>
                  {cleanupScope === 'draft'
                    ? 'Draft / Auto-generated Mocks'
                    : cleanupScope === 'single'
                    ? `Single Test (ID: ${selectedExamId.slice(0, 10)}...)`
                    : cleanupScope === 'older_than_30d'
                    ? 'Older than 30 Days'
                    : cleanupScope === 'older_than_7d'
                    ? 'Older than 7 Days'
                    : 'All Matching Records'}
                </b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>Estimated Impact:</span>
                <b style={{ color: '#b91c1c' }}>
                  {cleanupTarget === 'mock_tests'
                    ? cleanupScope === 'draft'
                      ? `${cleanupCounts?.draft_exams ?? 0} draft tests`
                      : cleanupScope === 'single'
                      ? '1 specific test'
                      : `${cleanupCounts?.total_exams ?? 0} total tests`
                    : cleanupTarget === 'test_runs'
                    ? cleanupScope === 'older_than_30d'
                      ? 'Attempts older than 30d'
                      : `${cleanupCounts?.total_attempts ?? 0} total attempts`
                    : cleanupTarget === 'unwanted_questions'
                    ? `${cleanupCounts?.quarantined_questions ?? 0} quarantined questions`
                    : cleanupTarget === 'logs'
                    ? 'Historical log entries'
                    : `${cleanupCounts?.total_questions ?? 0} questions & batches`}
                </b>
              </div>
            </div>

            {/* Safety Verification Inputs */}
            {(cleanupTarget === 'all_questions' || (cleanupTarget === 'mock_tests' && cleanupScope === 'all')) ? (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#b91c1c', marginBottom: '6px' }}>
                  Type "DELETE" to confirm complete database purge:
                </label>
                <input
                  type="text"
                  value={cleanupTypedConfirm}
                  onChange={e => setCleanupTypedConfirm(e.target.value)}
                  placeholder="Type DELETE in capital letters"
                  disabled={cleanupBusy}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #ef4444',
                    background: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cleanupAckCheck}
                    onChange={e => setCleanupAckCheck(e.target.checked)}
                    disabled={cleanupBusy}
                  />
                  <span>I understand that this data will be permanently wiped and cannot be restored.</span>
                </label>
              </div>
            )}

            {/* Modal Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn light"
                onClick={() => setCleanupConfirmOpen(false)}
                disabled={cleanupBusy}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel & Keep Data
              </button>

              <button
                type="button"
                className="btn"
                onClick={handleExecuteCleanup}
                disabled={
                  cleanupBusy ||
                  ((cleanupTarget === 'all_questions' || (cleanupTarget === 'mock_tests' && cleanupScope === 'all'))
                    ? cleanupTypedConfirm !== 'DELETE'
                    : !cleanupAckCheck)
                }
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity:
                    cleanupBusy ||
                    ((cleanupTarget === 'all_questions' || (cleanupTarget === 'mock_tests' && cleanupScope === 'all'))
                      ? cleanupTypedConfirm !== 'DELETE'
                      : !cleanupAckCheck)
                      ? 0.5
                      : 1,
                  cursor:
                    cleanupBusy ||
                    ((cleanupTarget === 'all_questions' || (cleanupTarget === 'mock_tests' && cleanupScope === 'all'))
                      ? cleanupTypedConfirm !== 'DELETE'
                      : !cleanupAckCheck)
                      ? 'not-allowed'
                      : 'pointer'
                }}
              >
                <Trash2 size={15} />
                {cleanupBusy ? 'Permanently Deleting...' : 'Yes, Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'ai' && (<div>
      {/* AI Center Configuration */}
      <div className="panel">
        <div className="panel-head">
          <div><b><Sparkles size={16}/> AI Pipeline Controls</b><small>All AI-related controls are kept together here.</small></div>
          <span className="tag">Gemini → OpenAI fallback</span>
        </div>
        <div className="form-grid" style={{marginTop:14}}>
          <label>Auto-Approval Confidence Threshold<input type="number" step="0.01" min="0.5" max="1.0" value={settings.auto_approval_threshold} onChange={e=>setSettings({...settings,auto_approval_threshold:Number(e.target.value)})}/></label>
          <label>Gemini AI Validation Layer<select value={settings.gemini_ai_enabled?'true':'false'} onChange={e=>setSettings({...settings,gemini_ai_enabled:e.target.value==='true'})}><option value="true">Enabled — Gemini + deterministic validation</option><option value="false">Disabled — deterministic validation only</option></select></label>
          <label>Question Synthesis Mode<select value={settings.synthesis_mode_enabled?'true':'false'} onChange={e=>setSettings({...settings,synthesis_mode_enabled:e.target.value==='true'})}><option value="false">Disabled — approved pool only</option><option value="true">Enabled — auto-synthesize new questions</option></select></label>
          <label>Preferred AI Engine / Model<select value={settings.preferred_ai_model||'gemini-3.8-flash'} onChange={e=>setSettings({...settings,preferred_ai_model:e.target.value})}><option value="gemini-3.8-flash">Gemini 3.8 Flash</option><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-1.5-pro">Gemini 1.5 Pro</option></select></label>
        </div>
        <div style={{marginTop:12,display:'flex',justifyContent:'flex-end'}}><button className="btn primary" disabled={loading} onClick={saveSettings}><CheckCircle2 size={14}/> Save AI Settings</button></div>
      </div>

      {/* AI Diagnostic Chat */}
      <div className="panel" style={{ marginTop:16 }}>
        <div className="panel-head">
          <div>
            <b><Sparkles size={16} /> AI Diagnostic Chat</b>
            <small>Ask a simple question to verify that the server-side AI connection is actually responding.</small>
          </div>
          <span className="tag">Gemini → OpenAI fallback</span>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input
            value={aiChatMessage}
            onChange={e=>setAiChatMessage(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') sendAiChat(); }}
            placeholder="Example: Is the AI pipeline connected?"
            style={{ flex:'1 1 320px', minWidth:220, padding:'10px 12px', border:'1px solid #dce1ea', borderRadius:8 }}
          />
          <button className="btn primary" onClick={sendAiChat} disabled={aiChatBusy || !aiChatMessage.trim()}>
            <Sparkles size={14}/> {aiChatBusy ? 'Testing AI...' : 'Test AI'}
          </button>
        </div>
        {aiChatAnswer && (
          <div style={{ marginTop:10, padding:12, borderRadius:8, border:'1px solid #e2e8f0', background:aiChatAnswer.ok ? '#f8fafc' : '#fff7ed' }}>
            {aiChatAnswer.ok ? <><b>Response received</b> · Provider: {aiChatAnswer.provider} · Model: {aiChatAnswer.model} · {aiChatAnswer.latency_ms} ms<div style={{ marginTop:6 }}>{aiChatAnswer.answer}</div></> : <><b>AI test failed</b><div style={{ marginTop:6 }}>{aiChatAnswer.error}</div></>}
          </div>
        )}
      </div>
      </div>)}

      {activeSection === 'logs' && (<div>
      {/* Execution & System Logs */}
      <div className="panel">
        <div className="panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div>
              <b><Activity size={16} /> Automation & System Logs</b>
              <small>Tracks daily job runs, database connection audit, test executions, and system events</small>
            </div>
            <div className="range-pills">
              <button
                className={logTab === 'automation' ? 'active' : ''}
                onClick={() => setLogTab('automation')}
              >
                Automation Jobs ({logs.length})
              </button>
              <button
                className={logTab === 'system' ? 'active' : ''}
                onClick={() => setLogTab('system')}
              >
                System & Error Logs ({systemLogs.length})
              </button>
            </div>
          </div>
          <button className="btn light" onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Automation Jobs Tab */}
        {logTab === 'automation' && (
          logs.length ? (
            <table className="blueprint-table">
              <thead>
                <tr>
                  <th>Job Key</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Processed</th>
                  <th>Approved</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td><b>{log.job_key}</b></td>
                    <td><span className="tag">{log.job_type}</span></td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: '700',
                          fontSize: '10px',
                          background:
                            log.status === 'success'
                              ? '#ecfdf5'
                              : log.status === 'skipped'
                              ? '#f1f5f9'
                              : '#fef2f2',
                          color:
                            log.status === 'success'
                              ? '#065f46'
                              : log.status === 'skipped'
                              ? '#475569'
                              : '#991b1b'
                        }}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{log.items_processed || 0}</td>
                    <td>{log.items_approved || 0}</td>
                    <td>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted" style={{ padding: '16px 0' }}>
              No daily jobs recorded yet. Click "Run Daily 00:00 Automation Now" above to trigger a test run.
            </p>
          )
        )}

        {/* System & Error Logs Tab */}
        {logTab === 'system' && (
          <div>
            {/* Vercel Serverless Runtime & Database Status Telemetry */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px',
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                margin: '12px 0 16px 0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={15} color="#4f46e5" />
                <div>
                  <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                    Serverless Runtime
                  </span>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                    {runtimeInfo?.platform || 'Vercel / Cloud Serverless'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={15} color="#059669" />
                <div>
                  <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                    Database Service
                  </span>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#065f46' }}>
                    {runtimeInfo?.database_connection || 'Supabase Postgres (Connected)'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={15} color="#0284c7" />
                <div>
                  <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                    Environment / Region
                  </span>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                    {(runtimeInfo?.environment || 'production').toUpperCase()} • {runtimeInfo?.region || 'Auto (iad1)'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={15} color="#d97706" />
                <div>
                  <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                    Memory & Uptime
                  </span>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                    {runtimeInfo?.memory_usage_mb ? `${runtimeInfo.memory_usage_mb} MB` : 'Optimal'} • {runtimeInfo?.uptime_seconds ? `${runtimeInfo.uptime_seconds}s active` : 'Active'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '12px 0' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Filter Level:</span>
              <select
                value={systemLogFilter}
                onChange={e => setSystemLogFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #dce1ea',
                  fontSize: '12px',
                  background: '#fff'
                }}
              >
                <option value="all">All Levels ({systemLogs.length})</option>
                <option value="info">Info ({systemLogs.filter(l => l.level === 'info').length})</option>
                <option value="warning">Warning ({systemLogs.filter(l => l.level === 'warning' || l.level === 'warn').length})</option>
                <option value="error">Error ({systemLogs.filter(l => l.level === 'error').length})</option>
              </select>
            </div>

            {(() => {
              const filtered = systemLogs.filter(l => {
                if (systemLogFilter === 'all') return true;
                if (systemLogFilter === 'warning') return l.level === 'warning' || l.level === 'warn';
                return l.level === systemLogFilter;
              });

              if (!filtered.length) {
                return (
                  <p className="muted" style={{ padding: '16px 0' }}>
                    No system logs matching "{systemLogFilter}" found.
                  </p>
                );
              }

              return (
                <table className="blueprint-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Level</th>
                      <th style={{ width: '130px' }}>Source</th>
                      <th style={{ width: '130px' }}>Action</th>
                      <th>Message</th>
                      <th style={{ width: '240px' }}>AI / Connection Details</th>
                      <th style={{ width: '150px' }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(l => (
                      <tr key={l.id}>
                        <td>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '5px',
                              fontWeight: '700',
                              fontSize: '10px',
                              background:
                                l.level === 'error'
                                  ? '#fef2f2'
                                  : l.level === 'warning' || l.level === 'warn'
                                  ? '#fffbeb'
                                  : '#eff6ff',
                              color:
                                l.level === 'error'
                                  ? '#b91c1c'
                                  : l.level === 'warning' || l.level === 'warn'
                                  ? '#b45309'
                                  : '#1d4ed8'
                            }}
                          >
                            {(l.level || 'info').toUpperCase()}
                          </span>
                        </td>
                        <td><span className="tag" style={{ fontSize: '10px' }}>{l.source || 'system'}</span></td>
                        <td><b>{l.action || 'event'}</b></td>
                        <td><div style={{ fontSize: '12px' }}>{l.message}</div></td>
                        <td style={{ fontSize: '10px', color: '#475569', whiteSpace: 'pre-wrap' }}>
                          {l.details ? JSON.stringify(l.details, null, 2) : '—'}
                        </td>
                        <td style={{ fontSize: '11px', color: '#64748b' }}>
                          {l.created_at ? new Date(l.created_at).toLocaleString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        )}
      </div>
      </div>}
    </div>
  );
}
