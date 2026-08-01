/**
 * Directed unit tests for public privacy absolute-path detection.
 * Does not require a clean Git capture tree.
 */
import { describe, expect, it } from 'vitest';

import {
  detectAbsoluteFilesystemPathLeak,
  scanJsonTextForPrivacyLeaks,
  scanPublicTextForPrivacyLeaks,
} from '../../../scripts/actkg-release/public-bundle-v1';

describe('public privacy absolute path detection', () => {
  it('detects arbitrary multi-segment POSIX absolute paths in free text', () => {
    expect(detectAbsoluteFilesystemPathLeak('see /tmp/secret/token.json')).toContain('/tmp/secret');
    expect(detectAbsoluteFilesystemPathLeak('root=/var/lib/act/db')).toContain('/var/lib');
    expect(detectAbsoluteFilesystemPathLeak('"/workspace/projects/act"')).toContain('/workspace/projects');
    expect(detectAbsoluteFilesystemPathLeak('path=/root/.ssh/id_rsa')).toContain('/root/.ssh');
    expect(detectAbsoluteFilesystemPathLeak('/Users/yw/.codex/config')).toContain('/Users/yw');
    expect(detectAbsoluteFilesystemPathLeak('/home/student/notes.md')).toContain('/home/student');
    expect(detectAbsoluteFilesystemPathLeak('/srv/act/private/output.json')).toBe(
      '/srv/act/private/output.json',
    );
    expect(detectAbsoluteFilesystemPathLeak('leak=/usr/local/share/private.json')).toContain(
      '/usr/local/share/private.json',
    );
    expect(detectAbsoluteFilesystemPathLeak('/run/user/1000/build.json')).toBe(
      '/run/user/1000/build.json',
    );
    expect(detectAbsoluteFilesystemPathLeak('export=/media/usb/export.json')).toContain(
      '/media/usb/export.json',
    );
    // Free-text bare absolute paths fail closed (no JSON Pointer root whitelist).
    expect(detectAbsoluteFilesystemPathLeak('/foo/bar')).toBe('/foo/bar');
    expect(detectAbsoluteFilesystemPathLeak('/components/schemas/Foo')).toBe(
      '/components/schemas/Foo',
    );
    // Unicode path segments (not ASCII-only).
    expect(detectAbsoluteFilesystemPathLeak('/私有/输出.json')).toBe('/私有/输出.json');
    // Colon-labeled absolute path (http(s) scrubbed first; label colon is a boundary).
    expect(detectAbsoluteFilesystemPathLeak('source:/srv/act/private.json')).toContain(
      '/srv/act/private.json',
    );
    expect(detectAbsoluteFilesystemPathLeak('path:/run/user/1000/out.json')).toContain(
      '/run/user/1000/out.json',
    );
  });

  it('detects Windows drive, real UNC, and file: URI absolute paths', () => {
    expect(detectAbsoluteFilesystemPathLeak('C:\\Users\\yw\\secret.txt')).toMatch(/^C:/u);
    expect(detectAbsoluteFilesystemPathLeak('notes at D:/data/private/file.json')).toMatch(/^D:/u);
    expect(detectAbsoluteFilesystemPathLeak('share=\\\\fileserver\\teams\\act')).toMatch(/^\\\\fileserver/u);
    expect(detectAbsoluteFilesystemPathLeak('\\\\nas01\\exports\\bundle\\manifest.json')).toMatch(
      /^\\\\nas01\\exports/u,
    );

    expect(detectAbsoluteFilesystemPathLeak('file:///Users/yw/secret.txt')).toBe(
      'file:///Users/yw/secret.txt',
    );
    expect(detectAbsoluteFilesystemPathLeak('note file:///tmp/build/out ')).toContain(
      'file:///tmp/build/out',
    );
    expect(detectAbsoluteFilesystemPathLeak('file://server/share/path')).toBe(
      'file://server/share/path',
    );
  });

  it('does not re-match path/query/fragment from http(s) URLs', () => {
    expect(detectAbsoluteFilesystemPathLeak('https://example.com/tmp/docs/guide')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('http://cdn.example.org/var/assets/a.png')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('https://example.com/?ref=/foo/bar')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('https://example.com/docs#/components/schemas/Foo')).toBeNull();
    expect(
      detectAbsoluteFilesystemPathLeak('see https://api.example.com/v1?path=/srv/act/private/x.json'),
    ).toBeNull();
  });

  it('does not flag course-relative paths, LaTeX, or transfer-function formulas', () => {
    expect(detectAbsoluteFilesystemPathLeak('course-content/authoring/knowledge/releases/x')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('relative/path/to/file.json')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('ctr:profile:control-theory-engineering-v0.3:act-v2')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('\\\\begin{aligned}\\nV_{2}(s)')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('\\begin{aligned}\nV_{2}(s)=\\frac{1}{s}')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('G(s)=\\frac{K}{s(Js+B)}')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('{"description":"\\\\begin{aligned}\\nV_{2}(s)\\\\end{aligned}"}')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('R(s)=p(s)/q(s).')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('Y(s)/U(s)=G(s)/(1+G(s)H(s))')).toBeNull();
  });

  it('JSON $ref pure pointer / URI-reference values are not treated as filesystem paths', () => {
    const withRef = scanJsonTextForPrivacyLeaks(
      'schema.json',
      JSON.stringify({
        components: {
          schemas: {
            Foo: { type: 'object' },
          },
        },
        paths: {
          '/x': {
            get: {
              responses: {
                '200': { $ref: '#/components/schemas/Foo' },
              },
            },
          },
        },
        external: { $ref: '/components/schemas/Foo' },
        bare: { $ref: '/foo/bar' },
        recursive: { $recursiveRef: '#/definitions/Node' },
        dynamic: { $dynamicRef: '#node' },
      }),
    );
    expect(withRef.some((item) => item.includes('absolute-path:'))).toBe(false);

    const ndjson = scanJsonTextForPrivacyLeaks(
      'rows.jsonl',
      `${JSON.stringify({ $ref: '/foo/bar', note: 'ok' })}\n${JSON.stringify({ $ref: '#/$defs/Release' })}\n`,
      { ndjson: true },
    );
    expect(ndjson.some((item) => item.includes('absolute-path:'))).toBe(false);
  });

  it('JSON $ref file://, Windows drive, and UNC values still produce absolute-path findings', () => {
    const fileUri = scanJsonTextForPrivacyLeaks(
      'doc.json',
      JSON.stringify({ $ref: 'file:///Users/yw/secret' }),
    );
    expect(fileUri.some((item) => item.includes('absolute-path:') && item.includes('file:///Users/yw/secret'))).toBe(true);

    const winDrive = scanJsonTextForPrivacyLeaks(
      'doc.json',
      JSON.stringify({ $ref: 'C:\\Users\\yw\\secret' }),
    );
    expect(winDrive.some((item) => item.includes('absolute-path:') && /C:/u.test(item))).toBe(true);

    const unc = scanJsonTextForPrivacyLeaks(
      'doc.json',
      // JSON string with real UNC \\server\share\secret
      JSON.stringify({ $ref: '\\\\server\\share\\secret' }),
    );
    expect(unc.some((item) => item.includes('absolute-path:') && item.includes('\\\\server\\share'))).toBe(true);
  });

  it('JSON non-ref fields still reject absolute filesystem path leaks', () => {
    const findings = scanJsonTextForPrivacyLeaks(
      'bundle-extra.json',
      JSON.stringify({
        $ref: '/components/schemas/Foo',
        export_path: '/srv/act/private/output.json',
        note: 'safe',
      }),
    );
    expect(findings.some((item) => item.includes('/srv/act/private/output.json'))).toBe(true);
    // pure $ref pointer must not contribute a path finding
    expect(findings.some((item) => item.includes('/components/schemas/Foo'))).toBe(false);
  });

  it('JSON raw-document scan does not context-free-match pointer-like strings outside fields', () => {
    // Raw JSON text contains "/foo/bar" only as a $ref value — no absolute-path finding.
    const findings = scanJsonTextForPrivacyLeaks(
      'doc.json',
      '{"$ref":"/foo/bar","title":"x"}',
    );
    expect(findings.some((item) => item.includes('absolute-path:'))).toBe(false);
  });

  it('scanPublicTextForPrivacyLeaks reports absolute-path findings with labels on free text', () => {
    const findings = scanPublicTextForPrivacyLeaks(
      'RELEASE-NOTES.md',
      'export path was /tmp/build/out/bundle and key=SILICONFLOW_API_KEY\n',
    );
    expect(findings.some((item) => item.includes('absolute-path:') && item.includes('/tmp/build'))).toBe(true);
    expect(findings.some((item) => item.includes('SILICONFLOW_API_KEY'))).toBe(true);

    const fileUriFindings = scanPublicTextForPrivacyLeaks(
      'notes.md',
      'cached at file:///Users/yw/secret.txt\n',
    );
    expect(
      fileUriFindings.some((item) => item.includes('absolute-path:file:///Users/yw/secret.txt')),
    ).toBe(true);
  });

  it('still detects secrets inside JSON $ref-adjacent documents', () => {
    const findings = scanJsonTextForPrivacyLeaks(
      'doc.json',
      JSON.stringify({
        $ref: '/components/schemas/Foo',
        hint: 'SILICONFLOW_API_KEY must not leak',
      }),
    );
    expect(findings.some((item) => item.includes('SILICONFLOW_API_KEY'))).toBe(true);
  });
});
