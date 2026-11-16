/**
 * 服务端内容哈希（issue-2152-p1）：按规范序序列化后 sha256。
 *
 * 仅服务端路由 import（依赖 node:crypto）；规范序与 Rust model_pack 的
 * 思路一致——对象键字典序、数组保序、数字统一可往返文本。
 */
import { createHash } from 'node:crypto';

/** 规范序 JSON 文本：键字典序、数字经 Number() 归一（-0 → 0）。 */
export function canonicalJson(value: unknown): string {
  // 同一曲线中仪器字段高度重复。只在本次调用内复用键文本，避免为每个
  // 样本分配 entries/filter/sort/map 的中间数组，不保留任何记录正文。
  const keyTexts = new Map<string, string>();
  function serialize(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('规范序序列化遇到非有限数值');
      return String(value);
    }
    if (Array.isArray(value)) return `[${value.map(serialize).join(',')}]`;
    if (typeof value === 'object') {
      const object = value as Record<string, unknown>;
      let text = '{';
      let separator = '';
      for (const key of Object.keys(object).sort()) {
        const entry = object[key];
        if (entry === undefined) continue;
        let keyText = keyTexts.get(key);
        if (keyText === undefined) {
          keyText = JSON.stringify(key);
          keyTexts.set(key, keyText);
        }
        text += `${separator}${keyText}:${serialize(entry)}`;
        separator = ',';
      }
      return `${text}}`;
    }
    throw new Error(`规范序序列化遇到不支持类型：${typeof value}`);
  }
  return serialize(value);
}

/** 学生辨识工件内容哈希（sha256 hex，64 位小写）。
 *
 * 只哈希契约规定的七个内容字段 + contractVersion——调用方传入的
 * 附加属性（experimentKey/lineageKey 等）不参与，保证哈希可按
 * 内容契约独立复算。
 */
export function studentModelContentHash(input: {
  structure: unknown;
  ioContract: unknown;
  operatingPoint: unknown;
  identification: unknown;
  trainingRuns: unknown;
  validationRuns: unknown;
  sampleDt: number;
}): string {
  const canonical = canonicalJson({
    contractVersion: 1,
    structure: input.structure,
    ioContract: input.ioContract,
    operatingPoint: input.operatingPoint,
    identification: input.identification,
    trainingRuns: input.trainingRuns,
    validationRuns: input.validationRuns,
    sampleDt: input.sampleDt,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
