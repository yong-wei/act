import { createHash } from 'node:crypto';

const baseUrl = (process.env.ILAB_BASE_URL || 'http://39.105.173.29').replace(/\/+$/, '');
const appId = process.env.ILAB_APP_ID || '10000';
const secret = process.env.ILAB_SECRET || 'probe-placeholder';
const ticket = process.env.ILAB_PROBE_TICKET || 'probe_ticket';
let decoded = ticket;
try {
  decoded = decodeURIComponent(ticket);
} catch {
  decoded = ticket;
}
const signature = createHash('md5').update(`${decoded}${appId}${secret}`, 'utf8').digest('hex').toUpperCase();
const url = `${baseUrl}/open/api/v2/token?ticket=${encodeURIComponent(decoded)}&appid=${encodeURIComponent(appId)}&signature=${signature}`;

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const body = (await response.text()).slice(0, 300);
  console.log(JSON.stringify({
    baseUrl,
    appId,
    httpStatus: response.status,
    usedConfiguredSecret: Boolean(process.env.ILAB_SECRET),
    body,
  }));
  if (response.status >= 500) process.exit(1);
} catch (error) {
  console.log(JSON.stringify({
    baseUrl,
    appId,
    reachable: false,
    error: error instanceof Error ? error.message : 'request failed',
  }));
  process.exit(1);
}
