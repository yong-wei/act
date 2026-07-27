import { describe, expect, it } from 'vitest';

import {
  resolveSessionClassContext,
} from '../class-session-attribution';

describe('class session attribution helpers', () => {
  it('resolves only the persisted session class context', () => {
    const result = resolveSessionClassContext({
      sessionClassId: 'class-2024',
      sessionClass: { id: 'class-2024', name: '2024自动化', code: 'AUTO2024' },
    });

    expect(result).toMatchObject({
      classId: 'class-2024',
      class: { id: 'class-2024', name: '2024自动化', code: 'AUTO2024' },
      attribution: {
        classId: 'class-2024',
        mode: 'explicit',
        confidence: 1,
        studentCount: 0,
      },
    });
  });

  it('keeps a classless session unassigned', () => {
    expect(resolveSessionClassContext({
      sessionClassId: null,
      sessionClass: null,
    })).toMatchObject({
      classId: null,
      class: null,
      attribution: { mode: 'unassigned' },
    });
  });
});
