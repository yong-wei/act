import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { COMPOSITE_ENVELOPE_REGISTRY_RELATIVE, loadCompositeEnvelopeRegistry } from '@/lib/actkg-envelope/composite-envelope-registry';
import { LOCALE_QUALIFICATION_PACKAGE_CONTRACT, readLocaleQualificationPackage } from '@/lib/authority-locale-readiness/qualification-package';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'act-composite-'));
  roots.push(root);
  const runtime = join(root, 'course-content/runtime/knowledge/composite-envelopes');
  const authoring = join(root, COMPOSITE_ENVELOPE_REGISTRY_RELATIVE);
  const write = (file: string, value: unknown) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
  };
  const registry = (name: string) => ({ contract: 'actkg-composite-envelope-registry/v1', envelopes: [{ name, qualified: true }] });
  write(authoring, registry('legacy'));
  return { root, runtime, write, registry };
}
describe('Runtime composite metadata', () => {
  it('uses legacy metadata only when Runtime metadata is absent', () => {
    const f = fixture();
    expect(loadCompositeEnvelopeRegistry(f.root)[0]?.name).toBe('legacy');
    f.write(join(f.runtime, 'actkg-composite-envelope-registry.json'), f.registry('successor'));
    expect(loadCompositeEnvelopeRegistry(f.root)[0]?.name).toBe('successor');
  });
  it('invalidates registry cache after a selected release changes at the same path', () => {
    const f = fixture();
    const file = join(f.runtime, 'actkg-composite-envelope-registry.json');
    f.write(file, f.registry('first'));
    expect(loadCompositeEnvelopeRegistry(f.root)[0]?.name).toBe('first');
    f.write(file, f.registry('second'));
    expect(loadCompositeEnvelopeRegistry(f.root)[0]?.name).toBe('second');
  });
  it('fails closed for an incomplete Runtime release instead of mixing legacy metadata', () => {
    const f = fixture();
    mkdirSync(f.runtime, { recursive: true });
    expect(() => loadCompositeEnvelopeRegistry(f.root)).toThrow('sealed envelope registry missing');
    expect(readLocaleQualificationPackage(f.root, 'legacy')).toBeNull();
  });
  it('reads locale qualification from the same selected metadata directory', () => {
    const f = fixture();
    f.write(join(f.runtime, 'locale-manifests/successor.json'), {
      contract: LOCALE_QUALIFICATION_PACKAGE_CONTRACT, compositeReleaseName: 'successor',
    });
    expect(readLocaleQualificationPackage(f.root, 'successor')?.compositeReleaseName).toBe('successor');
  });
});
