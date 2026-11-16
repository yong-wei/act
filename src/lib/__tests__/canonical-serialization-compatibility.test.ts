import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../student-model-artifact-contract/server-hash';

describe('既有内容寻址记录的规范序兼容性', () => {
  it('按字典序保留整数键、转义键、中文及不同深度的同名字段', () => {
    const input = { '2': -0, '10': 1e21, nested: { z: true, a: null, omitted: undefined },
      values: [false, '\ud800', '\n"\\', 5e-324], 中文: '量测', 'a"': '转义' };
    expect(canonicalJson(input)).toBe(String.raw`{"10":1e+21,"2":0,"a\"":"转义","nested":{"a":null,"z":true},"values":[false,"\ud800","\n\"\\",5e-324],"中文":"量测"}`);
  });

  it('有限数值文本保持JSON往返规则，包括极值、指数和负零', () => {
    for (const value of [-0, 0, 1e-7, 1e-6, 1e20, 1e21, -1e21, Number.MAX_VALUE, Number.MIN_VALUE,
      Number.MAX_SAFE_INTEGER, .1 + .2, -123.456]) {
      expect(canonicalJson(value)).toBe(JSON.stringify(value));
    }
  });

  it('重复仪器字段的大分块保持优化前固定内容哈希', () => {
    const samples = Array.from({ length: 1000 }, (_, index) => ({
      signal: index % 2 ? 'Heading' : { SurfaceEncoder: index % 16 },
      measurement: { value: index % 7 === 0 ? null : index / 8,
        quality: index % 7 === 0 ? 'Missing' : 'Good',
        t_sample_s: index / 20, t_arrive_s: index / 20 + .03 },
    }));
    const text = canonicalJson(samples);
    expect(createHash('sha256').update(text).digest('hex')).toBe('62fd4b4a43711b82316abb50f028ea14ec787e343d73834764eb1546c52cdf0f');
    expect(JSON.parse(text)).toEqual(samples);
  });

  it('调用之间及不同对象的字段不会相互污染，也不修改冻结输入', () => {
    const first = Object.freeze({ value: Object.freeze({ z: 1, a: 2 }), quality: 'Good' });
    expect(canonicalJson(first)).toBe('{"quality":"Good","value":{"a":2,"z":1}}');
    expect(canonicalJson({ quality: 'Missing', value: null, extra: 3 })).toBe('{"extra":3,"quality":"Missing","value":null}');
    expect(canonicalJson(first)).toBe('{"quality":"Good","value":{"a":2,"z":1}}');
  });

  it('仍拒绝非有限值、非法数组成员和非JSON类型', () => {
    for (const value of [NaN, Infinity, -Infinity]) expect(() => canonicalJson({ value })).toThrow('非有限数值');
    for (const value of [undefined, Symbol('invalid'), BigInt(1), () => 0]) {
      expect(() => canonicalJson(value)).toThrow('不支持类型');
      expect(() => canonicalJson([value])).toThrow('不支持类型');
    }
    expect(canonicalJson({ omitted: undefined, kept: null })).toBe('{"kept":null}');
  });
});
