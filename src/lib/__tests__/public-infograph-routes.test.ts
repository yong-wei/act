import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), activeImage: vi.fn(), publishedImage: vi.fn(),
  selector: vi.fn(), publicUrl: vi.fn(), reference: vi.fn(), feature: vi.fn(),
}));
vi.mock('@/app/api/knowledge/_active-authority', () => ({
  authorizeActiveGraph: mocks.authorize, readActiveDetailInfograph: mocks.activeImage,
  activeUnavailableResponse: () => new Response('Unavailable', { status: 503 }),
}));
vi.mock('@/lib/knowledge-surface', () => ({ knowledgeSurfaceSelectorRejection: mocks.selector }));
vi.mock('@/lib/authority-locale-readiness/request', () => ({
  activeLocaleCapability: () => ({}), resolveActiveLocaleRequest: () => ({ ok: true }),
}));
vi.mock('@/lib/authority-domain-shards/learning-content', () => ({
  isBindingContentToken: (value: string) => /^[A-Za-z0-9_-]+$/.test(value),
  readPublishedAuthorityInfographBySafeId: mocks.publishedImage,
}));
vi.mock('@/lib/public-teaching-media', () => ({ publicTeachingMediaUrlForBuffer: mocks.publicUrl }));
vi.mock('@/lib/published-resource-reference', () => ({ parsePublishedResourceHref: mocks.reference }));
vi.mock('@/lib/published-resource-index', () => ({ resolvePublishedResourceFeature: mocks.feature }));

import { GET as activeImage } from '@/app/api/knowledge/shards/active/nodes/[id]/infograph/route';
import { GET as publishedImage } from '@/app/api/knowledge/published-infograph/[safeId]/route';
import { GET as nodeDetail } from '@/app/api/knowledge/shards/active/nodes/[id]/route';

function active() {
  return activeImage(new Request('https://act.example/api/knowledge/shards/active/nodes/node-a/infograph'),
    { params: Promise.resolve({ id: 'node-a' }) });
}
function published(search = '') {
  return publishedImage(new Request(`https://act.example/api/knowledge/published-infograph/safe-a${search}`),
    { params: Promise.resolve({ safeId: 'safe-a' }) });
}

describe('public infograph image entrances', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authorize.mockResolvedValue({ ok: false, response: new Response('Unauthorized', { status: 401 }) });
    mocks.selector.mockReturnValue(null);
    mocks.publicUrl.mockResolvedValue(null);
    mocks.activeImage.mockReturnValue(Buffer.from('accepted-png'));
    mocks.publishedImage.mockReturnValue(Buffer.from('accepted-png'));
  });

  it('serves accepted images without consulting the graph login gate', async () => {
    for (const response of [await active(), await published()]) {
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    }
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it('keeps the real node-detail entrance protected when images become public', async () => {
    const response = await nodeDetail(new Request('https://act.example/api/knowledge/shards/active/nodes/node-a'),
      { params: Promise.resolve({ id: 'node-a' }) });
    expect(response.status).toBe(401);
    expect(mocks.authorize).toHaveBeenCalledOnce();
  });

  it('redirects both entrances only after the existing reader returns accepted bytes', async () => {
    const url = `https://static.adapt-learn.online/teaching-media/sha256/${'a'.repeat(64)}/asset.png`;
    mocks.publicUrl.mockResolvedValue(url);
    for (const response of [await active(), await published()]) {
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(url);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    expect(mocks.publicUrl).toHaveBeenCalledWith(Buffer.from('accepted-png'), 'image/png');
  });

  it('keeps missing or unqualified images unavailable', async () => {
    mocks.activeImage.mockReturnValue(null);
    mocks.publishedImage.mockReturnValue(null);
    expect((await active()).status).toBe(404);
    expect((await published()).status).toBe(404);
    expect(mocks.publicUrl).not.toHaveBeenCalled();
  });

  it('keeps stale resource references rejected before reading image bytes', async () => {
    mocks.reference.mockReturnValue({ resourceId: 'act:infographic:safe-a' });
    mocks.feature.mockResolvedValue({ current: false });
    expect((await published('?resourceRef=old')).status).toBe(409);
    expect(mocks.publishedImage).not.toHaveBeenCalled();
  });

  it('does not let public images bypass a rejected source selector', async () => {
    mocks.selector.mockReturnValue(NextResponse.json({ error: 'Invalid source' }, { status: 400 }));
    expect((await active()).status).toBe(400);
    expect((await published()).status).toBe(400);
    expect(mocks.activeImage).not.toHaveBeenCalled();
    expect(mocks.publishedImage).not.toHaveBeenCalled();
  });
});
