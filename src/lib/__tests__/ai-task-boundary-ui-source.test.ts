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
    const sharedRenderer = readSource('src/components/ai/konling-chat-renderer.tsx');
    const copilotPanel = readSource('src/features/ai/copilot-panel.tsx');
    const interactiveAiPanel = readSource('src/features/interactive/InteractiveAIPanel.tsx');

    expect(messageContent).toContain('sanitizeVerifiedCitationMarkdown(sanitizeAiVisibleContent(content))');
    expect(sharedRenderer).toContain('data-konling-chat-renderer="shared"');
    expect(sharedRenderer).toContain("sanitizeContent={!isUser}");
    expect(sharedRenderer).toContain('<KonlingCitationPanel metadata={extractKonlingCitationMetadata(message.metadata)} />');
    expect(sharedRenderer).toContain('summarizeAiToolResult(tool.toolName)');
    expect(sharedRenderer).toContain('flex-[0_1_75%]');
    expect(sharedRenderer).toContain('已调用 {tools.length} 项辅助能力');
    expect(sharedRenderer).not.toContain('called ${tools.length}');
    expect(sharedRenderer).not.toContain('called ${tool.toolName}');
    expect(globalSidebar).toContain("role={isOpen ? 'dialog' : undefined}");
    expect(globalSidebar).toContain("aria-modal={isOpen ? 'true' : undefined}");
    expect(globalSidebar).toContain("aria-hidden={isOpen ? undefined : 'true'}");
    expect(globalSidebar).toContain('inert={!isOpen}');
    expect(globalSidebar).toContain('data-ai-task-status="global-sidebar"');
    expect(globalSidebar).toContain('<KonlingChatMessageList messages={messages} styles={styles} onStructuredAction={handleStructuredAction} />');
    expect(globalSidebar).toContain('konlingPromptInputClassName');
    expect(globalSidebar).toContain('发送 AI 问题');
    expect(copilot).toContain('<KonlingChatMessageList messages={messages} />');
    expect(copilot).toContain('konlingPromptInputClassName');
    expect(copilot).toContain("context === 'portfolio-reflection'");
    expect(copilot).toContain("context === 'evidence'");
    expect(copilot).toContain('const evidenceSummary = useMemo');
    expect(copilot).toContain('data-ai-task-boundary="evidence-copilot-summary"');
    expect(copilot).toContain('pageContext: copilotPageContext');
    expect(copilot).toContain('taskContext: evidenceSummary');
    expect(copilot).toContain('证据来源：${evidenceSummary.source}');
    expect(konlingSidebar).toContain('<KonlingChatMessageList messages={messages} styles={styles} />');
    expect(konlingSidebar).toContain('konlingPromptInputClassName');
    expect(copilotPanel).toContain('<KonlingChatMessageList messages={messages} />');
    expect(copilotPanel).toContain('konlingPromptInputClassName');
    expect(interactiveAiPanel).toContain('<KonlingChatMessageList messages={ai.messages} />');
    expect(interactiveAiPanel).toContain('konlingPromptInputClassName');

    [
      sharedRenderer,
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
    const globalButton = readSource('src/components/ai/global-ai-button.tsx');

    expect(source).toContain('data-primary-task-input');
    expect(source).toContain('name={`prompt-${field.key}`}');
    expect(source).toContain('data-ai-local-task-surface="prompt-evaluation"');
    expect(source).toContain('data-ai-task-focus-mode="local-first"');
    expect(source).toContain('data-task-workspace-archetype="ai-local-task"');
    expect(source).toContain('data-task-workspace-zone="local-primary-input"');
    expect(source).toContain('data-task-workspace-zone="floating-dock-safe-area"');
    expect(source).toContain('本次 Prompt 评价结果已清空并丢弃。');
    expect(source).toContain('const promptAuditTaskContext = useMemo');
    expect(source).toContain('auditTaskContext: promptAuditTaskContext');
    expect(source).toContain('来源：{promptAuditTaskContext.source');
    expect(source).toContain('任务：{promptAuditTaskContext.assignment');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('getAiAuditTaskContract');
    expect(source).toContain('清空本次结果');
    expect(source).toContain('停止当前请求');
    expect(source).toContain('重试上次动作');
    expect(source).toContain('buildDemoAssessment');
    expect(source).toContain('userId: DEMO_USER_ID');
    expect(globalButton).toContain("document.querySelector('[data-ai-local-task-surface][data-ai-task-focus-mode=\"local-first\"]')");
    expect(globalButton).toContain('priority: localTaskMode ? 90 : 10');
    expect(globalButton).toContain("ariaLabel: localTaskMode ? '呼出次级控灵 AI助手' : '呼出控灵 AI助手'");
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
    const copilot = readSource('src/app/ai/copilot/page.tsx');
    const learningCenter = readSource('src/features/ai/personal-learning-center.tsx');
    const portfolio = readSource('src/app/(main)/profile/portfolio/page.tsx');

    expect(aiPage).toContain('taskIntent={params?.task}');
    expect(aiPage).toContain('taskAssignment={params?.assignment}');
    expect(aiPage).toContain('taskContextIntent={params?.intent}');
    expect(aiPage).toContain("data-ai-local-task-surface={hasLocalTask ? 'ai-workshop' : undefined}");
    expect(aiPage).toContain("data-ai-task-focus-mode={hasLocalTask ? 'local-first' : undefined}");
    expect(aiPage).toContain("data-task-workspace-archetype={hasLocalTask ? 'ai-local-task' : undefined}");
    expect(learningCenter).toContain('data-ai-task-boundary="report-feedback"');
    expect(learningCenter).toContain('assignment: taskAssignment');
    expect(learningCenter).toContain('intent: taskContextIntent ?? taskIntent');
    expect(learningCenter).toContain('标记待写回');
    expect(learningCenter).toContain('本页尚未保存到学习任务');
    expect(learningCenter).toContain('输出：{candidate.outputTarget}');
    expect(learningCenter).toContain('任务：{candidate.assignment');
    expect(learningCenter).toContain('data-primary-task-input="ai-workshop-report-feedback"');
    expect(copilot).toContain('data-primary-task-input={localTaskMode ? \'copilot-local-task\' : undefined}');
    expect(copilot).toContain("context === 'portfolio-reflection'");
    expect(copilot).toContain("context === 'evidence'");
    expect(copilot).toContain('clearLocalConversation');
    expect(copilot).toContain('buildPortfolioReflectionDraft(source, {');
    expect(copilot).toContain('intent: taskIntent');
    expect(copilot).toContain('auditTaskContext: portfolioReflectionTaskContext');
    expect(copilot).toContain("taskType: 'portfolio-reflection'");
    expect(copilot).toContain('source: reflectionDraft.source');
    expect(copilot).toContain('intent: reflectionDraft.intent');
    expect(copilot).toContain("if (assignment) params.set('assignment', assignment)");
    expect(copilot).toContain("if (taskIntent) params.set('taskIntent', taskIntent)");
    expect(copilot).toContain('href={portfolioReflectionHref}');
    expect(copilot).toContain('reflectionDraft.assignment ?? \'portfolio-reflection\'');
    expect(copilot).toContain('reflectionDraft.intent');
    expect(copilot).toContain("if (assignment) params.set('assignment', assignment)");
    expect(copilot).toContain("if (taskIntent) params.set('taskIntent', taskIntent)");
    expect(copilot).toContain('href={portfolioReflectionHref}');
    expect(copilot).toContain('任务：');
    expect(copilot).toContain("{reflectionDraft.assignment ?? 'portfolio-reflection'} · 意图：{reflectionDraft.intent}");
    expect(copilot).toContain('请把本次 AI 协作的任务目标和输出对象整理成反思草稿。');
    expect(copilot).toContain('请先说明当前证据来源，再给出下一步练习建议。');
    expect(learningCenter).not.toContain('练习任务候选已写回学习任务');
    expect(portfolio).toContain('data-ai-task-boundary="portfolio-reflection-draft"');
    expect(portfolio).toContain('buildPortfolioReflectionDraft');
    expect(portfolio).toContain('shouldRenderPortfolioFeedbackTask');
    expect(portfolio).toContain('const localFeedbackContext = shouldRenderPortfolioFeedbackTask(feedbackQuery)');
    expect(portfolio).toContain('const feedbackContext = useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams)');
    expect(readSource('src/lib/student-feedback-task-contract.ts')).toContain('Boolean(buildFeedbackTaskContext(query)?.supported)');
    expect(portfolio).toContain('const hasLocalPortfolioTask = Boolean(reflectionDraft || feedbackPortfolioDraft)');
    expect(portfolio).toContain("hasLocalPortfolioTask ? 'reflections' : 'works'");
    expect(portfolio).toContain("if (status === 'loading' || (loading && !hasLocalPortfolioTask))");
    expect(portfolio).toContain("const reflectionTaskIntent = searchParams.get('taskIntent') ?? searchParams.get('intent') ?? undefined");
    expect(portfolio).toContain('intent: reflectionTaskIntent');
    expect(portfolio).toContain('草稿候选已创建');
    expect(portfolio).toContain('本页尚未保存到学习档案');
    expect(portfolio).toContain("href: '/evaluation/prompt-assessment'");
    expect(portfolio).toContain("draftDisposition, setDraftDisposition");
    expect(portfolio).toContain("setDraftDisposition('saved-draft')");
    expect(portfolio).toContain("setDraftDisposition('discarded')");
    expect(portfolio).toContain('data-primary-task-input="portfolio-reflection-draft"');
    expect(portfolio).toContain("任务：{draft.assignment ?? 'portfolio-reflection'}");
    expect(portfolio).toContain('晋升策略：');
    expect(portfolio).toContain('· 晋升策略：');
    expect(portfolio).toContain('{draft.promotionPolicy}');
    expect(portfolio).not.toContain('>保存草稿<');
    expect(portfolio).not.toContain('确认草稿内容后保存到学习档案');
  });
});
