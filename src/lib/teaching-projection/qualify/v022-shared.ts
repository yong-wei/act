/** Shared helpers for inactive v0.22 qualification. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionSha256 } from '../hash';

export const V022_SNAPSHOT =
  'snap-9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151';
export const V022_RELEASE_ID = 'ctr:release:control-theory-engineering-v0.22';
export const V09_SNAPSHOT =
  'snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7';
export const V09_RELEASE_ID = 'ctr:release:control-theory-engineering-v0.9';
export const V09_PROJECTION =
  'proj-769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d';
export const V09_PREREQUISITE =
  'proj-b8100a7f322e588a620a2869b5fccafa22d501de9a85bb5882a7c56e9528a21b';
export const V09_SHARD_SET =
  'ads-6328487edecd02ed5da3c7c66b80f458a1bce59e5b26c6cc06a8f611636a6196';
export const V09_ACTIVATION = 'first-cutover-7f4cdd1084af-769b1a832622';

export const AUTHORITY_CANDIDATE_RELATIVE =
  'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.22';
export const TEACHING_CANDIDATE_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.22';
export const CATALOG_CANDIDATE_RELATIVE =
  'course-content/authoring/knowledge/authority-domain-catalog/candidates/control-theory-engineering-v0.22';
export const V022_RELEASE_RELATIVE =
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.22-r5';

const SYSTEM_STRING = /(?:snap-|proj-|ads-|ctr:release:|first-cutover-|sha256:|[a-f0-9]{64})/i;

export function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function writeCanonical(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

export function shaFile(filePath: string): string {
  return projectionSha256(readFileSync(filePath));
}

export function leakInDisplay(value: string): boolean {
  return SYSTEM_STRING.test(value);
}

export function posixJoin(...parts: string[]): string {
  return parts.join('/');
}
