import { createPrismaClassroomStateRuntime } from './adapters/prisma-state-runtime';
import {
  readClassroomSessionState,
  writeClassroomSessionState,
  type ReadClassroomSessionStateInput,
  type WriteClassroomSessionStateInput,
} from './application/state';

export async function writeClassroomSessionStateUseCase(input: WriteClassroomSessionStateInput) {
  return writeClassroomSessionState(createPrismaClassroomStateRuntime(), input);
}

export async function readClassroomSessionStateUseCase(input: ReadClassroomSessionStateInput) {
  return readClassroomSessionState(createPrismaClassroomStateRuntime(), input);
}
