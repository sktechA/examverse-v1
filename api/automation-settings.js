import { getSupabaseAdmin, verifyAdminAuth } from './_shared.js';

export default async function handler(req, res) {
  console.info('[AUTOMATION] Request:', req?.method || 'UNKNOWN');
  const sb = getSupabaseAdmin(req);
  if (!sb) {
    console.error('[DB] Connection client creation FAILED');
    return res.status(500).json({ error: 'Database server configuration unavailable' });
  }

  // Admin Authorization check (Requirement 11)
  const auth = await verifyAdminAuth(req, sb);
  console.info('[AUTH] Admin verification:', JSON.stringify({ ok: !!auth.ok, role: auth.role || null, statusCode: auth.statusCode || null, error: auth.error || null }));
  if (!auth.ok) {
    return res.status(auth.statusCode || 401).json({ error: auth.error });
  }

  // GET: Retrieve configuration & latest job logs
  if (req.method === 'GET') {
    try {
      const { data: config } = await sb
        .from('automation_settings')
        .select('*')
        .eq('id', 'default_config')
        .maybeSingle();

      const { data: logs } = await sb
        .from('automation_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      const extraPrefs = config?.exam_quotas?.__preferences || {};

      const normalizedSettings = config ? {
        ...config,
        daily_question_target: Number(config.daily_question_target) || 1000,
        daily_ca_target: Number(config.current_affairs_target ?? config.daily_ca_target ?? 150),
        current_affairs_target: Number(config.current_affairs_target ?? config.daily_ca_target ?? 150),
        auto_approval_threshold: Number(config.auto_approval_threshold) || 0.93,
        gemini_ai_enabled: Boolean(config.gemini_ai_enabled),
        daily_automation_enabled: Boolean(config.daily_automation_enabled ?? config.daily_scheduler_enabled ?? true),
        daily_scheduler_enabled: Boolean(config.daily_automation_enabled ?? config.daily_scheduler_enabled ?? true),
        preferred_ai_model: extraPrefs.preferred_ai_model || 'gemini-3.8-flash',
        generation_schedule: extraPrefs.generation_schedule || '00:00:00 Asia/Kolkata',
        ca_ingestion_enabled: extraPrefs.ca_ingestion_enabled !== false,
        synthesis_mode_enabled: Boolean(extraPrefs.synthesis_mode_enabled),
        mock_generation_enabled: extraPrefs.mock_generation_enabled !== false,
        default_mock_questions: Number(config.default_mock_questions) || 80,
        default_mock_count: Number(config.default_mock_count) || 5,
        difficulty_ratio: config.difficulty_ratio || { easy: 30, moderate: 50, hard: 20 },
        subject_quotas: config.subject_quotas || {
          Reasoning: 250,
          Mathematics: 250,
          'General Awareness': 150,
          'Current Affairs': 150,
          Computer: 100,
          English: 50,
          Hindi: 50
        },
        exam_quotas: config.exam_quotas || {}
      } : {
        daily_question_target: 1000,
        current_affairs_target: 150,
        daily_ca_target: 150,
        auto_approval_threshold: 0.93,
        gemini_ai_enabled: process.env.GEMINI_AI_ENABLED === 'true',
        daily_automation_enabled: true,
        daily_scheduler_enabled: true,
        preferred_ai_model: 'gemini-3.8-flash',
        generation_schedule: '00:00:00 Asia/Kolkata',
        ca_ingestion_enabled: true,
        synthesis_mode_enabled: false,
        mock_generation_enabled: true,
        default_mock_questions: 80,
        default_mock_count: 5,
        difficulty_ratio: { easy: 30, moderate: 50, hard: 20 },
        subject_quotas: {
          Reasoning: 250,
          Mathematics: 250,
          'General Awareness': 150,
          'Current Affairs': 150,
          Computer: 100,
          English: 50,
          Hindi: 50
        },
        exam_quotas: {}
      };

      return res.status(200).json({
        ok: true,
        settings: normalizedSettings,
        recent_logs: logs || []
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // POST: Update configuration
  if (req.method === 'POST') {
    try {
      const updates = req.body || {};
      const { data: existing } = await sb
        .from('automation_settings')
        .select('*')
        .eq('id', 'default_config')
        .maybeSingle();

      const existingPrefs = existing?.exam_quotas?.__preferences || {};
      const existingExamQuotas = existing?.exam_quotas || {};

      const newPrefs = {
        ...existingPrefs,
        preferred_ai_model: updates.preferred_ai_model || existingPrefs.preferred_ai_model || 'gemini-3.8-flash',
        generation_schedule: updates.generation_schedule || existingPrefs.generation_schedule || '00:00:00 Asia/Kolkata',
        ca_ingestion_enabled: updates.ca_ingestion_enabled !== undefined ? Boolean(updates.ca_ingestion_enabled) : (existingPrefs.ca_ingestion_enabled !== false),
        synthesis_mode_enabled: updates.synthesis_mode_enabled !== undefined ? Boolean(updates.synthesis_mode_enabled) : Boolean(existingPrefs.synthesis_mode_enabled),
        mock_generation_enabled: updates.mock_generation_enabled !== undefined ? Boolean(updates.mock_generation_enabled) : (existingPrefs.mock_generation_enabled !== false),
        default_mock_questions: Number(updates.default_mock_questions || existing?.default_mock_questions || 80),
        default_mock_count: Number(updates.default_mock_count || existing?.default_mock_count || 5),
      };

      const updatedExamQuotas = {
        ...(updates.exam_quotas || existingExamQuotas),
        __preferences: newPrefs
      };

      const payload = {
        id: 'default_config',
        daily_question_target: updates.daily_question_target !== undefined ? Number(updates.daily_question_target) : (existing?.daily_question_target ?? 1000),
        current_affairs_target: updates.current_affairs_target !== undefined ? Number(updates.current_affairs_target) : (updates.daily_ca_target !== undefined ? Number(updates.daily_ca_target) : (existing?.current_affairs_target ?? 150)),
        auto_approval_threshold: updates.auto_approval_threshold !== undefined ? Number(updates.auto_approval_threshold) : (existing?.auto_approval_threshold ?? 0.93),
        gemini_ai_enabled: updates.gemini_ai_enabled !== undefined ? Boolean(updates.gemini_ai_enabled) : Boolean(existing?.gemini_ai_enabled),
        daily_automation_enabled: updates.daily_automation_enabled !== undefined ? Boolean(updates.daily_automation_enabled) : (updates.daily_scheduler_enabled !== undefined ? Boolean(updates.daily_scheduler_enabled) : (existing?.daily_automation_enabled ?? true)),
        default_mock_questions: Number(updates.default_mock_questions || existing?.default_mock_questions || 80),
        default_mock_count: Number(updates.default_mock_count || existing?.default_mock_count || 5),
        difficulty_ratio: updates.difficulty_ratio || existing?.difficulty_ratio || { easy: 30, moderate: 50, hard: 20 },
        subject_quotas: updates.subject_quotas || existing?.subject_quotas || {},
        exam_quotas: updatedExamQuotas,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await sb
        .from('automation_settings')
        .upsert(payload)
        .select()
        .single();

      if (error) {
        console.error('[AUTOMATION] Save FAILED:', JSON.stringify({ code: error.code || null, message: error.message || null, details: error.details || null, hint: error.hint || null }));
        throw error;
      }
      console.info('[AUTOMATION] Save PASS');

      const savedSettings = {
        ...data,
        daily_ca_target: data.current_affairs_target,
        daily_scheduler_enabled: data.daily_automation_enabled,
        preferred_ai_model: newPrefs.preferred_ai_model,
        generation_schedule: newPrefs.generation_schedule,
        ca_ingestion_enabled: newPrefs.ca_ingestion_enabled,
        synthesis_mode_enabled: newPrefs.synthesis_mode_enabled,
        mock_generation_enabled: newPrefs.mock_generation_enabled
      };

      return res.status(200).json({ ok: true, settings: savedSettings });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
