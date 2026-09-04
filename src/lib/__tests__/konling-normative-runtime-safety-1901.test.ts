import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import normativeStatusCases from '@/lib/konling-normative-status-cases.json';
import {
  applyKonlingNormativeSafetyDegradation,
  buildKonlingCitationGuard,
  buildKonlingTeachingAssistantRuntimeContract,
  type KonlingCitationContext,
  type KonlingRuntimeContext,
  type KonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';

vi.mock('server-only', () => ({}));

function createScope(): KonlingRuntimeScope {
  return {
    authenticatedUserId: 'student-1',
    targetUserId: 'student-1',
    role: 'student',
    classId: 'class-1',
    courseId: 'unit-4-5',
    pageId: 'step-03',
    resourceId: 'resource-1',
    pathNodeId: 'node-1',
    privacyScopes: ['student-visible'],
  };
}

function createRuntimeContext(citationContext?: KonlingCitationContext): KonlingRuntimeContext {
  return {
    pageContext: {
      courseId: 'simulation',
      courseTitle: '仿真',
      pageType: 'practice',
      stepId: 'pid-default',
      topic: 'PID 参数整定',
      learningObjectives: [],
      knowledgeType: 'X',
    },
    userProfile: {
      id: 'student-1',
      name: '张三',
      learningStyle: 'INTERACTIVE',
      cognitiveLevel: 3,
      abilityVector: {
        computational: 0.5,
        crossDomain: 0.5,
        design: 0.5,
        analysis: 0.5,
        evaluation: 0.5,
      },
    },
    learnerState: null,
    planContext: {
      currentPathId: null,
      activeNodeId: null,
      nextNodeIds: [],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'missing',
    },
    memory: [],
    citationContext: citationContext ?? {
      required: true,
      contentCitations: [],
      evidenceCitations: [],
      missingCitationClasses: ['content', 'evidence'],
      lowConfidenceReasons: ['missing-content', 'missing-evidence'],
      responseProtocol: {
        requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    },
    permittedTools: ['get_page_context', 'search_knowledge_graph'],
    missingContext: [],
    featureFlags: {
      learnerState: false,
      semanticMemory: false,
      strategyMemory: false,
    },
  } as unknown as KonlingRuntimeContext;
}

function normativeStatus(query: string): string {
  return buildKonlingTeachingAssistantRuntimeContract({
    modeId: 'generic-chat',
    runtimeContext: createRuntimeContext(),
    scope: createScope(),
    currentUserQuery: query,
  }).studyQuestion?.normativeGuidance ?? 'none';
}

function verificationRequiredGuard(query: string, answer: string, citationContext?: KonlingCitationContext) {
  const runtimeContext = createRuntimeContext(citationContext);
  const modeContract = buildKonlingTeachingAssistantRuntimeContract({
    modeId: 'generic-chat',
    runtimeContext,
    scope: createScope(),
    currentUserQuery: query,
  });
  return buildKonlingCitationGuard(
    { citationContext: runtimeContext.citationContext, teachingAssistantMode: modeContract },
    answer,
  );
}

describe('issue #1901 frozen normative status regression', () => {
  it('keeps the frozen set with standard, implicit, multi-intent, identifier, obligation, and negative phrasings', () => {
    expect(normativeStatusCases).toHaveLength(58);
    const expectedCounts: Record<string, number> = {
      standard: 10,
      implicit: 10,
      'multi-intent': 8,
      'standard-identifier': 8,
      obligation: 8,
      negative: 14,
    };
    for (const [phrasing, count] of Object.entries(expectedCounts)) {
      expect(
        normativeStatusCases.filter((item) => item.phrasing === phrasing),
        phrasing,
      ).toHaveLength(count);
    }
  });

  it('meets the normative status confusion matrix gates', () => {
    const matrix = {
      'verification-required': { 'verification-required': 0, 'not-applicable': 0 },
      'not-applicable': { 'verification-required': 0, 'not-applicable': 0 },
    };
    for (const item of normativeStatusCases) {
      matrix[item.expectedStatus as keyof typeof matrix][normativeStatus(item.query) as 'verification-required' | 'not-applicable'] += 1;
    }
    const total = normativeStatusCases.length;
    const correct = matrix['verification-required']['verification-required']
      + matrix['not-applicable']['not-applicable'];
    const recall = matrix['verification-required']['verification-required']
      / (matrix['verification-required']['verification-required'] + matrix['verification-required']['not-applicable']);
    expect(correct / total).toBeGreaterThanOrEqual(0.9);
    expect(recall).toBeGreaterThanOrEqual(0.9);
    expect(matrix['not-applicable']['verification-required']).toBe(0);
  });

  it('keeps the independent gate at parity with the classifier vocabulary for non-generic modes', () => {
    // #1948：第二条是组合信号措辞（规范/要求 × 权威文档），不含任何单命中
    // 标记，独立门禁仍须与主分类器平价，非 generic 模式不得绕过 fail-closed。
    const queries = [
      '请给出国家标准对控制实验报告封面的规范格式',
      '实验报告封面有哪些规范要求？',
    ] as const;
    for (const query of queries) {
      for (const modeId of ['resource-coach', 'generic-chat'] as const) {
        const contract = buildKonlingTeachingAssistantRuntimeContract({
          modeId,
          runtimeContext: createRuntimeContext(),
          scope: createScope(),
          currentUserQuery: query,
        });
        expect(contract.answerIntent, `${modeId}: ${query}`).toBe(modeId === 'generic-chat' ? 'normative-content' : 'fact-explanation');
        expect(contract.studyQuestion?.normativeGuidance, `${modeId}: ${query}`).toBe('verification-required');
      }
    }
  });
});

describe('issue #1901 answer-level normative safety degradation', () => {
  const unsafeAnswers: Array<{ answer: string; violations: string[] }> = [
    {
      answer: '根据 GB/T 7713 的规定，实验报告封面必须包括题目、姓名和日期。',
      violations: ['unhedged-normative-assertion', 'unverified-standard-identifier'],
    },
    {
      answer: '官方规定实验报告必须使用蓝黑墨水书写。',
      violations: ['unhedged-normative-assertion'],
    },
    {
      answer: '规范要求必须加盖学校公章，否则无效。',
      violations: ['unhedged-normative-assertion'],
    },
    {
      answer: '详见官方要求 https://example.gov.cn/report-standard，其中列出了全部必填项。',
      violations: ['authority-link'],
    },
    {
      answer: '考核办法必须包含平时成绩占比，这是行业认证要求的格式。',
      violations: ['unhedged-normative-assertion'],
    },
    {
      // Codex review finding 1: capitalized English markers must not slip
      // through the lowercase marker lists.
      answer: 'Official requirement: the report must list the standard format items.',
      violations: ['unhedged-normative-assertion'],
    },
    {
      // Codex review finding 2: CRLF separators must not drift line offsets
      // into the code range and skip the assertion after the code block.
      answer: '示例代码：\r\n```\r\nprint("report")\r\n```\r\n官方规定实验报告必须使用蓝黑墨水书写。',
      violations: ['unhedged-normative-assertion'],
    },
  ];
  const query = '实验报告封面必须写哪些项才算合格？';

  it('flags canned unsafe answers with their violation classes', () => {
    for (const { answer, violations } of unsafeAnswers) {
      const guard = verificationRequiredGuard(query, answer);
      expect(guard.normativeCompliance?.status, answer).toBe('degraded');
      expect(guard.normativeCompliance?.violations.sort(), answer).toEqual([...violations].sort());
      expect(guard.lowConfidenceReasons, answer).toContain(
        `normative-answer-degraded:${[...violations].sort().join('+')}`,
      );
    }
  });

  it('replaces unsafe answers with a template that rescans compliant (unsafe assertion rate 0)', () => {
    for (const { answer } of unsafeAnswers) {
      const guard = verificationRequiredGuard(query, answer);
      const degraded = applyKonlingNormativeSafetyDegradation(answer, guard);
      expect(degraded, answer).not.toBe(answer);
      expect(degraded).toContain('需核验');
      expect(degraded).toContain('证据缺口');
      expect(degraded).toContain('核验建议');
      const rescan = verificationRequiredGuard(query, degraded);
      expect(rescan.normativeCompliance?.status, answer).toBe('compliant');
    }
  });

  it('passes compliant verification-needed answers through unchanged', () => {
    const compliant = [
      '该问题涉及官方规范，但当前缺少可核验的权威来源，具体条款无法核验。',
      '可回答边界：一般原理层面，实验报告通常包含实验目的、步骤和数据记录，具体格式请以课程正式文本为准。',
      '核验建议：建议向任课教师确认封面要求。',
    ].join('\n');
    const guard = verificationRequiredGuard(query, compliant);
    expect(guard.normativeCompliance?.status).toBe('compliant');
    expect(applyKonlingNormativeSafetyDegradation(compliant, guard)).toBe(compliant);
  });

  it('never degrades verified or non-normative answers', () => {
    const unsafeText = '官方规定实验报告必须使用蓝黑墨水书写。';
    const verifiedContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:official:report-standard',
        sourceType: 'content',
        displayTitle: '实验报告封面规范',
        href: 'https://example.gov.cn/report-standard',
        confidence: 'high',
        evidenceBasis: 'source-pack:konling-answer:official',
        owner: 'answer',
        citationTargetId: 'official:report-standard',
        verified: true,
        resolver: 'official-reference',
      }],
      evidenceCitations: [],
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      responseProtocol: {
        requiredOwners: ['answer'],
        minimum: { content: 1, evidenceWhenAvailable: 0 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const verifiedGuard = verificationRequiredGuard(query, unsafeText, verifiedContext);
    expect(verifiedGuard.studyQuestion?.normativeGuidance).toBe('verified');
    expect(verifiedGuard.normativeCompliance ?? null).toBeNull();
    expect(applyKonlingNormativeSafetyDegradation(unsafeText, verifiedGuard)).toBe(unsafeText);

    const plainQuery = '请推导闭环传递函数';
    const plainGuard = verificationRequiredGuard(plainQuery, unsafeText);
    expect(plainGuard.studyQuestion?.normativeGuidance).toBe('not-applicable');
    expect(applyKonlingNormativeSafetyDegradation(unsafeText, plainGuard)).toBe(unsafeText);
  });

  it('does not let client-marked citations raise the gate or skip degradation', () => {
    const clientVerifiedContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:client:report-standard',
        sourceType: 'content',
        displayTitle: '客户端自报规范',
        href: 'https://example.com/report-standard',
        confidence: 'high',
        evidenceBasis: 'client-claimed',
        owner: 'answer',
        citationTargetId: 'client:report-standard',
        verified: true,
        resolver: 'user-supplied',
      }],
      evidenceCitations: [],
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      responseProtocol: {
        requiredOwners: ['answer'],
        minimum: { content: 1, evidenceWhenAvailable: 0 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const answer = '官方规定实验报告必须使用蓝黑墨水书写。';
    const guard = verificationRequiredGuard(query, answer, clientVerifiedContext);
    expect(guard.studyQuestion?.normativeGuidance).toBe('verification-required');
    expect(guard.normativeCompliance?.status).toBe('degraded');
    expect(applyKonlingNormativeSafetyDegradation(answer, guard)).toContain('需核验');
  });
});

describe('issue #1901 delivery route wiring', () => {
  it('applies the normative degradation after marker stripping in both delivery routes', () => {
    const chatRoute = readFileSync('src/app/api/ai/chat/route.ts', 'utf8');
    expect(chatRoute).toContain('applyKonlingNormativeSafetyDegradation(');
    expect(chatRoute).toContain('stripUnverifiedKonlingCitationMarkers(assistantContent, guard)');
    const messagesRoute = readFileSync('src/app/api/ai/sessions/[id]/messages/route.ts', 'utf8');
    expect(messagesRoute).toContain('applyKonlingNormativeSafetyDegradation(');
    expect(messagesRoute).toContain('normativeCompliance: citationGuard.normativeCompliance ?? null');
  });

  it('warns in the system prompt that non-compliant answers are replaced', () => {
    const promptBuilder = readFileSync('src/lib/ai-prompt-builder.ts', 'utf8');
    expect(promptBuilder).toContain('会被系统整体替换为核验提示');
  });
});
