import { getSupabaseAdmin, verifyAdminAuth } from './_shared.js';

async function handler(req, res) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return res.status(500).json({ error: 'Database connection unavailable' });
  }

  // Admin Authorization check (Requirement 11)
  const auth = await verifyAdminAuth(req, sb);
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

      return res.status(200).json({
        ok: true,
        settings: config ? { ...config, daily_ca_target: config.current_affairs_target, daily_scheduler_enabled: config.daily_automation_enabled, synthesis_mode_enabled: false } : {
          daily_question_target: 1000,
          current_affairs_target: 150,
          daily_ca_target: 150,
          auto_approval_threshold: 0.93,
          gemini_ai_enabled: process.env.GEMINI_AI_ENABLED === 'true',
          daily_automation_enabled: true,
           daily_scheduler_enabled: true,
           synthesis_mode_enabled: false,
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
          }
        },
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
      const { data, error } = await sb
        .from('automation_settings')
        .upsert({
          id: 'default_config',
          daily_question_target: Number(updates.daily_question_target) || 1000,
          current_affairs_target: Number(updates.current_affairs_target ?? updates.daily_ca_target) || 150,
          auto_approval_threshold: Number(updates.auto_approval_threshold) || 0.93,
          gemini_ai_enabled: Boolean(updates.gemini_ai_enabled),
          daily_automation_enabled: Boolean(updates.daily_automation_enabled ?? updates.daily_scheduler_enabled),
          default_mock_questions: Number(updates.default_mock_questions) || 80,
          default_mock_count: Number(updates.default_mock_count) || 5,
          difficulty_ratio: updates.difficulty_ratio || { easy: 30, moderate: 50, hard: 20 },
          subject_quotas: updates.subject_quotas || {},
          exam_quotas: updates.exam_quotas || {},
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, settings: data });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withApiLogging(handler, 'automation-settings');
