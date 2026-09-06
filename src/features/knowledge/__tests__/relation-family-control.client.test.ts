import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RelationFamilyControl } from '../graph/relation-family-control';
import { KNOWLEDGE_GRAPH_RELATION_FAMILIES } from '../graph/relation-family-controls';

function renderControl(avoidExpandedKonling: boolean) {
  return renderToStaticMarkup(
    createElement(RelationFamilyControl, {
      enabledFamilies: KNOWLEDGE_GRAPH_RELATION_FAMILIES,
      isLightTheme: false,
      placement: 'canvas',
      avoidExpandedKonling,
      onToggleAll: vi.fn(),
      onToggleFamily: vi.fn(),
    })
  );
}

describe('RelationFamilyControl', () => {
  it('keeps every relation-family button available in the expanded Konling avoidance layout', () => {
    const markup = renderControl(true);

    expect(markup).toContain('data-knowledge-relation-family-collision-policy="vertical-clear-of-expanded-konling"');
    expect(markup).toContain('bottom-0');
    expect(markup).toContain('left-20');
    expect(markup).toContain('grid-cols-1');
    expect(markup.match(/data-knowledge-relation-family=/g)).toHaveLength(4);
    expect(markup.match(/<button/g)).toHaveLength(4);
    expect(markup).not.toContain('disabled');
  });

  it('preserves the horizontal canvas layout when Konling is not expanded', () => {
    const markup = renderControl(false);

    expect(markup).toContain('data-knowledge-relation-family-collision-policy="default"');
    expect(markup).toContain('bottom-0');
    expect(markup).toContain('left-0');
    expect(markup).toContain('sm:grid-flow-col');
    expect(markup).not.toContain('vertical-clear-of-expanded-konling');
  });
});
