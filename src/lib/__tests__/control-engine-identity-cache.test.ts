import { cpSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generatedPackageDir, readGeneratedPackageIdentity } from '../control-engine/identity';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
});

let root: string;
let directory: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'act-identity-cache-'));
  directory = generatedPackageDir(root);
  cpSync(generatedPackageDir(), directory, { recursive: true });
  vi.mocked(readFileSync).mockClear();
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('生成数值软件包身份复用', () => {
  it('完整校验后复用未变文件，返回副本保持缓存独立', () => {
    const first = readGeneratedPackageIdentity(root);
    expect(vi.mocked(readFileSync).mock.calls.some(([file]) => String(file).endsWith('index_bg.wasm'))).toBe(true);
    const expected = structuredClone(first);
    first.files['index_bg.wasm'] = 'modified-by-caller';
    vi.mocked(readFileSync).mockClear();
    expect(readGeneratedPackageIdentity(root)).toEqual(expected);
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it('同长度覆盖并恢复mtime后仍重新校验并拒绝篡改', () => {
    readGeneratedPackageIdentity(root);
    const file = path.join(directory, 'index.js');
    const previous = statSync(file);
    const bytes = readFileSync(file);
    bytes[0] ^= 1;
    writeFileSync(file, bytes);
    utimesSync(file, previous.atime, previous.mtime);
    expect(() => readGeneratedPackageIdentity(root)).toThrow(/sealed identity/);
  });

  it('同名替换与删除必要文件均使旧缓存失效', () => {
    readGeneratedPackageIdentity(root);
    const file = path.join(directory, 'index.d.ts');
    writeFileSync(file + '.replacement', readFileSync(file));
    renameSync(file + '.replacement', file);
    vi.mocked(readFileSync).mockClear();
    readGeneratedPackageIdentity(root);
    expect(readFileSync).toHaveBeenCalled();
    rmSync(file);
    expect(() => readGeneratedPackageIdentity(root)).toThrow(/incomplete/);
  });

  it('身份元数据的修改或新增必须通过完整核验', () => {
    readGeneratedPackageIdentity(root);
    writeFileSync(path.join(directory, 'identity.json'), JSON.stringify({
      ...readGeneratedPackageIdentity(root), buildHash: '0'.repeat(64),
    }));
    expect(() => readGeneratedPackageIdentity(root)).toThrow(/build hash/);
  });
});
