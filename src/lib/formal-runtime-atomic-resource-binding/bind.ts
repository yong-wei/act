import {
  FORMAL_RESOURCE_BINDING_CONTRACT,
  FORMAL_TEACHING_ROLES,
  type FormalAtomDisposition,
  type FormalBinding,
  type FormalQualificationReceipt,
  type FormalResourceAtom,
  type FormalResourceCandidate,
  type FormalTeachingRole,
} from './contracts';
import { FormalResourceError, bindingId } from './hash';
import { closeCandidate, sourceIdentityMatches } from './inventory';
import { assertQualified, frozenCanonicalMappingIds } from './qualify';

export interface BindingCandidate {
  readonly resourceId: string;
  readonly atomId: string;
  readonly canonicalId: string;
  readonly role: FormalTeachingRole;
  readonly scopeId: string;
  readonly method: 'identity' | 'label-alias' | 'vector' | 'model';
  readonly confidence: number;
  readonly evidenceRefs: readonly string[];
}

const MIN_CONFIDENCE = 0.85;

export function assertTeachingRole(role: string): FormalTeachingRole {
  if (!(FORMAL_TEACHING_ROLES as readonly string[]).includes(role)) {
    throw new FormalResourceError('unsupported-role', `unknown teaching role: ${role}`);
  }
  return role as FormalTeachingRole;
}

export const PROVISIONAL_ENVELOPE_HASH = '' as const;

export function admitFormalBinding(input: {
  candidate: BindingCandidate;
  atom: FormalResourceAtom;
  mappingReceipt: FormalQualificationReceipt;
  mappingVersion: string;
  mappingConfig: string;
}): FormalBinding {
  assertQualified(input.mappingReceipt, 'canonical-mapping', input.mappingVersion, input.mappingConfig);
  if (input.candidate.method !== 'identity') {
    throw new FormalResourceError(
      'candidate-only',
      `${input.candidate.method} may create candidates only and cannot directly create BOUND`,
    );
  }
  if (input.candidate.confidence < MIN_CONFIDENCE || input.candidate.evidenceRefs.length === 0) {
    throw new FormalResourceError('item-gate', 'binding failed confidence or evidence gate');
  }
  if (
    input.atom.atomId !== input.candidate.atomId
    || input.atom.resourceId !== input.candidate.resourceId
    || input.atom.courseScopeId !== input.candidate.scopeId
  ) {
    throw new FormalResourceError('identity-drift', 'atom identity does not match binding candidate');
  }
  const role = assertTeachingRole(input.candidate.role);
  const allowed = frozenCanonicalMappingIds(input.mappingVersion, input.mappingConfig);
  if (!allowed.includes(input.candidate.canonicalId)) {
    throw new FormalResourceError(
      'candidate-only',
      'canonical id is not in the frozen mapping output',
    );
  }
  const row: FormalBinding = {
    contract: FORMAL_RESOURCE_BINDING_CONTRACT,
    bindingId: bindingId({
      resourceId: input.candidate.resourceId,
      atomId: input.candidate.atomId,
      canonicalId: input.candidate.canonicalId,
      role,
      scopeId: input.candidate.scopeId,
    }),
    resourceId: input.candidate.resourceId,
    atomId: input.candidate.atomId,
    canonicalId: input.candidate.canonicalId,
    role,
    scopeId: input.candidate.scopeId,
    envelopeHash: PROVISIONAL_ENVELOPE_HASH,
    source: input.atom.source,
  };
  assertBindingIntegrity(row);
  return row;
}

export function assertBindingIntegrity(binding: FormalBinding): void {
  if (binding.contract !== FORMAL_RESOURCE_BINDING_CONTRACT) {
    throw new FormalResourceError('identity-drift', 'binding contract is not the formal atomic contract');
  }
  assertTeachingRole(binding.role);
  if (!binding.resourceId || !binding.atomId || !binding.canonicalId || !binding.scopeId) {
    throw new FormalResourceError('identity-drift', 'binding identity fields are incomplete');
  }
  const expectedId = bindingId({
    resourceId: binding.resourceId,
    atomId: binding.atomId,
    canonicalId: binding.canonicalId,
    role: binding.role,
    scopeId: binding.scopeId,
  });
  if (binding.bindingId !== expectedId) {
    throw new FormalResourceError('identity-drift', 'bindingId does not match resource/atom/canonical/role/scope');
  }
}

export function stampBindingsWithEnvelope(
  bindings: readonly FormalBinding[],
  envelopeHash: string,
): FormalBinding[] {
  if (!envelopeHash) {
    throw new FormalResourceError('envelope-drift', 'cannot stamp bindings with an empty envelope hash');
  }
  return bindings.map((row) => {
    assertBindingIntegrity(row);
    return { ...row, envelopeHash };
  });
}

export function bindingMatchesAtom(
  row: FormalBinding,
  candidate: FormalResourceCandidate,
  atom: FormalResourceAtom,
  envelopeHash: string,
): boolean {
  try {
    assertBindingIntegrity(row);
  } catch {
    return false;
  }
  const identity = row.resourceId === candidate.resourceId
    && row.resourceId === atom.resourceId
    && row.atomId === atom.atomId
    && row.scopeId === candidate.courseScopeId
    && row.scopeId === atom.courseScopeId
    && sourceIdentityMatches(row.source, atom.source)
    && sourceIdentityMatches(row.source, candidate.source);
  if (!identity) return false;
  if (envelopeHash) return row.envelopeHash === envelopeHash;
  return true;
}

export function assertSealedBinding(input: {
  binding: FormalBinding;
  candidate: FormalResourceCandidate;
  atom: FormalResourceAtom;
  envelopeHash: string;
  mappingVersion: string;
  mappingConfig: string;
}): void {
  assertBindingIntegrity(input.binding);
  if (!input.envelopeHash || input.binding.envelopeHash !== input.envelopeHash) {
    throw new FormalResourceError(
      'envelope-drift',
      `binding ${input.binding.bindingId} is not stamped with the sealed envelope`,
    );
  }
  if (!bindingMatchesAtom(input.binding, input.candidate, input.atom, input.envelopeHash)) {
    throw new FormalResourceError(
      'identity-drift',
      `binding ${input.binding.bindingId} does not match its atom, candidate, source, or scope`,
    );
  }
  const allowed = frozenCanonicalMappingIds(input.mappingVersion, input.mappingConfig);
  if (!allowed.includes(input.binding.canonicalId)) {
    throw new FormalResourceError(
      'candidate-only',
      `binding ${input.binding.bindingId} canonical id is not in the frozen mapping output`,
    );
  }
}

export function closeIncludedResource(input: {
  candidate: FormalResourceCandidate;
  atoms: readonly FormalResourceAtom[];
  bindings: readonly FormalBinding[];
  envelopeHash?: string;
}): FormalResourceCandidate {
  const envelopeHash = input.envelopeHash ?? PROVISIONAL_ENVELOPE_HASH;
  let boundCount = 0;
  for (const atom of input.atoms) {
    if (atom.disposition === 'UNRESOLVED') {
      return closeCandidate(input.candidate, 'EXCLUDED', [`unresolved-atom:${atom.atomId}`]);
    }
    if (atom.disposition === 'BOUND') {
      const matched = input.bindings.some((row) => (
        bindingMatchesAtom(row, input.candidate, atom, envelopeHash)
      ));
      if (!matched) {
        return closeCandidate(input.candidate, 'EXCLUDED', [`unbound-atom:${atom.atomId}`]);
      }
      boundCount += 1;
    }
  }
  if (boundCount === 0) {
    return closeCandidate(input.candidate, 'EXCLUDED', ['no-bound-atom']);
  }
  return closeCandidate(input.candidate, 'INCLUDED');
}

export function applyAtomDisposition(
  atom: FormalResourceAtom,
  disposition: FormalAtomDisposition,
  evidenceRefs: readonly string[],
): FormalResourceAtom {
  if (disposition === 'NON_TEACHING' && evidenceRefs.length === 0) {
    throw new FormalResourceError('invalid-evidence-ref', 'NON_TEACHING requires evidence');
  }
  return { ...atom, disposition, evidenceRefs };
}

export function migrateLegacyBinding(input: {
  projectionMode: 'REQUIRED' | 'OPTIONAL' | 'NONE';
  method: BindingCandidate['method'];
}): 'candidate' | 'excluded' {
  if (input.projectionMode === 'NONE' || input.projectionMode === 'OPTIONAL') {
    return 'candidate';
  }
  if (input.method !== 'identity') return 'candidate';
  return 'candidate';
}

export function launcherConsumesAnchor(input: {
  subtype: FormalResourceCandidate['subtype'];
  anchorKind: FormalResourceAtom['anchor']['kind'];
}): boolean {
  if (input.anchorKind === 'media-paragraph') {
    return input.subtype === 'video' || input.subtype === 'audio' || input.subtype === 'podcast';
  }
  if (input.anchorKind === 'question-item') return input.subtype === 'exercise';
  return true;
}
