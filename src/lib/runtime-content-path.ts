import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const RUNTIME_PREFIX = 'course-content/runtime/';
const CONTENT_PREFIX = 'content/';

export const RUNTIME_CONTENT_ROOT = path.join(PROJECT_ROOT, 'course-content', 'runtime');
export const PUBLIC_CONTENT_ROOT = path.join(PROJECT_ROOT, 'content');

export type RuntimeContentPath = {
  absolutePath: string;
  projectPath: string;
  runtimePath: string;
};

export type ReadableContentPath = RuntimeContentPath | {
  absolutePath: string;
  projectPath: string;
  contentPath: string;
};

export function isInvalidContentPathError(error: unknown) {
  return error instanceof Error
    && (
      error.message.startsWith('Invalid readable content path:')
      || error.message.startsWith('Invalid runtime content path:')
    );
}

function normalizeInputPath(input: string, errorLabel: string) {
  const normalized = input.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0') || path.posix.isAbsolute(normalized)) {
    throw new Error(`${errorLabel}: ${input}`);
  }
  return normalized;
}

function resolveInsideRoot(root: string, relativePath: string, errorLabel: string) {
  if (relativePath.split('/').includes('..')) {
    throw new Error(`${errorLabel}: ${relativePath}`);
  }

  const normalizedRelative = path.posix.normalize(relativePath);
  if (
    normalizedRelative === '.'
    || normalizedRelative.startsWith('../')
    || normalizedRelative === '..'
    || path.posix.isAbsolute(normalizedRelative)
  ) {
    throw new Error(`${errorLabel}: ${relativePath}`);
  }

  const absolutePath = path.join(root, ...normalizedRelative.split('/'));
  const relativeToRoot = path.relative(root, absolutePath);
  if (
    !relativeToRoot
    || relativeToRoot.startsWith('..')
    || path.isAbsolute(relativeToRoot)
  ) {
    throw new Error(`${errorLabel}: ${relativePath}`);
  }

  return {
    absolutePath,
    normalizedRelative,
  };
}

export function resolveRuntimeContentPath(input: string): RuntimeContentPath {
  const normalized = normalizeInputPath(input, 'Invalid runtime content path');
  const runtimePath = normalized.startsWith(RUNTIME_PREFIX)
    ? normalized.slice(RUNTIME_PREFIX.length)
    : normalized;
  const resolved = resolveInsideRoot(RUNTIME_CONTENT_ROOT, runtimePath, 'Invalid runtime content path');

  return {
    absolutePath: resolved.absolutePath,
    projectPath: `${RUNTIME_PREFIX}${resolved.normalizedRelative}`,
    runtimePath: resolved.normalizedRelative,
  };
}

export function tryResolveRuntimeContentPath(input: string): RuntimeContentPath | null {
  try {
    return resolveRuntimeContentPath(input);
  } catch {
    return null;
  }
}

export function resolveReadableContentPath(input: string): ReadableContentPath {
  const normalized = normalizeInputPath(input, 'Invalid readable content path');
  if (normalized.startsWith(CONTENT_PREFIX)) {
    const contentPath = normalized.slice(CONTENT_PREFIX.length);
    const resolved = resolveInsideRoot(PUBLIC_CONTENT_ROOT, contentPath, 'Invalid readable content path');
    return {
      absolutePath: resolved.absolutePath,
      projectPath: `${CONTENT_PREFIX}${resolved.normalizedRelative}`,
      contentPath: resolved.normalizedRelative,
    };
  }
  if (normalized.startsWith(RUNTIME_PREFIX)) {
    return resolveRuntimeContentPath(normalized);
  }

  throw new Error(`Invalid readable content path: ${input}`);
}

export async function readReadableContentText(input: string) {
  const resolved = resolveReadableContentPath(input);
  return fs.readFile(resolved.absolutePath, 'utf8');
}
