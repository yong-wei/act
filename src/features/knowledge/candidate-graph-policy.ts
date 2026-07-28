import type { KnowledgeRole } from '@/lib/authoritative-knowledge';
import { CANDIDATE_RELEASE_SELECTOR } from './candidate-graph-contracts';

export const CANDIDATE_GRAPH_PUBLIC_ACTIVATION_ENV =
  'AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION';
export const CANDIDATE_GRAPH_V2_ACCEPTED_RELEASE_SET_ENV =
  'AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID';
export const CANDIDATE_KONLING_ACCEPTED_RELEASE_SET_ENV =
  'AUTHORITATIVE_KNOWLEDGE_GRAPH_KONLING_ACCEPTED_RELEASE_SET_ID';
export function isCandidateGraphPubliclyActivated(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const v2Acceptance = environment[CANDIDATE_GRAPH_V2_ACCEPTED_RELEASE_SET_ENV];
  const konlingAcceptance = environment[CANDIDATE_KONLING_ACCEPTED_RELEASE_SET_ENV];
  return environment[CANDIDATE_GRAPH_PUBLIC_ACTIVATION_ENV] === 'true'
    && v2Acceptance === CANDIDATE_RELEASE_SELECTOR.releaseSetId
    && konlingAcceptance === CANDIDATE_RELEASE_SELECTOR.releaseSetId
    && v2Acceptance === konlingAcceptance;
}

export function resolveCandidateGraphAccess(
  role: string | null | undefined,
  publiclyActivated: boolean,
): {
  allowed: boolean;
  role: KnowledgeRole | null;
  controlledVerification: boolean;
} {
  if (role !== 'STUDENT' && role !== 'TEACHER' && role !== 'ADMIN') {
    return { allowed: false, role: null, controlledVerification: false };
  }
  if (publiclyActivated) {
    return { allowed: true, role, controlledVerification: false };
  }
  return {
    allowed: role === 'ADMIN',
    role,
    controlledVerification: role === 'ADMIN',
  };
}
