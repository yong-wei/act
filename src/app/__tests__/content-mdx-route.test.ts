import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('/api/content/mdx route', () => {
  it('serves runtime markdown through the content path boundary', async () => {
    const { GET } = await import('@/app/api/content/mdx/route');

    const response = await GET(new Request(
      'http://localhost/api/content/mdx?path=course-content/runtime/lessons/3-8/3-8-handout.md',
    ));
    const payload = await response.json() as { content?: string };

    expect(response.status).toBe(200);
    expect(payload.content).toContain('频域判别');
  });

  it('rejects traversal and project-root arbitrary reads', async () => {
    const { GET } = await import('@/app/api/content/mdx/route');

    const traversal = await GET(new Request(
      'http://localhost/api/content/mdx?path=course-content/runtime/../authoring/shared/lesson-id-map.json',
    ));
    const arbitraryRootRead = await GET(new Request('http://localhost/api/content/mdx?path=package.json'));

    expect(traversal.status).toBe(400);
    expect(arbitraryRootRead.status).toBe(400);
  });
});
