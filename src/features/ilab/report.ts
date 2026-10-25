import type { AiUsageLedger } from './ai-data';
import type { StoredIlabStep } from './payload';
import { ILAB_EXPERIMENT_TITLE, ILAB_MAX_POINTS } from './steps';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildIlabReportHtml(input: {
  displayName: string;
  vesselName: string;
  steps: StoredIlabStep[];
  ledger: AiUsageLedger;
  reflection: string;
  pretestNote?: string;
  paperNote?: string;
}): string {
  const earned = input.steps.reduce((sum, step) => sum + step.earnedPoints, 0);
  const rows = [...input.steps]
    .sort((left, right) => left.seq - right.seq)
    .map((step) => `<tr><td>${step.seq}</td><td>${escapeHtml(step.title)}</td><td>${step.earnedPoints}/${step.maxPoints}</td><td>${escapeHtml(step.evaluation)}</td><td>${escapeHtml(step.remarks)}</td></tr>`)
    .join('');
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${escapeHtml(ILAB_EXPERIMENT_TITLE)}实验报告</title></head>
<body>
<h1>${escapeHtml(ILAB_EXPERIMENT_TITLE)}</h1>
<p>学生：${escapeHtml(input.displayName || '未命名')}</p>
<p>场景：${escapeHtml(input.vesselName || '未选择')}</p>
<p>申报步骤得分：${earned}/${ILAB_MAX_POINTS}。步骤 23 的教师评价和互评未计入。教师复核尚未完成。</p>
<table>
<thead><tr><th>序号</th><th>步骤</th><th>得分</th><th>评价</th><th>说明</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<h2>学生反思</h2>
<p>${escapeHtml(input.reflection)}</p>
<h2>预习成绩</h2>
<p>${escapeHtml(input.pretestNote || '未完成预习。')}</p>
<h2>测试卷</h2>
<p>${escapeHtml(input.paperNote || '未提交测试卷。')}</p>
<h2>教师评价报告</h2>
<p>步骤 23 保持待教师复核，教师分数未计入本次实验空间成绩。四维量规为工程伦理判断、证据化表达、多目标权衡、团队协作。</p>
<h2>人工智能调用</h2>
<p>调用次数：${input.ledger.callCount}。输入 token：${input.ledger.inputTokens}。输出 token：${input.ledger.outputTokens}。</p>
<p>${escapeHtml(input.ledger.remark)}</p>
</body>
</html>`;
  if (Buffer.byteLength(html, 'utf8') > 5 * 1024 * 1024) {
    throw new Error('实验报告超过 5MB。');
  }
  if (!html.trim()) throw new Error('实验报告为空。');
  return html;
}
