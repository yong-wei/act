import { describe, expect, it } from 'vitest';

import { toRepositoryArtifactPath } from '@/lib/evidence-artifact-path';

describe('toRepositoryArtifactPath', () => {
  it('serializes Windows artifact paths with portable forward slashes', () => {
    expect(toRepositoryArtifactPath(
      'C:\\workspace\\act',
      'C:\\workspace\\act\\artifacts\\commercial-ui\\evidence.png',
      'win32',
    )).toBe('artifacts/commercial-ui/evidence.png');
  });

  it('keeps POSIX artifact paths portable', () => {
    expect(toRepositoryArtifactPath(
      '/workspace/act',
      '/workspace/act/artifacts/commercial-ui/evidence.png',
      'linux',
    )).toBe('artifacts/commercial-ui/evidence.png');
  });
});
