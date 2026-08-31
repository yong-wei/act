import { joinClassroomSession } from './application/join';
import { createPrismaClassroomJoinRuntime } from './adapters/prisma-join-runtime';
import type { JoinClassroomSessionInput } from './types';

export async function joinClassroomSessionUseCase(input: JoinClassroomSessionInput) {
  return joinClassroomSession(createPrismaClassroomJoinRuntime(), input);
}
