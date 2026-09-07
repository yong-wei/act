import { describe, expect, it } from 'vitest';

import { canEmbedResourceHref } from '../embed-policy';

describe('canEmbedResourceHref', () => {
  it('embeds governed app pages and rejects raw runtime files', () => {
    expect(canEmbedResourceHref('/interactive-learning/courses/unit-1-1-see-the-full-picture')).toBe(true);
    expect(canEmbedResourceHref('/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-01')).toBe(true);
    expect(canEmbedResourceHref('/course-runtime/lessons/demo/handout.md')).toBe(false);
    expect(canEmbedResourceHref('/interactive-learning/lessons/3-2/notes.md')).toBe(false);
    expect(canEmbedResourceHref('https://example.com/lesson')).toBe(false);
  });
});
