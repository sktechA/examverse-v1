import React, { useState, useEffect, useRef } from 'react';
import { Clock3, X, Zap, Pause } from 'lucide-react';

function cleanAnswer(v = '') {
  const m = String(v).trim().match(/^\s*([ABCD])(?:\s*[.)]|\s|$)/i);
  return m ? m[1].toUpperCase() : String(v).trim().toUpperCase().slice(0, 1);
}

function getBilingualPair(enVal, hiVal) {
  let en = String(enVal || '').trim();
  let hi = String(hiVal || '').trim();

  const checkSlash = (str) => {
    if (str && (str.includes('/') || str.includes('|'))) {
      const parts = str.split(/\s*[\/|]\s*/);
      if (parts.length >= 2) {
        const p1 = parts[0].trim();
        const p2 = parts.slice(1).join(' / ').trim();
        const p1HasHi = /[\u0900-\u097F]/.test(p1);
        const p2HasHi = /[\u0900-\u097F]/.test(p2);
        if (!p1HasHi && p2HasHi) return { en: p1, hi: p2 };
        if (p1HasHi && !p2HasHi) return { en: p2, hi: p1 };
      }
    }
    return null;
  };

  const slashEn = checkSlash(en);
  if (slashEn) {
    en = slashEn.en;
    if (!hi) hi = slashEn.hi;
  }
  const slashHi = checkSlash(hi);
  if (slashHi) {
    if (!en) en = slashHi.en;
    hi = slashHi.hi;
  }

  // If en was pure Hindi and hi was empty:
  if (!hi && /[\u0900-\u097F]/.test(en) && !/[a-zA-Z]/.test(en)) {
    hi = en;
    en = '';
  }
  // If hi was pure English and en was empty:
  if (!en && /[a-zA-Z]/.test(hi) && !/[\u0900-\u097F]/.test(hi)) {
    en = hi;
    hi = '';
  }

  return { en, hi };
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function MockModal({ exam, close, session, supabase, Brand, initialLang }) {
  const recovery = exam?._recoveryState || null;
  const recoveryResult = exam?._recoveryResult || null;

  // Requirement 8: EXACT database configuration values (no hardcoded fallback for existing database exam)
  const [config, setConfig] = useState(() => {
    if (recovery?.config) return recovery.config;
    return {
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
    };
  });

  const durationMinutes = config.durationMinutes;
  const totalQuestionsLimit = config.totalQuestionsLimit;
  const marksPerQuestion = config.marksPerQuestion;
  const negativeMarking = config.negativeMarking;
  const shouldRandomize = config.shouldRandomize;

  const [time, setTime] = useState(() => {
    if (recovery?.time_remaining !== undefined) return recovery.time_remaining;
    return durationMinutes * 60;
  });
  const [questions, setQuestions] = useState(() => {
    if (recovery?.questions?.length) return recovery.questions;
    if (exam._recoveryQuestions?.length) return exam._recoveryQuestions;
    return [];
  });
  const [q, setQ] = useState(() => {
    if (recovery?.current_q_index !== undefined) return recovery.current_q_index;
    return 0;
  });
  const [answers, setAnswers] = useState(() => {
    if (recovery?.answers) return recovery.answers;
    if (exam._recoveryAnswers) return exam._recoveryAnswers;
    return {};
  });
  const [review, setReview] = useState(() => {
    if (recovery?.review) return recovery.review;
    return {};
  });
  const [loading, setLoading] = useState(() => {
    if (recoveryResult || recovery?.questions?.length) return false;
    return true;
  });
  const [msg, setMsg] = useState('');
  const [submitted, setSubmitted] = useState(() => !!recoveryResult);
  const [showFive, setShowFive] = useState(false);
  const [showOne, setShowOne] = useState(false);
  const [result, setResult] = useState(() => recoveryResult || null);
  const [startedAt] = useState(() => recovery?.started_at || new Date().toISOString());
  const [langMode, setLangMode] = useState(() => {
    if (recovery?.lang_mode) return recovery.lang_mode;
    if (initialLang === 'hi' || initialLang === 'en') return initialLang;
    const stored = localStorage.getItem('sktech_lang');
    if (stored === 'hi' || stored === 'en') return stored;
    return 'both';
  }); // 'both' | 'en' | 'hi'
  const [showSolutions, setShowSolutions] = useState(false);

  // Synchronized refs for tracking active state during unloads, timer ticks, and disconnects
  const timeRef = useRef(time);
  timeRef.current = time;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const reviewRef = useRef(review);
  reviewRef.current = review;
  const qRef = useRef(q);
  qRef.current = q;
  const langModeRef = useRef(langMode);
  langModeRef.current = langMode;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const configRef = useRef(config);
  configRef.current = config;
  const startedAtRef = useRef(startedAt);
  startedAtRef.current = startedAt;

  const getStorageKey = () => `sktech_active_exam_${session?.user?.id || 'candidate'}`;

  const persistActiveSession = (customTime, customAnswers, customReview, customQ, customLang) => {
    if (submitted || !questionsRef.current?.length) return;
    const curQuestions = questionsRef.current;
    const curTime = customTime !== undefined ? customTime : timeRef.current;
    const curAnswers = customAnswers !== undefined ? customAnswers : answersRef.current;
    const curReview = customReview !== undefined ? customReview : reviewRef.current;
    const curQ = customQ !== undefined ? customQ : qRef.current;
    const curLang = customLang !== undefined ? customLang : langModeRef.current;

    const payload = {
      session_id: recovery?.session_id || `ses_${Date.now()}`,
      candidate_id: session?.user?.id || 'candidate',
      candidate_email: session?.user?.email || '',
      exam_id: exam.id || null,
      status: 'in_progress',
      exam: {
        id: exam.id || null,
        title: exam.title || exam.name,
        name: exam.name || exam.title,
        subject: exam.subject || null,
        cat: exam.cat || 'Admin Exam',
        duration_minutes: configRef.current.durationMinutes,
        total_questions: configRef.current.totalQuestionsLimit,
        marks_per_question: configRef.current.marksPerQuestion,
        negative_marking: configRef.current.negativeMarking,
        randomize_questions: configRef.current.shouldRandomize
      },
      started_at: startedAtRef.current,
      last_active_at: new Date().toISOString(),
      time_remaining: curTime,
      current_q_index: curQ,
      answers: curAnswers,
      review: curReview,
      lang_mode: curLang,
      questions: curQuestions,
      config: configRef.current
    };

    try {
      const k = getStorageKey();
      localStorage.setItem(k, JSON.stringify(payload));
      localStorage.setItem('sktech_interrupted_exam_session', JSON.stringify(payload));
    } catch (e) {
      console.warn('Active session persist warning:', e);
    }
  };

  const clearActiveSession = () => {
    try {
      const k = getStorageKey();
      localStorage.removeItem(k);
      localStorage.removeItem('sktech_interrupted_exam_session');
    } catch (e) {
      console.warn('Active session clear warning:', e);
    }
  };

  // Sync state whenever answers, review, question index, or language mode changes
  useEffect(() => {
    if (!loading && !submitted && questions.length > 0) {
      persistActiveSession();
    }
  }, [answers, review, q, langMode, loading, submitted, questions.length]);

  // Window unload / disconnection safeguards
  useEffect(() => {
    if (loading || submitted || !questions.length) return;
    const handleUnload = () => {
      persistActiveSession();
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [loading, submitted, questions.length]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      if (recovery?.questions?.length > 0 || recoveryResult) {
        setLoading(false);
        return;
      }
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
                  'id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,question_hi,option_a_hi,option_b_hi,option_c_hi,option_d_hi,explanation_hi,language,subject,topic,difficulty,exam'
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

          // Safety net: If no questions were mapped to this exam yet, auto-query matching approved questions
          if ((!data || data.length === 0) && supabase) {
            try {
              const targetSubject = exam.subject || (
                String(exam.title || '').toLowerCase().includes('reasoning') ? 'Reasoning' :
                String(exam.title || '').toLowerCase().includes('math') ? 'Mathematics' :
                String(exam.title || '').toLowerCase().includes('banking') ? 'Banking Awareness' :
                String(exam.title || '').toLowerCase().includes('current affairs') ? 'Current Affairs' :
                String(exam.title || '').toLowerCase().includes('computer') ? 'Computer' :
                String(exam.title || '').toLowerCase().includes('general awareness') ? 'General Awareness' :
                null
              );

              const { data: poolQs } = await supabase
                .from('questions')
                .select(
                  'id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,question_hi,option_a_hi,option_b_hi,option_c_hi,option_d_hi,explanation_hi,language,subject,topic,difficulty,exam'
                )
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .limit(effectiveLimit * 3);

              if (poolQs?.length) {
                const validPool = poolQs.filter(q => {
                  const ans = cleanAnswer(q.correct_answer, q);
                  return /^[ABCD]$/.test(ans) && q.option_a && q.option_b && q.option_c && q.option_d && !isDependentContextMissing(q.question);
                });

                let selected = [];
                if (targetSubject) {
                  selected = validPool.filter(q => String(q.subject || '').toLowerCase() === targetSubject.toLowerCase());
                }
                if (selected.length < effectiveLimit) {
                  const other = validPool.filter(q => !selected.some(s => s.id === q.id));
                  selected = [...selected, ...other].slice(0, effectiveLimit);
                } else {
                  selected = selected.slice(0, effectiveLimit);
                }

                if (selected.length > 0) {
                  data = selected;
                  // Asynchronously persist mappings to database so future loads are pre-cached
                  const toInsert = selected.map((q, idx) => ({
                    exam_id: exam.id,
                    question_id: q.id,
                    question_order: idx + 1
                  }));
                  supabase.from('exam_questions').insert(toInsert).catch(() => {});
                }
              }
            } catch (_) {}
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
              'id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,question_hi,option_a_hi,option_b_hi,option_c_hi,option_d_hi,explanation_hi,language,subject,topic,difficulty,exam'
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

        // Validate complete integrity of question records (English, Hindi, or Bilingual)
        let validQuestions = (data || []).filter(
          x =>
            (x.question?.trim() || x.question_hi?.trim()) &&
            (x.option_a?.trim() || x.option_a_hi?.trim()) &&
            (x.option_b?.trim() || x.option_b_hi?.trim()) &&
            (x.option_c?.trim() || x.option_c_hi?.trim()) &&
            (x.option_d?.trim() || x.option_d_hi?.trim()) &&
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

    clearActiveSession();
    setResult(finished);
    setSubmitted(true);
    setMsg('');

    if (supabase && session?.user?.id) {
      try {
        const { error: attemptError } = await supabase.from('exam_attempts').insert({
          exam_id: exam.id || null,
          candidate_id: session.user.id,
          answers,
          score: finished.score,
          correct_count: correct,
          wrong_count: wrong,
          skipped_count: skipped,
          started_at: startedAt,
          submitted_at: new Date().toISOString()
        });
        if (attemptError) throw attemptError;
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
          if (t % 5 === 0) {
            persistActiveSession(t - 1);
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
    const handleResultClose = () => {
      clearActiveSession();
      close();
    };

    return (
      <div className="modal-bg">
        <div className="modal result-modal" style={{ maxWidth: '560px', position: 'relative' }}>
          <button className="close" onClick={handleResultClose}><X /></button>
          <BrandComponent />
          <span className="pill">
            {result.interruptedSubmission ? 'INTERRUPTED SESSION EVALUATED' : 'EXAM COMPLETED'}
          </span>
          <h2>{exam.title || exam.name}</h2>
          <p className="muted">
            {result.interruptedSubmission
              ? 'Your unsubmitted exam was concluded. Attempted answers have been verified and saved to your history.'
              : result.auto
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
            <button
              className="btn primary"
              onClick={() => setShowSolutions(s => !s)}
            >
              {showSolutions ? 'Hide Solutions' : '📖 View Solutions & Explanations'}
            </button>
            <button className="btn dark" onClick={handleResultClose}>
              Return to Dashboard
            </button>
          </div>

          {showSolutions && (
            <div className="solution-review-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '8px' }}>
                <b style={{ fontSize: '14px', color: '#1e293b' }}>Bilingual Questions & Solutions Review</b>
                <div className="lang-selector-group">
                  <button
                    type="button"
                    className={'lang-btn ' + (langMode === 'both' ? 'active' : '')}
                    onClick={() => setLangMode('both')}
                  >
                    Both
                  </button>
                  <button
                    type="button"
                    className={'lang-btn ' + (langMode === 'en' ? 'active' : '')}
                    onClick={() => setLangMode('en')}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    className={'lang-btn ' + (langMode === 'hi' ? 'active' : '')}
                    onClick={() => setLangMode('hi')}
                  >
                    हिन्दी
                  </button>
                </div>
              </div>

              {questions.map((item, idx) => {
                const userAns = answers[item.id] || null;
                const correctAns = cleanAnswer(item.correct_answer);
                const isCorrect = userAns === correctAns;
                const isSkipped = !userAns;
                const cardStatus = isSkipped ? 'skipped' : (isCorrect ? 'correct' : 'wrong');
                const itemQPair = getBilingualPair(item.question, item.question_hi);
                const itemExpPair = getBilingualPair(item.explanation, item.explanation_hi);

                return (
                  <div key={item.id || idx} className={`solution-q-card ${cardStatus}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="pill">Q{idx + 1} · {item.subject || 'General'}</span>
                      <span className={isCorrect ? 'success-badge' : isSkipped ? 'tag' : 'error-badge'}>
                        {isCorrect ? '✓ Correct (+1)' : isSkipped ? '⚪ Skipped (0)' : `✗ Wrong (-${result.negativeMarking})`}
                      </span>
                    </div>

                    {(langMode === 'both' || langMode === 'en' || !itemQPair.hi) && (
                      <h4 style={{ margin: '12px 0 6px', fontSize: '15px', color: '#0f172a' }}>{itemQPair.en}</h4>
                    )}
                    {(langMode === 'both' && itemQPair.hi && itemQPair.hi !== itemQPair.en) && (
                      <div className="question-hi-box" style={{ margin: '6px 0 10px' }}>
                        <span className="lang-tag-hi">हिन्दी प्रश्न</span>
                        <p className="question-hi-text" style={{ fontSize: '14px', margin: 0 }}>{itemQPair.hi}</p>
                      </div>
                    )}
                    {langMode === 'hi' && (
                      <h4 style={{ margin: '12px 0 6px', fontSize: '15px', color: '#0f172a' }}>{itemQPair.hi || itemQPair.en}</h4>
                    )}

                    {/* Options list in review */}
                    <div style={{ marginTop: '8px', display: 'grid', gap: '6px' }}>
                      {['a', 'b', 'c', 'd'].map(letter => {
                        const ltrUpper = letter.toUpperCase();
                        const optPair = getBilingualPair(item[`option_${letter}`], item[`option_${letter}_hi`]);
                        if (!optPair.en && !optPair.hi) return null;
                        const isUserChoice = userAns === ltrUpper;
                        const isCorrectChoice = correctAns === ltrUpper;
                        let optBorder = '#e2e8f0';
                        let optBg = '#fafbfc';
                        if (isCorrectChoice) { optBorder = '#16a16b'; optBg = '#f0fdf4'; }
                        else if (isUserChoice && !isCorrect) { optBorder = '#dc2626'; optBg = '#fef2f2'; }

                        return (
                          <div
                            key={ltrUpper}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: `1px solid ${optBorder}`,
                              background: optBg,
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div>
                              {(langMode === 'both' || langMode === 'en' || !optPair.hi) && (
                                <span><b>{ltrUpper}.</b> {optPair.en || optPair.hi}</span>
                              )}
                              {(langMode === 'both' && optPair.hi && optPair.hi !== optPair.en) && (
                                <span style={{ marginLeft: '10px', color: '#64748b' }}>/ {optPair.hi}</span>
                              )}
                              {langMode === 'hi' && (
                                <span><b>{ltrUpper}.</b> {optPair.hi || optPair.en}</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {isUserChoice && (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: isCorrect ? '#bbf7d0' : '#fecaca', color: isCorrect ? '#14532d' : '#991b1b' }}>
                                  Your Choice
                                </span>
                              )}
                              {isCorrectChoice && (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#bbf7d0', color: '#14532d' }}>
                                  Correct Key
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Step-by-Step Educational Explanation */}
                    {(itemExpPair.en || itemExpPair.hi) && (
                      <div className="solution-explanation-box">
                        <b style={{ display: 'block', fontSize: '12px', color: '#5961df', marginBottom: '6px' }}>
                          💡 Step-by-step Solution & Explanation (विस्तृत हल):
                        </b>
                        {(langMode === 'both' || langMode === 'en' || !itemExpPair.hi) && itemExpPair.en && (
                          <p style={{ margin: '0 0 6px', fontSize: '13px', lineHeight: 1.5, color: '#1e293b' }}>
                            {itemExpPair.en}
                          </p>
                        )}
                        {(langMode === 'both' || langMode === 'hi') && itemExpPair.hi && (
                          <p style={{ margin: '6px 0 0', fontSize: '13px', lineHeight: 1.5, color: '#334155' }}>
                            <span className="lang-tag-hi" style={{ marginRight: '6px' }}>हिन्दी समाधान</span>
                            {itemExpPair.hi}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="lang-selector-group">
              <button
                type="button"
                className={'lang-btn ' + (langMode === 'both' ? 'active' : '')}
                onClick={() => setLangMode('both')}
                title="Bilingual mode (English + Hindi)"
              >
                🌐 Both (द्विभाषी)
              </button>
              <button
                type="button"
                className={'lang-btn ' + (langMode === 'en' ? 'active' : '')}
                onClick={() => setLangMode('en')}
                title="English only"
              >
                English
              </button>
              <button
                type="button"
                className={'lang-btn ' + (langMode === 'hi' ? 'active' : '')}
                onClick={() => setLangMode('hi')}
                title="Hindi only"
              >
                हिन्दी
              </button>
            </div>

            <strong className={time <= 300 ? 'timer danger' : 'timer'}>
              <Clock3 size={18} />
              {String(Math.floor(time / 60)).padStart(2, '0')}:
              {String(time % 60).padStart(2, '0')}
            </strong>

            <button
              type="button"
              className="btn light"
              onClick={() => {
                persistActiveSession();
                close();
              }}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                gap: '5px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}
              title="Pause and safely exit. Your progress and remaining time will be saved."
            >
              <Pause size={13} /> Pause & Exit
            </button>
          </div>
        </div>

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

            {/* Bilingual Question rendering */}
            {(() => {
              const qPair = getBilingualPair(current.question, current.question_hi);
              return (
                <>
                  {(langMode === 'both' || langMode === 'en' || !qPair.hi) && (
                    <h2 className="question-en" style={{ fontSize: '18px', marginTop: '10px' }}>
                      {qPair.en}
                    </h2>
                  )}
                  {(langMode === 'both' && qPair.hi && qPair.hi !== qPair.en) && (
                    <div className="question-hi-box">
                      <span className="lang-tag-hi">हिन्दी प्रश्न</span>
                      <p className="question-hi-text">{qPair.hi}</p>
                    </div>
                  )}
                  {langMode === 'hi' && (
                    <h2 className="question-en" style={{ fontSize: '18px', marginTop: '10px' }}>
                      {qPair.hi || qPair.en}
                    </h2>
                  )}
                </>
              );
            })()}

            {/* Bilingual Options rendering */}
            <div style={{ marginTop: '16px' }}>
              {opts.map(([key, rawText]) => {
                const optPair = getBilingualPair(rawText, current[`option_${key.toLowerCase()}_hi`]);
                const isSelected = answers[current.id] === key;
                return (
                  <label
                    className={'option ' + (isSelected ? 'selected' : '')}
                    key={key}
                  >
                    <input
                      type="radio"
                      name={'q-' + current.id}
                      checked={isSelected}
                      onChange={() => setAnswers(a => ({ ...a, [current.id]: key }))}
                    />
                    <div style={{ flex: 1 }}>
                      {(langMode === 'both' || langMode === 'en' || !optPair.hi) && (
                        <div className="opt-en">
                          <b>{key}.</b> {optPair.en || optPair.hi}
                        </div>
                      )}
                      {(langMode === 'both' && optPair.hi && optPair.hi !== optPair.en) && (
                        <div className="opt-hi" style={{ marginTop: '4px' }}>
                          <span style={{ color: '#5961df', fontWeight: 700 }}>({key})</span> {optPair.hi}
                        </div>
                      )}
                      {langMode === 'hi' && (
                        <div className="opt-en" style={{ fontSize: '15px' }}>
                          <b>{key}.</b> {optPair.hi || optPair.en}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
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
