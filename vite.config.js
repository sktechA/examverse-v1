import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Server-side handlers
import adminCreateUserHandler from './api/admin-create-user.js';
import aiRepairHandler from './api/ai-repair.js';
import aiReviewHandler from './api/ai-review.js';
import geminiValidateHandler from './api/gemini-validate.js';
import mockGeneratorHandler from './api/mock-generator.js';
import syncCurrentAffairsHandler from './api/sync-current-affairs.js';
import dailySchedulerHandler from './api/daily-scheduler.js';
import automationSettingsHandler from './api/automation-settings.js';
import questionIntegrityHandler from './api/question-integrity-test.js';
import bilingualTranslateHandler from './api/bilingual-translate.js';
import systemLogsHandler from './api/system-logs.js';
import adminCleanupHandler from './api/admin-cleanup.js';

const apiRoutes = {
  '/api/admin-create-user': adminCreateUserHandler,
  '/api/admin-manage-user': adminCreateUserHandler,
  '/api/ai-repair': aiRepairHandler,
  '/api/ai-review': aiReviewHandler,
  '/api/gemini-validate': geminiValidateHandler,
  '/api/mock-generator': mockGeneratorHandler,
  '/api/sync-current-affairs': syncCurrentAffairsHandler,
  '/api/daily-scheduler': dailySchedulerHandler,
  '/api/automation-settings': automationSettingsHandler,
  '/api/question-integrity-test': questionIntegrityHandler,
  '/api/bilingual-translate': bilingualTranslateHandler,
  '/api/system-logs': systemLogsHandler,
  '/api/admin-cleanup': adminCleanupHandler
};

function apiMiddlewarePlugin() {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      // 00:00 Asia/Kolkata server-side in-process scheduler
      let lastRanDate = '';
      const cronTimer = setInterval(async () => {
        try {
          const kolkataFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          const parts = kolkataFormatter.formatToParts(new Date());
          const year = parts.find(p => p.type === 'year')?.value;
          const month = parts.find(p => p.type === 'month')?.value;
          const day = parts.find(p => p.type === 'day')?.value;
          const hour = parts.find(p => p.type === 'hour')?.value;
          const minute = parts.find(p => p.type === 'minute')?.value;

          const currentDateStr = `${year}-${month}-${day}`;
          if (hour === '00' && minute === '00' && lastRanDate !== currentDateStr) {
            lastRanDate = currentDateStr;
            console.log(`[00:00 Asia/Kolkata Cron] Triggering daily automation for ${currentDateStr}...`);
            await dailySchedulerHandler({ isInternal: true }, null);
          }
        } catch (e) {
          console.warn('[00:00 Scheduler Check Error]:', e.message);
        }
      }, 30000); // Check every 30 seconds
      if (typeof cronTimer?.unref === 'function') {
        cronTimer.unref();
      }

      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const pathname = parsedUrl.pathname;
        const handler = apiRoutes[pathname];

        if (handler) {
          let bodyData = '';
          let bodyLength = 0;
          const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB strict payload ceiling
          let payloadTooLarge = false;

          req.on('data', chunk => {
            bodyLength += chunk.length;
            if (bodyLength > MAX_BODY_BYTES) {
              payloadTooLarge = true;
              req.destroy();
              res.statusCode = 413;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Payload Too Large. Maximum allowed size is 5MB.' }));
              return;
            }
            bodyData += chunk;
          });

          req.on('end', async () => {
            if (payloadTooLarge) return;

            try {
              req.body = bodyData ? JSON.parse(bodyData) : {};
            } catch (_) {
              req.body = {};
            }
            req.query = Object.fromEntries(parsedUrl.searchParams.entries());

            const mockRes = {
              statusCode: 200,
              status(code) {
                this.statusCode = code;
                return this;
              },
              setHeader(key, val) {
                res.setHeader(key, val);
                return this;
              },
              json(data) {
                res.statusCode = this.statusCode;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return this;
              },
              send(data) {
                res.statusCode = this.statusCode;
                res.end(data);
                return this;
              }
            };

            try {
              await handler(req, mockRes);
            } catch (err) {
              console.error(`API error on ${pathname}:`, err?.message);
              mockRes.status(500).json({ error: 'An internal server error occurred while processing your request.' });
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), apiMiddlewarePlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all'
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
          }
        }
      }
    }
  }
});
