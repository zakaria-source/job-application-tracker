import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const outputDir = resolve('dist/demo/browser');
const redirectsPath = resolve(outputDir, '_redirects');
const rawApiOrigin = process.env.JOBTRACKR_API_ORIGIN?.trim();
const rules = [];

if (rawApiOrigin) {
  const apiOrigin = normalizeApiOrigin(rawApiOrigin);
  rules.push(`/api/*  ${apiOrigin}/api/:splat  200`);
  console.log(`Netlify API proxy enabled for ${apiOrigin}`);
} else {
  console.log('JOBTRACKR_API_ORIGIN is not set; Netlify will deploy local-only mode.');
}

rules.push('/*  /index.html  200');

await mkdir(outputDir, {recursive: true});
await writeFile(redirectsPath, `${rules.join('\n')}\n`, 'utf8');

function normalizeApiOrigin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('JOBTRACKR_API_ORIGIN must be an absolute HTTPS URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('JOBTRACKR_API_ORIGIN must use HTTPS.');
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error('JOBTRACKR_API_ORIGIN must contain only the HTTPS origin, without path, query, credentials or fragment.');
  }

  return parsed.origin;
}
