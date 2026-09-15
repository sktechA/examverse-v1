import React, { useState, useEffect } from 'react';
import { Clock3, X, Zap } from 'lucide-react';

function cleanAnswer(v = '') {
  const m = String(v).trim().match(/^\s*([ABCD])(?:\s*[.)]|\s|$)/i);
  return m ? m[1].toUpperCase() : String(v).trim().toUpperCase().slice(0, 1);
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function MockModal({ exam, close, session, supabase, Brand }) {
  // Requirement 8: EXACT database configuration values (no hardcoded fallback for existing database exam)
  const [config, setConfig] = useState({
    durationMinutes: exam.duration_minutes !== undefined && exam.duration_minutes !== null
      ? Number(exam.duration_minutes)
      : (parseInt(exam.time) || 60),
    totalQuestionsLimit: exam.total_questions !== undefined && exam.total_questions !== null
      ? Number(exam.total_questions)
      : (parseInt(exam.q) || 25),
    marksPerQuestion: exam.marks_per_question !== undefined && exam.marks_per_question !== null
      ? Number(exam.marks_per_question)
      : 1,
    negativeMarking: exam.negative_marking !== undefined && exam.negative_marking !== null
      ? Number(exam.negative_marking)
      : (parseFloat(exam.negative) || 0),
    shouldRandomize: exam.randomize_questions !== false
  });

  const durationMinutes = config.durationMinutes;
  const totalQuestionsLimit = config.totalQuestionsLimit;
  const marksPerQuestion = config.marksPerQuestion;
  const negativeMarking = config.negativeMarking;
  const shouldRandomize = config.shouldRandomize;

  const [time, setTime] = useState(durationMinutes * 60);
  const [questions, setQuestions] = useState([]);
  const [q, setQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showFive, setShowFive] = useState(false);
  const [showOne, setShowOne] = useState(false);
  const [result, setResult] = useState(null);
  const [startedAt] = useState(new Date().toISOString());
  const [fullScreenWarning, setFullScreenWarning] = useState(false);

  const enterExamFullscreen = async () => {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el?.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' });
      }
      setFullScreenWarning(false);
    } catch (err) {
      console.warn('Fullscreen request was not granted:', err);
    }
  };

  useEffect(() => {
    if (loading || submitted || result) return;
    enterExamFullscreen();

    const onFullscreenChange = () => {
      if (!document.fullscreenElement && !submitted) {
        setFullScreenWarning(true);
      }
    };
    const onBeforeUnload = (e) => {
      if (!submitted) {
        e.preventDefault();
        e.returnValue = 'Exam is in progress. Please submit the exam before leaving.';
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden && !submitted) setFullScreenWarning(true);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.body.classList.add('exam-in-progress');

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.body.classList.remove('exam-in-progress');
    };
  }, [loading, submitted, result]);

  useEffect(() => {
    if (submitted && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, [submitted]);

  useEffect(() => {
    const blockKeys = (e) => {
      if (submitted) return;
      // Keep browser-level shortcuts usable where the browser refuses to block them,
      // but prevent common in-app navigation/close shortcuts during an exam.
      if ((e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) ||
          (e.ctrlKey && (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'w')) ||
          e.key === 'F5') {
        e.preventDefault();
        setFullScreenWarning(true);
      }
    };
    const blockContext = (e) => e.preventDefault();
    window.addEventListener('keydown', blockKeys, true);
    window.addEventListener('contextmenu', blockContext);
    return () => {
      window.removeEventListener('keydown', blockKeys, true);
      window.removeEventListener('contextmenu', blockContext);
    };
  }, [submitted]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      let data = null;
      let error = null;

      try {
        let effectiveLimit = totalQuestionsLimit;
        let effectiveRandomize = shouldRandomize;

        if (exam.id) {
          // Fetch authoritative exam row directly from database (Requirement 8)
          const { data: dbExam } = await supabase
            .from('exams')
            .select('id, title, total_questions, duration_minutes, marks_per_question, negative_marking, randomize_questions')
            .eq('id', exam.id)
            .maybeSingle();

          if (dbExam && live) {
            const dur = Number(dbExam.duration_minutes ?? durationMinutes);
            const totalQ = Number(dbExam.total_questions ?? totalQuestionsLimit);
            const marks = Number(dbExam.marks_per_question ?? marksPerQuestion);
            const neg = Number(dbExam.negative_marking ?? negativeMarking);
            const rand = dbExam.randomize_questions !== false;

            effectiveLimit = totalQ;
            effectiveRandomize = rand;

            setConfig({
              durationMinutes: dur,
              totalQuestionsLimit: totalQ,
              marksPerQuestion: marks,
              negativeMarking: neg,
              shouldRandomize: rand
            });
            setTime(dur * 60);
          }

          // Attempt RPC first, fallback to direct query if needed
          const rpc = await supabase.rpc('get_exam_questions', {
            p_exam_id: exam.id,
            p_limit: effectiveLimit
          });

          if (!rpc.error && rpc.data?.length) {
            data = rpc.data;
          } else {
            // Direct join query
            const { data: mapped, error: me } = await supabase
              .from('exam_questions')
              .select('question_id, question_order')
              .eq('exam_id', exam.id)
              .order('question_order', { ascending: true })
              .limit(effectiveLimit);

            if (mapped?.length) {
              const qIds = mapped.map(m => m.question_id);
              const { data: qs, error: qe } = await supabase
                .from('questions')
                .select(
                  'id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,question_hi,option_a_hi,option_b_hi,option_c_hi,option_d_hi,subject,topic,difficulty,exam'
                )
                .in('id', qIds);

              // Maintain exact mapped order & prevent any question/option scramble (Requirement 5)
              const qMap = new Map((qs || []).map(item => [item.id, item]));
              data = qIds.map(id => qMap.get(id)).filter(Boolean);
              error = qe;
            } else {
              error = me;
            }
          }
        } else {
          // Subject Practice must use the administrator's database configuration.
          // Never fall back to hardcoded 25 questions / 25 minutes.
          if (exam.cat === 'Subject Test') {
            const requestedSubject = String(exam.subject || exam.name.replace(' Practice', '')).trim();
            const { data: subjectExams, error: subjectExamError } = await supabase
              .from('exams')
              .select('id, title, subject, total_questions, duration_minutes, marks_per_question, negative_marking, randomize_questions, published, status, updated_at')
              .eq('published', true)
              .eq('status', 'published')
              .order('updated_at', { ascending: false })
              .limit(100);

            if (subjectExamError) {
              throw subjectExamError;
            }

            const wanted = requestedSubject.toLowerCase().replace(/\s+/g, ' ').trim();
            const subjectExam = (subjectExams || []).find(e => {
              const dbSubject = String(e.subject || '').toLowerCase().replace(/\s+/g, ' ').trim();
              const title = String(e.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
              return dbSubject === wanted || title === wanted ||
                title === `${wanted} practice` || title.includes(`${wanted} practice`) ||
                title.includes(wanted);
            }) || null;

            if (!subjectExam) {
              setMsg(`Admin configuration not found for ${requestedSubject}. Please ask Admin to create/publish the subject exam configuration.`);
              setLoading(false);
              return;
            }

            const dur = Number(subjectExam.duration_minutes);
            const totalQ = Number(subjectExam.total_questions);
            const marks = Number(subjectExam.marks_per_question ?? 1);
            const neg = Number(subjectExam.negative_marking ?? 0);
            const rand = subjectExam.randomize_questions !== false;

            setConfig({
              durationMinutes: dur,
              totalQuestionsLimit: totalQ,
              marksPerQuestion: marks,
              negativeMarking: neg,
              shouldRandomize: rand
            });
            setTime(dur * 60);
            effectiveLimit = totalQ;
            effectiveRandomize = rand;
          }

          // Generic practice mock query
          let query = supabase
            .from('questions')
            .select(
              'id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,question_hi,option_a_hi,option_b_hi,option_c_hi,option_d_hi,subject,topic,difficulty,exam'
            )
            .eq('status', 'approved')
            .limit(effectiveLimit);

          if (exam.cat === 'Subject Test') {
            query = query.eq('subject', exam.name.replace(' Practice', ''));
          } else if (exam.name) {
            query = query.ilike('exam', `%${exam.name.split(' ')[0]}%`);
          }
          const r = await query;
          data = r.data;
          error = r.error;
        }

        // A configured DB exam must have exactly the configured number of usable mapped questions.
        // Never silently start a 100-question exam with 25/30 questions.
        if (exam.id && !error && (data || []).length !== effectiveLimit) {
          if (live) {
            setQuestions([]);
            setMsg(`Exam is not ready: Admin configured ${effectiveLimit} questions, but only ${(data || []).length} valid questions are mapped.`);
            setLoading(false);
          }
          return;
        }

        // Validate complete integrity of question records
        let validQuestions = (data || []).filter(
          x =>
            x.question?.trim() &&
            x.option_a?.trim() &&
            x.option_b?.trim() &&
            x.option_c?.trim() &&
            x.option_d?.trim() &&
            /^[ABCD]$/.test(cleanAnswer(x.correct_answer))
        );

        // Shuffle only if randomize is enabled
        if (effectiveRandomize && validQuestions.length > 1) {
          validQuestions = shuffleArray(validQuestions);
        }

        if (live) {
          setQuestions(validQuestions);
          setLoading(false);
          if (error) {
            setMsg(error.message);
          }
        }
      } catch (err) {
        if (live) {
          setMsg(err.message);
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      live = false;
    };
  }, [exam.id]);

  const submit = async (auto = false) => {
    if (submitted) return;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    questions.forEach(x => {
      const a = answers[x.id];
      if (!a) skipped++;
      else if (a === cleanAnswer(x.correct_answer)) correct++;
      else wrong++;
    });

    // Exact database formula scoring
    const score = correct * marksPerQuestion - wrong * negativeMarking;
    const maxMarks = questions.length * marksPerQuestion;
    const percentage = maxMarks > 0 ? Math.max(0, (score / maxMarks) * 100) : 0;

    const finished = {
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
      auto
    };

    setResult(finished);
    setSubmitted(true);
    setMsg('');

    if (supabase && session?.user?.id) {
      try {
        await supabase.from('exam_attempts').insert({
          exam_id: exam.id || null,
          candidate_id: session.user.id,
          answers,
          correct_count: correct,
          wrong_count: wrong,
          skipped_count: skipped,
          score: finished.score,
          started_at: startedAt,
          submitted_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Attempt could not be persisted:', err);
      }
    }
  };

  useEffect(() => {
    if (submitted) return;
    const id = setInterval(
      () =>
        setTime(t => {
          if (t === 301) setShowFive(true);
          if (t === 61) setShowOne(true);
          if (t <= 1) {
            clearInterval(id);
            submit(true);
            return 0;
          }
          return t - 1;
        }),
      1000
    );
    return () => clearInterval(id);
  }, [submitted, questions]);

  const BrandComponent = Brand || (() => (
    <div className="brand">
      <span className="logo"><Zap size={19} /></span>
      <div><b>SKTech Exam Portal</b></div>
    </div>
  ));

  if (loading) {
    return (
      <div className="modal-bg">
        <div className="modal">
          <BrandComponent />
          <p>Loading exam questions with exact syllabus configuration...</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="modal-bg">
        <div className="modal result-modal" style={{ maxWidth: '560px' }}>
          <BrandComponent />
          <span className="pill">EXAM COMPLETED</span>
          <h2>{exam.title || exam.name}</h2>
          <p className="muted">
            {result.auto
              ? 'Time expired and your exam was submitted automatically.'
              : 'Your exam has been submitted and verified against official answer keys.'}
          </p>

          <div className="attempt-summary" style={{ marginTop: '16px' }}>
            <div>
              <strong>{result.score}</strong>
              <small>Score / {result.maxMarks}</small>
            </div>
            <div>
              <strong>{result.correct}</strong>
              <small>Correct (+{result.marksPerQuestion} ea)</small>
            </div>
            <div>
              <strong>{result.wrong}</strong>
              <small>Wrong (-{result.negativeMarking} ea)</small>
            </div>
            <div>
              <strong>{result.skipped}</strong>
              <small>Skipped</small>
            </div>
          </div>

          <div className="stats" style={{ marginTop: '16px' }}>
            <div className="stat">
              <small>Attempted</small>
              <strong>{result.attempted} / {result.total_questions}</strong>
            </div>
            <div className="stat">
              <small>Percentage</small>
              <strong>{result.percentage.toFixed(2)}%</strong>
            </div>
            <div className="stat">
              <small>Accuracy</small>
              <strong>
                {result.attempted > 0
                  ? `${Math.round((result.correct / result.attempted) * 100)}%`
                  : '0%'}
              </strong>
            </div>
          </div>

          {msg && <div className="error-badge">{msg}</div>}

          <button className="btn dark full" style={{ marginTop: '20px' }} onClick={close}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="modal-bg">
        <div className="modal">
          <button className="close" onClick={close}><X /></button>
          <BrandComponent />
          <h2>No Approved Questions Available</h2>
          <p className="muted">
            This exam currently has no validated approved questions assigned. Admin can use
            “Blueprint-Driven AI Mock Generator” or “Auto-map Questions” in Exam Management.
          </p>
          <button className="btn dark full" onClick={close}>Close</button>
        </div>
      </div>
    );
  }

  const current = questions[q];
  const opts = [
    ['A', current.option_a],
    ['B', current.option_b],
    ['C', current.option_c],
    ['D', current.option_d]
  ].filter(x => x[1]);

  return (
    <div className="modal-bg">
      <div className="mock">
        <div className="mock-head">
          <div>
            <b>{exam.title || exam.name}</b>
            <small style={{ display: 'block', color: '#64748b', marginTop: '2px' }}>
              Q{q + 1} of {questions.length} · Section: <b>{current.subject || 'General'}</b>
              {current.topic ? ` (${current.topic})` : ''} · +{marksPerQuestion} / -{negativeMarking} marks
            </small>
          </div>
          <strong className={time <= 300 ? 'timer danger' : 'timer'}>
            <Clock3 size={18} />
            {String(Math.floor(time / 60)).padStart(2, '0')}:
            {String(time % 60).padStart(2, '0')}
          </strong>
        </div>

        {fullScreenWarning && (
          <div className="exam-alert exam-fullscreen-alert">
            <span>🔒</span>
            <div>
              <b>Exam mode active</b>
              <small>Exam screen should remain open. Return to this window and continue the test.</small>
            </div>
            <button onClick={enterExamFullscreen}>Return to Full Screen</button>
          </div>
        )}

        {(showFive || showOne) && (
          <div className="exam-alert">
            <span>⚠️</span>
            <div>
              <b>{showOne ? '1 Minute Remaining!' : '5 Minutes Remaining!'}</b>
              <small>Review unanswered questions before auto-submit.</small>
            </div>
            <button onClick={() => { setShowFive(false); setShowOne(false); }}>×</button>
          </div>
        )}

        <div className="mock-body">
          <main>
            <span className="pill">QUESTION {q + 1} OF {questions.length}</span>
            <h2 style={{ fontSize: '18px', marginTop: '10px' }}>{current.question}</h2>
            {current.question_hi && (
              <p className="question-hi" style={{ fontSize: '16px' }}>{current.question_hi}</p>
            )}

            <div style={{ marginTop: '16px' }}>
              {opts.map(([key, text]) => (
                <label
                  className={'option ' + (answers[current.id] === key ? 'selected' : '')}
                  key={key}
                >
                  <input
                    type="radio"
                    name={'q-' + current.id}
                    checked={answers[current.id] === key}
                    onChange={() => setAnswers(a => ({ ...a, [current.id]: key }))}
                  />
                  <b>{key}.</b> {text}
                </label>
              ))}
            </div>

            <div className="mock-actions">
              <button
                className="btn light"
                disabled={q === 0}
                onClick={() => setQ(Math.max(0, q - 1))}
              >
                Previous
              </button>

              <button
                className={'btn ' + (review[current.id] ? 'primary' : 'light')}
                onClick={() => setReview(r => ({ ...r, [current.id]: !r[current.id] }))}
              >
                {review[current.id] ? 'Marked for Review' : 'Mark for Review'}
              </button>

              <button
                className="btn dark"
                onClick={() => setQ(Math.min(questions.length - 1, q + 1))}
              >
                {q === questions.length - 1 ? 'Review' : 'Save & Next'}
              </button>
            </div>
          </main>

          <aside>
            <b>Question Palette</b>
            <div className="palette">
              {questions.map((x, i) => (
                <button
                  className={
                    (i === q ? 'sel ' : '') +
                    (answers[x.id] ? 'answered ' : '') +
                    (review[x.id] ? 'reviewed' : '')
                  }
                  onClick={() => setQ(i)}
                  key={x.id}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '14px', lineHeight: '1.6' }}>
              <div>🟢 Answered: {Object.keys(answers).length}</div>
              <div>⚪ Unanswered: {questions.length - Object.keys(answers).length}</div>
              <div>🟡 Review: {Object.keys(review).filter(k => review[k]).length}</div>
            </div>

            <button className="btn primary full" onClick={() => submit(false)}>
              Submit Exam
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
