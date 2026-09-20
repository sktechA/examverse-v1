import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';

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
    name: 'MEA',
    domain: 'mea.gov.in',
    category: 'National & International Current Affairs (Summits, Treaties)',
    feed_url: 'https://mea.gov.in/rss.xml',
    portal_url: 'https://www.mea.gov.in',
    authority: 'Ministry of External Affairs, Government of India'
  },
  {
    name: 'DPIIT',
    domain: 'dpiit.gov.in',
    category: 'Industrial Partnerships & Foreign Investment',
    feed_url: 'https://dpiit.gov.in/rss.xml',
    portal_url: 'https://dpiit.gov.in',
    authority: 'Department for Promotion of Industry and Internal Trade'
  },
  {
    name: 'MPIDC (Invest MP)',
    domain: 'mpidc.co.in',
    category: 'State Special Topics (Madhya Pradesh policies, industrial models, infrastructure)',
    feed_url: 'https://mpidc.co.in/rss',
    portal_url: 'https://mpidc.co.in',
    authority: 'MP Industrial Development Corporation & Invest MP'
  },
  {
    name: 'PRS Legislative Research',
    domain: 'prsindia.org',
    category: 'Governance, Public Welfare & New Legislative Rules',
    feed_url: 'https://prsindia.org/rss.xml',
    portal_url: 'https://prsindia.org',
    authority: 'PRS Legislative Research & Parliamentary Affairs'
  },
  {
    name: 'RBI',
    domain: 'rbi.org.in',
    category: 'Banking, Financial Sector & Economic Impacts',
    feed_url: 'https://rbi.org.in/pressreleases_rss.xml',
    portal_url: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx',
    authority: 'Reserve Bank of India'
  },
  {
    name: 'Ministry of Finance',
    domain: 'finmin.nic.in',
    category: 'Banking, Financial Sector & Economic Impacts',
    feed_url: 'https://finmin.nic.in/rss',
    portal_url: 'https://finmin.nic.in',
    authority: 'Ministry of Finance, Government of India'
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
    name: 'DIPR Madhya Pradesh (MP Info)',
    domain: 'mpinfo.org',
    category: 'State Special Topics (Madhya Pradesh policies, industrial models, infrastructure)',
    feed_url: 'https://mpinfo.org/rss',
    portal_url: 'https://mpinfo.org',
    authority: 'Directorate of Public Relations, Government of Madhya Pradesh'
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
    name: 'MPPSC & MPESB',
    domain: 'mppsc.mp.gov.in',
    category: 'State Exam Notifications',
    feed_url: 'https://mppsc.mp.gov.in/rss',
    portal_url: 'https://mppsc.mp.gov.in/',
    authority: 'Madhya Pradesh Public Service Commission & MPESB'
  },
  {
    name: 'NITI Aayog',
    domain: 'niti.gov.in',
    category: 'Governance, Public Welfare & New Legislative Rules',
    feed_url: 'https://niti.gov.in/rss',
    portal_url: 'https://niti.gov.in',
    authority: 'NITI Aayog (National Institution for Transforming India)'
  }
];

export const OFFICIAL_GROUNDED_MILESTONES = [
  {
    external_id: 'official:mea:summit-japan-india-2026',
    title: 'India-Japan Annual Summit & Global Strategic Partnership Agreement',
    summary: 'India and Japan concluded high-level bilateral summits committing to a 5-trillion yen investment target over five years, enhancing semiconductor supply chain resilience, green hydrogen technology corridors, and expanding technical skills transfer for industrial engineering and automation.',
    source_name: 'MEA',
    source_url: 'https://www.mea.gov.in/bilateral-documents.htm?51/Japan_India_Summit',
    category: 'National & International Current Affairs (Summits, Treaties)',
    subject: 'Current Affairs',
    topic: 'International Summits & Treaties',
    published_at: '2026-03-12T10:00:00.000Z',
    event_date: '2026-03-12',
    domain: 'mea.gov.in',
    authority: 'Ministry of External Affairs, Government of India',
    exam_relevance: 'MP Sub-Engineer CBT, MPPSC & UPSC General Studies (International Treaties)'
  },
  {
    external_id: 'official:mpidc:japan-mp-industrial-model',
    title: 'Japan-Madhya Pradesh Industrial Investment Model & Pithampur-Mandideep Corridor',
    summary: 'Under the bilateral industrial cooperation framework between the Government of Madhya Pradesh and Japanese industrial agencies (JETRO & JICA), a dedicated Japan-MP Industrial Model was formalized across Pithampur Special Economic Zone and Mandideep Industrial Growth Centre. The model establishes plug-and-play smart factory spaces, sustainable industrial water grid recycling, single-window environmental compliance, and skill centers for mechanical and electrical engineering disciplines.',
    source_name: 'MPIDC (Invest MP)',
    source_url: 'https://mpidc.co.in/policies-and-initiatives/japan-mp-industrial-model',
    category: 'State Special Topics (Madhya Pradesh policies, industrial models, infrastructure)',
    subject: 'MP GK',
    topic: 'MP Industrial Policies & Foreign Collaborations',
    published_at: '2026-04-18T09:30:00.000Z',
    event_date: '2026-04-18',
    domain: 'mpidc.co.in',
    authority: 'MP Industrial Development Corporation & Invest MP',
    exam_relevance: 'MP Sub-Engineer CBT (Civil/Mech/Elec), MPPSC State Engineering Services & MP GK'
  },
  {
    external_id: 'official:mp:ken-betwa-link-project',
    title: 'Ken-Betwa River Interlinking National Project (KBLP) Phase-I Engineering Progress',
    summary: 'The flagship Ken-Betwa River Link Project (KBLP), India’s pioneer national river-interlinking project, reached milestone canal excavation across Bundelkhand. With the Daudhan Dam, a 221 km link canal, 103 MW hydro-power and 27 MW solar power components, the project provides irrigation to 10.62 lakh hectares and clean drinking water to 62 lakh residents across Chhatarpur, Tikamgarh, and Panna districts of Madhya Pradesh.',
    source_name: 'MP Government Portal',
    source_url: 'https://mp.gov.in/departments/water-resources/kblp-milestone',
    category: 'State Special Topics (Madhya Pradesh policies, industrial models, infrastructure)',
    subject: 'MP GK',
    topic: 'MP Major River Projects & Civil Infrastructure',
    published_at: '2026-02-10T11:00:00.000Z',
    event_date: '2026-02-10',
    domain: 'mp.gov.in',
    authority: 'Government of Madhya Pradesh & Ministry of Jal Shakti',
    exam_relevance: 'MP Sub-Engineer CBT (Civil Engineering & MP GK)'
  },
  {
    external_id: 'official:rbi:unified-lending-interface-cbdc',
    title: 'RBI Launches Unified Lending Interface (ULI) and Expands Retail Digital Rupee (e-Rupee)',
    summary: 'The Reserve Bank of India officially launched the Unified Lending Interface (ULI) to facilitate frictionless credit evaluation to MSMEs, dairy farmers, and infrastructure contractors using verifiable consent-based financial data architecture. Alongside, RBI expanded retail CBDC (e-Rupee) cross-border transaction protocols with major Asian trade corridors.',
    source_name: 'RBI',
    source_url: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=58312',
    category: 'Banking, Financial Sector & Economic Impacts',
    subject: 'Banking Awareness',
    topic: 'Digital Public Infrastructure & Monetary Technology',
    published_at: '2026-01-22T08:00:00.000Z',
    event_date: '2026-01-22',
    domain: 'rbi.org.in',
    authority: 'Reserve Bank of India',
    exam_relevance: 'IBPS RRB, SBI PO, SSC CGL & MP Sub-Engineer General Awareness'
  },
  {
    external_id: 'official:prs:bns-dpdp-governance-enforcement',
    title: 'Enactment of Bharatiya Nyaya Sanhita and Digital Personal Data Protection (DPDP) Rules',
    summary: 'Parliamentary and statutory gazette notification enforcing Bharatiya Nyaya Sanhita (BNS) alongside the Digital Personal Data Protection (DPDP) Rules, establishing statutory standards for digital citizen consent, forensic evidence handling in state governance, and stringent penalties for data fiduciaries.',
    source_name: 'PRS Legislative Research',
    source_url: 'https://prsindia.org/billtrack/the-bharatiya-nyaya-sanhita-2023',
    category: 'Governance, Public Welfare & New Legislative Rules',
    subject: 'General Awareness',
    topic: 'Constitutional Governance & Modern Legal Reforms',
    published_at: '2025-11-15T12:00:00.000Z',
    event_date: '2025-11-15',
    domain: 'prsindia.org',
    authority: 'PRS Legislative Research & Ministry of Law and Justice',
    exam_relevance: 'MPPSC, MP Sub-Engineer General Knowledge & SSC CGL'
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


export function createResilientMockClient() {
  const mockChain = () => {
    const chain = {
      eq: () => chain,
      neq: () => chain,
      lt: () => chain,
      lte: () => chain,
      gt: () => chain,
      gte: () => chain,
      like: () => chain,
      ilike: () => chain,
      in: () => chain,
      is: () => chain,
      order: () => chain,
      limit: () => chain,
      range: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      then: (resolve) => resolve({ data: [], error: null })
    };
    return chain;
  };

  return {
    from: () => ({
      select: () => mockChain(),
      insert: async () => ({ data: null, error: null }),
      update: () => mockChain(),
      delete: () => mockChain(),
      upsert: async () => ({ data: null, error: null })
    }),
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null })
    },
    rpc: async () => ({ data: null, error: null })
  };
}

export function getSupabaseAdmin(req = null) {
  // If caller already attached an instantiated client, use it directly
  if (req?.supabaseClient) return req.supabaseClient;
  if (req?.sb) return req.sb;

  let rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  let url = rawUrl;
  if (rawUrl) {
    try {
      url = new URL(rawUrl).origin;
    } catch (_) {
      url = rawUrl;
    }
  }

  // Privileged server client: NEVER fall back to a browser publishable/anon key.
  // SUPABASE_SECRET_KEY is preferred for the modern Supabase secret key; the
  // legacy service-role names remain supported for existing deployments.
  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    ''
  ).trim();

  console.info('[DB] Supabase config:', JSON.stringify({
    url: url ? 'OK' : 'MISSING',
    privileged_key: secretKey ? 'OK' : 'MISSING'
  }));

  if (!url || !secretKey) {
    return createResilientMockClient();
  }

  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  };

  try {
    return createClient(url, secretKey, options);
  } catch (err) {
    console.error('[DB] Failed to create Supabase client:', err.message);
    return createResilientMockClient();
  }
}

// User-session client: browser-safe publishable/anon key used to validate the caller JWT.
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
 * Security, Sanitization & Autonomous Defense Utilities
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length >= 5 && trimmed.length <= 254 && EMAIL_REGEX.test(trimmed);
}

export function sanitizeString(val, maxLength = 1000) {
  if (val === null || val === undefined) return '';
  let s = String(val).replace(/\0/g, ''); // Strip null-byte injection
  // Strip dangerous script tags / event handlers / javascript: pseudo-protocols
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/javascript\s*:/gi, '');
  s = s.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  return s.trim().slice(0, maxLength);
}

/**
 * Strips prototype pollution keys (__proto__, constructor, prototype) recursively
 */
export function sanitizeObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 2000).map(item => sanitizeObject(item, depth + 1));
  }
  const clean = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue; // Block prototype pollution vectors
    }
    if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeObject(value, depth + 1);
    } else if (typeof value === 'string') {
      clean[key] = value.replace(/\0/g, '');
    } else {
      clean[key] = value;
    }
  }
  return { ...clean };
}

/**
 * Constant-time string comparison to prevent side-channel timing attacks
 */
export function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length === 0 || bufB.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts normalized client IP address from request headers
 */
export function getClientIp(req) {
  if (!req) return '127.0.0.1';
  const xForwardedFor = req.headers?.['x-forwarded-for'];
  if (xForwardedFor) {
    const firstIp = String(xForwardedFor).split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers?.['x-real-ip'];
  if (realIp) return String(realIp).trim();
  const remoteAddr = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (remoteAddr) {
    if (remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1') return '127.0.0.1';
    return String(remoteAddr).trim();
  }
  return '127.0.0.1';
}

/**
 * In-memory sliding-window Token Bucket Rate Limiter
 * Autonomously defends against volumetric flooding and brute-force attacks.
 */
const rateLimitStore = new Map();

// Periodic prune to prevent memory leaks
if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime + 30000) {
        rateLimitStore.delete(key);
      }
    }
  }, 120000);
  if (typeof timer?.unref === 'function') {
    timer.unref();
  }
}

export function checkRateLimit(ip = '127.0.0.1', bucket = 'global', maxRequests = 120, windowMs = 60000) {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  let record = rateLimitStore.get(key);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(key, record);
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
  }
  record.count++;
  if (record.count > maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: maxRequests - record.count, retryAfter: 0 };
}

/**
 * Sanitizes and shields error messages returned to clients.
 * Prevents internal PostgreSQL schemas, constraint names, stack traces, and tokens from leaking.
 */
export function sanitizeErrorResponse(err, defaultMessage = 'An internal processing error occurred. Please try again later.') {
  if (!err) return defaultMessage;
  const raw = typeof err === 'string' ? err : (err.message || String(err));
  
  // Detect database schema exposure, stack traces, or secret leaks
  const isSensitive = /relation\s+["']|column\s+["']|syntax error at|foreign key constraint|password|secret|key=|bearer|pg_|postgresql|auth\.users|stack|at\s+\S+\s+\(/i.test(raw);
  if (isSensitive) {
    return defaultMessage;
  }
  // Strip multi-line messages, file system paths, or node_modules
  if (raw.includes('\n') || raw.includes('/app/') || raw.includes('node_modules')) {
    return defaultMessage;
  }
  return raw.slice(0, 180);
}

/**
 * Verifies whether an authenticated context has full admin privileges (super_admin, admin, or system owner).
 */
export function isSuperOrAdminRole(auth) {
  if (!auth || !auth.ok) return false;
  if (auth.isInternal || auth.role === 'cron') return true;
  if (auth.role === 'admin' || auth.role === 'super_admin') return true;
  if (auth.user?.email && auth.user.email.toLowerCase() === 'skt22tripathi@gmail.com') return true;
  return false;
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

  // Verify CRON_SECRET if configured and provided using timing-safe comparison
  const configuredCronSecret = (process.env.CRON_SECRET || '').trim();
  if (configuredCronSecret.length >= 8) {
    if (token && timingSafeCompare(token, configuredCronSecret)) {
      return { ok: true, isCron: true, role: 'cron' };
    }
    if (querySecret && timingSafeCompare(String(querySecret), configuredCronSecret)) {
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

    return { ok: true, user, role: profile?.role || (isSuperAdminEmail ? 'super_admin' : 'admin') };
  } catch (err) {
    return {
      ok: false,
      statusCode: 500,
      error: 'Authorization verification service error'
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

/**
 * Computes a deterministic normalized text hash of a question and its options (A, B, C, D).
 * Accurately detects duplicates even across subtle spacing, casing, or punctuation differences.
 */
export function computeQuestionNormalizedHash(q = {}) {
  if (!q || typeof q !== 'object') return '';
  const normQ = normalizeText(q.question || '');
  const normA = normalizeText(q.option_a || '');
  const normB = normalizeText(q.option_b || '');
  const normC = normalizeText(q.option_c || '');
  const normD = normalizeText(q.option_d || '');
  const payload = `${normQ}|${normA}|${normB}|${normC}|${normD}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Checks if a question is already present in the database or an in-memory active hash set.
 * Returns true if duplicate exists, false otherwise.
 */
export async function isQuestionDuplicateInDb(sb, questionObj, activeHashSet = null) {
  if (!questionObj || typeof questionObj !== 'object') return true;
  const normHash = computeQuestionNormalizedHash(questionObj);
  const legacyHash = crypto.createHash('sha256')
    .update(`${questionObj.question || ''}:${questionObj.option_a || ''}:${questionObj.correct_answer || ''}`)
    .digest('hex');

  if (activeHashSet) {
    if (activeHashSet.has(normHash) || activeHashSet.has(legacyHash)) {
      return true;
    }
  }

  if (!sb) return false;

  try {
    const { data: exactMatch } = await sb
      .from('questions')
      .select('id')
      .eq('content_hash', normHash)
      .maybeSingle();

    if (exactMatch) {
      return true;
    }

    if (legacyHash && legacyHash !== normHash) {
      const { data: legacyMatch } = await sb
        .from('questions')
        .select('id')
        .eq('content_hash', legacyHash)
        .maybeSingle();

      if (legacyMatch) {
        return true;
      }
    }

    // Secondary check: verify if the normalized question text already exists
    const cleanQ = normalizeText(questionObj.question || '');
    if (cleanQ && cleanQ.length > 15) {
      const qPrefix = cleanQ.slice(0, 45);
      const { data: textMatches } = await sb
        .from('questions')
        .select('id, question, option_a, option_b, option_c, option_d')
        .ilike('question', `%${qPrefix}%`)
        .limit(10);

      if (textMatches && textMatches.length > 0) {
        for (const tm of textMatches) {
          if (computeQuestionNormalizedHash(tm) === normHash) {
            return true;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Duplicate Check Warning]:', err?.message);
  }

  return false;
}

/**
 * Normalizes option values for strict duplication checks.
 * Equates numeric variants (e.g. .1, 0.1, 0.10, +.1, Rs. .1 vs Rs. 0.1, 10% vs 10 %)
 * and textual equivalents while preserving semantically distinct values.
 */
export function normalizeOptionValue(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s) return '';

  const clean = s
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Fraction check: 1/2, 3/4, etc.
  const fracMatch = clean.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]);
    const den = parseFloat(fracMatch[2]);
    if (den !== 0) {
      const val = num / den;
      return 'num::' + (Math.abs(val) < 1e-12 ? 0 : val.toFixed(6).replace(/\.?0+$/, '')) + ':';
    }
  }

  // Numeric check with optional currency prefix and unit/percent suffix
  // Supports: .1, 0.1, 0.10, +.1, -.1, Rs. .1, Rs. 0.1, 10%, 10 %, 1.0, 1, etc.
  const numMatch = clean.match(/^(.*?)([+-]?(?:\d+(?:\.\d+)?|\.\d+))([^0-9.]*)$/);
  if (numMatch) {
    let rawPrefix = numMatch[1].replace(/[^a-z\u0900-\u097F₹]/g, '').trim();
    const rawVal = parseFloat(numMatch[2]);
    let rawSuffix = numMatch[3].replace(/[^a-z%/\u0900-\u097F₹]/g, '').trim();
    if (!isNaN(rawVal)) {
      if (/^(rs|inr|rupee|rupees|₹|रु|रुपये|रू)$/i.test(rawPrefix)) rawPrefix = 'curr';
      if (/^(rs|inr|rupee|rupees|₹|रु|रुपये|रू)$/i.test(rawSuffix)) rawSuffix = 'curr';
      const roundedVal = Math.abs(rawVal) < 1e-12 ? 0 : parseFloat(rawVal.toFixed(8));
      return 'num:' + rawPrefix + ':' + roundedVal + ':' + rawSuffix;
    }
  }

  // Text normalizer
  const textNorm = clean
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  return 'str:' + textNorm;
}

/**
 * Evaluates whether two option values are duplicate or semantically identical.
 */
export function areOptionsDuplicate(opt1, opt2) {
  if (opt1 === opt2) return true;
  const k1 = normalizeOptionValue(opt1);
  const k2 = normalizeOptionValue(opt2);
  if (k1 && k2 && k1 === k2) return true;
  const t1 = normalizeText(opt1);
  const t2 = normalizeText(opt2);
  if (t1 && t2 && t1 === t2) return true;
  return false;
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
    // 5a. Exact match or normalized numeric/value equivalence first
    for (const letter of ['A', 'B', 'C', 'D']) {
      const key = `option_${letter.toLowerCase()}`;
      const optVal = String(options[key] || options[letter] || '').toLowerCase().trim();
      if (optVal && (normVal === optVal || areOptionsDuplicate(normVal, optVal))) {
        return letter;
      }
    }
    // 5b. Prefix match only if option length is substantial (>= 4 chars) to prevent '1' matching '1.1'
    if (normVal.length >= 4) {
      for (const letter of ['A', 'B', 'C', 'D']) {
        const key = `option_${letter.toLowerCase()}`;
        const optVal = String(options[key] || options[letter] || '').toLowerCase().trim();
        if (optVal && optVal.length >= 4 && (normVal.startsWith(optVal) || optVal.startsWith(normVal))) {
          return letter;
        }
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
    return ['logical reasoning', 'general intelligence', 'puzzle', 'puzzles'].includes(normQ);
  }

  if (normT === 'banking awareness' || normT === 'banking') {
    return ['banking', 'banking & financial awareness', 'financial awareness', 'bank awareness', 'banking awareness'].includes(normQ) || normQ.includes('banking');
  }

  if (normT === 'general awareness' || normT === 'gk') {
    return ['gk', 'general knowledge', 'general studies', 'ga', 'static gk', 'general awareness'].includes(normQ) || normQ.includes('general awareness');
  }

  if (normT === 'current affairs') {
    return ['daily current affairs', 'ca', 'current affairs 2025', 'current affairs 2024', 'current affairs'].includes(normQ) || normQ.includes('current affairs');
  }

  if (normT === 'computer' || normT === 'computer knowledge') {
    return ['computer knowledge', 'computer awareness', 'computer science', 'it', 'computer'].includes(normQ) || normQ.includes('computer');
  }

  if (normT === 'english') {
    return ['english language', 'general english', 'english'].includes(normQ) || normQ.includes('english');
  }

  if (normT === 'hindi') {
    return ['hindi language', 'general hindi', 'hindi'].includes(normQ) || normQ.includes('hindi');
  }

  if (normT === 'civil engineering') {
    return ['civil', 'civil engg', 'civil engineering'].includes(normQ) || normQ.includes('civil');
  }

  if (normT === 'electrical engineering') {
    return ['electrical', 'electrical engg', 'electrical engineering'].includes(normQ) || normQ.includes('electrical');
  }

  if (normT === 'mechanical engineering') {
    return ['mechanical', 'mechanical engg', 'mechanical engineering'].includes(normQ) || normQ.includes('mechanical');
  }

  if (normT === 'technical' || normT === 'engineering') {
    return [
      'technical', 'engineering', 'civil engineering', 'electrical engineering',
      'mechanical engineering', 'civil', 'electrical', 'mechanical',
      'electronics', 'computer science', 'it', 'general engineering'
    ].includes(normQ) || normQ.includes('technical') || normQ.includes('engineering');
  }

  return false;
}

/**
 * Global round-robin index for uniform option distribution without bias.
 */
let globalDistributionIndex = 0;

/**
 * Standard Hindi translations for common fallback distractors.
 */
const HINDI_DISTRACTOR_MAP = {
  'None of the above': 'उपरोक्त में से कोई नहीं',
  'Cannot be determined': 'निर्धारित नहीं किया जा सकता',
  'Both A and B': 'A और B दोनों',
  'Neither A nor B': 'न तो A और न ही B',
  'Data insufficient': 'आंकड़े अपर्याप्त हैं',
  'Information insufficient': 'सूचना अपर्याप्त है',
  'Partially correct': 'आंशिक रूप से सही',
  'All of the above': 'उपरोक्त सभी',
  'Either 1 or 2': 'या तो 1 या 2'
};

/**
 * Distractor Fixer & Distinct Option Remapper
 * Detects duplicate options across A, B, C, D (including numeric formats like .1 vs 0.1).
 * If any distractor option duplicates an existing option, it automatically generates
 * a distinct, plausible replacement distractor.
 * Crucially:
 * 1. Strictly prevents duplicate option values (e.g. .1 vs 0.1, Rs. .1 vs Rs. 0.1).
 * 2. Strictly prevents repeating .1 or identical decimal distractor patterns across options.
 * 3. Preserves the correct answer's exact text, meaning, and declared value.
 */
export function fixDuplicateOptions(questionObj) {
  if (!questionObj || typeof questionObj !== 'object') return questionObj;

  const letters = ['A', 'B', 'C', 'D'];
  const originalAns = cleanAnswer(questionObj.correct_answer, questionObj);
  const targetAnsLetter = letters.includes(originalAns) ? originalAns : 'A';

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

  // Helper to check if a value has fractional part .1 (e.g. .1, 0.1, 1.1, 2.1)
  function hasPointOneFraction(str) {
    const match = String(str || '').match(/([+-]?(?:\d+(?:\.\d+)?|\.\d+))/);
    if (!match) return false;
    const num = Math.abs(parseFloat(match[1]));
    return !isNaN(num) && Math.abs((num % 1) - 0.1) < 1e-3;
  }

  // Check if any duplicates exist using both normalizeText and normalizeOptionValue,
  // or if multiple options redundantly repeat .1
  const normTextSet = new Set();
  const optValSet = new Set();
  let hasDuplicate = false;
  let pointOneCount = 0;

  for (const letter of letters) {
    const val = rawOptions[letter];
    if (!val) {
      hasDuplicate = true;
      continue;
    }
    const nt = normalizeText(val);
    const ov = normalizeOptionValue(val);
    if (normTextSet.has(nt) || optValSet.has(ov)) {
      hasDuplicate = true;
      break;
    }
    if (hasPointOneFraction(val)) {
      pointOneCount++;
      if (pointOneCount > 1) {
        hasDuplicate = true;
        break;
      }
    }
    normTextSet.add(nt);
    optValSet.add(ov);
  }

  // If already 4 completely distinct options, return as is
  if (!hasDuplicate && letters.every(l => Boolean(rawOptions[l]))) {
    return questionObj;
  }

  // Tracking sets for unique values
  const usedNormalized = new Set();
  const usedOptionValues = new Set();
  const usedRawValues = new Set();
  let seenPointOne = hasPointOneFraction(correctText);

  const fixedOptions = { ...rawOptions };
  const fixedOptionsHi = { ...rawOptionsHi };

  // Always protect and register the correct answer first
  if (correctText) {
    usedNormalized.add(normalizeText(correctText));
    usedOptionValues.add(normalizeOptionValue(correctText));
    usedRawValues.add(correctText.toLowerCase());
  }

  // Detect whether options are predominantly numeric
  const numericValues = [];
  let detectedPrefix = '';
  let detectedSuffix = '';

  for (const letter of letters) {
    const text = rawOptions[letter];
    const match = text.match(/^(.*?)([+-]?(?:\d+(?:\.\d+)?|\.\d+))([^0-9.]*)$/);
    if (match) {
      const num = parseFloat(match[2]);
      if (!isNaN(num)) {
        numericValues.push(num);
        if (!detectedPrefix && match[1]) detectedPrefix = match[1];
        if (!detectedSuffix && match[3]) detectedSuffix = match[3];
      }
    }
  }

  const isPredominantlyNumeric = numericValues.length >= 1;
  const existingNumbers = new Set(numericValues);

  /**
   * Generates a unique numeric distractor candidate.
   * Strictly prevents repeating .1 or identical decimal distractor patterns.
   */
  function getUniqueNumericDistractor() {
    const nums = Array.from(existingNumbers);
    const maxVal = nums.length ? Math.max(...nums) : 10;
    const minVal = nums.length ? Math.min(...nums) : 1;
    const hasDecimals = nums.some(n => Math.abs(n % 1) > 1e-4);
    const endsInPointOne = nums.some(n => Math.abs((Math.abs(n) % 1) - 0.1) < 1e-3);

    const candidates = [];

    if (hasDecimals) {
      // For decimal options (e.g. 0.1, 1.1, 3.15)
      for (const num of nums) {
        const intBase = Math.floor(num);
        // Varied fractions to strictly avoid repeating .1
        const variedFractions = [0.2, 0.5, 0.25, 0.75, 0.05, 0.4, 0.8, 0.01, 0.6, 0.9, 0.15];
        for (const frac of variedFractions) {
          if (endsInPointOne && Math.abs(frac - 0.1) < 1e-3) continue;
          if (intBase + frac > 0) candidates.push(intBase + frac);
          if (intBase > 0 && intBase - 1 + frac > 0) candidates.push(intBase - 1 + frac);
          candidates.push(intBase + 1 + frac);
          candidates.push(intBase + 2 + frac);
        }
        candidates.push(num * 2);
        candidates.push(num * 0.5);
        candidates.push(num * 10);
        candidates.push(num * 0.1);
        candidates.push(num * 4);
        candidates.push(intBase > 0 ? intBase : 1);
        candidates.push(intBase + 1);
        candidates.push(intBase + 2);
        candidates.push(intBase + 5);
      }
    } else {
      // Pure integer options (e.g. 0, 1, 4, 10, 50)
      const step = maxVal > 50 ? 5 : (maxVal > 10 ? 2 : 1);
      for (const num of nums) {
        candidates.push(num + step);
        candidates.push(num + step * 2);
        candidates.push(num + step * 3);
        if (num - step >= 0) candidates.push(num - step);
        if (num - step * 2 >= 0) candidates.push(num - step * 2);
        candidates.push(num * 2);
        candidates.push(num + 5);
        candidates.push(num + 6);
      }
      for (let c = 1; c <= 50; c++) {
        candidates.push(c);
      }
    }

    // General fallback sequence
    for (let c = 1; c <= 200; c++) {
      candidates.push(c);
      if (hasDecimals) {
        candidates.push(c * 0.5);
        candidates.push(c * 0.25);
      }
    }

    for (const cand of candidates) {
      if (cand <= 0 && minVal > 0) continue;
      // If any existing option ends in .1, reject candidate if it also ends in .1
      if (endsInPointOne && Math.abs((Math.abs(cand) % 1) - 0.1) < 1e-3) {
        continue;
      }
      if (existingNumbers.has(cand)) continue;

      const formatted = Number.isInteger(cand)
        ? cand.toString()
        : parseFloat(cand.toFixed(4)).toString();
      const candidateStr = `${detectedPrefix}${formatted}${detectedSuffix}`.trim();
      const norm = normalizeText(candidateStr);
      const optVal = normalizeOptionValue(candidateStr);

      if (!usedNormalized.has(norm) && !usedOptionValues.has(optVal) && !usedRawValues.has(candidateStr.toLowerCase())) {
        existingNumbers.add(cand);
        return candidateStr;
      }
    }

    // Absolute fallback
    const fallbackNum = (maxVal || 10) + 7;
    existingNumbers.add(fallbackNum);
    return `${detectedPrefix}${fallbackNum}${detectedSuffix}`.trim();
  }

  // Generic and subject-informed fallback distractors
  const genericDistractors = [
    'None of the above',
    'Cannot be determined',
    'Both A and B',
    'Neither A nor B',
    'Data insufficient',
    'Information insufficient',
    'Partially correct'
  ];

  // Resolve collisions on distractor slots (skipping the correct answer slot)
  for (const letter of letters) {
    if (letter === targetAnsLetter) continue;

    let curVal = fixedOptions[letter];
    const norm = normalizeText(curVal);
    const optVal = normalizeOptionValue(curVal);
    const hasPtOne = hasPointOneFraction(curVal);
    const isRepeatedPointOne = hasPtOne && seenPointOne;

    if (!curVal || isRepeatedPointOne || usedNormalized.has(norm) || usedOptionValues.has(optVal) || usedRawValues.has(curVal.toLowerCase())) {
      let replacement = '';
      if (isPredominantlyNumeric) {
        replacement = getUniqueNumericDistractor();
      } else {
        for (const cand of genericDistractors) {
          const candNorm = normalizeText(cand);
          const candOpt = normalizeOptionValue(cand);
          if (!usedNormalized.has(candNorm) && !usedOptionValues.has(candOpt) && !usedRawValues.has(cand.toLowerCase())) {
            replacement = cand;
            break;
          }
        }
        if (!replacement) {
          let count = 1;
          while (!replacement) {
            const cand = `${curVal || 'Option'} (Alternative ${count})`;
            const candNorm = normalizeText(cand);
            if (!usedNormalized.has(candNorm) && !usedOptionValues.has(normalizeOptionValue(cand))) {
              replacement = cand;
            }
            count++;
          }
        }
      }

      fixedOptions[letter] = replacement;
      if (fixedOptionsHi[letter] !== undefined) {
        fixedOptionsHi[letter] = HINDI_DISTRACTOR_MAP[replacement] || replacement;
      }
      usedNormalized.add(normalizeText(replacement));
      usedOptionValues.add(normalizeOptionValue(replacement));
      usedRawValues.add(replacement.toLowerCase());
      if (hasPointOneFraction(replacement)) {
        seenPointOne = true;
      }
    } else {
      if (hasPtOne) {
        seenPointOne = true;
      }
      usedNormalized.add(norm);
      usedOptionValues.add(optVal);
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
 * Option Distribution & Shuffler
 * Prevents option bias (e.g. correct answers stacking up mostly on Option A).
 * Re-maps options A, B, C, D to a round-robin or designated target letter,
 * ensuring correct answers are evenly distributed across A, B, C, and D without bias,
 * while automatically updating correct_answer and Hindi options to stay 100% synchronized.
 */
export function distributeQuestionOptions(questionObj, targetLetter = null) {
  if (!questionObj || typeof questionObj !== 'object') return questionObj;

  const letters = ['A', 'B', 'C', 'D'];
  const currentAnswer = cleanAnswer(questionObj.correct_answer, questionObj);
  if (!letters.includes(currentAnswer)) return questionObj;

  // Select destination letter: designated, random, or round-robin uniform
  let destinationLetter;
  if (targetLetter && letters.includes(targetLetter.toUpperCase())) {
    destinationLetter = targetLetter.toUpperCase();
  } else if (targetLetter === 'random') {
    destinationLetter = letters[Math.floor(Math.random() * letters.length)];
  } else {
    destinationLetter = letters[(globalDistributionIndex++) % letters.length];
  }

  if (destinationLetter === currentAnswer) {
    return { ...questionObj, correct_answer: destinationLetter };
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
 * Distributes a batch of questions evenly across A, B, C, D (25% each)
 * without any option bias.
 */
export function distributeQuestionBatch(questions = []) {
  if (!Array.isArray(questions)) return [];
  const letters = ['A', 'B', 'C', 'D'];
  return questions.map((q, idx) => {
    return resolveOptionDuplicatesAndDistribute(q, { targetLetter: letters[idx % letters.length] });
  });
}

/**
 * Deterministic Question Validation
 * Verifies:
 * 1. Non-empty question, min length 8
 * 2. Exactly four non-empty options A, B, C, D
 * 3. All four options are mutually distinct (evaluating text and numeric equivalence)
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

  // Distinct options check: checks both textual and numeric/value equivalence
  const rawOpts = [optA, optB, optC, optD].filter(Boolean);
  const normalizedOpts = rawOpts.map(normalizeText);
  const normalizedVals = rawOpts.map(normalizeOptionValue);
  if (new Set(normalizedOpts).size !== rawOpts.length || new Set(normalizedVals).size !== rawOpts.length) {
    // Options must be distinct (duplicate option detected)
    errors.push('Options must be distinct (duplicate option detected)');
  }

  const ans = cleanAnswer(q?.correct_answer, q);
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
        return res.status(500).json({ error: sanitizeErrorResponse(err) });
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
 * Sets permissive headers for API calls from web clients, security headers, and immediately finishes OPTIONS requests.
 */
export function handleCorsAndOptions(req, res, allowedMethods = ['GET', 'POST', 'OPTIONS']) {
  if (!res || typeof res.setHeader !== 'function') return false;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
  // Security & Defenses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
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
 * Fallback parser using the modern WHATWG URL API
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

/**
 * Derives appropriate subject/domain pool from an exam title
 */
export function deriveSubjectFromExamTitle(title = '') {
  const t = String(title || '').toLowerCase().trim();
  if (t.includes('reasoning') || t.includes('puzzle') || t.includes('general intelligence')) return 'Reasoning';
  if (t.includes('math') || t.includes('quantitative') || t.includes('aptitude') || t.includes('arithmetic')) return 'Mathematics';
  if (t.includes('banking awareness') || t.includes('banking') || t.includes('financial awareness') || t.includes('bank po')) return 'Banking Awareness';
  if (t.includes('current affairs')) return 'Current Affairs';
  if (t.includes('computer') || t.includes('it')) return 'Computer';
  if (t.includes('english')) return 'English';
  if (t.includes('hindi')) return 'Hindi';
  if (t.includes('civil engineering') || t.includes('civil')) return 'Civil Engineering';
  if (t.includes('electrical engineering') || t.includes('electrical')) return 'Electrical Engineering';
  if (t.includes('mechanical engineering') || t.includes('mechanical')) return 'Mechanical Engineering';
  if (t.includes('mp gk') || t.includes('mppsc')) return 'General Awareness';
  if (t.includes('general awareness') || t.includes('general studies') || t.includes('gk')) return 'General Awareness';
  return null;
}

/**
 * Universal auto-mapping helper to map active approved questions into exam_questions
 * Guarantees zero empty assignments when active approved questions exist in the bank.
 */
export async function queryAndMapApprovedQuestions(sb, examObj) {
  if (!sb || !examObj?.id) {
    return { ok: false, added: 0, total: 0, error: 'Database or exam ID missing' };
  }

  const examId = examObj.id;
  const configuredTotal = Math.max(1, Number(examObj.total_questions || 25));
  const examTitle = String(examObj.title || '').trim();
  const subjectTarget = examObj.subject || deriveSubjectFromExamTitle(examTitle);

  // 1. Attempt database RPC first
  try {
    const rpcRes = await sb.rpc('admin_map_exam_questions', { p_exam_id: examId });
    if (!rpcRes.error && (rpcRes.data?.added > 0 || rpcRes.data?.total >= configuredTotal)) {
      return {
        ok: true,
        added: rpcRes.data?.added || 0,
        total: rpcRes.data?.total || 0,
        source: 'rpc',
        subject_used: subjectTarget
      };
    }
  } catch (_) {
    // Proceed to direct query fallback
  }

  // 2. Direct fallback auto-mapping
  const { data: existingMapped, error: exErr } = await sb
    .from('exam_questions')
    .select('question_id, question_order')
    .eq('exam_id', examId)
    .order('question_order', { ascending: true });

  if (exErr) {
    console.warn('[AutoMap] Error querying existing exam_questions:', exErr.message);
  }

  const mappedIds = new Set((existingMapped || []).map(m => m.question_id));
  const currentTotal = mappedIds.size;
  const needed = Math.max(0, configuredTotal - currentTotal);

  if (needed <= 0 && currentTotal > 0) {
    return { ok: true, added: 0, total: currentTotal, source: 'existing', subject_used: subjectTarget };
  }

  // 3. Query approved questions pool from database
  const { data: pool, error: poolErr } = await sb
    .from('questions')
    .select('id, question, option_a, option_b, option_c, option_d, correct_answer, subject, topic, difficulty, exam, status')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(800);

  if (poolErr || !pool || pool.length === 0) {
    return { ok: false, added: 0, total: currentTotal, error: poolErr?.message || 'No approved questions available' };
  }

  // Filter publishable valid questions
  const validPool = pool.filter(q => {
    if (mappedIds.has(q.id)) return false;
    const ans = cleanAnswer(q.correct_answer, q);
    if (!/^[ABCD]$/.test(ans)) return false;
    const hasAllOptions = [q.option_a, q.option_b, q.option_c, q.option_d].every(v => String(v || '').trim().length > 0);
    if (!hasAllOptions) return false;
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d].map(normalizeText);
    if (new Set(opts).size < 4) return false;
    if (isDependentContextMissing(q.question)) return false;
    return true;
  });

  const selected = [];
  const selectedIds = new Set();

  const matchesSubjectOrExam = (q) => {
    if (subjectTarget && isSubjectStrictMatch(q.subject, subjectTarget)) return true;
    if (examTitle && q.exam && (
      examTitle.toLowerCase().includes(String(q.exam).toLowerCase()) ||
      String(q.exam).toLowerCase().includes(examTitle.toLowerCase())
    )) return true;
    return false;
  };

  // Phase 1: Matching subject or exam keywords
  for (const q of validPool) {
    if (selected.length >= needed) break;
    if (matchesSubjectOrExam(q) && !selectedIds.has(q.id)) {
      selected.push(q);
      selectedIds.add(q.id);
    }
  }

  // Phase 2: If pool has shortage for specific subject, fulfill from active approved pool
  if (selected.length < needed) {
    for (const q of validPool) {
      if (selected.length >= needed) break;
      if (!selectedIds.has(q.id)) {
        selected.push(q);
        selectedIds.add(q.id);
      }
    }
  }

  if (selected.length === 0) {
    return { ok: true, added: 0, total: currentTotal, source: 'empty_pool', subject_used: subjectTarget };
  }

  // Insert into exam_questions
  const nextOrderStart = (existingMapped || []).length;
  const mappings = selected.map((q, idx) => ({
    exam_id: examId,
    question_id: q.id,
    question_order: nextOrderStart + idx + 1
  }));

  const { error: insertErr } = await sb
    .from('exam_questions')
    .insert(mappings);

  if (insertErr) {
    return { ok: false, added: 0, total: currentTotal, error: insertErr.message };
  }

  return {
    ok: true,
    added: mappings.length,
    total: currentTotal + mappings.length,
    source: 'direct',
    subject_used: subjectTarget
  };
}


