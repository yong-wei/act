import { sha256Text } from '@/lib/architecture-census/serialize';

import { AUTHORITY_INPUT_IDS, REQUIRED_TERMINAL_STAGE_IDS, WORKTREE_ROLES } from './types';

const KNOWN_STAGE_IDS = new Set<string>([...REQUIRED_TERMINAL_STAGE_IDS, ...AUTHORITY_INPUT_IDS]);
const LOCAL_TOKEN = /^[a-z0-9]+(?:-[a-z0-9.]+)*$/u;
const RELATIVE_PATH = /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/u;
const DIGEST_TOKEN = /^[A-Za-z0-9._-]+$/u;
const REDACTED_IDENTITY = /^obs:[a-f0-9]{64}$/u;

export function isSafeObservationIdentity(identity: string, sourceStageId?: string): boolean {
  if (REDACTED_IDENTITY.test(identity)) return true;
  const parts = identity.split(':');
  if (parts.length === 3 && (WORKTREE_ROLES as readonly string[]).includes(parts[0]!)) {
    return RELATIVE_PATH.test(parts[1]!) && DIGEST_TOKEN.test(parts[2]!);
  }
  if (parts.length !== 2) return false;
  const [stage, token] = parts;
  if (!stage || !token || !KNOWN_STAGE_IDS.has(stage) || !LOCAL_TOKEN.test(token)) return false;
  if (sourceStageId && stage !== sourceStageId) return false;
  return true;
}

export function publicObservationIdentity(
  identity: string,
  sourceStageId?: string,
): { identity: string; safe: boolean } {
  if (REDACTED_IDENTITY.test(identity)) return { identity, safe: true };
  if (isSafeObservationIdentity(identity, sourceStageId)) return { identity, safe: true };
  return { identity: `obs:${sha256Text(identity)}`, safe: false };
}
