import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function readFunctionBlock(source: string, marker: string) {
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextFunction = source.indexOf('\n  const ', start + marker.length);
  expect(nextFunction).toBeGreaterThan(start);
  return source.slice(start, nextFunction);
}

describe('ai task boundary UI source contracts', () => {
  it('sanitizes global and copilot AI messages and hides raw tool JSON', () => {
    const messageContent = readSource('src/components/ai/ai-message-content.tsx');
    const globalSidebar = readSource('src/components/ai/global-ai-sidebar.tsx');
    const copilot = readSource('src/app/ai/copilot/page.tsx');
    const konlingSidebar = readSource('src/components/ai/konling-sidebar.tsx');
    const copilotPanel = readSource('src/features/ai/copilot-panel.tsx');
    const interactiveAiPanel = readSource('src/features/interactive/InteractiveAIPanel.tsx');

    expect(messageContent).toContain('sanitizeContent ? sanitizeAiVisibleContent(content) : content');
    expect(globalSidebar).toContain("role={isOpen ? 'dialog' : undefined}");
    expect(globalSidebar).toContain("aria-modal={isOpen ? 'true' : undefined}");
    expect(globalSidebar).toContain("aria-hidden={isOpen ? undefined : 'true'}");
    expect(globalSidebar).toContain('inert={!isOpen}');
    expect(globalSidebar).toContain('data-ai-task-status="global-sidebar"');
    expect(globalSidebar).toContain('summarizeAiToolResult(tool.toolName)');
    expect(globalSidebar).toContain('发送 AI 问题');
    expect(globalSidebar).toContain('sanitizeContent={!isUser}');
    expect(copilot).toContain('summarizeAiToolResult(tool.toolName)');
    expect(copilot).toContain("sanitizeContent={message.role !== 'user'}");
    expect(copilot).toContain("context === 'portfolio-reflection'");
    expect(copilot).toContain("context === 'evidence'");
    expect(copilot).toContain('const evidenceSummary = useMemo');
    expect(copilot).toContain('data-ai-task-boundary="evidence-copilot-summary"');
    expect(copilot).toContain('pageContext: copilotPageContext');
    expect(copilot).toContain('taskContext: evidenceSummary');
    expect(copilot).toContain('证据来源：${evidenceSummary.source}');
    expect(konlingSidebar).toContain('sanitizeContent={!isUser}');
    expect(copilotPanel).toContain('sanitizeContent={!isUser}');
    expect(interactiveAiPanel).toContain('sanitizeContent={!isUser}');

    [
      globalSidebar,
      copilot,
      konlingSidebar,
      copilotPanel,
      interactiveAiPanel,
    ].forEach((source) => {
      expect(source).not.toContain('<AIMessageContent content={message.content} />');
    });
  });

  it('keeps prompt assessment page-local inputs ahead of global AI', () => {
    const source = readSource('src/app/evaluation/prompt-assessment/page.tsx');

    expect(source).toContain('data-primary-task-input');
    expect(source).toContain('name={`prompt-${field.key}`}');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('getAiAuditTaskContract');
    expect(source).toContain('清空本次结果');
    expect(source).toContain('停止当前请求');
    expect(source).toContain('重试上次动作');
    expect(source).toContain('buildDemoAssessment');
    expect(source).toContain('userId: DEMO_USER_ID');
    const doAssessmentBlock = readFunctionBlock(source, 'const doAssessment = async () => {');
    const doConsistencyBlock = readFunctionBlock(source, 'const doConsistencyCheck = async () => {');

    expect(doAssessmentBlock.indexOf("if (autoDemo) {")).toBeLessThan(doAssessmentBlock.indexOf("fetch('/api/evaluation/assess-prompt'"));
    expect(doAssessmentBlock.indexOf('return;')).toBeLessThan(doAssessmentBlock.indexOf("fetch('/api/evaluation/assess-prompt'"));
    expect(doAssessmentBlock).toContain('userId: DEMO_USER_ID');
    expect(doAssessmentBlock).toContain('sessionId: DEMO_SESSION_ID');

    expect(doConsistencyBlock.indexOf("if (autoDemo) {")).toBeLessThan(doConsistencyBlock.indexOf("fetch('/api/evaluation/track-consistency'"));
    expect(doConsistencyBlock.indexOf('return;')).toBeLessThan(doConsistencyBlock.indexOf("fetch('/api/evaluation/track-consistency'"));
    expect(doConsistencyBlock).toContain('userId: DEMO_USER_ID');
    expect(doConsistencyBlock).toContain('sessionId: DEMO_SESSION_ID');
  });

  it('maps AI workshop and portfolio reflection intents to candidate-only states without false persistence', () => {
    const aiPage = readSource('src/app/ai/page.tsx');
    const learningCenter = readSource('src/features/ai/personal-learning-center.tsx');
    const portfolio = readSource('src/app/(main)/profile/portfolio/page.tsx');

    expect(aiPage).toContain('taskIntent={params?.task}');
    expect(learningCenter).toContain('data-ai-task-boundary="report-feedback"');
    expect(learningCenter).toContain('buildReportFeedbackTaskCandidates()');
    expect(learningCenter).toContain('标记待写回');
    expect(learningCenter).toContain('本页尚未保存到学习任务');
    expect(learningCenter).not.toContain('练习任务候选已写回学习任务');
    expect(portfolio).toContain('data-ai-task-boundary="portfolio-reflection-draft"');
    expect(portfolio).toContain('buildPortfolioReflectionDraft');
    expect(portfolio).toContain('草稿候选已创建');
    expect(portfolio).toContain('本页尚未保存到学习档案');
    expect(portfolio).not.toContain('>保存草稿<');
    expect(portfolio).not.toContain('确认草稿内容后保存到学习档案');
  });
});
