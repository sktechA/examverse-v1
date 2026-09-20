import fs from 'node:fs';
import path from 'node:path';

const apiDir = path.resolve('api');
const files = fs.existsSync(apiDir)
  ? fs.readdirSync(apiDir).filter(name => {
      if (!name.endsWith('.js')) return false;
      if (name.startsWith('_')) return false;
      return true;
    })
  : [];

const limit = 12;
if (files.length > limit) {
  console.error(`Vercel Hobby protection: ${files.length}/${limit} functions. Deployment blocked.`);
  console.error(files.join('\n'));
  process.exit(1);
}
console.log(`Vercel Hobby protection: ${files.length}/${limit} production API function.`);
