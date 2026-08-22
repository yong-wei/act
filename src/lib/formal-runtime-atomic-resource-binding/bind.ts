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
import { closeCandidate } from './inventory';
import { assertQualified } from './qualify';

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

export function admitFormalBinding(input: {
  candidate: BindingCandidate;
  atom: FormalResourceAtom;
  envelopeHash: string;
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
  return {
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
    envelopeHash: input.envelopeHash,
    source: input.atom.source,
  };
}

export function closeIncludedResource(input: {
  candidate: FormalResourceCandidate;
  atoms: readonly FormalResourceAtom[];
  bindings: readonly FormalBinding[];
  envelopeHash: string;
}): FormalResourceCandidate {
  let boundCount = 0;
  for (const atom of input.atoms) {
    if (atom.disposition === 'UNRESOLVED') {
      return closeCandidate(input.candidate, 'EXCLUDED', [`unresolved-atom:${atom.atomId}`]);
    }
    if (atom.disposition === 'BOUND') {
      const matched = input.bindings.some((row) => (
        row.contract === FORMAL_RESOURCE_BINDING_CONTRACT
        && row.resourceId === input.candidate.resourceId
        && row.atomId === atom.atomId
        && row.envelopeHash === input.envelopeHash
        && row.source.contentSha256 === atom.source.contentSha256
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
