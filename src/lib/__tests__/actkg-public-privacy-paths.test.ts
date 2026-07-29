/**
 * Directed unit tests for public privacy absolute-path detection.
 * Does not require a clean Git capture tree.
 */
import { describe, expect, it } from 'vitest';

import {
  detectAbsoluteFilesystemPathLeak,
  scanPublicTextForPrivacyLeaks,
} from '../../../scripts/actkg-release/public-bundle-v1';

describe('public privacy absolute path detection', () => {
  it('detects arbitrary multi-segment POSIX absolute paths', () => {
    expect(detectAbsoluteFilesystemPathLeak('see /tmp/secret/token.json')).toContain('/tmp/secret');
    expect(detectAbsoluteFilesystemPathLeak('root=/var/lib/act/db')).toContain('/var/lib');
    expect(detectAbsoluteFilesystemPathLeak('"/workspace/projects/act"')).toContain('/workspace/projects');
    expect(detectAbsoluteFilesystemPathLeak('path=/root/.ssh/id_rsa')).toContain('/root/.ssh');
    expect(detectAbsoluteFilesystemPathLeak('/Users/yw/.codex/config')).toContain('/Users/yw');
    expect(detectAbsoluteFilesystemPathLeak('/home/student/notes.md')).toContain('/home/student');
    // Previously missed roots (allowlist hole):
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
  });

  it('detects Windows drive, real UNC, and file: URI absolute paths', () => {
    expect(detectAbsoluteFilesystemPathLeak('C:\\Users\\yw\\secret.txt')).toMatch(/^C:/u);
    expect(detectAbsoluteFilesystemPathLeak('notes at D:/data/private/file.json')).toMatch(/^D:/u);
    expect(detectAbsoluteFilesystemPathLeak('share=\\\\fileserver\\teams\\act')).toMatch(/^\\\\fileserver/u);
    expect(detectAbsoluteFilesystemPathLeak('\\\\nas01\\exports\\bundle\\manifest.json')).toMatch(
      /^\\\\nas01\\exports/u,
    );

    // POSIX file URI (empty authority, absolute path)
    expect(detectAbsoluteFilesystemPathLeak('file:///Users/yw/secret.txt')).toBe(
      'file:///Users/yw/secret.txt',
    );
    expect(detectAbsoluteFilesystemPathLeak('note file:///tmp/build/out ')).toContain(
      'file:///tmp/build/out',
    );
    // Authority form
    expect(detectAbsoluteFilesystemPathLeak('file://server/share/path')).toBe(
      'file://server/share/path',
    );
  });

  it('does not flag legitimate URLs, JSON pointers, course-relative paths, or LaTeX escapes', () => {
    expect(detectAbsoluteFilesystemPathLeak('https://example.com/tmp/docs/guide')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('http://cdn.example.org/var/assets/a.png')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('/properties/schema_version')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('/$defs/Release')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('course-content/authoring/knowledge/releases/x')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('relative/path/to/file.json')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('ctr:profile:control-theory-engineering-v0.3:act-v2')).toBeNull();
    // r2 Projection descriptions include LaTeX; raw JSON often stores "\\begin{aligned}\nV_{2}(s)".
    expect(detectAbsoluteFilesystemPathLeak('\\\\begin{aligned}\\nV_{2}(s)')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('\\begin{aligned}\nV_{2}(s)=\\frac{1}{s}')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('G(s)=\\frac{K}{s(Js+B)}')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('{"description":"\\\\begin{aligned}\\nV_{2}(s)\\\\end{aligned}"}')).toBeNull();
    // Transfer-function ratios must not be parsed as multi-segment POSIX paths.
    expect(detectAbsoluteFilesystemPathLeak('R(s)=p(s)/q(s).')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('Y(s)/U(s)=G(s)/(1+G(s)H(s))')).toBeNull();
  });

  it('scanPublicTextForPrivacyLeaks reports absolute-path findings with labels', () => {
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
});
