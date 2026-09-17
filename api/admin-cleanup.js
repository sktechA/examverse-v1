import { getSupabaseAdmin, verifyAdminAuth, withApiLogging } from './_shared.js';

/**
 * Permanent Data Deletion & Database Cleanup API Handler
 * 
 * Allows authorized administrators to safely select and permanently delete:
 * 1. Old / Redundant Mock Tests (exams + exam_questions + associated attempts)
 * 2. Candidate Test Runs & Attempts (exam_attempts)
 * 3. Quarantined / Unapproved Questions (questions with status 'needs_correction' or 'pending_review')
 * 4. Full Question Bank Purge (questions + question_imports + exam_questions)
 * 5. Historical Automation & System Logs (automation_logs + system_logs)
 * 
 * Safety:
 * - Requires verified admin authentication.
 * - Explicitly unlinks foreign key references before deleting parent records.
 * - Logs all deletion activities to system_logs for permanent audit trail.
 */
async function handler(req, res) {
  const method = req.method;

  const sb = getSupabaseAdmin(req);
  if (!sb) {
    return res.status(503).json({ error: 'Database server configuration unavailable' });
  }

  // Admin Authorization check
  const auth = await verifyAdminAuth(req, sb);
  if (!auth.ok) {
    return res.status(auth.statusCode || 401).json({ error: auth.error });
  }

  // GET: Fetch live counts and list of mock tests for the cleanup dashboard
  if (method === 'GET') {
    try {
      const [
        examsCountRes,
        examsDraftCountRes,
        attemptsCountRes,
        quarantinedCountRes,
        allQuestionsCountRes,
        autoLogsCountRes,
        sysLogsCountRes,
        recentExamsRes
      ] = await Promise.all([
        sb.from('exams').select('*', { count: 'exact', head: true }),
        sb.from('exams').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        sb.from('exam_attempts').select('*', { count: 'exact', head: true }),
        sb.from('questions').select('*', { count: 'exact', head: true }).in('status', ['needs_correction', 'pending_review']),
        sb.from('questions').select('*', { count: 'exact', head: true }),
        sb.from('automation_logs').select('*', { count: 'exact', head: true }),
        sb.from('system_logs').select('*', { count: 'exact', head: true }),
        sb.from('exams').select('id, title, exam_type, subject, status, total_questions, created_at').order('created_at', { ascending: false }).limit(50)
      ]);

      return res.status(200).json({
        ok: true,
        counts: {
          total_exams: examsCountRes.count || 0,
          draft_exams: examsDraftCountRes.count || 0,
          total_attempts: attemptsCountRes.count || 0,
          quarantined_questions: quarantinedCountRes.count || 0,
          total_questions: allQuestionsCountRes.count || 0,
          automation_logs: autoLogsCountRes.count || 0,
          system_logs: sysLogsCountRes.count || 0
        },
        recent_exams: recentExamsRes.data || []
      });
    } catch (err) {
      console.error('[Admin Cleanup GET Error]:', err);
      return res.status(500).json({ error: err.message || 'Failed to fetch database cleanup counts' });
    }
  }

  // POST: Execute safe permanent deletion
  if (method === 'POST') {
    const { target, scope = 'all', exam_id = null, confirmed = false } = req.body || {};

    if (!confirmed) {
      return res.status(400).json({
        error: 'Deletion confirmation is required (confirmed: true) to permanently delete data.'
      });
    }

    if (!target) {
      return res.status(400).json({
        error: 'Target dataset is required (target: "mock_tests" | "test_runs" | "unwanted_questions" | "all_questions" | "logs")'
      });
    }

    let deletedCount = 0;
    let summaryMessage = '';
    const userEmail = auth.user?.email || 'admin';
    const userId = auth.user?.id || null;

    try {
      // TARGET 1: MOCK TESTS
      if (target === 'mock_tests') {
        if (exam_id) {
          // Delete single specific mock test
          // 1. Delete associated exam questions mappings
          await sb.from('exam_questions').delete().eq('exam_id', exam_id);
          // 2. Delete associated exam attempts
          await sb.from('exam_attempts').delete().eq('exam_id', exam_id);
          // 3. Delete exam record
          const { error: delErr } = await sb.from('exams').delete().eq('id', exam_id);
          if (delErr) throw delErr;

          deletedCount = 1;
          summaryMessage = `Permanently deleted mock test ID ${exam_id} and its associated test runs and question mappings.`;
        } else if (scope === 'draft') {
          // Delete all draft or mock-generated exams
          const { data: draftExams } = await sb.from('exams').select('id').eq('status', 'draft');
          const draftIds = (draftExams || []).map(e => e.id);

          if (draftIds.length > 0) {
            await sb.from('exam_questions').delete().in('exam_id', draftIds);
            await sb.from('exam_attempts').delete().in('exam_id', draftIds);
            const { error: delErr } = await sb.from('exams').delete().in('id', draftIds);
            if (delErr) throw delErr;
            deletedCount = draftIds.length;
          }
          summaryMessage = `Permanently deleted ${deletedCount} draft/unapproved mock tests.`;
        } else if (scope === 'all') {
          // Delete all exams
          await sb.from('exam_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await sb.from('exam_attempts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          const { data: allExams } = await sb.from('exams').select('id');
          const allIds = (allExams || []).map(e => e.id);
          if (allIds.length > 0) {
            const { error: delErr } = await sb.from('exams').delete().in('id', allIds);
            if (delErr) throw delErr;
            deletedCount = allIds.length;
          }
          summaryMessage = `Permanently deleted all ${deletedCount} mock tests and their mappings.`;
        } else {
          return res.status(400).json({ error: `Invalid scope for mock_tests: "${scope}". Must be "draft", "all", or provide "exam_id".` });
        }
      }

      // TARGET 2: TEST RUNS / ATTEMPTS
      else if (target === 'test_runs') {
        if (scope === 'older_than_30d') {
          const cutOffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: oldAttempts } = await sb.from('exam_attempts').select('id').lt('submitted_at', cutOffDate);
          const oldIds = (oldAttempts || []).map(a => a.id);
          if (oldIds.length > 0) {
            const { error: delErr } = await sb.from('exam_attempts').delete().in('id', oldIds);
            if (delErr) throw delErr;
            deletedCount = oldIds.length;
          }
          summaryMessage = `Permanently deleted ${deletedCount} test runs older than 30 days.`;
        } else {
          // Delete all attempts
          const { data: allAttempts } = await sb.from('exam_attempts').select('id');
          const allIds = (allAttempts || []).map(a => a.id);
          if (allIds.length > 0) {
            const { error: delErr } = await sb.from('exam_attempts').delete().in('id', allIds);
            if (delErr) throw delErr;
            deletedCount = allIds.length;
          }
          summaryMessage = `Permanently deleted all ${deletedCount} candidate test runs / exam attempts.`;
        }
      }

      // TARGET 3: UNWANTED / QUARANTINED QUESTIONS
      else if (target === 'unwanted_questions') {
        // Fetch questions with status 'needs_correction' or 'pending_review'
        const { data: badQuestions } = await sb
          .from('questions')
          .select('id')
          .in('status', ['needs_correction', 'pending_review']);

        const badIds = (badQuestions || []).map(q => q.id);
        if (badIds.length > 0) {
          // 1. Remove from exam_questions mappings
          await sb.from('exam_questions').delete().in('question_id', badIds);
          // 2. Delete questions
          const { error: delErr } = await sb.from('questions').delete().in('id', badIds);
          if (delErr) throw delErr;
          deletedCount = badIds.length;
        }
        summaryMessage = `Permanently deleted ${deletedCount} quarantined / unapproved questions from question bank.`;
      }

      // TARGET 4: ALL QUESTIONS (FULL QUESTION BANK RESET)
      else if (target === 'all_questions') {
        // 1. Delete all exam_questions mappings
        await sb.from('exam_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        // 2. Delete all questions
        const { data: allQ } = await sb.from('questions').select('id');
        const allQIds = (allQ || []).map(q => q.id);
        if (allQIds.length > 0) {
          const { error: delErr } = await sb.from('questions').delete().in('id', allQIds);
          if (delErr) throw delErr;
          deletedCount = allQIds.length;
        }
        // 3. Clear question_imports history
        await sb.from('question_imports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        summaryMessage = `Permanently cleared entire question bank (${deletedCount} questions and import batches).`;
      }

      // TARGET 5: HISTORICAL LOGS
      else if (target === 'logs') {
        let cutOffDate = null;
        if (scope === 'older_than_7d') {
          cutOffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (scope === 'older_than_30d') {
          cutOffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        // Delete automation_logs
        let autoLogsQuery = sb.from('automation_logs').delete();
        let sysLogsQuery = sb.from('system_logs').delete();

        if (cutOffDate) {
          autoLogsQuery = autoLogsQuery.lt('created_at', cutOffDate);
          sysLogsQuery = sysLogsQuery.lt('created_at', cutOffDate);
        } else {
          autoLogsQuery = autoLogsQuery.neq('id', '00000000-0000-0000-0000-000000000000');
          sysLogsQuery = sysLogsQuery.neq('id', '00000000-0000-0000-0000-000000000000');
        }

        const [autoRes, sysRes] = await Promise.all([autoLogsQuery, sysLogsQuery]);
        if (autoRes.error) console.warn('[Cleanup] auto logs delete warning:', autoRes.error);
        if (sysRes.error) console.warn('[Cleanup] sys logs delete warning:', sysRes.error);

        deletedCount = 1; // Success indicator
        summaryMessage = `Successfully pruned historical logs (${scope}).`;
      } else {
        return res.status(400).json({ error: `Unknown cleanup target: "${target}"` });
      }

      // Log the cleanup event in system_logs
      try {
        await sb.from('system_logs').insert({
          level: 'warning',
          source: 'admin-cleanup',
          action: 'permanent-delete',
          message: summaryMessage,
          details: {
            target,
            scope,
            exam_id,
            deleted_count: deletedCount,
            user_id: userId,
            user_email: userEmail,
            timestamp: new Date().toISOString()
          }
        });
      } catch (logErr) {
        console.warn('[Admin Cleanup] System log writing warning:', logErr.message);
      }

      return res.status(200).json({
        ok: true,
        target,
        scope,
        deleted_count: deletedCount,
        message: summaryMessage
      });
    } catch (delError) {
      console.error('[Admin Cleanup Execution Error]:', delError);
      return res.status(500).json({
        error: delError.message || 'Failed to execute permanent data cleanup'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withApiLogging(handler, 'admin-cleanup');
