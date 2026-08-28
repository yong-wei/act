import { createClassroomSession } from './application/create';
import { createPrismaClassroomCreateRuntime } from './adapters/prisma-create-runtime';
import type { CreateClassroomSessionInput } from './types';

export async function createClassroomSessionUseCase(input: CreateClassroomSessionInput) {
  return createClassroomSession(createPrismaClassroomCreateRuntime(), input);
}
