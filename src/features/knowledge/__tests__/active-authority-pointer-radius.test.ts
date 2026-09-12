import { describe, expect, it } from 'vitest';

import {
  activeNodePointerRadius,
  activeNodeRadius,
} from '../graph/active-renderer/active-authority-visual';

describe('active node pointer radius', () => {
  it('covers the root label bubble, not only the painted glyph', () => {
    const node = {
      id: 'root-entry-01',
      renderRadius: 40,
      metadata: {
        presentationKind: 'active-root-navigation',
        presentationRadius: 96,
      },
    };
    expect(activeNodeRadius(node)).toBe(40);
    expect(activeNodePointerRadius(node)).toBe(96);
  });

  it('extends domain-concept hits past the glyph so the name is clickable', () => {
    const node = {
      id: 'ctkg:domainconcept:example',
      renderRadius: 12,
      metadata: { presentationKind: 'semantic' },
    };
    expect(activeNodePointerRadius(node, 1)).toBeGreaterThan(activeNodeRadius(node));
  });
});
