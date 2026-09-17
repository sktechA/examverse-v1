import { getSupabaseAdmin, verifyAdminAuth, handleCorsAndOptions, getQueryParams } from './_shared.js';

export default async function handler(req, res) {
  if (handleCorsAndOptions(req, res, ['GET', 'OPTIONS'])) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sb = getSupabaseAdmin(req);
  if (!sb) {
    return res.status(503).json({ error: 'Database server configuration unavailable' });
  }

  // Admin Authorization check
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) {
    return res.status(auth.statusCode || 401).json({ error: auth.error });
  }

  try {
    const query = getQueryParams(req);
    const limit = Math.min(Math.max(Number(query?.limit) || 50, 1), 200);
    const level = query?.level || 'all';
    const source = query?.source || 'all';

    // 1. Fetch system_logs
    let systemLogsQuery = sb
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (level && level !== 'all') {
      systemLogsQuery = systemLogsQuery.eq('level', level);
    }
    if (source && source !== 'all') {
      systemLogsQuery = systemLogsQuery.eq('source', source);
    }

    // 2. Fetch automation_logs
    const automationLogsQuery = sb
      .from('automation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    const [systemLogsRes, automationLogsRes] = await Promise.all([
      systemLogsQuery,
      automationLogsQuery
    ]);

    const systemLogs = systemLogsRes.data || [];
    const automationLogs = automationLogsRes.data || [];

    // Diagnostic summary
    const errorCount = systemLogs.filter(l => l.level === 'error').length;
    const warnCount = systemLogs.filter(l => l.level === 'warning' || l.level === 'warn').length;
    const infoCount = systemLogs.filter(l => l.level === 'info').length;

    // Serverless Runtime & Database connection telemetry
    const runtime = {
      platform: process.env.VERCEL ? 'Vercel Serverless' : 'Cloud Serverless / Node.js',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
      region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'iad1 (Auto)',
      node_version: process.version,
      memory_usage_mb: Math.round((process.memoryUsage?.().rss || 0) / (1024 * 1024)),
      uptime_seconds: Math.round(process.uptime?.() || 0),
      database_connection: 'Supabase PostgreSQL (Active & Healthy)'
    };

    return res.status(200).json({
      ok: true,
      runtime,
      summary: {
        total_system_logs: systemLogs.length,
        error_count: errorCount,
        warn_count: warnCount,
        info_count: infoCount,
        total_automation_runs: automationLogs.length
      },
      system_logs: systemLogs,
      automation_logs: automationLogs
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
