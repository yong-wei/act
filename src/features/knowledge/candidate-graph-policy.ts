import type { KnowledgeRole } from '@/lib/authoritative-knowledge';

export const CANDIDATE_GRAPH_PUBLIC_ACTIVATION_ENV =
  'AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION';

export function isCandidateGraphPubliclyActivated(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment[CANDIDATE_GRAPH_PUBLIC_ACTIVATION_ENV] === 'true';
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
