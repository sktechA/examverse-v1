export interface Question {
  id: string;
  question: string;
  question_hi?: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_a_hi?: string;
  option_b_hi?: string;
  option_c_hi?: string;
  option_d_hi?: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  subject: string;
  topic?: string;
  subtopic?: string;
  difficulty?: 'Easy' | 'Moderate' | 'Hard';
  language?: string;
  exam?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'needs_correction';
  ai_confidence?: number;
  ai_verdict?: string;
  ai_notes?: string;
  source?: string;
  source_url?: string;
}

export interface Exam {
  id?: string;
  title: string;
  exam_type?: string;
  subject?: string;
  total_questions: number;
  duration_minutes: number;
  marks_per_question: number;
  negative_marking: number;
  randomize_questions: boolean;
  status: 'draft' | 'published' | 'archived';
  blueprint?: any;
}

export interface AutomationSettings {
  daily_question_target: number;
  daily_ca_target: number;
  auto_approval_threshold: number;
  gemini_ai_enabled: boolean;
  daily_scheduler_enabled: boolean;
  synthesis_mode_enabled: boolean;
  subject_quotas: Record<string, number>;
  exam_quotas: Record<string, number>;
}

export interface AutomationLog {
  id: string;
  created_at: string;
  job_type: string;
  job_key: string;
  status: 'success' | 'failed' | 'partial' | 'skipped';
  items_processed: number;
  items_approved: number;
  items_rejected: number;
  details?: any;
}
