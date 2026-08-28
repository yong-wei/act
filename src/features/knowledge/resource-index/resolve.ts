import type {
  IndexedResourceAccess,
  IndexedResourceEntry,
  RegistryIndex,
  ResolveIndexedResourceInput,
  ResourceDescriptor,
} from './types';

function isStudentVisible(access: IndexedResourceAccess): boolean {
  return access.teacherPolicy !== 'teacher-only'
    && access.teacherPolicy !== 'blocked'
    && access.teacherPolicy !== 'teacher-assigned'
    && access.privacyLevel !== 'teacher-scoped'
    && access.sourceAvailability !== 'teacher_only'
    && access.sourceAvailability !== 'archived';
}

export function canRevealIndexedResource(
  access: IndexedResourceAccess,
  role: ResolveIndexedResourceInput['role'],
): boolean {
  if (access.sourceAvailability === 'archived' || access.teacherPolicy === 'blocked') {
    return false;
  }
  if (role === 'admin') return true;
  if (role === 'teacher') {
    return access.privacyLevel !== 'admin-scoped';
  }
  return isStudentVisible(access);
}

function hideDescriptor(entry: IndexedResourceEntry): ResourceDescriptor {
  return {
    ...entry.descriptor,
    availability: 'unavailable',
    availabilityCode: 'role-or-scope-denied',
    status: '当前角色不可读取该资源描述符。',
    launcher: null,
    safeConfig: undefined,
  };
}

export function resolveIndexedResource(
  input: ResolveIndexedResourceInput,
): IndexedResourceEntry | null {
  const match = input.index.entries.find((entry) => {
    if (input.identityKey) return entry.descriptor.identity.key === input.identityKey;
    if (input.sourceKind && input.sourceRef) {
      return entry.descriptor.identity.sourceKind === input.sourceKind
        && entry.descriptor.identity.sourceRef === input.sourceRef;
    }
    return false;
  });
  if (!match) return null;
  if (!canRevealIndexedResource(match.access, input.role)) {
    return {
      ...match,
      descriptor: hideDescriptor(match),
    };
  }
  return match;
}
