import adminCleanupHandler from '../server/api/admin-cleanup.js';
import adminCreateUserHandler from '../server/api/admin-create-user.js';
import aiRepairHandler from '../server/api/ai-repair.js';
import aiReviewHandler from '../server/api/ai-review.js';
import automationSettingsHandler from '../server/api/automation-settings.js';
import bilingualTranslateHandler from '../server/api/bilingual-translate.js';
import dailySchedulerHandler from '../server/api/daily-scheduler.js';
import mockGeneratorHandler from '../server/api/mock-generator.js';
import questionIntegrityHandler from '../server/api/question-integrity-test.js';
import syncCurrentAffairsHandler from '../server/api/sync-current-affairs.js';
import systemLogsHandler from '../server/api/system-logs.js';
import geminiValidateHandler from '../server/api/gemini-validate.js';
import testAllFunctionsHandler from '../server/api/test-all-functions.js';
import syncExamCalendarHandler from '../server/api/sync-exam-calendar.js';

const routes = new Map([
  ['admin-create-user', adminCreateUserHandler],
  ['admin-manage-user', adminCreateUserHandler],
  ['admin-cleanup', adminCleanupHandler],
  ['ai-repair', aiRepairHandler],
  ['ai-review', aiReviewHandler],
  ['automation-settings', automationSettingsHandler],
  ['bilingual-translate', bilingualTranslateHandler],
  ['daily-scheduler', dailySchedulerHandler],
  ['mock-generator', mockGeneratorHandler],
  ['question-integrity-test', questionIntegrityHandler],
  ['sync-current-affairs', syncCurrentAffairsHandler],
  ['sync-exam-calendar', syncExamCalendarHandler],
  ['system-logs', systemLogsHandler],
  ['gemini-validate', geminiValidateHandler],
  ['test-all-functions', testAllFunctionsHandler]
]);

function getRouteName(req) {
  const raw = String(req?.query?.path ?? '');
  if (raw) return raw.replace(/^\/+|\/+$/g, '').split('/')[0];
  const pathname = new URL(req?.url || '/', 'http://localhost').pathname;
  const match = pathname.match(/^\/api\/([^/]+)/);
  return match?.[1] || '';
}

function normalizeRequest(req) {
  const routeName = getRouteName(req);
  if (!req.query || typeof req.query !== 'object') req.query = {};
  req.query.route = routeName;
  return routeName;
}

export default async function handler(req, res) {
  const routeName = normalizeRequest(req);
  const target = routes.get(routeName);

  if (!target) {
    res.statusCode = 404;
    res.setHeader?.('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'API route not found' }));
  }

  try {
    return await target(req, res);
  } catch (error) {
    console.error(`[API Gateway] ${routeName}:`, error?.message || error);
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader?.('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'Internal server error' }));
  }
}
