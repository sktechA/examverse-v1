import React, { useEffect, useMemo, useState } from 'react';
import FeaturedExamCarousel from './FeaturedExamCarousel';
import {
  CalendarDays,
  Clock3,
  FileText,
  ShieldCheck,
  RefreshCw,
  Download,
  ArrowUpRight,
  Award,
  Zap,
  AlertCircle
} from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;

function isVerifiedOfficial(item) {
  const verification = String(item?.verification_status || '').toLowerCase();
  const status = String(item?.status || '').toLowerCase();
  return (
    ['verified', 'updated', 'postponed'].includes(verification) &&
    !['cancelled', 'rejected', 'completed'].includes(status)
  );
}

function safeTime(value) {
  if (!value) return NaN;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : NaN;
}

export default function ComprehensiveExamCalendar({
  supabase,
  publicMode = false,
  adminMode = false,
  onOpenExam
}) {
  const [mockExams, setMockExams] = useState([]);
  const [officialSchedules, setOfficialSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      let officialData = [];
      try {
        const res = await fetch('/api/sync-exam-calendar', {
          headers: { Accept: 'application/json' }
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.ok && Array.isArray(json.schedules)) {
            officialData = json.schedules;
          }
        }
      } catch (err) {
        console.warn('Official exam calendar fetch note:', err?.message || err);
      }

      if (officialData.length === 0 && supabase) {
        try {
          const { data } = await supabase
            .from('official_exam_schedules')
            .select('*')
            .in('verification_status', ['verified', 'updated', 'postponed'])
            .not('status', 'in', '(cancelled,rejected,completed)')
            .order('exam_date', { ascending: true, nullsFirst: false })
            .limit(500);
          officialData = Array.isArray(data) ? data : [];
        } catch (err) {
          console.warn('Official schedule DB fallback note:', err?.message || err);
        }
      }

      setOfficialSchedules(officialData.filter(isVerifiedOfficial));

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('exams')
            .select('id,title,description,duration_minutes,total_questions,marks_per_question,negative_marking,scheduled_start,scheduled_end,status,published,subject,exam_type,created_at')
            .or('published.eq.true,status.eq.published')
            .order('scheduled_start', { ascending: true, nullsFirst: false })
            .limit(500);
          if (!error && Array.isArray(data)) setMockExams(data);
        } catch (err) {
          console.warn('Mock exam fetch note:', err?.message || err);
        }
      }
    } catch (err) {
      console.warn('Exam calendar loading error:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [supabase]);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const session = (await supabase?.auth?.getSession?.())?.data?.session;
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch('/api/sync-exam-calendar', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'sync', quick: false, enable_ai_research: true })
      });
      const data = await res.json();
      setSyncNotice(
        data?.ok
          ? `Official calendar updated: ${Number(data.total_schedules || 0).toLocaleString('en-IN')} verified records checked.`
          : 'Official calendar refresh could not be completed.'
      );
      await loadData();
    } catch (err) {
      setSyncNotice('Official calendar refresh could not be completed. Showing the latest saved records.');
      await loadData();
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncNotice(null), 5000);
    }
  };

  const formatLocalDate = (timestamp) => {
    if (!Number.isFinite(timestamp)) return 'Not announced';
    try {
      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date(timestamp));
    } catch {
      return 'Not announced';
    }
  };

  const formatLocalTime = (timestamp) => {
    if (!Number.isFinite(timestamp)) return '—';
    try {
      return new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date(timestamp));
    } catch {
      return '—';
    }
  };

  const formatCountdown = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return { d: 0, h: 0, m: 0, s: 0, text: '00:00:00' };
    let total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400);
    total %= 86400;
    const h = Math.floor(total / 3600);
    total %= 3600;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return {
      d,
      h,
      m,
      s,
      text: d > 0
        ? `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
        : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    };
  };

  const activeData = useMemo(() => {
    const list = [];
    const seen = new Set();

    const add = (item) => {
      const key = item._id || item.id || item.identity_key || item.title;
      if (!key || seen.has(key)) return;
      seen.add(key);
      list.push(item);
    };

    officialSchedules.forEach((item) => {
      const start = safeTime(item.exam_date);
      const duration = Number(item.duration_minutes) || 120;
      const explicitEnd = safeTime(item.exam_end_date);
      const end = Number.isFinite(explicitEnd)
        ? explicitEnd
        : (Number.isFinite(start) ? start + duration * 60 * 1000 : NaN);
      if (!Number.isFinite(start)) return;

      const isLive = start <= now && Number.isFinite(end) && end > now;
      const isUpcoming = start > now;
      if (!isLive && !isUpcoming) return;

      add({
        ...item,
        _origin_type: 'official',
        _id: item.id || `official-${item.identity_key || item.exam_title}`,
        title: item.exam_title,
        authority: item.conducting_authority || item.source_authority || 'Official Examination Board',
        category: item.subject_category || item.exam_type || 'Official Examination',
        description: item.remarks || `${item.conducting_authority || 'Official board'} officially announced examination.`,
        exam_date: start,
        exam_end_date: end,
        application_last_date: safeTime(item.application_last_date),
        duration_minutes: Number(item.duration_minutes) || null,
        admit_card_url: item.admit_card_url || item.official_admit_card_url || null,
        official_notification_url: item.official_notification_url || null,
        notification_number: item.notification_number || null,
        _isLive: isLive,
        _isUpcoming: isUpcoming,
        _remainingMs: isLive ? Math.max(0, end - now) : 0,
        _startsInMs: isUpcoming ? Math.max(0, start - now) : 0
      });
    });

    mockExams.forEach((mock) => {
      const published = (mock.published === true || mock.status === 'published') &&
        !['cancelled', 'unpublished', 'draft'].includes(String(mock.status || '').toLowerCase());
      if (!published || !mock.scheduled_start) return;

      const start = safeTime(mock.scheduled_start);
      if (!Number.isFinite(start)) return;
      const duration = Number(mock.duration_minutes) || 60;
      const explicitEnd = safeTime(mock.scheduled_end);
      const end = Number.isFinite(explicitEnd) ? explicitEnd : start + duration * 60 * 1000;
      const isLive = start <= now && end > now;
      const isUpcoming = start > now;
      if (!isLive && !isUpcoming) return;

      add({
        ...mock,
        _origin_type: 'mock',
        _id: mock.id || `mock-${mock.title}`,
        title: mock.title,
        authority: 'SKTech Mock',
        category: mock.subject || 'CBT Mock Test',
        exam_date: start,
        exam_end_date: end,
        application_last_date: null,
        duration_minutes: duration,
        total_questions: Number(mock.total_questions) || 0,
        admit_card_url: null,
        notification_number: null,
        _isLive: isLive,
        _isUpcoming: isUpcoming,
        _remainingMs: isLive ? Math.max(0, end - now) : 0,
        _startsInMs: isUpcoming ? Math.max(0, start - now) : 0
      });
    });

    return list.sort((a, b) => {
      if (a._isLive !== b._isLive) return a._isLive ? -1 : 1;
      return a.exam_date - b.exam_date;
    });
  }, [officialSchedules, mockExams, now]);

  const liveList = activeData.filter((item) => item._isLive);
  const upcomingList = activeData.filter((item) => item._isUpcoming);

  return (
    <section className="exam-schedule-container" id="upcoming-exams">
      {syncNotice && adminMode && (
        <div className="no-live-notice-banner" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={16} />
            <span>{syncNotice}</span>
          </div>
        </div>
      )}

      <FeaturedExamCarousel
        exams={activeData.slice(0, Math.max(1, activeData.length))}
        now={now}
        publicMode={publicMode}
        onOpenExam={onOpenExam}
      />

      <div className="exam-schedule-secondary">
        <div className="exam-schedule-secondary-head">
          <div>
            <span className="section-kicker">EXAMINATION CALENDAR</span>
            <h3>Upcoming &amp; Live Examinations</h3>
            <p>Only current and future published examinations are shown.</p>
          </div>
          {adminMode && (
            <button
              className="btn outline"
              style={{ fontSize: 12, padding: '7px 11px' }}
              disabled={isSyncing}
              onClick={handleTriggerSync}
            >
              <RefreshCw size={13} className={isSyncing ? 'spin-anim' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync Official Calendar'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="schedule-empty-state compact">
            <CalendarDays size={28} />
            <h4>Loading examination schedule...</h4>
          </div>
        ) : activeData.length === 0 ? (
          <div className="schedule-empty-state compact">
            <CalendarDays size={30} />
            <h4>No upcoming examinations are currently available.</h4>
            <p>Verified official examination schedules will appear here automatically when dates are announced.</p>
          </div>
        ) : (
          <div className="schedule-cards-grid compact-grid">
            {activeData.map((item) => {
              const isOfficial = item._origin_type === 'official';
              const cd = item._isLive
                ? formatCountdown(item._remainingMs)
                : formatCountdown(item._startsInMs);
              return (
                <article
                  key={item._id}
                  className={'schedule-item-card compact-card ' + (item._isLive ? 'is-live' : 'is-upcoming')}
                >
                  <div className="schedule-card-top">
                    <span className={'schedule-origin-badge ' + (isOfficial ? 'official' : 'mock')}>
                      {isOfficial ? <Award size={10} /> : <Zap size={10} />}
                      {isOfficial ? item.authority : 'SKTech CBT Mock'}
                    </span>
                    <span className={'schedule-status-pill ' + (item._isLive ? 'live' : 'upcoming')}>
                      {item._isLive ? '● Live Now' : 'Upcoming'}
                    </span>
                  </div>

                  <h3>{item.title}</h3>

                  <div className="schedule-card-meta-list">
                    <div>
                      <CalendarDays size={13} />
                      <span>Exam Date: <strong>{formatLocalDate(item.exam_date)}</strong></span>
                    </div>
                    <div>
                      <Clock3 size={13} />
                      <span>Duration: <strong>{item.duration_minutes ? `${item.duration_minutes} Minutes` : 'Not announced'}</strong></span>
                    </div>
                    {isOfficial && item.application_last_date && (
                      <div>
                        <AlertCircle size={13} />
                        <span>Application Last Date: <strong>{formatLocalDate(item.application_last_date)}</strong></span>
                      </div>
                    )}
                    {isOfficial && item.notification_number && (
                      <div>
                        <FileText size={13} />
                        <span>Notification No.: <strong>{item.notification_number}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className={'schedule-timer-strip ' + (item._isLive ? 'live' : 'upcoming')}>
                    <span>{item._isLive ? 'Examination Closes In:' : 'Examination Starts In:'}</span>
                    <strong>{cd.text}</strong>
                  </div>

                  {isOfficial && item.admit_card_url ? (
                    <a
                      href={item.admit_card_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="schedule-card-action-btn btn success"
                      style={{ textDecoration: 'none' }}
                    >
                      <Download size={13} /> Download Admit Card <ArrowUpRight size={13} />
                    </a>
                  ) : !isOfficial ? (
                    <button
                      className={'schedule-card-action-btn btn ' + (item._isLive ? 'primary' : 'outline')}
                      onClick={() => onOpenExam?.(item._rawMock || item)}
                    >
                      {publicMode ? 'Login to Attempt' : (item._isLive ? 'Enter Live Exam' : 'Practice Mock Test')}
                      <ArrowUpRight size={13} />
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="exam-schedule-source-note">
        <ShieldCheck size={14} />
        <span>Official examination schedules are shown only after source verification. Past dates are automatically excluded.</span>
        <span className="exam-schedule-counts">{liveList.length} live · {upcomingList.length} upcoming</span>
      </div>
    </section>
  );
}
