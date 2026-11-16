// Replays browser-observed public resource URLs and measures encoded response bodies.
import http from 'node:http';
import https from 'node:https';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
mkdirSync('.logs', { recursive: true });
const count = Number(option('--concurrency', '7'));
const label = option('--label', `entry-n${count}`);
const fallback = process.argv.includes('--fallback');
const manifest = JSON.parse(readFileSync(option('--manifest', '.tmp/load-asset-manifest.json')));
const courseKeys = Object.keys(manifest.byCourse);
const events = [],
  clients = [],
  intervals = new Map(),
  outcomes = [];
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: Math.max(32, count * 6) });
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: Math.max(32, count * 6) });
const startedAt = Date.now();
async function get(url, client, attempt = 0) {
  const begin = performance.now();
  const row = {
    host: new URL(url).hostname,
    path: new URL(url).pathname,
    client,
    attempt,
    bytes: 0,
    status: 0,
  };
  try {
    await new Promise((resolve, reject) => {
      const req = (url.startsWith('https:') ? https : http).get(
        url,
        {
          agent: url.startsWith('https:') ? httpsAgent : httpAgent,
          timeout: 60000,
          headers: {
            origin: manifest.origin,
            'accept-encoding': 'gzip, br',
            'user-agent': `ACT-cold-entry/${label}`,
          },
        },
        (res) => {
          row.status = res.statusCode;
          row.headers = Object.fromEntries(
            [
              'content-encoding',
              'cache-control',
              'age',
              'via',
              'x-cache',
              'x-cache-lookup',
              'x-swift-cachetime',
              'x-swift-savetime',
              'ali-swift-global-savetime',
            ].flatMap((key) => (res.headers[key] === undefined ? [] : [[key, res.headers[key]]])),
          );
          res.on('data', (chunk) => {
            row.bytes += chunk.length;
            const second = Math.floor((Date.now() - startedAt) / 1000);
            const bin = intervals.get(second) ?? {};
            bin[row.host] = (bin[row.host] ?? 0) + chunk.length;
            intervals.set(second, bin);
          });
          res.on('error', reject);
          res.on('end', resolve);
        },
      );
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
    });
  } catch (error) {
    row.error = String(error.message).slice(0, 200);
  }
  row.ms = performance.now() - begin;
  row.at = Date.now();
  events.push(row);
  if (attempt === 0 && (row.status !== 200 || row.error)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return get(url, client, 1);
  }
  outcomes.push(row);
}
try {
  await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const key = courseKeys[index % courseKeys.length];
      const urls = [`${manifest.origin}/simulations/${key}`, ...manifest.byCourse[key]].map(
        (value) => {
          const url = new URL(value);
          return fallback && url.hostname === 'static.adapt-learn.online'
            ? `${manifest.origin}/assets${url.pathname}`
            : value;
        },
      );
      let cursor = 0;
      const start = performance.now();
      await Promise.all(
        Array.from({ length: 6 }, async () => {
          while (cursor < urls.length) {
            const url = urls[cursor++];
            await get(url, index);
          }
        }),
      );
      clients.push({
        course: key,
        ms: performance.now() - start,
        bytes: events
          .filter((row) => row.client === index)
          .reduce((sum, row) => sum + row.bytes, 0),
      });
    }),
  );
} finally {
  httpsAgent.destroy();
  httpAgent.destroy();
}
const elapsedS = (Date.now() - startedAt) / 1000;
const byHost = Object.fromEntries(
  [...new Set(events.map((row) => row.host))].map((host) => {
    const rows = events.filter((row) => row.host === host),
      bytes = rows.reduce((sum, row) => sum + row.bytes, 0);
    return [host, { requests: rows.length, bytes, mbps: (bytes * 8) / elapsedS / 1e6 }];
  }),
);
const bytes = events.reduce((sum, row) => sum + row.bytes, 0);
const errors = events.filter((row) => row.status !== 200 || row.error);
const series = Array.from({ length: Math.ceil(elapsedS) }, (_, second) => ({
  second,
  byHost: intervals.get(second) ?? {},
}));
const totals = series.map((row) =>
  Object.values(row.byHost).reduce((sum, bytes) => sum + bytes, 0),
);
const peakSustained10SecondMbps =
  (Math.max(
    ...totals.map(
      (_, index) => totals.slice(index, index + 10).reduce((sum, bytes) => sum + bytes, 0) / 10,
    ),
  ) *
    8) /
  1e6;
const result = {
  label,
  concurrency: count,
  fallback,
  startedAt: new Date(startedAt).toISOString(),
  elapsedS,
  bytes,
  combinedMbps: (bytes * 8) / elapsedS / 1e6,
  completedEntriesPerMinute: (count / elapsedS) * 60,
  byHost,
  clients,
  errors,
  requests: events.length,
  peakOneSecondMbps: (Math.max(...totals) * 8) / 1e6,
  peakSustained10SecondMbps,
  series,
  unrecoveredErrors: outcomes.filter((row) => row.status !== 200 || row.error).length,
  byteScope:
    'encoded HTTP entity bodies sampled as received; app plus ESA, headers/TLS excluded; OSS origin not added',
  events,
};
writeFileSync(`.logs/load-${label}.json`, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({
    label,
    concurrency: count,
    elapsedS,
    bytes,
    combinedMbps: result.combinedMbps,
    byHost,
    errors: errors.length,
  }),
);
if (result.unrecoveredErrors) process.exitCode = 1;
