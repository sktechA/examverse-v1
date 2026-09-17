import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import url from 'node:url';

// 1. Monkey-patch legacy url.parse using the WHATWG URL standard to eliminate [DEP0169] DeprecationWarning
if (typeof url.parse === 'function') {
  const originalUrlParse = url.parse;
  url.parse = function(urlStr, parseQueryString, slashesDenoteHost) {
    if (typeof urlStr === 'string') {
      try {
        const parsed = new URL(urlStr, 'http://localhost');
        return {
          protocol: parsed.protocol,
          slashes: true,
          auth: parsed.username ? (parsed.password ? `${parsed.username}:${parsed.password}` : parsed.username) : null,
          host: parsed.host,
          port: parsed.port,
          hostname: parsed.hostname,
          hash: parsed.hash,
          search: parsed.search,
          query: parseQueryString ? Object.fromEntries(parsed.searchParams) : (parsed.search ? parsed.search.slice(1) : ''),
          pathname: parsed.pathname,
          path: parsed.pathname + parsed.search,
          href: parsed.href
        };
      } catch (_) {}
    }
    return originalUrlParse.call(this, urlStr, parseQueryString, slashesDenoteHost);
  };
}

// 2. Suppress DEP0169 Node deprecation warnings if emitted by any legacy internals
if (typeof process !== 'undefined' && process.emitWarning) {
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function(warning, ...args) {
    if (typeof warning === 'string' && (warning.includes('DEP0169') || warning.includes('url.parse'))) {
      return;
    }
    if (warning && typeof warning === 'object') {
      if (warning.name === 'DeprecationWarning' && warning.message && warning.message.includes('url.parse')) {
        return;
      }
      if (warning.code === 'DEP0169') {
        return;
      }
    }
    return originalEmitWarning.call(this, warning, ...args);
  };
}

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

export const OFFICIAL_RECRUITMENT_PORTALS = [
  {
    id: 'ibps',
    name: 'IBPS (Institute of Banking Personnel Selection)',
    board: 'IBPS',
    category: 'Banking & Financial Sector',
    portal_url: 'https://www.ibps.in',
    apply_url: 'https://www.ibps.in',
    domain: 'ibps.in',
    authority: 'Institute of Banking Personnel Selection',
    feed_url: 'https://www.ibps.in',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Official centralized recruitment portal for PO/MT, Clerk, Specialist Officers (SO), and Regional Rural Banks (RRB CRP).',
    active_notifications: [
      {
        title: 'IBPS CRP PO/MT & Specialist Officer Recruitment Notifications',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://www.ibps.in'
      },
      {
        title: 'IBPS RRB Officer Scale I, II, III & Office Assistants',
        date: 'Active',
        status: 'Application & Admit Card Live',
        url: 'https://www.ibps.in'
      }
    ]
  },
  {
    id: 'sbi',
    name: 'SBI Careers (State Bank of India)',
    board: 'SBI',
    category: 'Banking & Financial Sector',
    portal_url: 'https://sbi.co.in/web/careers',
    apply_url: 'https://sbi.co.in/web/careers',
    domain: 'sbi.co.in',
    authority: 'State Bank of India Central Recruitment & Promotion Department',
    feed_url: 'https://sbi.co.in/web/careers',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Official recruitment portal for SBI Probationary Officers (PO), Junior Associates (Customer Support & Sales), and Specialist Cadre Officers (SCO).',
    active_notifications: [
      {
        title: 'SBI Junior Associates (Clerical Cadre) Recruitment Notification',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://sbi.co.in/web/careers'
      },
      {
        title: 'SBI Probationary Officers (PO) & Specialist Cadre Officers Drive',
        date: 'Active',
        status: 'Notice / Apply Portal Live',
        url: 'https://sbi.co.in/web/careers'
      }
    ]
  },
  {
    id: 'ssc',
    name: 'SSC (Staff Selection Commission)',
    board: 'SSC',
    category: 'Central Government Staff Selection',
    portal_url: 'https://ssc.gov.in',
    apply_url: 'https://ssc.gov.in',
    domain: 'ssc.gov.in',
    authority: 'Staff Selection Commission, Government of India',
    feed_url: 'https://ssc.gov.in',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'New official portal for Combined Graduate Level (CGL), CHSL (10+2), Multi-Tasking Staff (MTS), Delhi Police / CAPF SI, and GD Constable.',
    active_notifications: [
      {
        title: 'SSC Combined Graduate Level (CGL) Examination Notification',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://ssc.gov.in'
      },
      {
        title: 'SSC Combined Higher Secondary Level (CHSL) & GD Constable Portal',
        date: 'Active',
        status: 'OTR & Apply Portal Live',
        url: 'https://ssc.gov.in'
      }
    ]
  },
  {
    id: 'rrb',
    name: 'Railway Recruitment Boards (RRB)',
    board: 'RRB',
    category: 'Indian Railways',
    portal_url: 'https://www.rrbcdg.gov.in',
    apply_url: 'https://www.rrbapply.gov.in',
    domain: 'rrbcdg.gov.in',
    authority: 'Railway Recruitment Control Board (RRCB), Ministry of Railways',
    feed_url: 'https://www.rrbcdg.gov.in',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Official regional railway recruitment portals & Centralized Online Application Portal (rrbapply.gov.in) for NTPC, ALP, Technicians, JE, and Group D.',
    regional_portals: [
      { region: 'RRB Chandigarh (Nodal)', url: 'https://www.rrbcdg.gov.in' },
      { region: 'RRB Bhopal (West Central / Western)', url: 'https://rrbbhopal.gov.in' },
      { region: 'RRB Prayagraj / Allahabad', url: 'https://rrbald.gov.in' },
      { region: 'RRB Mumbai', url: 'https://rrbmumbai.gov.in' },
      { region: 'Central Online Application Portal', url: 'https://www.rrbapply.gov.in' }
    ],
    active_notifications: [
      {
        title: 'RRB Centralized Employment Notice (CEN) - NTPC (Graduate & Under Graduate)',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://www.rrbapply.gov.in'
      },
      {
        title: 'RRB Assistant Loco Pilot (ALP) & Technicians Recruitment Window',
        date: 'Active',
        status: 'Application & CBT Stage Active',
        url: 'https://www.rrbcdg.gov.in'
      }
    ]
  },
  {
    id: 'mpesb',
    name: 'MPESB / MPPEB (Madhya Pradesh Employees Selection Board)',
    board: 'MPESB',
    category: 'Madhya Pradesh State Exams',
    portal_url: 'https://esb.mp.gov.in',
    apply_url: 'https://esb.mponline.gov.in',
    domain: 'esb.mp.gov.in',
    authority: 'Madhya Pradesh Employees Selection Board (formerly MPPEB / Vyapam), Bhopal',
    feed_url: 'https://esb.mp.gov.in',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Main official portal (esb.mp.gov.in) and official MPOnline application window (esb.mponline.gov.in) for Police Constable, Subedar/SI, Group-3 Sub Engineer, Patwari, and Teacher Eligibility.',
    active_notifications: [
      {
        title: 'MPESB Police Constable (GD / Radio) Recruitment Examination',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://esb.mponline.gov.in'
      },
      {
        title: 'MPESB Group-3 Sub Engineer, Draftsman & Other Equivalent Posts',
        date: 'Active',
        status: 'Rule Book Live / Apply Online',
        url: 'https://esb.mp.gov.in/rulebooks/rule_books.htm'
      },
      {
        title: 'MPESB Subedar & Sub-Inspector (Police Headquarter) Recruitment',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://esb.mponline.gov.in'
      }
    ]
  },
  {
    id: 'mppsc',
    name: 'MPPSC (Madhya Pradesh Public Service Commission)',
    board: 'MPPSC',
    category: 'Madhya Pradesh State Civil Services',
    portal_url: 'https://mppsc.mp.gov.in',
    apply_url: 'https://mppsc.mp.gov.in',
    domain: 'mppsc.mp.gov.in',
    authority: 'Madhya Pradesh Public Service Commission, Residency Area, Indore',
    feed_url: 'https://mppsc.mp.gov.in/rss',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Official portal for State Service Examination (SSE), State Forest Service (SFS), Assistant Professor, Medical Officer, and Mining Inspector.',
    active_notifications: [
      {
        title: 'MPPSC State Service Examination (SSE Prelims / Mains)',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://mppsc.mp.gov.in'
      },
      {
        title: 'MPPSC State Forest Service & Engineering Service Examination',
        date: 'Active',
        status: 'Official Advertisement Live',
        url: 'https://mppsc.mp.gov.in'
      }
    ]
  },
  {
    id: 'upsc',
    name: 'UPSC (Union Public Service Commission)',
    board: 'UPSC',
    category: 'All India & Central Civil Services',
    portal_url: 'https://upsc.gov.in',
    apply_url: 'https://upsconline.nic.in',
    domain: 'upsc.gov.in',
    authority: 'Union Public Service Commission, Dholpur House, New Delhi',
    feed_url: 'https://upsc.gov.in',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Official portal for Civil Services Examination (CSE), Engineering Services (ESE), Combined Defence Services (CDS), NDA/NA, and Central Armed Police Forces (CAPF).',
    active_notifications: [
      {
        title: 'UPSC Civil Services (Preliminary / Main) Examination',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://upsconline.nic.in'
      },
      {
        title: 'UPSC Combined Defence Services (CDS) & NDA Online Application',
        date: 'Active',
        status: 'OTR & Apply Portal Live',
        url: 'https://upsconline.nic.in'
      }
    ]
  }
];


export function getSupabaseAdmin(req = null) {
  let rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  let url = rawUrl;
  if (rawUrl) {
    try {
      url = new URL(rawUrl).origin;
    } catch (_) {
      url = rawUrl;
    }
  }

  // Cross-resolve secret/service-role keys across any naming variation
  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    ''
  ).trim();

  // Populate mutual aliases so downstream scripts/tools never face missing service role keys
  if (secretKey) {
    if (!process.env.SUPABASE_SECRET_KEY) process.env.SUPABASE_SECRET_KEY = secretKey;
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = secretKey;
  }

  const anonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  if (anonKey) {
    if (!process.env.VITE_SUPABASE_ANON_KEY) process.env.VITE_SUPABASE_ANON_KEY = anonKey;
    if (!process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = anonKey;
  }

  const isKeyValid = Boolean(secretKey);
  console.info('[DB] Supabase config:', JSON.stringify({
    url: url ? 'OK' : 'MISSING',
    secret_key: isKeyValid ? 'OK' : 'MISSING',
    service_role_key: isKeyValid ? 'OK' : 'MISSING',
    anon_key: anonKey ? 'OK' : (isKeyValid ? 'RESOLVED_VIA_SERVICE_KEY' : 'MISSING'),
    selected_key: isKeyValid ? 'SERVICE_ROLE' : 'NONE'
  }));

  if (!url || !secretKey) return null;
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

// User-session client: publishable/anon key or admin key used to validate caller JWT.
export function getSupabaseUser(req = null) {
  let rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  let url = rawUrl;
  if (rawUrl) {
    try {
      url = new URL(rawUrl).origin;
    } catch (_) {
      url = rawUrl;
    }
  }

  const key = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  if (!url || !key) return null;
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || '';
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined
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
 * Normalizes user/env model names to official valid Gemini model IDs
 */
export function getNormalizedGeminiModel(rawModel) {
  if (!rawModel) return 'gemini-3.8-flash';
  const clean = String(rawModel).trim().toLowerCase().replace(/\s+/g, '-');
  if (clean.includes('3.8') && clean.includes('flash')) return 'gemini-3.8-flash';
  if (clean.includes('3.1') && clean.includes('pro')) return 'gemini-3.1-pro-preview';
  if (clean.includes('3.1') && clean.includes('flash-lite')) return 'gemini-3.1-flash-lite';
  if (clean.includes('flash')) return 'gemini-flash-latest';
  return clean || 'gemini-3.8-flash';
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
    let user = null;
    const userSb = getSupabaseUser(req);
    if (userSb) {
      try {
        const { data: userData, error: userErr } = await userSb.auth.getUser(token);
        if (!userErr && userData?.user) {
          user = userData.user;
        }
      } catch (_) {}
    }

    // Fallback: verify token using the admin client (sb) which can authenticate user JWTs directly
    if (!user && sb?.auth?.getUser) {
      try {
        const { data: adminUserData, error: adminUserErr } = await sb.auth.getUser(token);
        if (!adminUserErr && adminUserData?.user) {
          user = adminUserData.user;
        }
      } catch (_) {}
    }

    if (!user) {
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

export function cleanAnswer(v = '', options = null) {
  const s = String(v || '').trim();
  // 1. Direct match for A, B, C, D
  const mLetter = s.match(/^\s*(?:\(\s*([ABCD])\s*\)|\[\s*([ABCD])\s*\]|([ABCD]))(?:\s*[.):\-–—]|\s|$)/i);
  if (mLetter) return (mLetter[1] || mLetter[2] || mLetter[3]).toUpperCase();

  // 2. Numbered answers 1 -> A, 2 -> B, 3 -> C, 4 -> D
  const mNum = s.match(/^\s*(?:\(\s*([1-4])\s*\)|\[\s*([1-4])\s*\]|([1-4]))(?:\s*[.):\-–—]|\s|$)/);
  if (mNum) {
    const num = mNum[1] || mNum[2] || mNum[3];
    return { '1': 'A', '2': 'B', '3': 'C', '4': 'D' }[num];
  }

  // 3. Devanagari numerals: १ -> A, २ -> B, ३ -> C, ४ -> D
  const mDev = s.match(/^\s*(?:\(\s*([१२३४])\s*\)|\[\s*([१२३४])\s*\]|([१२३४]))(?:\s*[.):\-–—]|\s|$)/);
  if (mDev) {
    const dev = mDev[1] || mDev[2] || mDev[3];
    return { '१': 'A', '२': 'B', '३': 'C', '४': 'D' }[dev];
  }

  // 4. Devanagari option letters: क -> A, ख -> B, ग -> C, घ -> D
  const mDevChar = s.match(/^\s*(?:\(\s*([कखगघ])\s*\)|\[\s*([कखगघ])\s*\]|([कखगघ]))(?:\s*[.):\-–—]|\s|$)/);
  if (mDevChar) {
    const char = mDevChar[1] || mDevChar[2] || mDevChar[3];
    return { 'क': 'A', 'ख': 'B', 'ग': 'C', 'घ': 'D' }[char];
  }

  // 5. If options map or record is provided, check if string matches option text
  if (options && typeof options === 'object') {
    const normVal = s.toLowerCase().trim();
    for (const letter of ['A', 'B', 'C', 'D']) {
      const key = `option_${letter.toLowerCase()}`;
      const optVal = String(options[key] || options[letter] || '').toLowerCase().trim();
      if (optVal && (normVal === optVal || normVal.startsWith(optVal) || optVal.startsWith(normVal))) {
        return letter;
      }
    }
  }

  const first = s.toUpperCase().slice(0, 1);
  return ['A', 'B', 'C', 'D'].includes(first) ? first : '';
}

/**
 * Puzzle / Seating Arrangement Context Detection (Requirement 6)
 * Detects questions that depend on an arrangement premise and flags them if the premise is missing.
 */
export function hasDependentReference(text = '') {
  const t = String(text || '').trim();
  const patterns = [
    /उसी व्यवस्था के अनुसार/i,
    /दी गई व्यवस्था के अनुसार/i,
    /उपरोक्त व्यवस्था के अनुसार/i,
    /उपर्युक्त व्यवस्था के अनुसार/i,
    /दी गई व्यवस्था में/i,
    /उपरोक्त व्यवस्था में/i,
    /बैठक व्यवस्था के अनुसार/i,
    /पहेली के अनुसार/i,
    /according to the (?:above |given )?arrangement/i,
    /based on the (?:above |given )?arrangement/i,
    /in the (?:above |given )?arrangement/i,
    /which of the following is true according to the arrangement/i,
    /who sits (?:immediately |second |third |fourth )?(?:to the )?(?:left|right) of/i,
    /who sits between/i,
    /who sits opposite/i,
    /who faces/i
  ];
  return patterns.some(p => p.test(t));
}

export function hasPuzzlePremise(text = '') {
  const t = String(text || '').trim();
  const setupPatterns = [
    /(?:eight|seven|six|nine|ten|8|7|6|9|10|\w+)\s+(?:persons|people|friends|members|individuals)\s+.*(?:sitting|seated|around|row|floor|facing)/i,
    /(?:sitting|seated)\s+(?:around|in a row|in a circle|facing center|facing North)/i,
    /(?:आठ|सात|छह|नौ|दस|[0-9]+)\s*(?:व्यक्ति|मित्र|लोग|सदस्य).*?(?:बैठे|पंक्ति|वृत्ताकार|मंजिल|दिशा)/i,
    /(?:वृत्ताकार|मेज|पंक्ति|मंजिल|उत्तर की ओर|दक्षिण की ओर|केंद्र की ओर)\s*मुख/i,
    /(?:study|read) the following information.*answer/i,
    /निम्नलिखित जानकारी का ध्यानपूर्वक अध्ययन/i
  ];
  return setupPatterns.some(p => p.test(t)) || t.length > 250;
}

export function isDependentContextMissing(text = '') {
  if (!hasDependentReference(text)) return false;
  return !hasPuzzlePremise(text);
}

/**
 * Safe Gemini Execution with Timeout Promise and Exponential Backoff Retry (max 3 retries).
 * Handles transient 503 Service Unavailable, 429 rate limits, timeouts, and network errors gracefully.
 */
export async function callGeminiWithRetry(fn, options = {}) {
  const maxRetries = options.maxRetries ?? options.retries ?? 3;
  const initialDelay = options.initialDelayMs ?? options.delayMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 20000;
  const operationName = options.operationName || 'Gemini API call';
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timerId = null;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => {
          const timeoutErr = new Error(`${operationName} timed out after ${timeoutMs}ms`);
          timeoutErr.status = 504;
          timeoutErr.isTimeout = true;
          reject(timeoutErr);
        }, timeoutMs);
      });

      const result = await Promise.race([
        fn(),
        timeoutPromise
      ]);

      if (timerId) clearTimeout(timerId);
      return result;
    } catch (err) {
      if (timerId) clearTimeout(timerId);
      lastError = err;

      const status = err?.status || err?.statusCode || err?.response?.status;
      const msg = String(err?.message || '');
      const is503 = status === 503 || /503|service\s*unavailable/i.test(msg);
      const is429 = status === 429 || /resource_exhausted|quota|429/i.test(msg);

      // Check for hard daily quota exhaustion vs short per-minute rate limit
      const isDailyQuota = /perday|daily\s*quota|per\s*day/i.test(msg);
      let retryDelaySeconds = 0;
      const matchDelay = msg.match(/retry\s*in\s*(\d+(\.\d+)?)s/i) || msg.match(/retryDelay["']?\s*:\s*["']?(\d+)s/i);
      if (matchDelay) {
        retryDelaySeconds = Math.ceil(parseFloat(matchDelay[1]));
      }

      // If hard daily quota is hit or required delay is > 10s, fail fast to avoid serverless timeout and API hammering
      if (isDailyQuota || (is429 && retryDelaySeconds > 10)) {
        err.isQuotaExhausted = true;
        err.retryDelaySeconds = retryDelaySeconds;
        if (!options.silent) {
          console.warn(`[GeminiQuota] ${operationName} quota exhausted (${isDailyQuota ? 'Daily limit' : `Wait ${retryDelaySeconds}s`}). Aborting rapid retries.`);
        }
        break;
      }

      const isTransient = is503 ||
        is429 ||
        err?.isTimeout ||
        /timeout|timed\s*out|ETIMEDOUT|ECONNRESET|unavailable|overloaded/i.test(msg);

      if (!isTransient || attempt === maxRetries) {
        if (!options.silent) {
          console.warn(`[GeminiRetry] ${operationName} final failure on attempt ${attempt + 1}/${maxRetries + 1}:`, msg);
        }
        break;
      }

      let backoff = initialDelay * Math.pow(2, attempt);
      if (retryDelaySeconds > 0 && retryDelaySeconds <= 10) {
        backoff = Math.max(backoff, retryDelaySeconds * 1000);
      }
      if (!options.silent) {
        console.warn(`[GeminiRetry] ${operationName} encountered recoverable error on attempt ${attempt + 1}/${maxRetries + 1} (${msg}). Retrying in ${backoff}ms...`);
      }
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastError;
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
 * Distractor Fixer & Distinct Option Remapper
 * Detects duplicate options across A, B, C, D.
 * If any distractor option duplicates an existing option, it automatically generates
 * a distinct, plausible replacement distractor (e.g. if Option B is '1' and Option C is '1',
 * Option C is remapped to a unique distinct value such as '6').
 * Crucially preserves the correct answer's exact text and meaning.
 */
export function fixDuplicateOptions(questionObj) {
  if (!questionObj || typeof questionObj !== 'object') return questionObj;

  const letters = ['A', 'B', 'C', 'D'];
  const originalAns = cleanAnswer(questionObj.correct_answer);
  const targetAnsLetter = ['A', 'B', 'C', 'D'].includes(originalAns) ? originalAns : 'A';

  // Extract raw option strings
  const rawOptions = {
    A: String(questionObj.option_a ?? '').trim(),
    B: String(questionObj.option_b ?? '').trim(),
    C: String(questionObj.option_c ?? '').trim(),
    D: String(questionObj.option_d ?? '').trim()
  };

  const rawOptionsHi = {
    A: questionObj.option_a_hi ? String(questionObj.option_a_hi).trim() : null,
    B: questionObj.option_b_hi ? String(questionObj.option_b_hi).trim() : null,
    C: questionObj.option_c_hi ? String(questionObj.option_c_hi).trim() : null,
    D: questionObj.option_d_hi ? String(questionObj.option_d_hi).trim() : null
  };

  const correctText = rawOptions[targetAnsLetter] || '';

  // Helper: check if duplicate exists
  const normalizedSet = new Set();
  let hasDuplicate = false;
  for (const letter of letters) {
    const val = rawOptions[letter];
    if (!val) continue;
    const norm = normalizeText(val);
    if (normalizedSet.has(norm)) {
      hasDuplicate = true;
      break;
    }
    normalizedSet.add(norm);
  }

  // If already 4 distinct non-empty options, return original unmodified
  if (!hasDuplicate && letters.every(l => Boolean(rawOptions[l]))) {
    return questionObj;
  }

  // We need to resolve duplicate distractors while strictly protecting the correct answer option!
  const usedNormalized = new Set();
  const usedRawValues = new Set();

  // 1. Lock the correct answer option first
  const fixedOptions = { ...rawOptions };
  const fixedOptionsHi = { ...rawOptionsHi };

  if (correctText) {
    usedNormalized.add(normalizeText(correctText));
    usedRawValues.add(correctText.toLowerCase());
  }

  // Detect numeric pattern if options are mostly numbers
  const numericValues = [];
  let prefix = '';
  let suffix = '';

  for (const letter of letters) {
    const text = rawOptions[letter];
    const match = text.match(/^([^\d\-+.]*?)([+-]?\d+(?:\.\d+)?)([^\d.]*?)$/);
    if (match) {
      const num = parseFloat(match[2]);
      if (!isNaN(num)) {
        numericValues.push(num);
        if (!prefix && match[1]) prefix = match[1];
        if (!suffix && match[3]) suffix = match[3];
      }
    }
  }

  const isPredominantlyNumeric = numericValues.length >= 2;
  const existingNumbers = new Set(numericValues);

  function getUniqueNumericDistractor() {
    const maxVal = existingNumbers.size ? Math.max(...existingNumbers) : 10;
    const minVal = existingNumbers.size ? Math.min(...existingNumbers) : 1;
    // Step size based on values
    const step = maxVal > 50 ? 5 : (maxVal > 10 ? 2 : 1);
    
    // Candidates derived from existing numbers
    const candidates = [];
    for (const num of [...existingNumbers]) {
      candidates.push(num + step);
      candidates.push(num + step * 2);
      candidates.push(num + step * 3);
      if (num - step > 0) candidates.push(num - step);
      if (num - step * 2 > 0) candidates.push(num - step * 2);
      candidates.push(num * 2);
      candidates.push(num + 5);
      candidates.push(num + 6);
    }
    // General fallback sequence
    for (let c = 1; c <= 200; c++) {
      candidates.push(c);
      candidates.push(c * step);
    }

    for (const cand of candidates) {
      if (!existingNumbers.has(cand) && cand > 0) {
        existingNumbers.add(cand);
        const formatted = Number.isInteger(cand) ? cand.toString() : cand.toFixed(1);
        const candidateStr = `${prefix}${formatted}${suffix}`.trim();
        const norm = normalizeText(candidateStr);
        if (!usedNormalized.has(norm) && !usedRawValues.has(candidateStr.toLowerCase())) {
          return candidateStr;
        }
      }
    }
    // Absolute fallback
    const fallbackNum = (maxVal || 10) + 6;
    existingNumbers.add(fallbackNum);
    return `${prefix}${fallbackNum}${suffix}`.trim();
  }

  // Textual distractor banks for non-numeric options
  const genericDistractors = [
    'None of the above',
    'Cannot be determined',
    'Both A and B',
    'Neither A nor B',
    'Information insufficient',
    'Partially correct'
  ];

  // 2. Iterate through all other options (distractors)
  for (const letter of letters) {
    if (letter === targetAnsLetter) continue; // Skip correct answer

    let curVal = fixedOptions[letter];
    const norm = normalizeText(curVal);

    if (!curVal || usedNormalized.has(norm) || usedRawValues.has(curVal.toLowerCase())) {
      // Need a replacement distinct value
      let replacement = '';
      if (isPredominantlyNumeric) {
        replacement = getUniqueNumericDistractor();
      } else {
        // Look for unused textual distractor
        for (const cand of genericDistractors) {
          const candNorm = normalizeText(cand);
          if (!usedNormalized.has(candNorm) && !usedRawValues.has(cand.toLowerCase())) {
            replacement = cand;
            break;
          }
        }
        if (!replacement) {
          let count = 1;
          while (!replacement) {
            const cand = `${curVal || 'Option'} (Alternative ${count})`;
            const candNorm = normalizeText(cand);
            if (!usedNormalized.has(candNorm)) {
              replacement = cand;
            }
            count++;
          }
        }
      }

      fixedOptions[letter] = replacement;
      if (fixedOptionsHi[letter] && fixedOptionsHi[letter] === fixedOptionsHi[targetAnsLetter]) {
        fixedOptionsHi[letter] = replacement; // Synchronize Hindi option if present
      }
      usedNormalized.add(normalizeText(replacement));
      usedRawValues.add(replacement.toLowerCase());
    } else {
      usedNormalized.add(norm);
      usedRawValues.add(curVal.toLowerCase());
    }
  }

  return {
    ...questionObj,
    option_a: fixedOptions.A,
    option_b: fixedOptions.B,
    option_c: fixedOptions.C,
    option_d: fixedOptions.D,
    option_a_hi: fixedOptionsHi.A,
    option_b_hi: fixedOptionsHi.B,
    option_c_hi: fixedOptionsHi.C,
    option_d_hi: fixedOptionsHi.D,
    correct_answer: targetAnsLetter
  };
}

/**
 * Random Option Distribution & Shuffler
 * Prevents option bias (where correct answers stack up mostly on Option A).
 * Re-maps options A, B, C, D to a uniform random distribution or designated target letter,
 * while automatically updating correct_answer and Hindi options to stay 100% synchronized.
 */
export function distributeQuestionOptions(questionObj, targetLetter = null) {
  if (!questionObj || typeof questionObj !== 'object') return questionObj;

  const letters = ['A', 'B', 'C', 'D'];
  const currentAnswer = cleanAnswer(questionObj.correct_answer);
  if (!letters.includes(currentAnswer)) return questionObj;

  // Choose target letter: provided or uniformly random from A, B, C, D
  const destinationLetter = targetLetter && letters.includes(targetLetter)
    ? targetLetter
    : letters[Math.floor(Math.random() * letters.length)];

  if (destinationLetter === currentAnswer) {
    return questionObj;
  }

  // Swap current answer slot with destinationLetter slot
  const newObj = { ...questionObj };
  const currLow = currentAnswer.toLowerCase();
  const destLow = destinationLetter.toLowerCase();

  const tempEn = newObj[`option_${currLow}`];
  newObj[`option_${currLow}`] = newObj[`option_${destLow}`];
  newObj[`option_${destLow}`] = tempEn;

  if (newObj[`option_${currLow}_hi`] !== undefined || newObj[`option_${destLow}_hi`] !== undefined) {
    const tempHi = newObj[`option_${currLow}_hi`];
    newObj[`option_${currLow}_hi`] = newObj[`option_${destLow}_hi`];
    newObj[`option_${destLow}_hi`] = tempHi;
  }

  newObj.correct_answer = destinationLetter;
  return newObj;
}

/**
 * Combined Option Deduplication, Distractor Repair, and Answer Distribution
 * Ensures options are 100% unique and correct answer is distributed across A/B/C/D.
 */
export function resolveOptionDuplicatesAndDistribute(questionObj, options = {}) {
  if (!questionObj || typeof questionObj !== 'object') return questionObj;
  
  // 1. Resolve duplicates / distractor collisions first
  const fixed = fixDuplicateOptions(questionObj);

  // 2. Distribute answer evenly across A, B, C, D (unless distribute is explicitly false)
  if (options.distribute !== false) {
    return distributeQuestionOptions(fixed, options.targetLetter || null);
  }
  return fixed;
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
    // Options must be distinct (duplicate option detected)
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

  // Dependent context check (Requirement 6)
  if (isDependentContextMissing(questionText)) {
    errors.push('Missing puzzle/arrangement context (dependent question without arrangement details)');
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

export function withApiLogging(handler, routeName = 'api') {
  return async function(req, res) {
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(`[${routeName}] API Error:`, err);
      if (res && typeof res.status === 'function' && !res.headersSent) {
        return res.status(500).json({ error: err?.message || 'Internal Server Error' });
      }
      throw err;
    }
  };
}

/**
 * Robust JSON parser for LLM responses.
 * Automatically strips markdown code fences, leading/trailing non-JSON noise,
 * and extracts the outermost JSON payload without throwing SyntaxErrors.
 */
export function cleanJsonParse(text, fallback = {}) {
  if (!text) return fallback;
  if (typeof text === 'object') return text;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(s);
  } catch (_) {
    const firstBrace = s.indexOf('{');
    const lastBrace = s.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(s.slice(firstBrace, lastBrace + 1));
      } catch (_) {}
    }
    const firstBracket = s.indexOf('[');
    const lastBracket = s.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(s.slice(firstBracket, lastBracket + 1));
      } catch (_) {}
    }
    return fallback;
  }
}

/**
 * Standard CORS & HTTP Preflight (OPTIONS) Handler
 * Sets permissive headers for API calls from web clients, and immediately finishes OPTIONS requests.
 */
export function handleCorsAndOptions(req, res, allowedMethods = ['GET', 'POST', 'OPTIONS']) {
  if (!res || typeof res.setHeader !== 'function') return false;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
  if (req?.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.status(204).end();
    } else if (typeof res.writeHead === 'function') {
      res.writeHead(204);
      res.end();
    }
    return true;
  }
  return false;
}

/**
 * WHATWG-compliant query parameter parser
 * Fallback parser using modern WHATWG URL API instead of deprecated url.parse
 */
export function getQueryParams(req) {
  if (req?.query && typeof req.query === 'object') return req.query;
  try {
    const urlObj = new URL(req?.url || '', 'http://localhost');
    return Object.fromEntries(urlObj.searchParams.entries());
  } catch (_) {
    return {};
  }
}

