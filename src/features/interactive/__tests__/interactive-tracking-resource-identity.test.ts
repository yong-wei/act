import { describe, expect, it } from 'vitest';

import { resolveTrackingResourceIdentity } from '../hooks/resource-identity';

describe('resolveTrackingResourceIdentity', () => {
  it('keeps logical course keys in resourceKey and out of resourceId', () => {
    const identity = resolveTrackingResourceIdentity({
      configuredResourceId: 'unit-3-8-frequency-domain-translation-judgment',
      configuredResourceKey: 'unit-3-8-frequency-domain-translation-judgment',
      eventResourceId: null,
      eventResourceKey: 'unit-3-8-frequency-domain-translation-judgment',
    });

    expect(identity).toEqual({
      resourceId: null,
      resourceKey: 'unit-3-8-frequency-domain-translation-judgment',
    });
  });

  it('preserves persisted TeachingResource ids when the caller supplies one', () => {
    const identity = resolveTrackingResourceIdentity({
      configuredResourceId: 'cmabcdefghijklmno12345678',
      configuredResourceKey: 'lesson-entry:3-8:handout',
    });

    expect(identity).toEqual({
      resourceId: 'cmabcdefghijklmno12345678',
      resourceKey: 'lesson-entry:3-8:handout',
    });
  });
});
