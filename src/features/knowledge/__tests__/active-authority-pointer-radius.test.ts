import { describe, expect, it } from 'vitest';

import {
  activeNodePointerRadius,
  activeNodeRadius,
} from '../graph/active-renderer/active-authority-visual';

describe('active node pointer radius', () => {
  it('uses the painted root bubble as the hit area because the name sits inside it', () => {
    const node = {
      id: 'root-entry-01',
      renderRadius: 88,
      metadata: {
        presentationKind: 'active-root-navigation',
        presentationRadius: 120,
      },
    };
    expect(activeNodeRadius(node)).toBe(88);
    expect(activeNodePointerRadius(node)).toBe(88);
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
