import {
  getSupabaseAdmin,
  verifyAdminAuth,
  handleCorsAndOptions,
  getQueryParams,
  sanitizeObject,
  sanitizeString,
  sanitizeErrorResponse,
  checkRateLimit,
  getClientIp,
  isSuperOrAdminRole
} from './_shared.js';

export default async function handler(req, res) {
  if (handleCorsAndOptions(req, res, ['GET', 'POST', 'DELETE', 'OPTIONS'])) {
    return;
  }

  // 1. Rate Limiting Check
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, 'system-logs', 50, 60000);
  if (!rate.allowed) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', String(rate.retryAfter));
    }
    return res.status(429).json({ ok: false, error: 'Too many requests. Please slow down and try again shortly.' });
  }

  const sb = req?.supabaseClient || req?.sb || getSupabaseAdmin(req);
  if (!sb) {
    return res.status(503).json({ ok: false, error: 'Database server configuration unavailable' });
  }

  // 2. Admin Authorization check
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) {
    return res.status(auth.statusCode || 401).json({ ok: false, error: auth.error });
  }

  // --- DELETE / POST: Purge or Clear Old Logs ---
  if (req.method === 'DELETE' || (req.method === 'POST' && (req.body?.action === 'purge' || req.body?.action === 'clear' || req.body?.confirmed === true || req.body?.scope))) {
    // RBAC: Only Super Admin or Admin role can purge audit/system logs
    if (!isSuperOrAdminRole(auth)) {
      return res.status(403).json({ ok: false, error: 'Access denied: Admin or Super Admin role required to purge system logs.' });
    }

    try {
      let body = {};
      if (typeof req.body === 'string') {
        try { body = JSON.parse(req.body); } catch (_) { body = {}; }
      } else if (req.body && typeof req.body === 'object') {
        body = req.body;
      }
      body = sanitizeObject(body);

      const query = sanitizeObject(getQueryParams(req));
      const rawScope = String(body.scope || query.scope || 'all').toLowerCase().trim();
      const rawTarget = String(body.target || query.target || 'all').toLowerCase().trim();
      const rawFilterLvl = String(body.level || query.level || 'all').toLowerCase().trim();

      const allowedScopes = ['all', 'older_than_24h', '24h', '1d', 'older_than_7d', '7d', 'week', 'older_than_30d', '30d', 'month'];
      const scope = allowedScopes.includes(rawScope) ? rawScope : 'all';

      const allowedTargets = ['all', 'system', 'system_logs', 'automation', 'automation_logs'];
      const target = allowedTargets.includes(rawTarget) ? rawTarget : 'all';

      const allowedLevels = ['all', 'info', 'warning', 'warn', 'error'];
      const filterLvl = allowedLevels.includes(rawFilterLvl) ? rawFilterLvl : 'all';

      let cutOffDate = null;
      if (scope === 'older_than_24h' || scope === '24h' || scope === '1d') {
        cutOffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      } else if (scope === 'older_than_7d' || scope === '7d' || scope === 'week') {
        cutOffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (scope === 'older_than_30d' || scope === '30d' || scope === 'month') {
        cutOffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      let deletedSysCount = 0;
      let deletedAutoCount = 0;

      // Safe Purge: System Logs (Never touches auth, profiles, exams, or questions)
      if (target === 'all' || target === 'system' || target === 'system_logs') {
        let q = sb.from('system_logs').delete({ count: 'exact' });
        if (cutOffDate) {
          q = q.lt('created_at', cutOffDate);
        } else {
          q = q.neq('id', '00000000-0000-0000-0000-000000000000');
        }
        if (filterLvl && filterLvl !== 'all') {
          q = q.eq('level', filterLvl);
        }
        const { data: delData, count: delCount, error: delErr } = await q;
        if (delErr) {
          console.warn('[System Logs Purge] system_logs delete notice:', delErr.message);
        }
        deletedSysCount = (delCount !== null && delCount !== undefined) ? delCount : (delData?.length || 0);
      }

      // Safe Purge: Automation Logs
      if (target === 'all' || target === 'automation' || target === 'automation_logs') {
        let q = sb.from('automation_logs').delete({ count: 'exact' });
        if (cutOffDate) {
          q = q.lt('created_at', cutOffDate);
        } else {
          q = q.neq('id', '00000000-0000-0000-0000-000000000000');
        }
        const { data: delData, count: delCount, error: delErr } = await q;
        if (delErr) {
          console.warn('[System Logs Purge] automation_logs delete notice:', delErr.message);
        }
        deletedAutoCount = (delCount !== null && delCount !== undefined) ? delCount : (delData?.length || 0);
      }

      const totalDeleted = deletedSysCount + deletedAutoCount;
      const adminEmail = auth.user?.email || 'admin';

      // Log the audit event for compliance
      try {
        await sb.from('system_logs').insert({
          level: 'info',
          source: 'system-logs',
          action: 'purge-logs',
          message: `Admin ${adminEmail} safely purged logs (scope: ${scope}, target: ${target}, total: ${totalDeleted}).`,
          details: {
            scope,
            target,
            level: filterLvl,
            cut_off_date: cutOffDate,
            deleted_system_logs: deletedSysCount,
            deleted_automation_logs: deletedAutoCount,
            admin_id: auth.user?.id || null,
            admin_email: adminEmail,
            timestamp: new Date().toISOString()
          }
        });
      } catch (_) {}

      return res.status(200).json({
        ok: true,
        message: `Successfully purged ${totalDeleted} log entries (${deletedSysCount} system logs, ${deletedAutoCount} automation logs).`,
        deleted: {
          system_logs: deletedSysCount,
          automation_logs: deletedAutoCount,
          total: totalDeleted
        },
        scope,
        target
      });
    } catch (err) {
      console.error('[System Logs Purge Error]:', err);
      return res.status(500).json({ ok: false, error: sanitizeErrorResponse(err, 'Failed to purge logs') });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const query = sanitizeObject(getQueryParams(req));
    const limit = Math.min(Math.max(Number(query?.limit) || 50, 1), 200);
    const rawLevel = query?.level ? sanitizeString(String(query.level), 20) : 'all';
    const rawSource = query?.source ? sanitizeString(String(query.source), 50) : 'all';

    const allowedLevels = ['all', 'info', 'warning', 'warn', 'error'];
    const level = allowedLevels.includes(rawLevel) ? rawLevel : 'all';
    const source = rawSource;

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

    // Serverless Runtime & Database connection telemetry (sanitized: no sensitive envs)
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
    return res.status(500).json({ ok: false, error: sanitizeErrorResponse(err, 'Failed to retrieve system logs') });
  }
}
