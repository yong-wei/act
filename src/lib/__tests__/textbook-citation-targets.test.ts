import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { RuntimeMarkdownContent } from '../../components/shared/runtime-markdown';
import {
  TEXTBOOK_CITATION_MARKDOWN_ANCHOR_PREFIX,
  preprocessTextbookCitationMarkdown,
  resolveRuntimeMarkdownAssetHref,
  resolveTextbookCitationHref,
  resolveTextbookCitationReaderPath,
} from '../textbook-citation-targets';

describe('textbook citation targets', () => {
  it('maps runtime textbook chunks to rendered citation reader hrefs', () => {
    const resolved = resolveTextbookCitationHref(
      '/course-runtime/resources/textbooks/dorf-modern-control-systems/chunks/ch01-sec01__chunk-001.md#fig-01-01',
    );

    expect(resolved).toEqual({
      canonicalHref: '/course-runtime/resources/textbooks/dorf-modern-control-systems/chunks/ch01-sec01__chunk-001.md#fig-01-01',
      displayHref: '/textbook-citations/resources/textbooks/dorf-modern-control-systems/chunks/ch01-sec01__chunk-001.md#fig-01-01',
      runtimeRelativePath: 'resources/textbooks/dorf-modern-control-systems/chunks/ch01-sec01__chunk-001.md',
      anchor: 'fig-01-01',
    });
  });

  it('rejects traversal, unsupported extensions, and non-textbook routes', () => {
    expect(resolveTextbookCitationHref('/course-runtime/resources/textbooks/book/chunks/%2e%2e/private.md')).toBeNull();
    expect(resolveTextbookCitationHref('/course-runtime/resources/textbooks/book/assets/figure.png')).toBeNull();
    expect(resolveTextbookCitationHref('/course-runtime/lessons/2-1/2-1-handout.md')).toBeNull();
    expect(resolveTextbookCitationHref('https://model.example/textbook.md')).toBeNull();
  });

  it('validates reader route target paths with the same allowlist', () => {
    expect(resolveTextbookCitationReaderPath([
      'resources',
      'textbooks',
      'book',
      'sections',
      'ch01-sec01.md',
    ])).toEqual({
      runtimeRelativePath: 'resources/textbooks/book/sections/ch01-sec01.md',
      canonicalHref: '/course-runtime/resources/textbooks/book/sections/ch01-sec01.md',
    });
    expect(resolveTextbookCitationReaderPath(['resources', 'textbooks', 'book', 'assets', 'figure.png'])).toBeNull();
  });

  it('removes source comments and machine image descriptions from visible Markdown', () => {
    const markdown = [
      '<!-- citation-target: ch01-sec01 -->',
      '# Heading',
      '',
      '<a id="fig-01"></a>![](/course-runtime/resources/textbooks/book/assets/fig.png)',
      '',
      '> Image description: This is retrieval-only prose.',
      '',
      'Learner-visible paragraph.',
    ].join('\n');

    const cleaned = preprocessTextbookCitationMarkdown(markdown);
    expect(cleaned).toContain('# Heading');
    expect(cleaned).toContain('![](/course-runtime/resources/textbooks/book/assets/fig.png)');
    expect(cleaned).toContain(`[[${TEXTBOOK_CITATION_MARKDOWN_ANCHOR_PREFIX}fig-01]]`);
    expect(cleaned).toContain('Learner-visible paragraph.');
    expect(cleaned).not.toContain('citation-target');
    expect(cleaned).not.toContain('Image description');
    expect(cleaned).not.toContain('<a id=');
  });

  it('renders safe textbook anchors as real invisible DOM anchors without leaking raw HTML', () => {
    const cleaned = preprocessTextbookCitationMarkdown([
      '<a id="fig-01"></a>![](/course-runtime/resources/textbooks/book/assets/fig.png)',
      '',
      'Visible paragraph.',
    ].join('\n'));
    const html = renderToStaticMarkup(React.createElement(RuntimeMarkdownContent, {
      markdown: cleaned,
      mode: 'textbook-citation',
      resolveAssetHref: (href: string) => href,
    }));

    expect(html).toContain('id="fig-01"');
    expect(html).toContain('data-textbook-citation-anchor="fig-01"');
    expect(html).toContain('<img');
    expect(html).not.toContain('&lt;a id');
    expect(html).not.toContain('<a id');
    expect(html).not.toContain(TEXTBOOK_CITATION_MARKDOWN_ANCHOR_PREFIX);
  });

  it('renders textbook anchors inside tables without leaking internal markers', () => {
    const cleaned = preprocessTextbookCitationMarkdown([
      '| Figure | Description |',
      '| --- | --- |',
      '| <a id="img-chapter-08-067"></a>![](/course-runtime/resources/textbooks/book/assets/img.png) | Table figure |',
    ].join('\n'));
    const html = renderToStaticMarkup(React.createElement(RuntimeMarkdownContent, {
      markdown: cleaned,
      mode: 'textbook-citation',
      resolveAssetHref: (href: string) => href,
    }));

    expect(html).toContain('id="img-chapter-08-067"');
    expect(html).toContain('data-textbook-citation-anchor="img-chapter-08-067"');
    expect(html).toContain('<td');
    expect(html).toContain('<img');
    expect(html).not.toContain('&lt;a id');
    expect(html).not.toContain(TEXTBOOK_CITATION_MARKDOWN_ANCHOR_PREFIX);
  });

  it('resolves relative Markdown images under the same runtime textbook tree', () => {
    expect(resolveRuntimeMarkdownAssetHref(
      '../assets/chapter-01/fig-01-01.png',
      'resources/textbooks/book/sections/ch01-sec01.md',
    )).toBe('/course-runtime/resources/textbooks/book/assets/chapter-01/fig-01-01.png');
    expect(resolveRuntimeMarkdownAssetHref('../../private.json', 'resources/textbooks/book/sections/ch01-sec01.md')).toBe('');
  });
});
