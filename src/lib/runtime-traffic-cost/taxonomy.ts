import {
  ROUTE_CLASSES,
  SOURCE_TYPES,
  type EndpointClass,
  type InventoryEntry,
  type Qualification,
  type RouteClass,
  type SourceType,
} from './types';

export const INVENTORY: readonly InventoryEntry[] = [
  { routeClass: 'public-assets', ownerPath: 'public/assets', description: 'Browser GLB and static files served from the app image through Nginx/Next.' },
  { routeClass: 'course-runtime', ownerPath: 'src/app/course-runtime/[...assetPath]/route.ts', description: 'Direct /course-runtime/* reads a whole runtime file into a Node buffer.' },
  { routeClass: 'runtime-media-redirect', ownerPath: 'src/app/api/course-runtime/assets/[...assetPath]/route.ts', description: 'Manifest-bound /api/course-runtime/assets/* redirects to a 300s OSS URL.' },
  { routeClass: 'runtime-blob-view', ownerPath: 'scripts/runtime-release', description: 'Production Runtime internal OSS FUSE Blob view.' },
  { routeClass: 'runtime-blob-public-read', ownerPath: 'scripts/runtime-release/developer-oss', description: 'Developer workstation public OSS Blob reads.' },
  { routeClass: 'publisher-public-upload', ownerPath: 'scripts/runtime-release/runtime-release-oss-publisher-bridge.py', description: 'Publisher PutObject of a new body.' },
  { routeClass: 'publisher-metadata-check', ownerPath: 'scripts/runtime-release/runtime-release-oss-publisher-bridge.py', description: 'Publisher HeadObject metadata reuse with no body read.' },
  { routeClass: 'publisher-legacy-body-readback', ownerPath: 'scripts/runtime-release/runtime-release-oss-publisher-bridge.py', description: 'Publisher legacy GetObject body readback.' },
];

const PREFIX_ROUTES: ReadonlyArray<readonly [RegExp, RouteClass]> = [
  [/^runtime\/(?:blobs|blob-releases)\//u, 'runtime-blob-view'],
  [/^runtime\/releases\//u, 'runtime-blob-view'],
  [/^public\/assets\//u, 'public-assets'],
  [/^assets\//u, 'public-assets'],
];

export function expectedSources(): readonly SourceType[] {
  return SOURCE_TYPES;
}

export function expectedRouteClasses(): readonly RouteClass[] {
  return ROUTE_CLASSES;
}

export function objectPrefixClass(prefix: string | undefined): string {
  if (!prefix) return 'unknown';
  if (prefix.startsWith('runtime/blobs/') || prefix.startsWith('runtime/blob-releases/')) return 'runtime-blobs';
  if (prefix.startsWith('runtime/releases/')) return 'runtime-releases';
  if (prefix.startsWith('public/assets/') || prefix.startsWith('assets/')) return 'browser-assets';
  return 'other';
}

export function routeClassFromPrefix(prefix: string | undefined): RouteClass | 'unattributed' {
  if (!prefix) return 'unattributed';
  for (const [pattern, routeClass] of PREFIX_ROUTES) {
    if (pattern.test(prefix)) return routeClass;
  }
  return 'unattributed';
}

export function routeClassFromPath(path: string | undefined): RouteClass | 'unattributed' {
  if (!path) return 'unattributed';
  if (path.startsWith('/api/course-runtime/assets/')) return 'runtime-media-redirect';
  if (path.startsWith('/course-runtime/')) return 'course-runtime';
  if (path.startsWith('/assets/') || path.startsWith('/public/assets/')) return 'public-assets';
  return 'unattributed';
}

export function ossEndpointClass(endpoint: string | undefined, metering: string | undefined): EndpointClass {
  if (metering === 'CdnOut') return 'cdn-origin';
  if (endpoint?.includes('internal') || metering === 'IntranetOut') return 'non-public';
  return 'public-network-out';
}

export function publisherRoute(operation: string | undefined): { readonly routeClass: RouteClass | 'unattributed'; readonly operationClass: string; readonly qualification: Qualification } {
  const value = (operation ?? '').toLowerCase();
  if (value === 'put-object' || value === 'upload') {
    return { routeClass: 'publisher-public-upload', operationClass: 'put-object', qualification: 'observed' };
  }
  if (value === 'head-object' || value === 'metadata-check') {
    return { routeClass: 'publisher-metadata-check', operationClass: 'head-object', qualification: 'observed' };
  }
  if (value === 'get-object-legacy' || value === 'legacy-body-readback') {
    return { routeClass: 'publisher-legacy-body-readback', operationClass: 'get-object', qualification: 'observed' };
  }
  return { routeClass: 'unattributed', operationClass: value || 'unknown', qualification: 'unattributed' };
}
