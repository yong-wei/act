#!/usr/bin/env node
/**
 * Fail-closed local database identity check for Cloud Agent start.
 *
 * PrismaPg / pg pass DATABASE_URL to pg-connection-string, which lets query
 * parameters such as host= and port= override the URL authority. Do not use a
 * regex that allows arbitrary query strings.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pgConnectionString from 'pg-connection-string';

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1']);
const ALLOWED_QUERY_KEYS = new Set(['schema']);
const ALLOWED_SCHEMAS = new Set(['public', 'shadow']);

function stripQuotes(raw) {
  return String(raw ?? '').trim().replace(/^['"]|['"]$/g, '');
}

export function assertLocalActObeUrl(label, raw) {
  const url = stripQuotes(raw);
  if (!url) {
    throw new Error(`${label} is empty`);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }

  if (parsedUrl.protocol !== 'postgresql:' && parsedUrl.protocol !== 'postgres:') {
    throw new Error(`${label} must use postgres or postgresql`);
  }

  const extraKeys = [...parsedUrl.searchParams.keys()].filter(
    (key) => !ALLOWED_QUERY_KEYS.has(key.toLowerCase()),
  );
  if (extraKeys.length) {
    throw new Error(
      `${label} has query parameters that can change the connection target: ${extraKeys.join(', ')}`,
    );
  }

  const schema = parsedUrl.searchParams.get('schema');
  if (schema && !ALLOWED_SCHEMAS.has(schema)) {
    throw new Error(`${label} schema must be public or shadow`);
  }

  const parsed = pgConnectionString.parse(url);
  const host = parsed.host ?? '';
  const port = String(parsed.port ?? '5432');
  if (!ALLOWED_HOSTS.has(host) || port !== '5432') {
    throw new Error(`${label} resolved to ${host}:${port}, not local act_obe`);
  }
  if (parsed.user !== 'act_user' || parsed.password !== 'act_pass' || parsed.database !== 'act_obe') {
    throw new Error(`${label} is not the local act_user/act_obe identity`);
  }
}

function main() {
  try {
    assertLocalActObeUrl('DATABASE_URL', process.env.DATABASE_URL);
    if (process.env.SHADOW_DATABASE_URL) {
      assertLocalActObeUrl('SHADOW_DATABASE_URL', process.env.SHADOW_DATABASE_URL);
    }
  } catch (error) {
    console.error(`[start] Refusing database writes: ${error.message}`);
    console.error(
      '[start] Expected postgresql://act_user:act_pass@localhost:5432/act_obe?schema=public (host may be 127.0.0.1; query may only set schema=public|shadow).',
    );
    process.exit(1);
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main();
}
