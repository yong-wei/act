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
      candidateAnswer: '## 前提与符号\nG(s) 为前向通道 [1]。\n## 关键变形\n闭环为 G/(1+GH)。',
    },
    {
      itemId: 'code-antiwindup',
      intent: 'code-debugging',
      question: 'PID 输出持续饱和导致超调增大，如何定位和修复？',
      referenceAnswer: '故障定位为积分项无限幅；最小修复是增加抗积分饱和；验证看阶跃超调是否回落。',
      candidateAnswer: '**故障定位**\n超调持续增大。\n**最小修复**\n加抗饱和 [1]。',
    },
    {
      itemId: 'concept-open-vs-closed',
      intent: 'concept-comparison',
      question: '比较开环控制与闭环控制的判别维度与边界。',
      referenceAnswer: '判别维度是有无反馈；闭环能抑制扰动；模型很准时开环亦可。',
      candidateAnswer: '## 判别维度\n有没有反馈 [1]。\n## 联系与差异\n闭环能抑制扰动 [1]。',
    },
    {
      itemId: 'normative-report-format',
      intent: 'normative-content',
      question: '实验报告封面有哪些规范要求？',
      referenceAnswer: '缺少权威来源时应标记需核验，不得写成确定规范条款。',
      candidateAnswer: '## 规范结论\n封面必须有题目与姓名。\n## 核验来源\n当前缺少权威来源，需核验。',
    },
    {
      itemId: 'open-overshoot-explain',
      intent: 'open-ended-explanation',
      question: '用生活化例子解释超调，并说明适用边界。',
      referenceAnswer: '超调类似船舵打过头；只适用于阶跃响应场景。',
      candidateAnswer: '## 核心结论\n超调是冲过头 [1]。\n## 定制化讲解\n像船舵打得太猛。',
    },
    {
      itemId: 'fact-overshoot-definition',
      intent: 'fact-explanation',
      question: '什么是超调量？',
      referenceAnswer: '超调量是峰值相对稳态值的超出比例。',
      candidateAnswer: '## 核心结论\n超调量是峰值相对稳态值的超出比例 [1]。\n## 解释\n越大越抖。',
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
      candidateAnswer: item.candidateAnswer,
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
