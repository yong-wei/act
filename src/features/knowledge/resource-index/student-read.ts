import type { RegistryIndex, SafeConfigValue } from './types';
import { RENDER_METADATA_SOURCE_KIND } from './types';
import { getLiveResourceRegistryIndex } from './sources';
import { resolveIndexedResource } from './resolve';

export interface StudentIndexedResourceRead {
  id: string;
  title: string;
  description: null;
  type: string;
  content: null;
  registryId: string;
  category: null;
  displayName: string;
  displayOrder: 0;
  teacherOnly: false;
  config: Record<string, SafeConfigValue>;
  aiHints: null;
  authorId: 'resource-registry';
  createdAt: string;
  updatedAt: string;
}

const EPOCH = new Date(0).toISOString();

export function projectStudentReadFromIndex(
  index: RegistryIndex,
  registryId: string,
): StudentIndexedResourceRead | null {
  const match = resolveIndexedResource({
    index,
    sourceKind: RENDER_METADATA_SOURCE_KIND,
    sourceRef: registryId,
    role: 'student',
  });
  if (!match) return null;
  if (match.descriptor.availability !== 'available' || !match.descriptor.launcher) {
    return null;
  }
  return {
    id: match.descriptor.foreignRefs.registryId ?? match.descriptor.identity.sourceRef,
    title: match.descriptor.title,
    description: null,
    type: match.descriptor.type,
    content: null,
    registryId: match.descriptor.foreignRefs.registryId ?? match.descriptor.identity.sourceRef,
    category: null,
    displayName: match.descriptor.title,
    displayOrder: 0,
    teacherOnly: false,
    config: match.descriptor.safeConfig ?? {},
    aiHints: null,
    authorId: 'resource-registry',
    createdAt: EPOCH,
    updatedAt: EPOCH,
  };
}

export function resolveStudentVisibleIndexedResource(
  registryId: string,
): StudentIndexedResourceRead | null {
  return projectStudentReadFromIndex(getLiveResourceRegistryIndex(), registryId);
}
