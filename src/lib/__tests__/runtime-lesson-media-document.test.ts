import { describe, expect, it } from 'vitest';

import { parseRuntimeLessonMediaDocument } from '../runtime-lesson-media-document';

describe('runtime lesson media document', () => {
  it('ignores document headings and parses valid nested media headings once', () => {
    const document = parseRuntimeLessonMediaDocument([
      '# 媒体链接登记',
      'https://legacy.example/ignored',
      '',
      '## lesson-slides.pdf',
      '- Slides',
      '',
      '### lesson-course.mp4',
      '- Course',
      '',
      '# lesson-course.mp4',
      '- Duplicate',
      '',
      '## lesson-handout.md',
      'Summary text',
    ].join('\n'));

    expect(document.mediaResources).toEqual([
      expect.objectContaining({ filename: 'lesson-slides.pdf', title: 'Slides', url: null }),
      expect.objectContaining({ filename: 'lesson-course.mp4', title: 'Course', url: null }),
    ]);
    expect(document.handoutSummary).toBe('Summary text');
  });
});
