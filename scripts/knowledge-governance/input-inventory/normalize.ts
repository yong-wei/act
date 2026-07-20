import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import type { Json } from './types';

export function normalizePath(value: string): string {
  if (/[\u0000-\u001f\u007f]/u.test(value)) throw new Error('path contains forbidden ASCII control characters');
  const posix = value.replaceAll('\\', '/').normalize('NFC');
  if (posix.startsWith('/') || /^[A-Za-z]:\//.test(posix)) throw new Error(`absolute path rejected: ${value}`);
  const normalized = path.posix.normalize(posix);
  if (normalized === '..' || normalized.startsWith('../')) throw new Error(`escaping path rejected: ${value}`);
  return normalized.replace(/^\.\//, '');
}

export function normalizeText(bytes: Buffer): string {
  let text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('input is not canonical UTF-8');
  if (text.charCodeAt(0) === 0xfeff) throw new Error('UTF-8 BOM is forbidden');
  return text.replace(/\r\n?/g, '\n').normalize('NFC');
}

export function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    const delta = left[i]!.codePointAt(0)! - right[i]!.codePointAt(0)!;
    if (delta !== 0) return delta;
  }
  return left.length - right.length;
}

export function sortUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.normalize('NFC')))].sort(compareCodePoints);
}

export function canonicalize(value: Json): Json {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => compareCodePoints(a, b)).map(([key, item]) => [key.normalize('NFC'), canonicalize(item)]));
  }
  return typeof value === 'string' ? value.normalize('NFC') : value;
}

export function canonicalJson(value: Json): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function taggedDigest(tag: string, value: string | Buffer): string {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  const prefix = Buffer.from(`${tag}\0${body.byteLength}\0`, 'utf8');
  return `sha256:${createHash('sha256').update(prefix).update(body).digest('hex')}`;
}

export async function normalizedFile(root: string, relativePath: string, options: { allowBinary?: boolean } = {}): Promise<{ path: string; digest: string; size: number; encoding: 'utf8-nfc-lf' | 'binary' }> {
  const safePath = normalizePath(relativePath);
  const absolute = path.join(root, safePath);
  if (options.allowBinary) {
    const size = (await stat(absolute)).size;
    const hash = createHash('sha256').update(Buffer.from(`repository-binary-file/v1\0${size}\0`, 'utf8'));
    for await (const chunk of createReadStream(absolute)) hash.update(chunk as Buffer);
    return { path: safePath, digest: `sha256:${hash.digest('hex')}`, size, encoding: 'binary' };
  }
  const bytes = await readFile(absolute);
  try {
    const normalized = Buffer.from(normalizeText(bytes), 'utf8');
    return { path: safePath, digest: taggedDigest('repository-text-file/v1', normalized), size: normalized.byteLength, encoding: 'utf8-nfc-lf' };
  } catch (error) {
    throw error;
  }
}
