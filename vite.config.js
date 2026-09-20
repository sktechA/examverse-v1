import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import adminCreateUserHandler from './server/api/admin-create-user.js';
import aiRepairHandler from './server/api/ai-repair.js';
import aiReviewHandler from './server/api/ai-review.js';
import mockGeneratorHandler from './server/api/mock-generator.js';
import syncCurrentAffairsHandler from './server/api/sync-current-affairs.js';
import dailySchedulerHandler from './server/api/daily-scheduler.js';
import automationSettingsHandler from './server/api/automation-settings.js';
import questionIntegrityHandler from './server/api/question-integrity-test.js';
import bilingualTranslateHandler from './server/api/bilingual-translate.js';
import systemLogsHandler from './server/api/system-logs.js';
import adminCleanupHandler from './server/api/admin-cleanup.js';
import geminiValidateHandler from './server/api/gemini-validate.js';
import testAllFunctionsHandler from './server/api/test-all-functions.js';
import syncExamCalendarHandler from './server/api/sync-exam-calendar.js';

const apiRoutes = {
  '/api/admin-create-user': adminCreateUserHandler,
  '/api/admin-manage-user': adminCreateUserHandler,
  '/api/ai-repair': aiRepairHandler,
  '/api/ai-review': aiReviewHandler,
  '/api/mock-generator': mockGeneratorHandler,
  '/api/sync-current-affairs': syncCurrentAffairsHandler,
  '/api/sync-exam-calendar': syncExamCalendarHandler,
  '/api/daily-scheduler': dailySchedulerHandler,
  '/api/automation-settings': automationSettingsHandler,
  '/api/question-integrity-test': questionIntegrityHandler,
  '/api/bilingual-translate': bilingualTranslateHandler,
  '/api/system-logs': systemLogsHandler,
  '/api/admin-cleanup': adminCleanupHandler,
  '/api/gemini-validate': geminiValidateHandler,
  '/api/test-all-functions': testAllFunctionsHandler
};

function apiMiddlewarePlugin() {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      // Development-only midnight scheduler. Production uses the Vercel cron below.
      let lastRanDate = '';
      const cronTimer = setInterval(async () => {
        try {
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
          }).formatToParts(new Date());
          const value = type => parts.find(p => p.type === type)?.value;
          const date = `${value('year')}-${value('month')}-${value('day')}`;
          if (value('hour') === '00' && value('minute') === '00' && lastRanDate !== date) {
            lastRanDate = date;
            await dailySchedulerHandler({ isInternal: true, method: 'POST', headers: {}, query: {}, body: {} }, {
              status: code => ({
                statusCode: code,
                json: data => console.log('[Dev Scheduler]', code, data)
              })
            });
          }
        } catch (e) {
          console.warn('[Dev Scheduler Check Error]:', e?.message || e);
        }
      }, 30000);
      cronTimer.unref?.();

      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const handler = apiRoutes[parsedUrl.pathname];
        if (!handler) return next();

        let bodyData = '';
        let bodyLength = 0;
        const MAX_BODY_BYTES = 5 * 1024 * 1024;
        let payloadTooLarge = false;

        req.on('data', chunk => {
          bodyLength += chunk.length;
          if (bodyLength > MAX_BODY_BYTES) {
            payloadTooLarge = true;
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Payload Too Large. Maximum allowed size is 5MB.' }));
            req.destroy();
            return;
          }
          bodyData += chunk;
        });

        req.on('end', async () => {
          if (payloadTooLarge) return;
          try { req.body = bodyData ? JSON.parse(bodyData) : {}; } catch { req.body = {}; }
          req.query = Object.fromEntries(parsedUrl.searchParams.entries());

          const mockRes = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            setHeader(key, val) { res.setHeader(key, val); return this; },
            json(data) { res.statusCode = this.statusCode; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return this; },
            send(data) { res.statusCode = this.statusCode; res.end(data); return this; },
            end(data) { res.statusCode = this.statusCode; res.end(data); return this; }
          };
          try { await handler(req, mockRes); }
          catch (err) {
            console.error(`API error on ${parsedUrl.pathname}:`, err?.message || err);
            if (!res.writableEnded) {
              mockRes.status(500).json({ error: 'An internal server error occurred while processing your request.' });
            }
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), apiMiddlewarePlugin()],
  server: { host: '0.0.0.0', port: 3000, allowedHosts: 'all' }
});
