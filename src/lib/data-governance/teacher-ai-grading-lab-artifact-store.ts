import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import type {
  TeacherAiGradingRawOutputMetadata,
  TeacherAiGradingRawOutputWriter,
} from './teacher-ai-grading-lab-runner';

export interface TeacherAiGradingLabArtifactStore {
  rawOutputWriter: TeacherAiGradingRawOutputWriter;
  read(logicalKey: string): Promise<Buffer>;
  write(logicalKey: string, bytes: Uint8Array): Promise<void>;
  delete(logicalKey: string): Promise<void>;
}

export function createFileSystemTeacherAiGradingLabArtifactStore(input: {
  artifactRoot: string;
}): TeacherAiGradingLabArtifactStore {
  const root = absoluteRoot(input.artifactRoot);
  const read = async (logicalKey: string) => readFile(controlledPath(root, logicalKey));
  const write = async (logicalKey: string, bytes: Uint8Array) => {
    const path = controlledPath(root, logicalKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  };
  const remove = async (logicalKey: string) => {
    await rm(controlledPath(root, logicalKey), { force: true });
    await rm(controlledPath(root, `${logicalKey}.metadata.json`), { force: true });
  };
  return {
    read,
    write,
    delete: remove,
    rawOutputWriter: {
      async write(raw) {
        await write(raw.key, raw.bytes);
        const metadata: TeacherAiGradingRawOutputMetadata = {
          key: raw.key,
          ownerId: raw.ownerId,
          checksum: raw.checksum,
          claimFingerprint: raw.claimFingerprint,
          attempt: raw.attempt,
        };
        await write(`${raw.key}.metadata.json`, Buffer.from(JSON.stringify(metadata)));
        return raw.key;
      },
      async head(key) {
        try {
          return JSON.parse((await read(`${key}.metadata.json`)).toString('utf8')) as TeacherAiGradingRawOutputMetadata;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
          throw error;
        }
      },
      delete: remove,
    },
  };
}

function absoluteRoot(value: string): string {
  if (!value?.trim() || !isAbsolute(value)) throw new Error('teacher-ai-grading-artifact-root-invalid');
  return resolve(value);
}

function controlledPath(root: string, logicalKey: string): string {
  if (!logicalKey || logicalKey.includes('\\') || logicalKey.startsWith('/') || /^[A-Za-z]:/.test(logicalKey)
    || logicalKey.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('teacher-ai-grading-artifact-key-invalid');
  }
  const path = resolve(root, ...logicalKey.split('/'));
  const relation = relative(root, path);
  if (!relation || relation.startsWith('..') || isAbsolute(relation)) throw new Error('teacher-ai-grading-artifact-root-escape');
  return path;
}
