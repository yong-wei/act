import type { RegistryIndex, SafeConfigValue } from './types';
import { RENDER_METADATA_SOURCE_KIND } from './types';
import { getLiveResourceRegistryIndex } from './sources';
import { resolveIndexedResource } from './resolve';
import {
  observeBrowseEligibility,
  observeLaunchEligibility,
} from '../resource-eligibility/callers';

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

function resolveStudentIndexedEntry(index: RegistryIndex, registryId: string) {
  return resolveIndexedResource({
    index,
    sourceKind: RENDER_METADATA_SOURCE_KIND,
    sourceRef: registryId,
    role: 'student',
  });
}

function callerContext(index: RegistryIndex, entry: NonNullable<ReturnType<typeof resolveStudentIndexedEntry>>) {
  return {
    role: 'student' as const,
    scope: entry.descriptor.identity.scope,
    resourceIndexIdentity: index.identity,
    requestedRevision: entry.descriptor.identity.sourceVersion,
    launcherContract: entry.descriptor.launcher
      ? {
        contractClass: entry.descriptor.launcher.contractClass,
        contractVersion: entry.descriptor.launcher.contractVersion,
      }
      : undefined,
  };
}

function toStudentRead(
  entry: NonNullable<ReturnType<typeof resolveStudentIndexedEntry>>,
): StudentIndexedResourceRead {
  return {
    id: entry.descriptor.foreignRefs.registryId ?? entry.descriptor.identity.sourceRef,
    title: entry.descriptor.title,
    description: null,
    type: entry.descriptor.type,
    content: null,
    registryId: entry.descriptor.foreignRefs.registryId ?? entry.descriptor.identity.sourceRef,
    category: null,
    displayName: entry.descriptor.title,
    displayOrder: 0,
    teacherOnly: false,
    config: entry.descriptor.safeConfig ?? {},
    aiHints: null,
    authorId: 'resource-registry',
    createdAt: EPOCH,
    updatedAt: EPOCH,
  };
}

export function projectStudentReadFromIndex(
  index: RegistryIndex,
  registryId: string,
): StudentIndexedResourceRead | null {
  const match = resolveStudentIndexedEntry(index, registryId);
  if (!match) return null;
  const context = callerContext(index, match);
  const browse = observeBrowseEligibility({ index, entry: match, context });
  const launch = observeLaunchEligibility({ index, entry: match, context });
  if (!browse.eligibleForContext || !launch.eligibleForContext) {
    return null;
  }
  return toStudentRead(match);
}

export function projectStudentLaunchFromIndex(
  index: RegistryIndex,
  registryId: string,
): StudentIndexedResourceRead | null {
  const match = resolveStudentIndexedEntry(index, registryId);
  if (!match) return null;
  const launch = observeLaunchEligibility({
    index,
    entry: match,
    context: callerContext(index, match),
  });
  if (!launch.eligibleForContext) return null;
  return toStudentRead(match);
}

export function resolveStudentVisibleIndexedResource(
  registryId: string,
): StudentIndexedResourceRead | null {
  return projectStudentReadFromIndex(getLiveResourceRegistryIndex(), registryId);
}

export function resolveStudentLaunchableIndexedResource(
  registryId: string,
): StudentIndexedResourceRead | null {
  return projectStudentLaunchFromIndex(getLiveResourceRegistryIndex(), registryId);
}
