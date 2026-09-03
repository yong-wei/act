import type { CensusObservation } from '@/lib/architecture-census/types';
import type { GateClass, OwnerId } from './types';

const RULES: ReadonlyArray<{ owner: OwnerId; pattern: RegExp }> = [
  { owner: 'arena', pattern: /(?:^|\/)(?:features\/arena|arena)(?:\/|$)|arena-/u },
  { owner: 'assessment', pattern: /adaptive-assessment|micro-tutoring|question-bank|assessment/u },
  { owner: 'personalization', pattern: /adaptive-learning|adaptive-path|personalization|learning-path/u },
  { owner: 'learning-record', pattern: /data-governance|learning-fact|learning-evidence|portrait|sar-/u },
  { owner: 'course', pattern: /features\/interactive|course-content|lesson-engine|course-runtime|unit-\d/u },
  { owner: 'classroom', pattern: /classroom|class-session|features\/teacher|diagnosis-report/u },
  { owner: 'assignment', pattern: /assignment/u },
  { owner: 'practice-lab', pattern: /control-workbench|simulations|control-engine|practice-lab/u },
  { owner: 'knowledge', pattern: /features\/knowledge|actkg|teaching-projection|resource-registry|governed-math|canonical-resource/u },
  { owner: 'identity', pattern: /(?:^|\/)(?:auth|identity|nextauth)(?:\/|$)|NEXTAUTH|getServerAuthSession/u },
];

export function matchingOwners(haystack: string): OwnerId[] {
  const owners: OwnerId[] = [];
  for (const rule of RULES) {
    if (rule.pattern.test(haystack) && !owners.includes(rule.owner)) owners.push(rule.owner);
  }
  return owners.length > 0 ? owners : ['platform'];
}

export function assignOwner(observation: Pick<CensusObservation, 'id' | 'kind' | 'identity' | 'evidence'>): OwnerId {
  const haystack = `${observation.kind} ${observation.identity} ${observation.evidence.join(' ')}`;
  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) return rule.owner;
  }
  return 'platform';
}

export function classifyGate(observation: Pick<CensusObservation, 'identity' | 'trustClass' | 'attributes'>): GateClass {
  const identity = observation.identity;
  if (/(?:verify:commit|verify:push|pre-commit|pre-push|prisma|wasm|qualify:|(?:^|[^A-Za-z0-9_-])(?:next-?auth|NEXTAUTH|getServerAuthSession)(?:$|[^A-Za-z0-9_-]))/u.test(identity)) {
    return 'hard';
  }
  if (/(?:typecheck|lint|openspec|schema)/iu.test(identity)) return 'contract';
  if (observation.trustClass === 'ci') return 'contract';
  if (/(?:legacy|compat|duplicate)/iu.test(identity)) return 'removable';
  return 'soft';
}

export function gateThreat(gateClass: GateClass): { threat: string; fact: string; consequence: string } {
  if (gateClass === 'hard') {
    return {
      threat: 'identity-privacy-integrity-or-release-corruption',
      fact: 'authoritative-runtime-or-persistence-fact',
      consequence: 'fail-closed-before-user-visible-mutation',
    };
  }
  if (gateClass === 'contract') {
    return {
      threat: 'schema-or-api-drift',
      fact: 'declared-contract',
      consequence: 'reject-unqualified-revision',
    };
  }
  if (gateClass === 'removable') {
    return {
      threat: 'duplicate-internal-check',
      fact: 'not-sole-validator',
      consequence: 'candidate-for-consolidation',
    };
  }
  return {
    threat: 'optional-presentation-or-evidence-gap',
    fact: 'non-authoritative-enhancement',
    consequence: 'degrade-without-blocking-core-flow',
  };
}
