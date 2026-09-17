/**
 * Verified Official Recruitment & Banking Portals
 * Strictly aligned with official government recruitment domains.
 * Zero cross-contamination between recruitment boards.
 */

export const OFFICIAL_RECRUITMENT_PORTALS = [
  {
    id: 'ibps',
    name: 'IBPS (Institute of Banking Personnel Selection)',
    shortName: 'IBPS Banking',
    board: 'IBPS',
    category: 'Banking & Financial Sector',
    portal_url: 'https://www.ibps.in',
    apply_url: 'https://www.ibps.in',
    domain: 'ibps.in',
    authority: 'Institute of Banking Personnel Selection',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Official centralized portal for CRP PO/MT, Clerk, Specialist Officers (SO), and Regional Rural Banks (RRB CRP Officer & Office Assistant).',
    active_notifications: [
      {
        title: 'IBPS CRP PO/MT & Specialist Officer Recruitment Notifications',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://www.ibps.in',
        type: 'Official Notification'
      },
      {
        title: 'IBPS RRB Officer Scale I, II, III & Office Assistants',
        date: 'Active',
        status: 'Application & Admit Card Live',
        url: 'https://www.ibps.in',
        type: 'Apply Window'
      }
    ]
  },
  {
    id: 'sbi',
    name: 'SBI Careers (State Bank of India)',
    shortName: 'SBI Careers',
    board: 'SBI',
    category: 'Banking & Financial Sector',
    portal_url: 'https://sbi.co.in/web/careers',
    apply_url: 'https://sbi.co.in/web/careers',
    domain: 'sbi.co.in',
    authority: 'State Bank of India Central Recruitment & Promotion Department',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Official recruitment portal for SBI Probationary Officers (PO), Junior Associates (Customer Support & Sales), and Specialist Cadre Officers (SCO).',
    active_notifications: [
      {
        title: 'SBI Junior Associates (Customer Support & Sales) Recruitment',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://sbi.co.in/web/careers',
        type: 'Official Notification'
      },
      {
        title: 'SBI Probationary Officers (PO) & Specialist Cadre Officers Drive',
        date: 'Active',
        status: 'Active Recruitment Portal',
        url: 'https://sbi.co.in/web/careers',
        type: 'Career Portal'
      }
    ]
  },
  {
    id: 'ssc',
    name: 'SSC (Staff Selection Commission)',
    shortName: 'SSC Portals',
    board: 'SSC',
    category: 'Central Government Staff Selection',
    portal_url: 'https://ssc.gov.in',
    apply_url: 'https://ssc.gov.in',
    domain: 'ssc.gov.in',
    authority: 'Staff Selection Commission, Government of India',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'New official centralized portal for CGL, CHSL (10+2), MTS, Delhi Police / CAPF Sub-Inspector, and GD Constable with One-Time Registration (OTR).',
    active_notifications: [
      {
        title: 'SSC Combined Graduate Level (CGL) Examination Notification',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://ssc.gov.in',
        type: 'Official Notification'
      },
      {
        title: 'SSC Combined Higher Secondary Level (CHSL) & GD Constable Portal',
        date: 'Active',
        status: 'OTR & Apply Portal Live',
        url: 'https://ssc.gov.in',
        type: 'Apply Window'
      }
    ]
  },
  {
    id: 'rrb',
    name: 'Railway Recruitment Boards (RRB)',
    shortName: 'Railway (RRB)',
    board: 'RRB',
    category: 'Indian Railways',
    portal_url: 'https://www.rrbcdg.gov.in',
    apply_url: 'https://www.rrbapply.gov.in',
    domain: 'rrbcdg.gov.in',
    authority: 'Railway Recruitment Control Board (RRCB), Ministry of Railways',
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
        url: 'https://www.rrbapply.gov.in',
        type: 'Central Application'
      },
      {
        title: 'RRB Assistant Loco Pilot (ALP) & Technicians Recruitment Window',
        date: 'Active',
        status: 'CBT & Application Stage Active',
        url: 'https://www.rrbcdg.gov.in',
        type: 'Regional Nodal Notice'
      }
    ]
  },
  {
    id: 'mpesb',
    name: 'MPESB / MPPEB (Madhya Pradesh Employees Selection Board)',
    shortName: 'MPESB / MPPEB',
    board: 'MPESB',
    category: 'Madhya Pradesh State Exams',
    portal_url: 'https://esb.mp.gov.in',
    apply_url: 'https://esb.mponline.gov.in',
    domain: 'esb.mp.gov.in',
    authority: 'Madhya Pradesh Employees Selection Board (formerly MPPEB / Vyapam), Bhopal',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Main official portal (esb.mp.gov.in) and official MPOnline application window (esb.mponline.gov.in) for Police Constable, Subedar/SI, Group-3 Sub Engineer, Patwari, and Teacher Eligibility.',
    active_notifications: [
      {
        title: 'MPESB Police Constable (GD / Radio) Recruitment Examination',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://esb.mponline.gov.in',
        type: 'Online Application Window'
      },
      {
        title: 'MPESB Group-3 Sub Engineer, Draftsman & Other Equivalent Posts',
        date: 'Active',
        status: 'Rule Book Live / Apply Online',
        url: 'https://esb.mp.gov.in/rulebooks/rule_books.htm',
        type: 'Rule Book & Apply'
      },
      {
        title: 'MPESB Subedar & Sub-Inspector (Police Headquarter) Recruitment',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://esb.mponline.gov.in',
        type: 'Apply Window'
      }
    ]
  },
  {
    id: 'mppsc',
    name: 'MPPSC (Madhya Pradesh Public Service Commission)',
    shortName: 'MPPSC State Services',
    board: 'MPPSC',
    category: 'Madhya Pradesh State Civil Services',
    portal_url: 'https://mppsc.mp.gov.in',
    apply_url: 'https://mppsc.mp.gov.in',
    domain: 'mppsc.mp.gov.in',
    authority: 'Madhya Pradesh Public Service Commission, Residency Area, Indore',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Official portal for State Service Examination (SSE), State Forest Service (SFS), Assistant Professor, Medical Officer, and Mining Inspector.',
    active_notifications: [
      {
        title: 'MPPSC State Service Examination (SSE Prelims / Mains)',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://mppsc.mp.gov.in',
        type: 'State Civil Services'
      },
      {
        title: 'MPPSC State Forest Service & Engineering Service Examination',
        date: 'Active',
        status: 'Official Advertisement Live',
        url: 'https://mppsc.mp.gov.in',
        type: 'Official Advertisement'
      }
    ]
  },
  {
    id: 'upsc',
    name: 'UPSC (Union Public Service Commission)',
    shortName: 'UPSC Central Services',
    board: 'UPSC',
    category: 'All India & Central Civil Services',
    portal_url: 'https://upsc.gov.in',
    apply_url: 'https://upsconline.nic.in',
    domain: 'upsc.gov.in',
    authority: 'Union Public Service Commission, Dholpur House, New Delhi',
    badge: 'New Notification Released',
    is_new: true,
    last_updated: 'Live',
    description: 'Official portal for Civil Services Examination (CSE), Engineering Services (ESE), Combined Defence Services (CDS), NDA/NA, and Central Armed Police Forces (CAPF).',
    active_notifications: [
      {
        title: 'UPSC Civil Services (Preliminary / Main) Examination',
        date: 'Active',
        status: 'New Notification Released',
        url: 'https://upsconline.nic.in',
        type: 'Online Application Window'
      },
      {
        title: 'UPSC Combined Defence Services (CDS) & NDA Online Application',
        date: 'Active',
        status: 'OTR & Apply Portal Live',
        url: 'https://upsconline.nic.in',
        type: 'OTR Application'
      }
    ]
  }
];

export const EXPANDED_VACANCIES = [
  // IBPS
  {
    id: 'ibps-crp-po',
    name: 'IBPS CRP PO/MT XIV Recruitment',
    board: 'IBPS',
    category: 'Banking',
    last: 'See official schedule',
    apply: 'https://www.ibps.in',
    notice: 'https://www.ibps.in',
    tag: 'NEW NOTIFICATION RELEASED',
    isNew: true,
    authority: 'Institute of Banking Personnel Selection',
    verifiedDomain: 'ibps.in'
  },
  {
    id: 'ibps-crp-clerk',
    name: 'IBPS CRP Clerk XIV Recruitment',
    board: 'IBPS',
    category: 'Banking',
    last: 'See official schedule',
    apply: 'https://www.ibps.in',
    notice: 'https://www.ibps.in',
    tag: 'NEW NOTIFICATION RELEASED',
    isNew: true,
    authority: 'Institute of Banking Personnel Selection',
    verifiedDomain: 'ibps.in'
  },
  {
    id: 'ibps-rrb-xiii',
    name: 'IBPS RRB Officer Scale I, II, III & Office Assistant',
    board: 'IBPS',
    category: 'Banking',
    last: 'See official schedule',
    apply: 'https://www.ibps.in',
    notice: 'https://www.ibps.in',
    tag: 'ACTIVE FORM',
    isNew: true,
    authority: 'Institute of Banking Personnel Selection',
    verifiedDomain: 'ibps.in'
  },

  // SBI Careers
  {
    id: 'sbi-ja',
    name: 'SBI Junior Associates (Customer Support & Sales)',
    board: 'SBI',
    category: 'Banking',
    last: 'See official portal',
    apply: 'https://sbi.co.in/web/careers',
    notice: 'https://sbi.co.in/web/careers',
    tag: 'NEW NOTIFICATION RELEASED',
    isNew: true,
    authority: 'State Bank of India',
    verifiedDomain: 'sbi.co.in'
  },
  {
    id: 'sbi-po',
    name: 'SBI Probationary Officers (PO) Recruitment',
    board: 'SBI',
    category: 'Banking',
    last: 'See official schedule',
    apply: 'https://sbi.co.in/web/careers',
    notice: 'https://sbi.co.in/web/careers',
    tag: 'TRENDING',
    isNew: false,
    authority: 'State Bank of India',
    verifiedDomain: 'sbi.co.in'
  },

  // SSC
  {
    id: 'ssc-cgl',
    name: 'SSC Combined Graduate Level (CGL) 2026',
    board: 'SSC',
    category: 'SSC',
    last: 'See official notice',
    apply: 'https://ssc.gov.in',
    notice: 'https://ssc.gov.in',
    tag: 'NEW NOTIFICATION RELEASED',
    isNew: true,
    authority: 'Staff Selection Commission',
    verifiedDomain: 'ssc.gov.in'
  },
  {
    id: 'ssc-chsl',
    name: 'SSC Combined Higher Secondary Level (CHSL 10+2)',
    board: 'SSC',
    category: 'SSC',
    last: 'See official notice',
    apply: 'https://ssc.gov.in',
    notice: 'https://ssc.gov.in',
    tag: 'NEW NOTIFICATION RELEASED',
    isNew: true,
    authority: 'Staff Selection Commission',
    verifiedDomain: 'ssc.gov.in'
  },
  {
    id: 'ssc-gd',
    name: 'SSC Constable (GD) in CAPFs, SSF & Assam Rifles',
    board: 'SSC',
    category: 'SSC',
    last: 'See official portal',
    apply: 'https://ssc.gov.in',
    notice: 'https://ssc.gov.in',
    tag: 'POPULAR',
    isNew: false,
    authority: 'Staff Selection Commission',
    verifiedDomain: 'ssc.gov.in'
  },

  // Railway (RRB)
  {
    id: 'rrb-ntpc',
    name: 'RRB NTPC (Non-Technical Popular Categories CEN)',
    board: 'RRB',
    category: 'Railway',
    last: 'See official schedule',
    apply: 'https://www.rrbapply.gov.in',
    notice: 'https://www.rrbcdg.gov.in',
    tag: 'NEW NOTIFICATION RELEASED',
    isNew: true,
    authority: 'Railway Recruitment Control Board',
    verifiedDomain: 'rrbcdg.gov.in / rrbapply.gov.in'
  },
  {
    id: 'rrb-alp-tech',
    name: 'RRB Assistant Loco Pilot (ALP) & Technicians',
    board: 'RRB',
    category: 'Railway',
    last: 'See official notice',
    apply: 'https://www.rrbapply.gov.in',
    notice: 'https://www.rrbcdg.gov.in',
    tag: 'ACTIVE FORM',
    isNew: true,
    authority: 'Railway Recruitment Control Board',
    verifiedDomain: 'rrbcdg.gov.in / rrbapply.gov.in'
  },

  // MPESB / MPPEB
  {
    id: 'mpesb-constable',
    name: 'MPESB Police Constable (GD / Radio) 2026',
    board: 'MPESB',
    category: 'MP State',
    last: '06 Oct 2026',
    apply: 'https://esb.mponline.gov.in',
    notice: 'https://esb.mp.gov.in/advertisement/Important_message_candidate.htm',
    tag: 'NEW NOTIFICATION RELEASED',
    isNew: true,
    authority: 'Madhya Pradesh Employees Selection Board',
    verifiedDomain: 'esb.mp.gov.in / esb.mponline.gov.in'
  },
  {
    id: 'mpesb-si',
    name: 'MPESB Subedar & Sub-Inspector (Police) 2026',
    board: 'MPESB',
    category: 'MP State',
    last: '23 Sep 2026',
    apply: 'https://esb.mponline.gov.in',
    notice: 'https://esb.mp.gov.in/student_dashboard.htm',
    tag: 'NEW NOTIFICATION RELEASED',
    isNew: true,
    authority: 'Madhya Pradesh Employees Selection Board',
    verifiedDomain: 'esb.mp.gov.in / esb.mponline.gov.in'
  },
  {
    id: 'mpesb-group3',
    name: 'MPESB Group-3 Combined Sub Engineer & Draftsman',
    board: 'MPESB',
    category: 'MP State',
    last: 'See official notice',
    apply: 'https://esb.mponline.gov.in',
    notice: 'https://esb.mp.gov.in/rulebooks/rule_books.htm',
    tag: 'TRENDING',
    isNew: false,
    authority: 'Madhya Pradesh Employees Selection Board',
    verifiedDomain: 'esb.mp.gov.in / esb.mponline.gov.in'
  },

  // MPPSC
  {
    id: 'mppsc-sse',
    name: 'MPPSC State Service Examination (SSE Prelims / Mains)',
    board: 'MPPSC',
    category: 'MP State',
    last: 'See official notice',
    apply: 'https://mppsc.mp.gov.in',
    notice: 'https://mppsc.mp.gov.in',
    tag: 'NEW NOTIFICATION RELEASED',
    isNew: true,
    authority: 'Madhya Pradesh Public Service Commission',
    verifiedDomain: 'mppsc.mp.gov.in'
  },
  {
    id: 'mppsc-sfs',
    name: 'MPPSC State Forest Service Examination',
    board: 'MPPSC',
    category: 'MP State',
    last: 'See official notice',
    apply: 'https://mppsc.mp.gov.in',
    notice: 'https://mppsc.mp.gov.in',
    tag: 'OFFICIAL',
    isNew: false,
    authority: 'Madhya Pradesh Public Service Commission',
    verifiedDomain: 'mppsc.mp.gov.in'
  },

  // UPSC
  {
    id: 'upsc-cse',
    name: 'UPSC Civil Services Examination (CSE Prelims / Mains)',
    board: 'UPSC',
    category: 'UPSC',
    last: 'See official calendar',
    apply: 'https://upsconline.nic.in',
    notice: 'https://upsc.gov.in/recruitment/recruitment-advertisement',
    tag: 'NEW NOTIFICATION RELEASED',
    isNew: true,
    authority: 'Union Public Service Commission',
    verifiedDomain: 'upsc.gov.in / upsconline.nic.in'
  },
  {
    id: 'upsc-cds',
    name: 'UPSC Combined Defence Services (CDS) & NDA Examination',
    board: 'UPSC',
    category: 'UPSC',
    last: 'See official notice',
    apply: 'https://upsconline.nic.in',
    notice: 'https://upsc.gov.in',
    tag: 'ACTIVE FORM',
    isNew: true,
    authority: 'Union Public Service Commission',
    verifiedDomain: 'upsc.gov.in / upsconline.nic.in'
  }
];
