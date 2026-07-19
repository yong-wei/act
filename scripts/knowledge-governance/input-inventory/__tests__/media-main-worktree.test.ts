import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectInputObservations, observeInput } from '../input-codecs';
import { repositoryRevision } from '../manifest';
import { classifyRegisteredSymlinks, enumerateRepository, loadRegistry, type Registry } from '../registry';
import type { Drift } from '../types';

const root = path.resolve(import.meta.dirname, '../../../..');
const realMainRoot = '/Users/YW/Documents/Site/act.just.edu.cn';
const revision = 'a'.repeat(40);

function fixtureRegistry(): Registry {
  return {
    repository_codec_contract: {
      unknown_codec: 'invalid',
      codecs: [
        { id: 'text/v1', media_type: 'text/plain', kind: 'text', include: ['**/*.txt'] },
        { id: 'png/v1', media_type: 'image/png', kind: 'binary', signature: 'png', include: ['**/*.png'] },
        { id: 'pdf/v1', media_type: 'application/pdf', kind: 'binary', signature: 'pdf', include: ['**/*.pdf'] },
      ],
    },
  } as unknown as Registry;
}

function git(directory: string, ...args: string[]): void {
  const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}

describe('closed repository input codecs', () => {
  it('resolves HEAD when the current branch exists only in packed-refs', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-packed-ref-'));
    try {
      git(directory, 'init', '-q');
      git(directory, 'config', 'user.email', 'inventory@example.invalid');
      git(directory, 'config', 'user.name', 'Inventory Test');
      await writeFile(path.join(directory, 'tracked.txt'), 'fixture\n');
      git(directory, 'add', 'tracked.txt');
      git(directory, 'commit', '-qm', 'fixture');
      const expected = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).stdout.trim();
      git(directory, 'pack-refs', '--all', '--prune');
      expect(await repositoryRevision(directory)).toBe(expected);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('retains unknown codecs and invalid PNG/PDF signatures as typed invalid observations', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-codecs-'));
    try {
      await writeFile(path.join(directory, 'bad.png'), 'not a png');
      await writeFile(path.join(directory, 'bad.pdf'), 'not a pdf');
      await writeFile(path.join(directory, 'garbage.bin'), Buffer.from([0, 1, 2]));
      const drift: Drift[] = [];
      const base = { source_root: 'isolated-worktree' as const, filesystem_root: directory, capture_revision: revision, vcs_state: 'untracked' as const };
      const records = await Promise.all(['bad.png', 'bad.pdf', 'garbage.bin'].map((file) => observeInput({ ...base, path: file }, fixtureRegistry(), drift)));
      expect(records).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'bad.png', state: 'invalid', codec: 'png/v1', error_code: 'INVALID_MEDIA_SIGNATURE' }),
        expect.objectContaining({ path: 'bad.pdf', state: 'invalid', codec: 'pdf/v1', error_code: 'INVALID_MEDIA_SIGNATURE' }),
        expect.objectContaining({ path: 'garbage.bin', state: 'invalid', codec: 'unknown', error_code: 'UNKNOWN_INPUT_CODEC' }),
      ]));
      expect(drift.map((item) => item.code).sort()).toEqual(['INVALID_MEDIA_SIGNATURE', 'INVALID_MEDIA_SIGNATURE', 'UNKNOWN_INPUT_CODEC'].sort());
    } finally { await rm(directory, { recursive: true }); }
  });

  it('captures main-only files and reports exact same-path content drift without precedence', async () => {
    const isolated = await mkdtemp(path.join(os.tmpdir(), 'inventory-isolated-'));
    const main = await mkdtemp(path.join(os.tmpdir(), 'inventory-main-'));
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    try {
      for (const directory of [isolated, main]) { git(directory, 'init', '-q'); git(directory, 'config', 'user.email', 'inventory@example.invalid'); git(directory, 'config', 'user.name', 'Inventory Test'); }
      await mkdir(path.join(isolated, 'media')); await mkdir(path.join(main, 'media'));
      await writeFile(path.join(isolated, 'media/shared.png'), Buffer.concat([png, Buffer.from('isolated')]));
      await writeFile(path.join(main, 'media/shared.png'), Buffer.concat([png, Buffer.from('main')]));
      await writeFile(path.join(main, 'media/only.pdf'), '%PDF-1.7\nmain only');
      await writeFile(path.join(main, '.gitignore'), 'media/only.pdf\n');
      git(isolated, 'add', 'media/shared.png'); git(isolated, 'commit', '-qm', 'fixture');
      git(main, 'add', 'media/shared.png', '.gitignore'); git(main, 'commit', '-qm', 'fixture');
      expect(await repositoryRevision(main)).toMatch(/^[0-9a-f]{40}$/u);
      const drift: Drift[] = [];
      const observations = await collectInputObservations({ isolatedRoot: isolated, isolatedRevision: revision, isolatedPaths: ['media/shared.png'], mainRoot: main, mainRevision: revision, mainPaths: ['media/shared.png', 'media/only.pdf'] }, fixtureRegistry(), drift);
      expect(observations.filter((item) => item.path === 'media/shared.png')).toHaveLength(2);
      expect(observations).toContainEqual(expect.objectContaining({ path: 'media/only.pdf', source_root: 'main-worktree', vcs_state: 'ignored', absence_reason: 'NOT_PRESENT_IN_ISOLATED_WORKTREE', state: 'observed' }));
      expect(drift).toContainEqual(expect.objectContaining({ code: 'SAME_PATH_CONTENT_DRIFT', scope: 'media/shared.png', expected: expect.objectContaining({ raw_digest: expect.stringMatching(/^sha256:/u) }), observed: expect.objectContaining({ raw_digest: expect.stringMatching(/^sha256:/u) }) }));
    } finally { await rm(isolated, { recursive: true }); await rm(main, { recursive: true }); }
  });

  it('authorizes only same-relative main-worktree regular-file replacements and retains target hash evidence', async () => {
    const isolated = await mkdtemp(path.join(os.tmpdir(), 'inventory-isolated-symlink-'));
    const main = await mkdtemp(path.join(os.tmpdir(), 'inventory-main-symlink-'));
    const external = await mkdtemp(path.join(os.tmpdir(), 'inventory-external-symlink-'));
    try {
      for (const directory of [isolated, main]) { git(directory, 'init', '-q'); git(directory, 'config', 'user.email', 'inventory@example.invalid'); git(directory, 'config', 'user.name', 'Inventory Test'); }
      await mkdir(path.join(isolated, 'media')); await mkdir(path.join(main, 'media')); await mkdir(path.join(external, 'media'));
      await writeFile(path.join(main, 'media/authorized.txt'), 'main authority\n');
      await writeFile(path.join(main, 'media/rejected.txt'), 'main decoy\n');
      await writeFile(path.join(external, 'media/rejected.txt'), 'external\n');
      await symlink(path.join(main, 'media/authorized.txt'), path.join(isolated, 'media/authorized.txt'));
      await symlink(path.join(external, 'media/rejected.txt'), path.join(isolated, 'media/rejected.txt'));
      git(main, 'add', 'media/authorized.txt', 'media/rejected.txt'); git(main, 'commit', '-qm', 'fixture');
      const registry = { repository_sources: [{ id: 'source', item_kind: 'doc', identity_namespace: 'repository_path', include: ['media/*.txt'], missing: 'fail' }], instructional_source_role_matrix: {} } as unknown as Registry;
      const classification = await classifyRegisteredSymlinks(isolated, registry, main);
      expect(classification).toEqual({ authorized_main_worktree_replacements: ['media/authorized.txt'], rejected: ['media/rejected.txt'] });
      const enumerationDrift: Drift[] = [];
      await enumerateRepository(isolated, registry, enumerationDrift, main);
      expect(enumerationDrift.filter((item) => item.code === 'SYMLINK_INPUT_REJECTED')).toEqual([expect.objectContaining({ code: 'SYMLINK_INPUT_REJECTED', scope: 'media/rejected.txt' })]);
      const drift: Drift[] = [];
      const observations = await collectInputObservations({ isolatedRoot: isolated, isolatedRevision: revision, isolatedPaths: [], mainRoot: main, mainRevision: await repositoryRevision(main), mainPaths: ['media/authorized.txt'], isolatedSymlinkReplacements: classification.authorized_main_worktree_replacements }, fixtureRegistry(), drift);
      expect(observations).toEqual([expect.objectContaining({
        path: 'media/authorized.txt', source_root: 'main-worktree', capture_revision: expect.stringMatching(/^[0-9a-f]{40}$/u),
        absence_reason: 'ISOLATED_SYMLINK_REPLACED_BY_AUTHORIZED_MAIN_WORKTREE_SAME_PATH_REGULAR_FILE',
        isolated_path_state: 'symbolic-link', replacement_target_source_root: 'main-worktree',
        replacement_target_path: 'media/authorized.txt', replacement_target_type: 'regular-file',
        state: 'observed', raw_digest: expect.stringMatching(/^sha256:/u), normalized_digest: expect.stringMatching(/^sha256:/u),
      })]);
      expect(drift).toEqual([]);
    } finally { await rm(isolated, { recursive: true }); await rm(main, { recursive: true }); await rm(external, { recursive: true }); }
  });

  it('classifies semantic source and opaque build artifacts without an unknown-codec fallback', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-real-codecs-'));
    try {
      const registry = await loadRegistry(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml');
      const files: Array<[string, string | Buffer]> = [
        ['source.m', 'disp(1)\n'], ['diagram.tex', '\\begin{document}\n'], ['diagram.aux', '\\relax\n'], ['diagram.log', 'build log\n'],
        ['module.pyc', Buffer.from([0x42, 0x0d, 0x0d, 0x0a])], ['.DS_Store', Buffer.from([0, 1])], ['audio.m4a', Buffer.from([0, 1])], ['image.ppm', 'P3\n1 1\n255\n0 0 0\n'],
      ];
      for (const [file, value] of files) await writeFile(path.join(directory, file), value);
      const drift: Drift[] = [];
      const base = { source_root: 'isolated-worktree' as const, filesystem_root: directory, capture_revision: revision, vcs_state: 'untracked' as const };
      const observations = await Promise.all(files.map(([file]) => observeInput({ ...base, path: file }, registry, drift)));
      expect(observations.filter((item) => ['source.m', 'diagram.tex', 'audio.m4a', 'image.ppm'].includes(item.path)).every((item) => item.state === 'observed')).toBe(true);
      expect(observations.filter((item) => ['diagram.aux', 'diagram.log', 'module.pyc', '.DS_Store'].includes(item.path)).every((item) => item.state === 'invalid' && item.error_code === 'UNCLASSIFIED_INPUT_CODEC')).toBe(true);
      expect(drift.some((item) => item.code === 'UNKNOWN_INPUT_CODEC')).toBe(false);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('observes the complete real declared PNG/PDF physical set without read failures', async () => {
    const registry = await loadRegistry(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml');
    const enumerationDrift: Drift[] = [];
    const repository = await enumerateRepository(root, registry, enumerationDrift);
    const paths = [...new Set(repository.sources.flatMap((source) => source.physical_paths as string[]).filter((file) => /\.(?:png|pdf)$/iu.test(file)))];
    const drift: Drift[] = [];
    const observations = await collectInputObservations({ isolatedRoot: root, isolatedRevision: await repositoryRevision(root), isolatedPaths: paths }, registry, drift);
    expect(paths.length).toBeGreaterThan(0);
    expect(observations).toHaveLength(paths.length);
    expect(observations.every((item) => item.state === 'observed' && ['png/v1', 'pdf/v1'].includes(item.codec))).toBe(true);
    expect(drift.filter((item) => item.code === 'INPUT_READ_FAILED')).toEqual([]);
  }, 120_000);

  it.runIf(existsSync(realMainRoot))('closes the real fixed main-worktree repository symlink, codec, and declared-input contract', async () => {
    const registry = await loadRegistry(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml');
    const source = registry.repository_sources.find((item) => item.id === 'lesson-runtime-evidence')!;
    expect(source.include).not.toContain('course-content/runtime/lessons/**/media-index.json');
    expect(source.include).toContain('course-content/runtime/lessons/**/media/**');
    const mainRevision = await repositoryRevision(realMainRoot);
    expect(mainRevision).toMatch(/^[0-9a-f]{40}$/u);
    const classification = await classifyRegisteredSymlinks(root, registry, realMainRoot);
    expect(classification.rejected).toEqual([]);
    expect(classification.authorized_main_worktree_replacements).toHaveLength(173);
    const drift: Drift[] = [];
    const repository = await enumerateRepository(root, registry, drift, realMainRoot);
    const mainRepository = await enumerateRepository(realMainRoot, registry, []);
    const record = repository.sources.find((item) => item.id === 'lesson-runtime-evidence')!;
    expect(record.logical_inputs).not.toContainEqual(expect.objectContaining({ pattern: 'course-content/runtime/lessons/**/media-index.json' }));
    expect((mainRepository.sources.find((item) => item.id === 'lesson-runtime-evidence')!.physical_paths as string[]).some((item) => /\/media\//u.test(item))).toBe(true);
    const observations = await collectInputObservations({
      isolatedRoot: root, isolatedRevision: await repositoryRevision(root), isolatedPaths: repository.sources.flatMap((item) => item.physical_paths as string[]),
      mainRoot: realMainRoot, mainRevision, mainPaths: mainRepository.sources.flatMap((item) => item.physical_paths as string[]),
      isolatedSymlinkReplacements: classification.authorized_main_worktree_replacements,
    }, registry, drift);
    expect(drift.filter((item) => ['SYMLINK_INPUT_REJECTED', 'UNKNOWN_INPUT_CODEC', 'DECLARED_INPUT_MISSING'].includes(item.code))).toEqual([]);
    expect(observations.filter((item) => item.absence_reason === 'ISOLATED_SYMLINK_REPLACED_BY_AUTHORIZED_MAIN_WORKTREE_SAME_PATH_REGULAR_FILE')).toHaveLength(173);
  }, 120_000);
});
