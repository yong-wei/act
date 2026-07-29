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
  it('detects Unix sensitive absolute paths', () => {
    expect(detectAbsoluteFilesystemPathLeak('see /tmp/secret/token.json')).toContain('/tmp/secret');
    expect(detectAbsoluteFilesystemPathLeak('root=/var/lib/act/db')).toContain('/var/lib');
    expect(detectAbsoluteFilesystemPathLeak('"/workspace/projects/act"')).toContain('/workspace/projects');
    expect(detectAbsoluteFilesystemPathLeak('path=/root/.ssh/id_rsa')).toContain('/root/.ssh');
    expect(detectAbsoluteFilesystemPathLeak('/Users/yw/.codex/config')).toContain('/Users/yw');
    expect(detectAbsoluteFilesystemPathLeak('/home/student/notes.md')).toContain('/home/student');
  });

  it('detects Windows drive and UNC absolute paths', () => {
    expect(detectAbsoluteFilesystemPathLeak('C:\\Users\\yw\\secret.txt')).toMatch(/^C:/u);
    expect(detectAbsoluteFilesystemPathLeak('notes at D:/data/private/file.json')).toMatch(/^D:/u);
    expect(detectAbsoluteFilesystemPathLeak('share=\\\\fileserver\\teams\\act')).toMatch(/^\\\\fileserver/u);
  });

  it('does not flag legitimate URLs, JSON pointers, or course-relative paths', () => {
    expect(detectAbsoluteFilesystemPathLeak('https://example.com/tmp/docs/guide')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('http://cdn.example.org/var/assets/a.png')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('/properties/schema_version')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('/$defs/Release')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('course-content/authoring/knowledge/releases/x')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('relative/path/to/file.json')).toBeNull();
    expect(detectAbsoluteFilesystemPathLeak('ctr:profile:control-theory-engineering-v0.3:act-v2')).toBeNull();
  });

  it('scanPublicTextForPrivacyLeaks reports absolute-path findings with labels', () => {
    const findings = scanPublicTextForPrivacyLeaks(
      'RELEASE-NOTES.md',
      'export path was /tmp/build/out/bundle and key=SILICONFLOW_API_KEY\n',
    );
    expect(findings.some((item) => item.includes('absolute-path:') && item.includes('/tmp/build'))).toBe(true);
    expect(findings.some((item) => item.includes('SILICONFLOW_API_KEY'))).toBe(true);
  });
});
