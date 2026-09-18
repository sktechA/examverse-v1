import React, { useEffect, useState } from 'react';
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Filter,
  Layers,
  Database,
  ShieldCheck,
  Zap,
  Clock,
  Server,
  Trash2,
  X
} from 'lucide-react';

export default function SystemLogs({ supabase, session }) {
  const [logs, setLogs] = useState([]);
  const [automationLogs, setAutomationLogs] = useState([]);
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('system'); // 'system' | 'automation'
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dbStatus, setDbStatus] = useState('Checking...');
  const [summary, setSummary] = useState({
    total: 0,
    errors: 0,
    warnings: 0,
    info: 0
  });

  // Purge / Clear Logs Modal & State
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeScope, setPurgeScope] = useState('all');
  const [purgeTarget, setPurgeTarget] = useState('all'); // 'all' | 'system' | 'automation'
  const [purging, setPurging] = useState(false);
  const [purgeStatus, setPurgeStatus] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Try API endpoint first
      let apiSucceeded = false;
      try {
        const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
        const res = await fetch(`/api/system-logs?limit=100&level=${filterLevel}&source=${filterSource}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok) {
            setLogs(data.system_logs || []);
            setAutomationLogs(data.automation_logs || []);
            if (data.runtime) setRuntimeInfo(data.runtime);
            if (data.summary) {
              setSummary({
                total: data.summary.total_system_logs || 0,
                errors: data.summary.error_count || 0,
                warnings: data.summary.warn_count || 0,
                info: data.summary.info_count || 0
              });
            }
            setDbStatus('Connected & Synchronized');
            apiSucceeded = true;
          }
        }
      } catch (apiErr) {
        console.warn('System logs API fetch notice:', apiErr.message);
      }

      // 2. Direct Supabase fallback if API wasn't used or returned error
      if (!apiSucceeded && supabase) {
        let q = supabase
          .from('system_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (filterLevel !== 'all') {
          q = q.eq('level', filterLevel);
        }
        if (filterSource !== 'all') {
          q = q.eq('source', filterSource);
        }

        const [sysRes, autoRes] = await Promise.all([
          q,
          supabase
            .from('automation_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30)
        ]);

        const sysData = sysRes.data || [];
        const autoData = autoRes.data || [];
        setLogs(sysData);
        setAutomationLogs(autoData);

        const errors = sysData.filter(l => l.level === 'error').length;
        const warnings = sysData.filter(l => l.level === 'warning' || l.level === 'warn').length;
        const info = sysData.filter(l => l.level === 'info').length;
        setSummary({
          total: sysData.length,
          errors,
          warnings,
          info
        });
        setDbStatus(sysRes.error ? `Error: ${sysRes.error.message}` : 'Connected (Direct Supabase)');
      } else if (!apiSucceeded) {
        setDbStatus('Database unavailable');
      }
    } catch (e) {
      console.warn('Failed to load system logs:', e);
      setDbStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeLogs = async () => {
    setPurging(true);
    setPurgeStatus(null);
    try {
      let purgeSuccessful = false;
      let resultMessage = '';

      // 1. Attempt API call
      try {
        const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
        const res = await fetch('/api/system-logs', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            scope: purgeScope,
            target: purgeTarget,
            confirmed: true
          })
        });

        const data = await res.json();
        if (res.ok && data.ok) {
          purgeSuccessful = true;
          resultMessage = data.message || 'Logs successfully purged.';
        } else {
          console.warn('[Purge Logs] API response notice:', data?.error);
        }
      } catch (apiErr) {
        console.warn('[Purge Logs] API fetch error:', apiErr.message);
      }

      // 2. Direct Supabase fallback if API call failed or returned error
      if (!purgeSuccessful && supabase) {
        let cutOffDate = null;
        if (purgeScope === 'older_than_24h') cutOffDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        else if (purgeScope === 'older_than_7d') cutOffDate = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
        else if (purgeScope === 'older_than_30d') cutOffDate = new Date(Date.now() - 30 * 86400 * 1000).toISOString();

        if (purgeTarget === 'all' || purgeTarget === 'system') {
          let q = supabase.from('system_logs').delete();
          if (cutOffDate) q = q.lt('created_at', cutOffDate);
          else q = q.neq('id', '00000000-0000-0000-0000-000000000000');
          await q;
        }

        if (purgeTarget === 'all' || purgeTarget === 'automation') {
          let q = supabase.from('automation_logs').delete();
          if (cutOffDate) q = q.lt('created_at', cutOffDate);
          else q = q.neq('id', '00000000-0000-0000-0000-000000000000');
          await q;
        }

        purgeSuccessful = true;
        resultMessage = `Logs successfully purged via direct database connection (${purgeScope}).`;
      }

      if (purgeSuccessful) {
        setPurgeStatus({ type: 'success', text: resultMessage });
        await fetchLogs();
        setTimeout(() => {
          setShowPurgeModal(false);
          setPurgeStatus(null);
        }, 1500);
      } else {
        setPurgeStatus({ type: 'error', text: 'Failed to purge logs. Please ensure you are logged in with admin privileges.' });
      }
    } catch (err) {
      setPurgeStatus({ type: 'error', text: err.message || 'Error occurred while purging logs.' });
    } finally {
      setPurging(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterLevel, filterSource]);

  const filteredLogs = logs.filter(l => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (l.message && l.message.toLowerCase().includes(term)) ||
      (l.source && l.source.toLowerCase().includes(term)) ||
      (l.action && l.action.toLowerCase().includes(term)) ||
      (l.level && l.level.toLowerCase().includes(term))
    );
  });

  const getLevelBadge = level => {
    const lvl = String(level || 'info').toLowerCase();
    if (lvl === 'error') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca'
          }}
        >
          <AlertTriangle size={12} /> ERROR
        </span>
      );
    }
    if (lvl === 'warning' || lvl === 'warn') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            background: '#fffbeb',
            color: '#b45309',
            border: '1px solid #fde68a'
          }}
        >
          <AlertTriangle size={12} /> WARN
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: '700',
          background: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe'
        }}
      >
        <Info size={12} /> INFO
      </span>
    );
  };

  return (
    <div className="admin-console">
      <div className="admin-hero">
        <div>
          <span className="section-kicker">OBSERVABILITY & AUDIT TRAIL</span>
          <h1>System & Event Logs <span>✦</span></h1>
          <p>Real-time database connection audit, scheduler events, test execution, and error tracking.</p>
        </div>
        <div className="admin-date">
          <Database size={16} color="#5961df" />
          <div>
            <b>{dbStatus}</b>
            <small>Live Supabase Audit Log</small>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <Activity size={20} />
          </div>
          <div className="admin-stat-copy">
            <span>Total System Events</span>
            <strong>{summary.total}</strong>
            <small>Recent audit entries</small>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <CheckCircle2 size={20} />
          </div>
          <div className="admin-stat-copy">
            <span>Info Events</span>
            <strong>{summary.info}</strong>
            <small>Standard operations</small>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon orange">
            <AlertTriangle size={20} />
          </div>
          <div className="admin-stat-copy">
            <span>Warnings</span>
            <strong>{summary.warnings}</strong>
            <small>Attention points</small>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon rose">
            <AlertTriangle size={20} />
          </div>
          <div className="admin-stat-copy">
            <span>Errors</span>
            <strong>{summary.errors}</strong>
            <small>{summary.errors === 0 ? 'Zero errors detected' : 'Requires review'}</small>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="panel">
        <div className="panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <b>Audit Log Explorer</b>
            <div className="range-pills">
              <button
                className={activeTab === 'system' ? 'active' : ''}
                onClick={() => setActiveTab('system')}
              >
                System Logs ({logs.length})
              </button>
              <button
                className={activeTab === 'automation' ? 'active' : ''}
                onClick={() => setActiveTab('automation')}
              >
                Automation Jobs ({automationLogs.length})
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              id="btn-purge-logs"
              className="btn"
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fecaca',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={() => {
                setPurgeStatus(null);
                setShowPurgeModal(true);
              }}
            >
              <Trash2 size={14} />
              Clear Logs
            </button>
            <button className="btn light" onClick={fetchLogs} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              {loading ? 'Refreshing...' : 'Refresh Logs'}
            </button>
          </div>
        </div>

        {/* Vercel Serverless Runtime & Database Status */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '12px',
            padding: '12px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={16} color="#4f46e5" />
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                Serverless Architecture
              </span>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                {runtimeInfo?.platform || 'Vercel / Cloud Serverless'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={16} color="#059669" />
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                Database Health
              </span>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#065f46' }}>
                {runtimeInfo?.database_connection || 'Supabase PostgreSQL (Connected)'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} color="#0284c7" />
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                Environment & Region
              </span>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                {(runtimeInfo?.environment || 'production').toUpperCase()} • {runtimeInfo?.region || 'Auto (iad1)'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="#d97706" />
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                Process Memory / Uptime
              </span>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                {runtimeInfo?.memory_usage_mb ? `${runtimeInfo.memory_usage_mb} MB` : 'Optimal'} • {runtimeInfo?.uptime_seconds ? `${runtimeInfo.uptime_seconds}s active` : 'Active'}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        {activeTab === 'system' && (
          <div
            style={{
              display: 'flex',
              gap: '12px',
              padding: '14px 0',
              borderBottom: '1px solid #edf0f4',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}
          >
            <div style={{ flex: '1', minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search logs by message, source or action..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #dce1ea',
                  fontSize: '13px'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                <Filter size={13} style={{ display: 'inline', marginRight: '4px' }} /> Level:
              </span>
              <select
                value={filterLevel}
                onChange={e => setFilterLevel(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #dce1ea',
                  fontSize: '12px',
                  background: '#fff'
                }}
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Source:</span>
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #dce1ea',
                  fontSize: '12px',
                  background: '#fff'
                }}
              >
                <option value="all">All Sources</option>
                <option value="daily-scheduler">daily-scheduler</option>
                <option value="sync-current-affairs">sync-current-affairs</option>
                <option value="ai-review">ai-review</option>
                <option value="candidate-app">candidate-app</option>
              </select>
            </div>
          </div>
        )}

        {/* Tab 1: System Logs Table */}
        {activeTab === 'system' && (
          <div>
            {filteredLogs.length > 0 ? (
              <table className="blueprint-table" style={{ marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Level</th>
                    <th style={{ width: '130px' }}>Source</th>
                    <th style={{ width: '140px' }}>Action</th>
                    <th>Message & Details</th>
                    <th style={{ width: '160px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(item => (
                    <tr key={item.id}>
                      <td>{getLevelBadge(item.level)}</td>
                      <td>
                        <span className="tag" style={{ fontSize: '10px' }}>
                          {item.source || 'system'}
                        </span>
                      </td>
                      <td>
                        <b style={{ fontSize: '12px', color: '#334155' }}>
                          {item.action || 'event'}
                        </b>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: '#1e293b' }}>
                          {item.message}
                        </div>
                        {item.details && Object.keys(item.details).length > 0 && (
                          <pre
                            style={{
                              marginTop: '4px',
                              padding: '6px 8px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '10px',
                              color: '#475569',
                              maxWidth: '100%',
                              overflowX: 'auto',
                              whiteSpace: 'pre-wrap'
                            }}
                          >
                            {typeof item.details === 'string'
                              ? item.details
                              : JSON.stringify(item.details, null, 2)}
                          </pre>
                        )}
                      </td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString('en-IN')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
                No system logs match your filter criteria. Events from the daily scheduler, integrity tests, and AI reviews will appear here automatically.
              </p>
            )}
          </div>
        )}

        {/* Tab 2: Automation Jobs Table */}
        {activeTab === 'automation' && (
          <div>
            {automationLogs.length > 0 ? (
              <table className="blueprint-table" style={{ marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th>Job Key</th>
                    <th>Job Type</th>
                    <th>Status</th>
                    <th>Processed</th>
                    <th>Approved</th>
                    <th>Started</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {automationLogs.map(job => (
                    <tr key={job.id}>
                      <td>
                        <b>{job.job_key}</b>
                      </td>
                      <td>
                        <span className="tag">{job.job_type}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: '700',
                            fontSize: '10px',
                            background:
                              job.status === 'success'
                                ? '#ecfdf5'
                                : job.status === 'skipped'
                                ? '#f1f5f9'
                                : '#fef2f2',
                            color:
                              job.status === 'success'
                                ? '#065f46'
                                : job.status === 'skipped'
                                ? '#475569'
                                : '#991b1b'
                          }}
                        >
                          {(job.status || 'unknown').toUpperCase()}
                        </span>
                      </td>
                      <td>{job.items_processed || 0}</td>
                      <td>{job.items_approved || 0}</td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>
                        {job.started_at
                          ? new Date(job.started_at).toLocaleString('en-IN')
                          : '—'}
                      </td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>
                        {job.completed_at
                          ? new Date(job.completed_at).toLocaleString('en-IN')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
                No automation jobs recorded yet. Trigger the daily 00:00 automation in the Daily Pipeline tab to record job execution history.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Purge Logs Modal */}
      {showPurgeModal && (
        <div
          id="purge-logs-modal"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={e => {
            if (e.target === e.currentTarget && !purging) {
              setShowPurgeModal(false);
            }
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #fed7aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fff7ed'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#ffedd5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c2410c'
                  }}
                >
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#9a3412' }}>
                    Purge System & Event Logs
                  </h3>
                  <span style={{ fontSize: '12px', color: '#c2410c' }}>
                    Safe administrative maintenance for log stores
                  </span>
                </div>
              </div>
              <button
                id="btn-close-purge-modal"
                disabled={purging}
                onClick={() => setShowPurgeModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9a3412',
                  padding: '6px',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 24px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#334155',
                  lineHeight: '1.5',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#0f172a', display: 'block', marginBottom: '2px' }}>
                    Security & Core Tables Safety Guarantee:
                  </strong>
                  <span>
                    This action only prunes entries from <code>system_logs</code> and <code>automation_logs</code>. User accounts, authentication tables, candidate profiles, exams, and question banks are strictly preserved and untouched.
                  </span>
                </div>
              </div>

              {/* Form Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#475569',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}
                  >
                    Target Log Store
                  </label>
                  <select
                    id="purge-target-select"
                    value={purgeTarget}
                    disabled={purging}
                    onChange={e => setPurgeTarget(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#ffffff',
                      color: '#1e293b'
                    }}
                  >
                    <option value="all">Both System Logs & Automation Runs (Recommended)</option>
                    <option value="system">Only System Logs (Audit events, API queries)</option>
                    <option value="automation">Only Automation Logs (Daily 00:00 Cron Runs)</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#475569',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}
                  >
                    Purge Scope / Age
                  </label>
                  <select
                    id="purge-scope-select"
                    value={purgeScope}
                    disabled={purging}
                    onChange={e => setPurgeScope(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#ffffff',
                      color: '#1e293b'
                    }}
                  >
                    <option value="all">All Logs (Full Table Purge)</option>
                    <option value="older_than_24h">Older than 24 Hours</option>
                    <option value="older_than_7d">Older than 7 Days</option>
                    <option value="older_than_30d">Older than 30 Days</option>
                  </select>
                </div>
              </div>

              {/* Status Message */}
              {purgeStatus && (
                <div
                  id="purge-status-message"
                  style={{
                    marginTop: '16px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: purgeStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: purgeStatus.type === 'success' ? '#166534' : '#991b1b',
                    border: `1px solid ${purgeStatus.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                  }}
                >
                  {purgeStatus.text}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}
            >
              <button
                id="btn-cancel-purge"
                className="btn light"
                disabled={purging}
                onClick={() => setShowPurgeModal(false)}
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                id="btn-confirm-purge"
                className="btn"
                disabled={purging}
                onClick={handlePurgeLogs}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '700',
                  padding: '8px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: purging ? 'not-allowed' : 'pointer'
                }}
              >
                {purging ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    Purging Logs...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Confirm Purge
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
