import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const VALID_SUBJECTS = [
  'Mathematics', 'Reasoning', 'General Awareness', 'Current Affairs',
  'Banking Awareness', 'Financial Awareness', 'English', 'Hindi',
  'Computer', 'General Science', 'Data Interpretation', 'Indian History',
  'Indian Geography', 'Indian Polity', 'Indian Economy', 'Environment & Ecology',
  'MP GK', 'MP History', 'MP Geography', 'MP Polity', 'MP Economy',
  'Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering',
  'Electronics Engineering', 'Agriculture Engineering', 'Inequality',
  'Syllogism', 'Coding-Decoding', 'Ranking', 'Number Series',
  'Blood Relation', 'Direction', 'Seating', 'Simplification',
  'Profit & Loss', 'Simple Interest', 'Ratio', 'Time & Distance',
  'Time & Work', 'Percentage', 'Computer Knowledge'
];

export const OFFICIAL_SOURCES = [
  {
    name: 'PIB',
    domain: 'pib.gov.in',
    category: 'National & Governance',
    feed_url: 'https://pib.gov.in/RssMain.aspx',
    portal_url: 'https://www.pib.gov.in/PressReleasePage.aspx',
    authority: 'Press Information Bureau, Government of India'
  },
  {
    name: 'RBI',
    domain: 'rbi.org.in',
    category: 'Banking & Financial Awareness',
    feed_url: 'https://rbi.org.in/pressreleases_rss.xml',
    portal_url: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx',
    authority: 'Reserve Bank of India'
  },
  {
    name: 'SEBI',
    domain: 'sebi.gov.in',
    category: 'Economy & Capital Markets',
    feed_url: 'https://www.sebi.gov.in/sebirss.xml',
    portal_url: 'https://www.sebi.gov.in/media-and-notifications/press-releases.html',
    authority: 'Securities and Exchange Board of India'
  },
  {
    name: 'NABARD',
    domain: 'nabard.org',
    category: 'Agriculture & Rural Development',
    feed_url: 'https://www.nabard.org/news-rss.aspx',
    portal_url: 'https://www.nabard.org/',
    authority: 'National Bank for Agriculture and Rural Development'
  },
  {
    name: 'MP Government Portal',
    domain: 'mp.gov.in',
    category: 'Madhya Pradesh State Affairs',
    feed_url: 'https://mp.gov.in/rss',
    portal_url: 'https://mp.gov.in/',
    authority: 'Government of Madhya Pradesh'
  },
  {
    name: 'MPPSC',
    domain: 'mppsc.mp.gov.in',
    category: 'State Exam Notifications',
    feed_url: 'https://mppsc.mp.gov.in/rss',
    portal_url: 'https://mppsc.mp.gov.in/',
    authority: 'Madhya Pradesh Public Service Commission'
  }
];

export function getSupabaseAdmin(req = null) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const key = serviceKey || anonKey;
  console.info('[DB] Supabase config:', JSON.stringify({ url: url ? 'OK' : 'MISSING', service_role_key: serviceKey ? 'OK' : 'MISSING', anon_key: anonKey ? 'OK' : 'MISSING', selected_key: serviceKey ? 'SERVICE_ROLE' : (anonKey ? 'ANON' : 'NONE') }));
  if (!url || !key) return null;
  const headers = {};
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || '';
  if (!serviceKey && authHeader) headers.Authorization = authHeader;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers }
  });
}

let geminiClient = null;
export function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

/**
 * Server-side Admin Authorization Check
 * Protects admin endpoints from public unauthenticated access.
 * Checks Bearer token against Supabase auth and profile role, or CRON_SECRET for scheduler calls.
 */
export async function verifyAdminAuth(req, sb) {
  // Allow internal server-to-server calls within same Node process
  if (req?.isInternal) {
    return { ok: true, isInternal: true, role: 'internal' };
  }

  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const querySecret = req?.query?.secret || req?.body?.cron_secret;

  // Verify CRON_SECRET if configured and provided
  const configuredCronSecret = process.env.CRON_SECRET;
  if (configuredCronSecret) {
    if (token === configuredCronSecret || querySecret === configuredCronSecret) {
      return { ok: true, isCron: true, role: 'cron' };
    }
  }

  if (!token) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Authentication required: missing Bearer authorization token'
    };
  }

  if (!sb) {
    return {
      ok: false,
      statusCode: 503,
      error: 'Database connection unavailable for authorization check'
    };
  }

  try {
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) {
      return {
        ok: false,
        statusCode: 401,
        error: 'Invalid or expired authentication session'
      };
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const allowedRoles = ['admin', 'super_admin', 'question_manager', 'exam_manager', 'content_manager'];
    const isSuperAdminEmail = user.email?.toLowerCase() === 'skt22tripathi@gmail.com';
    const hasRole = profile && allowedRoles.includes(profile.role);

    if (!isSuperAdminEmail && !hasRole) {
      return {
        ok: false,
        statusCode: 403,
        error: 'Access denied: administrator privileges required'
      };
    }

    return { ok: true, user, role: profile?.role || 'admin' };
  } catch (err) {
    return {
      ok: false,
      statusCode: 500,
      error: err.message || 'Authorization verification error'
    };
  }
}

export function normalizeText(s = '') {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

export function cleanAnswer(v = '') {
  const m = String(v || '').trim().match(/^\s*([ABCD])(?:\s*[.)]|\s|$)/i);
  return m ? m[1].toUpperCase() : String(v || '').trim().toUpperCase().slice(0, 1);
}

/**
 * Strict Subject Isolation Matcher
 * Guarantees that Mathematics questions never match Reasoning and vice-versa.
 */
export function isSubjectStrictMatch(qSubject = '', targetSubject = '') {
  const normQ = String(qSubject || '').trim().toLowerCase();
  const normT = String(targetSubject || '').trim().toLowerCase();
  if (!normQ || !normT) return false;

  if (normQ === normT) return true;

  if (normT === 'mathematics') {
    const reasoningKeywords = ['reasoning', 'syllogism', 'inequality', 'blood relation', 'direction', 'seating', 'puzzle', 'coding-decoding', 'ranking'];
    if (reasoningKeywords.some(kw => normQ.includes(kw))) return false;
    return ['quantitative aptitude', 'quant', 'arithmetic', 'maths', 'math'].includes(normQ);
  }

  if (normT === 'reasoning') {
    const mathKeywords = ['mathematics', 'quant', 'arithmetic', 'simplification', 'profit & loss', 'ratio', 'simple interest', 'percentage'];
    if (mathKeywords.some(kw => normQ.includes(kw))) return false;
    return ['logical reasoning', 'general intelligence'].includes(normQ);
  }

  return false;
}

/**
 * Deterministic Question Validation
 * Verifies:
 * 1. Non-empty question, min length 8
 * 2. Exactly four non-empty options A, B, C, D
 * 3. All four options are mutually distinct
 * 4. Correct answer is strictly A, B, C, or D
 * 5. Correct answer matches a non-empty option text
 * 6. If source is required (e.g. Current Affairs), source_url or source_name must exist
 */
export function validateQuestionDeterministic(q, options = {}) {
  const errors = [];
  const questionText = String(q?.question || '').trim();

  if (!questionText) {
    errors.push('Question text is missing');
  } else if (questionText.length < 8) {
    errors.push('Question text is too short (min 8 characters)');
  }

  const optA = String(q?.option_a || '').trim();
  const optB = String(q?.option_b || '').trim();
  const optC = String(q?.option_c || '').trim();
  const optD = String(q?.option_d || '').trim();

  if (!optA) errors.push('Option A is missing');
  if (!optB) errors.push('Option B is missing');
  if (!optC) errors.push('Option C is missing');
  if (!optD) errors.push('Option D is missing');

  // Distinct options check
  const rawOpts = [optA, optB, optC, optD].filter(Boolean);
  const normalizedOpts = rawOpts.map(normalizeText);
  if (new Set(normalizedOpts).size !== rawOpts.length) {
    errors.push('Options must be distinct (duplicate option detected)');
  }

  const ans = cleanAnswer(q?.correct_answer);
  if (!['A', 'B', 'C', 'D'].includes(ans)) {
    errors.push('Correct answer must be strictly A, B, C, or D');
  } else {
    const optMap = { A: optA, B: optB, C: optC, D: optD };
    if (!optMap[ans]) {
      errors.push(`Answer indicates option ${ans} but that option is empty`);
    }
  }

  // Source check if required (Current Affairs)
  if (options.requireSource || q?.subject === 'Current Affairs') {
    const hasSource = !!(q?.source_url || q?.source || q?.source_name);
    if (!hasSource) {
      errors.push('Traceable official source URL is required for Current Affairs');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    cleanedAnswer: ans
  };
}

export function getKolkataDateString(d = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d); // YYYY-MM-DD
}

export function getKolkataTimeString(d = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(d); // HH:mm:ss
}
