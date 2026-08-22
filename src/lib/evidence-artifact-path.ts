import path from 'node:path';

export function toRepositoryArtifactPath(
  repositoryRoot: string,
  absolutePath: string,
  platform: NodeJS.Platform = process.platform,
) {
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  return pathApi.relative(repositoryRoot, absolutePath).split(pathApi.sep).join('/');
}
