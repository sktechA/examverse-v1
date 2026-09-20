import React, { useState } from 'react';
import { Clock3, Play, AlertCircle, CheckCircle2, ChevronRight, X, RotateCcw } from 'lucide-react';

function cleanAnswer(v = '') {
  const m = String(v).trim().match(/^\s*([ABCD])(?:\s*[.)]|\s|$)/i);
  return m ? m[1].toUpperCase() : String(v).trim().toUpperCase().slice(0, 1);
}

export default function ExamRecoveryModal({
  recoverySession,
  onContinue,
  onDecline,
  supabase,
  session
}) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!recoverySession) return null;

  const exam = recoverySession.exam || {};
  const questions = Array.isArray(recoverySession.questions) ? recoverySession.questions : [];
  const answers = recoverySession.answers || {};
  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length || exam.total_questions || 0;
  const timeRemaining = recoverySession.time_remaining || 0;
  const currentQIndex = (recoverySession.current_q_index || 0) + 1;
  const pctAnswered = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  const formatTime = (secs) => {
    if (secs <= 0) return '00:00 (Time Expired)';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m > 0) {
      return `${m} min${m > 1 ? 's' : ''} ${s > 0 ? `${s} sec${s > 1 ? 's' : ''}` : ''} left`;
    }
    return `${s} second${s > 1 ? 's' : ''} left`;
  };

  const formatLastActive = (isoString) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent session';
    }
  };

  const handleDeclineClick = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      let correct = 0;
      let wrong = 0;
      let skipped = 0;

      const marksPerQuestion = Number(recoverySession.config?.marksPerQuestion ?? exam.marks_per_question ?? 1);
      const negativeMarking = Number(recoverySession.config?.negativeMarking ?? exam.negative_marking ?? 0);

      questions.forEach((x) => {
        const userAns = answers[x.id];
        if (!userAns) {
          skipped++;
        } else if (userAns === cleanAnswer(x.correct_answer)) {
          correct++;
        } else {
          wrong++;
        }
      });

      const score = correct * marksPerQuestion - wrong * negativeMarking;
      const maxMarks = questions.length * marksPerQuestion;
      const percentage = maxMarks > 0 ? Math.max(0, (score / maxMarks) * 100) : 0;

      const finishedResult = {
        correct,
        wrong,
        skipped,
        attempted: questions.length - skipped,
        score: Math.round(score * 100) / 100,
        maxMarks,
        percentage: Math.round(percentage * 100) / 100,
        total_questions: questions.length,
        marksPerQuestion,
        negativeMarking,
        auto: false,
        interruptedSubmission: true
      };

      // Persist to Supabase if authenticated
      if (supabase && session?.user?.id) {
        try {
          await supabase.from('exam_attempts').insert({
            exam_id: exam.id || null,
            candidate_id: session.user.id,
            answers,
            score: finishedResult.score,
            correct_count: correct,
            wrong_count: wrong,
            skipped_count: skipped,
            started_at: recoverySession.started_at || new Date().toISOString(),
            submitted_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn('Attempt save warning on decline:', dbErr);
        }
      }

      // Clear storage keys for this user
      try {
        const candidateKey = `sktech_active_exam_${session?.user?.id || 'candidate'}`;
        localStorage.removeItem(candidateKey);
        localStorage.removeItem('sktech_interrupted_exam_session');
      } catch (e) {
        console.warn('Storage clear warning:', e);
      }

      onDecline(finishedResult, questions, answers);
    } catch (err) {
      console.error('Error during decline & submit:', err);
      setErrorMsg(err.message || 'Failed to submit interrupted exam.');
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(5px)',
        zIndex: 99999,
        display: 'grid',
        placeItems: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '540px',
          padding: '28px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          border: '1px solid #fed7aa',
          position: 'relative'
        }}
      >
        {/* Header Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              background: '#ffedd5',
              color: '#9a3412',
              padding: '5px 10px',
              borderRadius: '99px'
            }}
          >
            <AlertCircle size={13} />
            UNSUBMITTED EXAM RECOVERY
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            {formatLastActive(recoverySession.last_active_at)}
          </span>
        </div>

        {/* Prompt */}
        <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Your previous exam was interrupted.
        </h2>
        <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px', lineHeight: 1.5 }}>
          Would you like to continue from where you left off?
        </p>

        {/* Exam Snapshot Card */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <b style={{ fontSize: '16px', color: '#1e293b', display: 'block' }}>
                {exam.title || exam.name || 'Practice Mock Exam'}
              </b>
              <small style={{ color: '#64748b', fontSize: '12px' }}>
                {exam.subject ? `${exam.subject} · ` : ''}
                {exam.cat || 'Mock Test'} · Last active at Question {currentQIndex}
              </small>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: timeRemaining <= 300 ? '#fef2f2' : '#eff6ff',
                color: timeRemaining <= 300 ? '#dc2626' : '#2563eb',
                padding: '4px 9px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              <Clock3 size={14} />
              {formatTime(timeRemaining)}
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span style={{ color: '#64748b' }}>Answered Progress</span>
              <strong style={{ color: '#0f172a' }}>
                {answeredCount} of {totalCount} questions ({pctAnswered}%)
              </strong>
            </div>
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pctAnswered}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #5b61df, #7a80ee)',
                  borderRadius: 'inherit',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              color: '#dc2626',
              fontSize: '12px',
              marginBottom: '16px',
              border: '1px solid #fecaca'
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="btn primary full"
            onClick={() => onContinue(recoverySession)}
            disabled={busy}
            style={{
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 750,
              borderRadius: '12px',
              cursor: 'pointer'
            }}
          >
            <Play size={16} fill="currentColor" />
            Continue Exam from Question {currentQIndex}
          </button>

          <button
            type="button"
            className="btn light full"
            onClick={handleDeclineClick}
            disabled={busy}
            style={{
              padding: '11px 18px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '12px',
              color: '#475569',
              cursor: busy ? 'not-allowed' : 'pointer',
              border: '1px solid #e2e8f0'
            }}
          >
            <CheckCircle2 size={16} style={{ color: '#64748b' }} />
            {busy ? 'Submitting & Evaluating...' : 'Decline & Submit (View Final Score)'}
          </button>
        </div>

        <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
          Selecting <b>Continue</b> restores your exact remaining time and answered questions.
          <br />
          Selecting <b>Decline</b> submits your answered questions and shows your score breakdown.
        </p>
      </div>
    </div>
  );
}
