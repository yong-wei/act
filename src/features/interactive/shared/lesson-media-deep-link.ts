/**
 * Lesson entry media deep link: `?media=<mediaId>&t=<seconds>[&sha=<sha256 prefix>]`.
 *
 * Anchored resource bindings navigate here instead of to a delivery URL. The page
 * resolves the media through the current delivery chain (gateway / signed OSS / ESA)
 * and seeks client-side once metadata is loaded. `sha` lets the page detect that the
 * binding was built against different media bytes and degrade to whole playback.
 */

export const MEDIA_DEEP_LINK_SHA_PREFIX_LENGTH = 12;

export interface LessonMediaDeepLink {
  mediaId: string;
  seconds: number;
  shaPrefix: string | null;
}

export function parseLessonMediaDeepLink(
  params: { get(name: string): string | null } | null | undefined,
): LessonMediaDeepLink | null {
  if (!params) return null;
  const mediaId = params.get('media')?.trim() ?? '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(mediaId)) return null;
  const rawSeconds = params.get('t')?.trim() ?? '';
  const seconds = rawSeconds ? Number(rawSeconds) : 0;
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const rawSha = params.get('sha')?.trim().toLowerCase() ?? '';
  const shaPrefix = /^[a-f0-9]{8,64}$/u.test(rawSha) ? rawSha : null;
  return { mediaId, seconds: Math.floor(seconds), shaPrefix };
}

export type MediaDeepLinkMatch =
  | { state: 'none' }
  | { state: 'seek'; seconds: number }
  | { state: 'drift'; seconds: number };

/** Decide what a matched media element should do with the deep link. */
export function matchLessonMediaDeepLink(
  link: LessonMediaDeepLink | null,
  resource: { id: string; sha256?: string | null },
): MediaDeepLinkMatch {
  if (!link || link.mediaId !== resource.id) return { state: 'none' };
  if (link.shaPrefix && resource.sha256 && !resource.sha256.toLowerCase().startsWith(link.shaPrefix)) {
    return { state: 'drift', seconds: link.seconds };
  }
  return { state: 'seek', seconds: link.seconds };
}

export function buildLessonMediaDeepLinkQuery(input: {
  mediaId: string;
  startSeconds: number;
  mediaSha256?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('media', input.mediaId);
  params.set('t', String(Math.max(0, Math.floor(input.startSeconds))));
  if (input.mediaSha256) params.set('sha', input.mediaSha256.slice(0, MEDIA_DEEP_LINK_SHA_PREFIX_LENGTH));
  return params.toString();
}
