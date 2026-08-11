import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ImmutableJsonOutput {
  relativePath: string;
  value: unknown;
}

function serialize(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * Publish a complete immutable evidence set.  An existing target is either
 * byte-identical for every required file or rejected without modification;
 * a new target is assembled in a sibling staging directory and atomically
 * renamed into place only after every file has been written successfully.
 */
export async function publishImmutableJsonSet(input: {
  root: string;
  outputRoot: string;
  outputs: readonly ImmutableJsonOutput[];
}): Promise<'published' | 'identical'> {
  const serialized = input.outputs
    .map((output) => ({ ...output, bytes: serialize(output.value) }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en'));
  const paths = serialized.map((output) => output.relativePath);
  if (new Set(paths).size !== paths.length) throw new Error('Current review publication rejected: duplicate output path');
  for (const relativePath of paths) {
    if (!relativePath || path.posix.isAbsolute(relativePath) || relativePath.includes('..')
      || path.posix.dirname(relativePath) !== '.') {
      throw new Error(`Current review publication rejected: unsafe output path ${relativePath}`);
    }
  }
  const target = path.join(input.root, input.outputRoot);
  const parent = path.dirname(target);
  await mkdir(parent, { recursive: true });
  let targetExists = false;
  try {
    targetExists = (await stat(target)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (targetExists) {
    const actualEntries = (await readdir(target, { withFileTypes: true }))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, 'en'));
    const expectedEntries = [...paths].sort((a, b) => a.localeCompare(b, 'en'));
    if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
      const missing = expectedEntries.filter((entry) => !actualEntries.includes(entry));
      if (missing.length > 0) {
        throw new Error(`Current review publication rejected: partial output set missing ${missing.join(', ')}`);
      }
      throw new Error('Current review publication rejected: output directory entry set mismatch');
    }
    for (const output of serialized) {
      let existing: Buffer;
      try {
        existing = await readFile(path.join(target, output.relativePath));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(`Current review publication rejected: partial output set missing ${output.relativePath}`);
        }
        throw error;
      }
      if (!existing.equals(output.bytes)) {
        throw new Error(`Current review publication rejected: immutable output differs ${output.relativePath}`);
      }
    }
    return 'identical';
  }

  const staging = await mkdtemp(path.join(parent, `.${path.basename(target)}.staging-`));
  let published = false;
  try {
    for (const output of serialized) {
      const absolute = path.join(staging, output.relativePath);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, output.bytes, { flag: 'wx' });
    }
    await rename(staging, target);
    published = true;
    return 'published';
  } finally {
    if (!published) await rm(staging, { recursive: true, force: true });
  }
}

export async function outputSetBytes(input: {
  root: string;
  outputRoot: string;
  relativePaths: readonly string[];
}): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();
  const target = path.join(input.root, input.outputRoot);
  for (const relativePath of [...input.relativePaths].sort((a, b) => a.localeCompare(b, 'en'))) {
    result.set(relativePath, await readFile(path.join(target, relativePath)));
  }
  return result;
}

export async function outputSetDirectoryEntries(input: {
  root: string;
  outputRoot: string;
}): Promise<string[]> {
  const target = path.join(input.root, input.outputRoot);
  return (await readdir(target)).sort((a, b) => a.localeCompare(b, 'en'));
}
