/**
 * 服务端内容哈希（issue-2152-p1）：按规范序序列化后 sha256。
 *
 * 仅服务端路由 import（依赖 node:crypto）；规范序与 Rust model_pack 的
 * 思路一致——对象键字典序、数组保序、数字统一可往返文本。
 */
import { createHash } from 'node:crypto';

import { canonicalJson } from './index';
export { canonicalJson } from './index';

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
