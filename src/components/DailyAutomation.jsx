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
  Layers
} from 'lucide-react';

export default function DailyAutomation({ supabase, session }) {
  const [settings, setSettings] = useState({
    daily_question_target: 1000,
    daily_ca_target: 150,
    auto_approval_threshold: 0.93,
    gemini_ai_enabled: false,
    daily_scheduler_enabled: true,
    synthesis_mode_enabled: false,
    subject_quotas: {
      Reasoning: 250,
      Mathematics: 250,
      'General Awareness': 200,
      'Banking Awareness': 150,
      Computer: 80,
      English: 70
    }
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runningJob, setRunningJob] = useState(false);
  const [runningTest, setRunningTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [msg, setMsg] = useState('');
  const [currentTimeKolkata, setCurrentTimeKolkata] = useState('');

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
    try {
      // Fetch settings
      const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
      const res = await fetch('/api/automation-settings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        if (json.settings) setSettings(json.settings);
      }

      // Fetch logs from Supabase
      if (supabase) {
        const { data } = await supabase
          .from('automation_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (data) setLogs(data);
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
      const res = await fetch('/api/automation-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase?.auth?.getSession())?.data?.session?.access_token || ''}` },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
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
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Job failed');
      setMsg(
        `Job Completed! CA Added: ${data.current_affairs_added || 0}, Questions Validated: ${
          data.questions_validated || 0
        }, Approved: ${data.questions_approved || 0}, Mocks Created: ${data.mocks_generated || 0}`
      );
      await loadData();
    } catch (e) {
      setMsg(`Job Error: ${e.message}`);
    } finally {
      setRunningJob(false);
    }
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
          </div>
        </div>

        {/* Test Result View */}
        {testResult && (
          <div className={testResult.ok ? 'integrity-pass' : 'integrity-fail'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
              {testResult.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              {testResult.ok
                ? 'QUESTION INTEGRITY TEST PASSED (Zero Cross-Contamination Detected)'
                : 'INTEGRITY TEST FAILED'}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '12px' }}>
              {testResult.summary || testResult.error}
            </p>
            {testResult.details && (
              <div className="log-terminal">
                {JSON.stringify(testResult.details, null, 2)}
              </div>
            )}
          </div>
        )}
      </div>

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
            Auto-Approval Confidence Threshold (e.g. 0.93)
            <input
              type="number"
              step="0.01"
              min="0.5"
              max="1.0"
              value={settings.auto_approval_threshold}
              onChange={e =>
                setSettings({ ...settings, auto_approval_threshold: Number(e.target.value) })
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
            Gemini AI Validation Layer
            <select
              value={settings.gemini_ai_enabled ? 'true' : 'false'}
              onChange={e =>
                setSettings({ ...settings, gemini_ai_enabled: e.target.value === 'true' })
              }
            >
              <option value="false">Disabled (Deterministic validation only - Recommended initially)</option>
              <option value="true">Enabled (Gemini 3.8 Flash + Deterministic)</option>
            </select>
          </label>

          <label>
            Question Synthesis Mode
            <select
              value={settings.synthesis_mode_enabled ? 'true' : 'false'}
              onChange={e =>
                setSettings({ ...settings, synthesis_mode_enabled: e.target.value === 'true' })
              }
            >
              <option value="false">Disabled (Strict: Use Existing Approved Questions)</option>
              <option value="true">Enabled (Auto-synthesize new questions)</option>
            </select>
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

      {/* Execution Logs */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <b><Activity size={16} /> Automation Execution History (Idempotency Logs)</b>
            <small>Tracks daily job runs, verified question counts, and prevent duplicate runs</small>
          </div>
          <button className="btn light" onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {logs.length ? (
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
        )}
      </div>
    </div>
  );
}
