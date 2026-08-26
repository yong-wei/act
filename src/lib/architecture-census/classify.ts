import type { SurfaceClass } from './types';

export function isSourcePath(path: string): boolean {
  return /\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/u.test(path);
}

export function isTestPath(path: string): boolean {
  return (
    /(^|\/)(?:__tests__|tests|test)(?:\/|$)/u.test(path)
    || /\.(?:test|spec)\.(?:ts|tsx|js|mjs)$/u.test(path)
  );
}

export function isGeneratedPath(path: string): boolean {
  return /(^|\/)(?:\.next|generated|node_modules)\//u.test(path) || path.includes('/generated/');
}

export function featureName(path: string): string | null {
  const match = path.match(/^src\/features\/([^/]+)\//u);
  return match?.[1] ?? null;
}

export function currentOwnerEvidence(path: string): string[] {
  if (path.startsWith('src/app/')) return [`path:${path.split('/').slice(0, 3).join('/')}`];
  if (path.startsWith('src/features/')) return [`feature:${featureName(path) ?? 'unknown'}`];
  if (path.startsWith('src/lib/')) return ['lib:shared'];
  if (path.startsWith('src/resources/')) return ['resources'];
  if (path.startsWith('prisma/')) return ['persistence'];
  if (path.startsWith('scripts/')) return ['toolchain'];
  if (path.startsWith('openspec/')) return ['openspec'];
  if (path.startsWith('rust/')) return ['simulation-kernel'];
  return [`path:${path.split('/')[0] ?? 'root'}`];
}

export function surfaceClassFor(path: string): SurfaceClass {
  if (isTestPath(path)) return 'test';
  if (isGeneratedPath(path)) return 'generated';
  if (/(?:legacy|compat|re-export|alias)/iu.test(path)) return 'compatibility';
  if (path.startsWith('src/app/') || path.includes('/route.ts') || path.endsWith('/page.tsx')) return 'framework-convention';
  return 'production';
}

export function isPageEntrypoint(path: string): boolean {
  return path.startsWith('src/app/') && /\/page\.tsx$/u.test(path);
}

export function isRouteHandler(path: string): boolean {
  return path.startsWith('src/app/') && /\/route\.ts$/u.test(path);
}

export function isServerAction(path: string): boolean {
  return path.startsWith('src/app/') && /actions\.ts$/u.test(path);
}

export function isUiEntrypoint(path: string): boolean {
  return path.startsWith('src/app/') && /\/(?:layout|page|template|default)\.tsx$/u.test(path);
}
