import { createHash } from 'node:crypto';

import type { KonlingBlindAuditManifest } from './types';

/**
 * blind-audit-v1 fixture 清单：六类 study-question 意图各一条，
 * 与 #1819 的回答单元引用合同对齐。真实批次清单以同结构追加版本。
 */
export const KONLING_BLIND_AUDIT_BENCHMARK_V1: KonlingBlindAuditManifest = Object.freeze({
  benchmarkVersion: 'blind-audit-v1',
  modes: ['rule-score', 'blind-audit'],
  replicates: 2,
  items: Object.freeze([
    {
      itemId: 'formula-closed-loop',
      intent: 'formula-derivation',
      question: '请推导单位负反馈系统的闭环传递函数。',
      referenceAnswer: '闭环传递函数为 G(s)/(1+G(s)H(s))，H(s)=1 时分母为 1+G(s)。',
    },
    {
      itemId: 'code-antiwindup',
      intent: 'code-debugging',
      question: 'PID 输出持续饱和导致超调增大，如何定位和修复？',
      referenceAnswer: '故障定位为积分项无限幅；最小修复是增加抗积分饱和；验证看阶跃超调是否回落。',
    },
    {
      itemId: 'concept-open-vs-closed',
      intent: 'concept-comparison',
      question: '比较开环控制与闭环控制的判别维度与边界。',
      referenceAnswer: '判别维度是有无反馈；闭环能抑制扰动；模型很准时开环亦可。',
    },
    {
      itemId: 'normative-report-format',
      intent: 'normative-content',
      question: '实验报告封面有哪些规范要求？',
      referenceAnswer: '缺少权威来源时应标记需核验，不得写成确定规范条款。',
    },
    {
      itemId: 'open-overshoot-explain',
      intent: 'open-ended-explanation',
      question: '用生活化例子解释超调，并说明适用边界。',
      referenceAnswer: '超调类似船舵打过头；只适用于阶跃响应场景。',
    },
    {
      itemId: 'fact-overshoot-definition',
      intent: 'fact-explanation',
      question: '什么是超调量？',
      referenceAnswer: '超调量是峰值相对稳态值的超出比例。',
    },
  ] as const),
} as KonlingBlindAuditManifest);

export function konlingBlindAuditManifestHash(manifest: KonlingBlindAuditManifest): string {
  const canonical = JSON.stringify({
    benchmarkVersion: manifest.benchmarkVersion,
    modes: [...manifest.modes].sort(),
    replicates: manifest.replicates,
    items: manifest.items.map((item) => ({
      itemId: item.itemId,
      intent: item.intent,
      question: item.question,
      referenceAnswer: item.referenceAnswer,
    })),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function expectedTaskCount(
  manifest: KonlingBlindAuditManifest,
  mode: KonlingBlindAuditManifest['modes'][number],
): number {
  return manifest.items.length * manifest.replicates * (manifest.modes.includes(mode) ? 1 : 0);
}
