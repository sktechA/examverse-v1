import React, { useState, useEffect, useRef } from 'react';
import {
  CalendarDays,
  Clock3,
  Calendar,
  CalendarCheck,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Download,
  FileCheck2,
  Info,
  Play
} from 'lucide-react';

const LABELS = {
  en: {
    headerTitle: 'Examination Calendar & Schedule',
    headerSubtitle: 'Verified live and upcoming examinations.',
    officialExam: 'OFFICIAL EXAMINATION',
    cbtMock: 'SKTECH CBT MOCK',
    verifiedBadge: 'Official source verified',
    examDate: 'Exam Date',
    duration: 'Duration',
    mins: 'Minutes',
    applyBy: 'Application Last Date',
    notifNo: 'Notification No.',
    officialGovt: 'Government / Examination Board',
    mockGovt: 'SKTech Exam Portal • Practice Simulation',
    closesIn: 'EXAMINATION CLOSES IN',
    startsIn: 'EXAMINATION STARTS IN',
    concluded: 'EXAMINATION CONCLUDED',
    days: 'Days',
    hours: 'Hours',
    minsLabel: 'Minutes',
    secs: 'Seconds',
    downloadAdmitCard: 'Download Admit Card',
    boardDetails: 'Official Details',
    startMock: 'Start Live Mock',
    practiceMock: 'Practice Past Mock',
    loginToAttempt: 'Login to Attempt Mock',
    prevExam: 'Previous examination',
    nextExam: 'Next examination',
    noExams: 'No featured examination schedules active at this time.'
  },
  hi: {
    headerTitle: 'परीक्षा कैलेंडर एवं समय-सारणी',
    headerSubtitle: 'सत्यापित लाइव और आगामी परीक्षाएं।',
    officialExam: 'आधिकारिक परीक्षा',
    cbtMock: 'एसकेटेक सीबीटी मॉक',
    verifiedBadge: 'सत्यापित आधिकारिक स्रोत',
    examDate: 'परीक्षा तिथि',
    duration: 'अवधि',
    mins: 'मिनट',
    applyBy: 'आवेदन की अंतिम तिथि',
    notifNo: 'अधिसूचना सं.',
    officialGovt: 'सरकारी / परीक्षा बोर्ड',
    mockGovt: 'SKTech Exam Portal • अभ्यास सिमुलेशन',
    closesIn: 'परीक्षा समापन में शेष समय',
    startsIn: 'परीक्षा प्रारंभ में शेष समय',
    concluded: 'परीक्षा संपन्न',
    days: 'दिन',
    hours: 'घंटे',
    minsLabel: 'मिनट',
    secs: 'सेकंड',
    downloadAdmitCard: 'प्रवेश पत्र डाउनलोड करें',
    boardDetails: 'आधिकारिक विवरण',
    startMock: 'लाइव मॉक प्रारंभ करें',
    practiceMock: 'अभ्यास मॉक टेस्ट दें',
    loginToAttempt: 'मॉक टेस्ट हेतु लॉगिन करें',
    prevExam: 'पिछली परीक्षा',
    nextExam: 'अगली परीक्षा',
    noExams: 'इस समय कोई लाइव या आगामी परीक्षा उपलब्ध नहीं है।'
  }
};

/**
 * High-resolution golden & crimson Government of India / Examination Seal
 */
function OfficialEmblem({ size = 68 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="featured-official-emblem"
      aria-label="Official Government Seal"
    >
      <circle cx="40" cy="40" r="38" stroke="#D97706" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.75" />
      <circle cx="40" cy="40" r="35" fill="url(#emblemGoldGrad)" stroke="#B45309" strokeWidth="1" />
      <circle cx="40" cy="40" r="28" fill="#881337" stroke="#FDE68A" strokeWidth="1.5" />
      
      {/* Golden Ashok Stambh / Lion & Star Emblem Silhouette */}
      <path
        d="M40 18L42.5 24H49L44 28L46 34L40 30.5L34 34L36 28L31 24H37.5L40 18Z"
        fill="#FDE68A"
      />
      {/* Central Emblem Pillars / Scales */}
      <rect x="36" y="32" width="8" height="15" rx="1" fill="#FDE68A" opacity="0.95" />
      <line x1="33" y1="36" x2="47" y2="36" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="41" x2="48" y2="41" stroke="#FEF3C7" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="34" cy="38" r="2" fill="#FDE68A" />
      <circle cx="46" cy="38" r="2" fill="#FDE68A" />
      
      {/* Base Ribbon */}
      <path
        d="M24 50C32 48 48 48 56 50L53 54C47 52 33 52 27 54L24 50Z"
        fill="#F59E0B"
        stroke="#78350F"
        strokeWidth="0.75"
      />
      
      {/* Golden Laurels on Sides */}
      <path
        d="M18 42C16 34 20 25 25 21M62 42C64 34 60 25 55 21"
        stroke="#FDE68A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      <defs>
        <linearGradient id="emblemGoldGrad" x1="10" y1="10" x2="70" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="0.5" stopColor="#D97706" />
          <stop offset="1" stopColor="#92400E" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Architectural watermark silhouette of the Parliament / Secretariat
 */
function ArchitecturalWatermark() {
  return (
    <svg
      className="split-card-watermark"
      viewBox="0 0 320 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g opacity="0.08" stroke="#FFFFFF" strokeWidth="1.2">
        <path d="M160 45 C130 45 120 75 120 95 L200 95 C200 75 190 45 160 45 Z" fill="#FFFFFF" fillOpacity="0.04" />
        <line x1="160" y1="30" x2="160" y2="45" strokeWidth="2" />
        <circle cx="160" cy="28" r="3" fill="#FFFFFF" />
        <rect x="110" y="95" width="100" height="15" />
        <line x1="50" y1="110" x2="270" y2="110" strokeWidth="2.5" />
        <line x1="60" y1="110" x2="60" y2="175" strokeWidth="2" />
        <line x1="80" y1="110" x2="80" y2="175" strokeWidth="2" />
        <line x1="100" y1="110" x2="100" y2="175" strokeWidth="2" />
        <line x1="120" y1="110" x2="120" y2="175" strokeWidth="2" />
        <line x1="140" y1="110" x2="140" y2="175" strokeWidth="2" />
        <line x1="160" y1="110" x2="160" y2="175" strokeWidth="2" />
        <line x1="180" y1="110" x2="180" y2="175" strokeWidth="2" />
        <line x1="200" y1="110" x2="200" y2="175" strokeWidth="2" />
        <line x1="220" y1="110" x2="220" y2="175" strokeWidth="2" />
        <line x1="240" y1="110" x2="240" y2="175" strokeWidth="2" />
        <line x1="260" y1="110" x2="260" y2="175" strokeWidth="2" />
        <path d="M40 175 L280 175 L285 190 L35 190 Z" fill="#FFFFFF" fillOpacity="0.04" />
        <rect x="30" y="190" width="260" height="12" />
      </g>
    </svg>
  );
}

export default function FeaturedExamCarousel({
  exams = [],
  now = Date.now(),
  publicMode = false,
  onOpenExam,
  onSelectOfficialExam,
  lang = 'en'
}) {
  const [uiLang, setUiLang] = useState(() => {
    if (lang && LABELS[lang]) return lang;
    try {
      return localStorage.getItem('sktech_lang') || document.documentElement.dataset.lang || 'en';
    } catch {
      return 'en';
    }
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next'); // 'next' | 'prev'
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimerRef = useRef(null);

  // Synchronize language if external event fired
  useEffect(() => {
    const onLangChange = (e) => {
      const v = e?.detail === 'hi' ? 'hi' : 'en';
      setUiLang(v);
    };
    window.addEventListener('sktech-lang', onLangChange);
    return () => window.removeEventListener('sktech-lang', onLangChange);
  }, []);

  // Make sure index is in valid bounds
  const validIndex = exams.length > 0 ? Math.min(currentIndex, exams.length - 1) : 0;
  const activeExam = exams[validIndex];

  // Auto-slide transition: approximately every 4 seconds
  useEffect(() => {
    if (exams.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setSlideDirection('next');
      setCurrentIndex((prev) => (prev + 1) % exams.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [exams.length, isPaused]);

  // Pause temporarily when user interacts
  const triggerInteractionPause = () => {
    setIsPaused(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 7000);
  };

  const handleNext = () => {
    if (exams.length <= 1) return;
    triggerInteractionPause();
    setSlideDirection('next');
    setCurrentIndex((prev) => (prev + 1) % exams.length);
  };

  const handlePrev = () => {
    if (exams.length <= 1) return;
    triggerInteractionPause();
    setSlideDirection('prev');
    setCurrentIndex((prev) => (prev - 1 + exams.length) % exams.length);
  };

  const handleDotClick = (i) => {
    if (i === validIndex || exams.length <= 1) return;
    triggerInteractionPause();
    setSlideDirection(i > validIndex ? 'next' : 'prev');
    setCurrentIndex(i);
  };

  const t = LABELS[uiLang] || LABELS.en;

  const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat(uiLang === 'hi' ? 'hi-IN' : 'en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(d);
    } catch {
      return String(timestamp);
    }
  };

  if (!activeExam) {
    return null;
  }

  // Calculate countdown time for active item
  const examStart = activeExam.exam_date ? new Date(activeExam.exam_date).getTime() : NaN;
  const examEnd = activeExam.exam_end_date ? new Date(activeExam.exam_end_date).getTime() : NaN;

  const isLive = Number.isFinite(examStart) && Number.isFinite(examEnd) && examStart <= now && examEnd > now;
  const isUpcoming = Number.isFinite(examStart) && examStart > now;
  const isConcluded = !isLive && !isUpcoming;

  // Defensive guard: never render an expired examination, even if the parent data
  // refresh is one tick behind the real-time clock.
  if (isConcluded) return null;

  const remainingMs = isLive
    ? Math.max(0, examEnd - now)
    : (isUpcoming ? Math.max(0, examStart - now) : 0);

  // Compute countdown units
  let totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const cdDays = String(days).padStart(2, '0');
  const cdHours = String(hours).padStart(2, '0');
  const cdMinutes = String(minutes).padStart(2, '0');
  const cdSeconds = String(seconds).padStart(2, '0');

  // Verify Admit Card URL strictly without inventing
  const rawAdmitCard = activeExam.official_admit_card_url || activeExam.admit_card_url;
  const hasAdmitCard = Boolean(
    rawAdmitCard &&
    typeof rawAdmitCard === 'string' &&
    rawAdmitCard.trim().startsWith('http')
  );

  const currentDisplayNumber = validIndex + 1;
  const totalDisplayNumber = exams.length;

  return (
    <section
      className="featured-carousel-wrapper"
      id="featured-exam-showcase"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={triggerInteractionPause}
    >
      {/* 1. Header Section: Title, Subtitle, and Right Pagination Controls */}
      <div className="featured-carousel-header">
        <div className="featured-header-left">
          <div className="featured-header-icon-box">
            <CalendarDays size={22} className="featured-header-icon" />
          </div>
          <div>
            <h2 className="featured-header-title">{t.headerTitle}</h2>
            <p className="featured-header-subtitle">{t.headerSubtitle}</p>
          </div>
        </div>

        {/* Top Right Counter & Directional Arrows */}
        <div className="featured-header-nav">
          <span className="featured-header-counter">
            {currentDisplayNumber} / {totalDisplayNumber}
          </span>
          <div className="featured-header-arrow-group">
            <button
              type="button"
              onClick={handlePrev}
              className="featured-header-btn"
              aria-label={t.prevExam}
              disabled={exams.length <= 1}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="featured-header-btn"
              aria-label={t.nextExam}
              disabled={exams.length <= 1}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Carousel Track with Side Floating Arrows (Desktop) */}
      <div className="featured-split-card-stage">
        {/* Left Floating Arrow (Desktop) */}
        {exams.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="featured-floating-arrow arrow-left"
            aria-label={t.prevExam}
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {/* The Split Card */}
        <div
          key={activeExam._id || activeExam.identity_key || validIndex}
          className={`featured-split-card slide-${slideDirection}`}
        >
          {/* =======================================================================
              LEFT SIDE: Deep Navy (#0A192F) with Emblem, Title & Authority
             ======================================================================= */}
          <div className="split-card-left">
            <ArchitecturalWatermark />

            {/* Official Badge Pill */}
            <div className="split-left-top">
              <span className="split-official-badge">
                <ShieldCheck size={14} className="split-badge-icon" />
                <span>{activeExam._origin_type === 'official' ? t.officialExam : t.cbtMock}</span>
              </span>
            </div>

            {/* Emblem and Title Group */}
            <div className="split-left-center">
              <div className="split-emblem-container">
                <OfficialEmblem size={66} />
              </div>
              <div className="split-title-container">
                <h3 className="split-exam-title">
                  {activeExam.title}
                </h3>
                <div className="split-exam-authority">
                  {activeExam.authority || 'Government Examination Authority'}
                  {activeExam.exam_type ? ` • ${activeExam.exam_type}` : ''}
                </div>
              </div>
            </div>

            {/* Official Footer Disclaimer */}
            <div className="split-left-footer">
              <span className="split-govt-text">{activeExam._origin_type === 'official' ? t.officialGovt : t.mockGovt}</span>
            </div>
          </div>

          {/* =======================================================================
              RIGHT SIDE: Clean Light Neutral with Metadata, Countdown & Actions
             ======================================================================= */}
          <div className="split-card-right">
            {/* Metadata 2x2 Grid */}
            <div className="split-metadata-grid">
              {/* Row 1, Col 1: Exam Date */}
              <div className="split-meta-item">
                <div className="split-meta-icon-box">
                  <Calendar size={18} />
                </div>
                <div className="split-meta-text">
                  <span className="split-meta-label">{t.examDate}</span>
                  <strong className="split-meta-val">{formatDate(activeExam.exam_date)}</strong>
                </div>
              </div>

              {/* Row 1, Col 2: Duration */}
              <div className="split-meta-item">
                <div className="split-meta-icon-box">
                  <Clock3 size={18} />
                </div>
                <div className="split-meta-text">
                  <span className="split-meta-label">{t.duration}</span>
                  <strong className="split-meta-val">
                    {activeExam.duration_minutes ? `${activeExam.duration_minutes} ${t.mins}` : '—'}
                  </strong>
                </div>
              </div>

              {/* Row 2, Col 1: Application Last Date */}
              <div className="split-meta-item">
                <div className="split-meta-icon-box">
                  <CalendarCheck size={18} />
                </div>
                <div className="split-meta-text">
                  <span className="split-meta-label">{t.applyBy}</span>
                  <strong className="split-meta-val">
                    {activeExam.application_last_date ? formatDate(activeExam.application_last_date) : '—'}
                  </strong>
                </div>
              </div>

              {/* Row 2, Col 2: Notification Number */}
              <div className="split-meta-item">
                <div className="split-meta-icon-box">
                  <FileText size={18} />
                </div>
                <div className="split-meta-text">
                  <span className="split-meta-label">{t.notifNo}</span>
                  <strong className="split-meta-val" title={activeExam.notification_number || 'Official Gazette'}>
                    {activeExam.notification_number || (uiLang === 'hi' ? 'घोषित नहीं' : 'Not announced')}
                  </strong>
                </div>
              </div>
            </div>

            {/* Countdown Box */}
            <div className="split-countdown-box">
              <div className="split-countdown-header">
                <Clock3 size={15} className="split-clock-icon" />
                <span className="split-countdown-title">
                  {isLive ? t.closesIn : (isUpcoming ? t.startsIn : t.concluded)}
                </span>
              </div>

              {!isConcluded ? (
                <div className="split-countdown-grid">
                  <div className="split-countdown-tile">
                    <span className="split-countdown-num">{cdDays}</span>
                    <span className="split-countdown-unit">{t.days}</span>
                  </div>
                  <div className="split-countdown-tile">
                    <span className="split-countdown-num">{cdHours}</span>
                    <span className="split-countdown-unit">{t.hours}</span>
                  </div>
                  <div className="split-countdown-tile">
                    <span className="split-countdown-num">{cdMinutes}</span>
                    <span className="split-countdown-unit">{t.minsLabel}</span>
                  </div>
                  <div className="split-countdown-tile">
                    <span className="split-countdown-num">{cdSeconds}</span>
                    <span className="split-countdown-unit">{t.secs}</span>
                  </div>
                </div>
              ) : (
                <div className="split-concluded-note">
                  <span>{t.concluded} — {formatDate(activeExam.exam_end_date || activeExam.exam_date)}</span>
                </div>
              )}
            </div>

            {/* Action Buttons Row: Streamlined to Download Admit Card only */}
            {(activeExam._origin_type !== 'official' || hasAdmitCard) && (
              <div className="split-actions-row">
                {activeExam._origin_type === 'official' ? (
                  /* Download Admit Card: Primary direct button when verified official admit-card URL exists */
                  <a
                    href={rawAdmitCard}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="split-btn-primary"
                  >
                    <Download size={16} />
                    <span>{t.downloadAdmitCard}</span>
                  </a>
                ) : (
                  /* CBT Mock Simulator Action */
                  <button
                    type="button"
                    className="split-btn-primary"
                    onClick={() => onOpenExam?.(activeExam._rawMock || activeExam)}
                  >
                    <Play size={16} />
                    <span>
                      {publicMode
                        ? t.loginToAttempt
                        : (activeExam._isLive ? t.startMock : t.practiceMock)}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Floating Arrow (Desktop) */}
        {exams.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="featured-floating-arrow arrow-right"
            aria-label={t.nextExam}
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* 3. Bottom Carousel Pagination Dots */}
      {exams.length > 1 && (
        <div
          className="featured-carousel-dots-row"
          role="tablist"
          aria-label="Featured examination navigation"
        >
          {exams.map((item, i) => (
            <button
              key={item._id || item.identity_key || i}
              type="button"
              className={`featured-carousel-dot ${i === validIndex ? 'active' : ''}`}
              onClick={() => handleDotClick(i)}
              aria-label={`Examination ${i + 1} of ${exams.length}`}
              role="tab"
              aria-selected={i === validIndex}
            />
          ))}
        </div>
      )}
    </section>
  );
}

