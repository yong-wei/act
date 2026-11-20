import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicImageDeliveryRedirect } from '@/lib/public-image-delivery';

const source = (digest = 'a'.repeat(64), suffix = 'png') =>
  `https://static.adapt-learn.online/teaching-media/sha256/${digest}/asset.${suffix}`;

const request = (
  accept = 'image/avif,image/webp,image/*',
  dest = 'image',
  suffix = '',
) => new Request(`https://act.adapt-learn.online/course-runtime/image${suffix}`, {
  headers: { Accept: accept, 'Sec-Fetch-Dest': dest },
});

afterEach(() => vi.unstubAllEnvs());

describe('public image delivery', () => {
  it('chooses a lossless picture or the measured responsive cover', () => {
    const variant = publicImageDeliveryRedirect(request(), source());
    expect(variant.status).toBe(307);
    expect(variant.headers.get('vary')).toBe('Accept, Sec-Fetch-Dest');
    expect(variant.headers.get('cache-control')).toBe('no-store');
    expect(new URL(variant.headers.get('location')!).searchParams.get('x-oss-process'))
      .toBe('image/format,webp/quality,lossless');
    const cover = source('df8b6ef5e4c122f2eae9ec21320a55df26d193f895a65d6b5c2edda39a91508d');
    expect(new URL(publicImageDeliveryRedirect(request(), cover).headers.get('location')!).searchParams.get('x-oss-process'))
      .toBe('image/resize,w_1280,limit_1/format,webp/quality,Q_82');
  });

  it('keeps exact representations for downloads, SVG, GIF and clients without WebP', () => {
    for (const [input, url] of [
      [request('image/webp;q=0,*/*'), source()],
      [request('image/webp', 'empty'), source()],
      [request('image/webp', 'image', '?download=1'), source()],
      [request(), source(undefined, 'svg')],
      [request(), source(undefined, 'gif')],
      [request(), source().replace('static.adapt-learn.online', 'act.adapt-learn.online')],
    ] as const) {
      expect(publicImageDeliveryRedirect(input, url).headers.get('location')).toBe(url);
    }
    vi.stubEnv('ACT_PUBLIC_TEACHING_MEDIA_WEBP_ENABLED', '0');
    expect(publicImageDeliveryRedirect(request(), source()).headers.get('location')).toBe(source());
  });
});
