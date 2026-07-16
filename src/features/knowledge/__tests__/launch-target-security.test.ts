import { describe, expect, it } from 'vitest';

import { resolveSafeLaunchTarget } from '../launch-target';

describe('knowledge resource launch target security', () => {
  it.each([
    '/adaptive-learning/path-node/opaque-leaf',
    'adaptive-learning/path-node/opaque-leaf',
    './opaque-leaf?next=1#focus',
    '../opaque-leaf',
    'https://act.just.edu.cn/knowledge',
  ])('preserves safe opaque target %s', (target) => {
    expect(resolveSafeLaunchTarget(target)).toEqual({
      href: target,
      reason: null,
    });
  });

  it.each([
    '',
    '\n',
    42,
    { href: '/safe' },
    '/safe\u200bjavascript:alert(1)',
    '/safe\u2028target',
  ])('rejects an invalid present authoritative value %j with a shared reason', (target) => {
    expect(resolveSafeLaunchTarget(target)).toEqual({
      href: null,
      reason: '资源启动地址未通过安全校验，当前不可启动。',
    });
  });

  it('rejects all HTTP by default, including loopback', () => {
    expect(resolveSafeLaunchTarget('http://localhost:3000/knowledge').href).toBeNull();
    expect(resolveSafeLaunchTarget('http://127.0.0.1:3200/knowledge').href).toBeNull();
  });

  it('allows loopback HTTP only for explicit development configuration on a loopback app origin', () => {
    expect(resolveSafeLaunchTarget('http://localhost:3000/knowledge', {
      mode: 'development',
      allowLoopbackHttp: true,
      applicationOrigin: 'http://127.0.0.1:3000',
    }).href).toBe('http://localhost:3000/knowledge');
    expect(resolveSafeLaunchTarget('http://localhost:3000/knowledge', {
      mode: 'production',
      allowLoopbackHttp: true,
      applicationOrigin: 'http://127.0.0.1:3000',
    }).href).toBeNull();
    expect(resolveSafeLaunchTarget('http://localhost:3000/knowledge', {
      mode: 'development',
      allowLoopbackHttp: true,
      applicationOrigin: 'https://act.just.edu.cn',
    }).href).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example/opaque',
    'https:\\evil.example\\opaque',
    'http://example.com/plaintext',
    ' javascript:alert(1)',
    'javascript:\nalert(1)',
    'java\tscript:alert(1)',
    'javascript:%0aalert(1)',
    '/safe\u0000javascript:alert(1)',
    '/safe path',
    '/safe%20path',
  ])('rejects dangerous or ambiguous target %j', (target) => {
    expect(resolveSafeLaunchTarget(target)).toEqual({
      href: null,
      reason: '资源启动地址未通过安全校验，当前不可启动。',
    });
  });
});
