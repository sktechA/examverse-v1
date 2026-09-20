import {
  getSupabaseAdmin,
  verifyAdminAuth,
  sanitizeObject,
  sanitizeString,
  sanitizeErrorResponse,
  checkRateLimit,
  getClientIp,
  isSuperOrAdminRole
} from './_shared.js';

export default async function handler(req, res) {
  // 1. Rate Limiting Check
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, 'automation-settings', 40, 60000);
  if (!rate.allowed) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', String(rate.retryAfter));
    }
    return res.status(429).json({ ok: false, error: 'Too many requests. Please slow down and try again shortly.' });
  }

  const sb = getSupabaseAdmin(req);
  if (!sb) {
    return res.status(500).json({ ok: false, error: 'Database server configuration unavailable' });
  }

  // 2. Admin Authorization check
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) {
    return res.status(auth.statusCode || 401).json({ ok: false, error: auth.error });
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
      return res.status(500).json({ ok: false, error: sanitizeErrorResponse(err, 'Failed to fetch automation settings') });
    }
  }

  // POST: Update configuration
  if (req.method === 'POST') {
    // RBAC: Only Super Admin or Admin role can update global automation parameters
    if (!isSuperOrAdminRole(auth)) {
      return res.status(403).json({ ok: false, error: 'Access denied: Admin or Super Admin role required to update automation settings.' });
    }

    try {
      // Prototype Pollution & Parameter Sanitization
      const updates = sanitizeObject(req.body || {});
      const { data: existing } = await sb
        .from('automation_settings')
        .select('*')
        .eq('id', 'default_config')
        .maybeSingle();

      const existingPrefs = existing?.exam_quotas?.__preferences || {};
      const existingExamQuotas = existing?.exam_quotas || {};

      // Clamp and sanitize numeric inputs
      const defaultMockQ = Math.min(Math.max(Number(updates.default_mock_questions || existing?.default_mock_questions || 80), 5), 200);
      const defaultMockC = Math.min(Math.max(Number(updates.default_mock_count || existing?.default_mock_count || 5), 1), 50);
      const dailyQTarget = Math.min(Math.max(Number(updates.daily_question_target !== undefined ? updates.daily_question_target : (existing?.daily_question_target ?? 1000)), 1), 10000);
      const rawCa = updates.current_affairs_target !== undefined ? updates.current_affairs_target : (updates.daily_ca_target !== undefined ? updates.daily_ca_target : (existing?.current_affairs_target ?? 150));
      const caTarget = Math.min(Math.max(Number(rawCa), 0), 2000);
      const autoThreshold = Math.min(Math.max(Number(updates.auto_approval_threshold !== undefined ? updates.auto_approval_threshold : (existing?.auto_approval_threshold ?? 0.93)), 0.50), 1.00);

      const newPrefs = {
        ...existingPrefs,
        preferred_ai_model: sanitizeString(updates.preferred_ai_model || existingPrefs.preferred_ai_model || 'gemini-3.8-flash', 50),
        generation_schedule: sanitizeString(updates.generation_schedule || existingPrefs.generation_schedule || '00:00:00 Asia/Kolkata', 50),
        ca_ingestion_enabled: updates.ca_ingestion_enabled !== undefined ? Boolean(updates.ca_ingestion_enabled) : (existingPrefs.ca_ingestion_enabled !== false),
        synthesis_mode_enabled: updates.synthesis_mode_enabled !== undefined ? Boolean(updates.synthesis_mode_enabled) : Boolean(existingPrefs.synthesis_mode_enabled),
        mock_generation_enabled: updates.mock_generation_enabled !== undefined ? Boolean(updates.mock_generation_enabled) : (existingPrefs.mock_generation_enabled !== false),
        default_mock_questions: defaultMockQ,
        default_mock_count: defaultMockC
      };

      const updatedExamQuotas = {
        ...(updates.exam_quotas || existingExamQuotas),
        __preferences: newPrefs
      };

      const payload = {
        id: 'default_config',
        daily_question_target: dailyQTarget,
        current_affairs_target: caTarget,
        auto_approval_threshold: autoThreshold,
        gemini_ai_enabled: updates.gemini_ai_enabled !== undefined ? Boolean(updates.gemini_ai_enabled) : Boolean(existing?.gemini_ai_enabled),
        daily_automation_enabled: updates.daily_automation_enabled !== undefined ? Boolean(updates.daily_automation_enabled) : (updates.daily_scheduler_enabled !== undefined ? Boolean(updates.daily_scheduler_enabled) : (existing?.daily_automation_enabled ?? true)),
        default_mock_questions: defaultMockQ,
        default_mock_count: defaultMockC,
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
        throw error;
      }

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
      return res.status(500).json({ ok: false, error: sanitizeErrorResponse(err, 'Failed to save automation settings') });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
