import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = f => fs.readFileSync(path.join(root,f),'utf8');
const checks = [
  ['OpenAI helper', read('server/api/_shared.js'), ['OPENAI_API_KEY','callOpenAIJsonWithRetry','writeAiPipelineLog']],
  ['Generation fallback', read('server/api/daily-scheduler.js'), ['generation-fallback','callOpenAIJsonWithRetry','fallback_provider']],
  ['Review fallback', read('server/api/daily-scheduler.js'), ['review-fallback','OpenAI Question Review']],
  ['Review endpoint fallback', read('server/api/ai-review.js'), ['gemini-review-fallback','OpenAI Question Review Fallback']],
  ['Repair fallback', read('server/api/ai-repair.js'), ['gemini-repair-fallback','OpenAI Question Repair Fallback']],
  ['Admin AI chat', read('server/api/ai-chat.js'), ['Gemini Admin Diagnostic Chat','OpenAI Admin Diagnostic Chat','chat-success','chat-failed']],
  ['Single Vercel API entry', read('api/[...path].js'), ["['ai-chat', aiChatHandler]"]],
  ['Admin AI chat UI', read('src/components/DailyAutomation.jsx'), ['AI Diagnostic Chat','/api/ai-chat','Test AI']],
  ['Detailed log UI', read('src/components/DailyAutomation.jsx'), ['AI / Connection Details','l.details','JSON.stringify(l.details']]
];
let failed=0;
for (const [name, content, needles] of checks) {
  const ok=needles.every(n=>content.includes(n));
  console.log(`${ok?'PASS':'FAIL'}: ${name}`);
  if(!ok) failed++;
}
console.log(`AI PIPELINE STATIC TEST: ${failed ? 'FAIL' : 'PASS'}`);
process.exitCode=failed?1:0;
