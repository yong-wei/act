import assert from 'node:assert/strict';

import { buildLessonHandoutPrintUrl, resolveHandoutAssetUrl } from '../../src/lib/handout-pdf';

function run() {
  const origin = 'http://127.0.0.1:3001';
  const lessonId = 'L-2b';

  assert.equal(
    buildLessonHandoutPrintUrl({ origin, lessonId }),
    `${origin}/interactive-learning/lessons/${lessonId}/handout-print`,
  );

  assert.equal(
    resolveHandoutAssetUrl('/course-runtime/lessons/L-2b/media/sh-01.svg', { origin, lessonId }),
    `${origin}/course-runtime/lessons/L-2b/media/sh-01.svg`,
  );

  assert.equal(
    resolveHandoutAssetUrl('media/sh-01.svg', { origin, lessonId }),
    `${origin}/course-runtime/lessons/${lessonId}/media/sh-01.svg`,
  );

  assert.equal(
    resolveHandoutAssetUrl('https://example.com/asset.svg', { origin, lessonId }),
    'https://example.com/asset.svg',
  );

  console.log('test-handout-pdf passed');
}

run();
