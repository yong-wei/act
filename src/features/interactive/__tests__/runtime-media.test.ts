import { describe, expect, it } from 'vitest';

import { extractDirectAudioSourceFromPreviewHtml } from '@/lib/runtime-media';

describe('runtime media helpers', () => {
  it('extracts direct audio src from preview html', () => {
    const html = `
      <script>
        var musicList = [
          {
            resid: '0',
            title: '',
            src: 'https://s2.cldisk.com/demo/audio.mp3?token=abc',
          },
        ];
      </script>
    `;

    expect(extractDirectAudioSourceFromPreviewHtml(html)).toBe(
      'https://s2.cldisk.com/demo/audio.mp3?token=abc',
    );
  });

  it('returns null when preview html does not expose a direct audio src', () => {
    expect(extractDirectAudioSourceFromPreviewHtml('<html><body>demo</body></html>')).toBeNull();
  });
});
