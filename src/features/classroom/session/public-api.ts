import {
  authorizeClassroomSessionAccess,
  canAccessClassroomSession,
  canManageClassroomSession,
  isClassroomAdmin,
  isClassroomTeacherOrAdmin,
  normalizeClassroomActorRole,
  type ClassroomSessionAccessOperation,
  type ClassroomSessionAccessRecord,
  type ClassroomSessionAccessUser,
} from './access-policy';
import { createPrismaClassroomLifecycleRuntime } from './adapters/lifecycle-commands';
import {
  advanceClassroomSession,
  endClassroomSession,
  openClassroomSessionStream,
  readClassroomSession,
  regenerateClassroomSessionJoinCode,
} from './application/lifecycle';
import type {
  AdvanceClassroomSessionInput,
  EndClassroomSessionInput,
  ReadClassroomSessionInput,
  StreamClassroomSessionInput,
} from './types';

export {
  authorizeClassroomSessionAccess,
  canAccessClassroomSession,
  canManageClassroomSession,
  isClassroomAdmin,
  isClassroomTeacherOrAdmin,
  normalizeClassroomActorRole,
};



export function authorizeClassroomSessionAccessUseCase(input: {
  session: ClassroomSessionAccessRecord | null | undefined;
  actor: ClassroomSessionAccessUser;
  operation: ClassroomSessionAccessOperation;
}) {
  return authorizeClassroomSessionAccess(input);
}

export async function readClassroomSessionUseCase(input: ReadClassroomSessionInput) {
  return readClassroomSession(createPrismaClassroomLifecycleRuntime(), input);
}

export async function advanceClassroomSessionUseCase(input: AdvanceClassroomSessionInput) {
  return advanceClassroomSession(createPrismaClassroomLifecycleRuntime(), input);
}

export async function endClassroomSessionUseCase(input: EndClassroomSessionInput) {
  return endClassroomSession(createPrismaClassroomLifecycleRuntime(), input);
}

export async function openClassroomSessionStreamUseCase(input: StreamClassroomSessionInput) {
  return openClassroomSessionStream(createPrismaClassroomLifecycleRuntime(), input);
}

export async function regenerateClassroomSessionJoinCodeUseCase(input: ReadClassroomSessionInput) {
  return regenerateClassroomSessionJoinCode(createPrismaClassroomLifecycleRuntime(), input);
}
