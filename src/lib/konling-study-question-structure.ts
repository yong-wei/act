export const STUDY_QUESTION_INTENTS = [
  'formula-derivation',
  'code-debugging',
  'concept-comparison',
  'normative-content',
  'open-ended-explanation',
  'fact-explanation',
] as const;

export type StudyQuestionIntent = (typeof STUDY_QUESTION_INTENTS)[number];

export const STUDY_QUESTION_SCORING_CALIBERS = [
  'structure-alias.v1',
  'structure-strict-title.v0',
] as const;

export type StudyQuestionScoringCaliber = (typeof STUDY_QUESTION_SCORING_CALIBERS)[number];

export type StudyQuestionSection = {
  id: string;
  title: string;
  aliases: readonly string[];
  citationPolicy: 'evidence-required' | 'model-derived';
};

export const STUDY_QUESTION_SECTIONS: Record<StudyQuestionIntent, readonly StudyQuestionSection[]> = {
  'formula-derivation': [
    { id: 'assumptions', title: '前提与符号', aliases: ['假设与符号', '符号定义', '已知条件'], citationPolicy: 'evidence-required' },
    { id: 'transform', title: '关键变形', aliases: ['推导步骤', '关键步骤', '主要变形'], citationPolicy: 'model-derived' },
    { id: 'applicability', title: '适用条件', aliases: ['成立条件', '使用条件'], citationPolicy: 'evidence-required' },
    { id: 'check', title: '结果校验', aliases: ['结果检验', '核对'], citationPolicy: 'model-derived' },
  ],
  'code-debugging': [
    { id: 'locate', title: '故障定位', aliases: ['问题定位', '现象'], citationPolicy: 'model-derived' },
    { id: 'cause', title: '原因', aliases: ['可能原因', '根因'], citationPolicy: 'model-derived' },
    { id: 'fix', title: '最小修复', aliases: ['修复建议', '改法'], citationPolicy: 'evidence-required' },
    { id: 'verify', title: '验证方法', aliases: ['如何验证', '检验方法'], citationPolicy: 'model-derived' },
  ],
  'concept-comparison': [
    { id: 'dimensions', title: '判别维度', aliases: ['比较维度', '从哪几方面看'], citationPolicy: 'evidence-required' },
    { id: 'difference', title: '联系与差异', aliases: ['相同与不同', '主要差别'], citationPolicy: 'evidence-required' },
    { id: 'boundary', title: '边界或反例', aliases: ['适用边界', '反例'], citationPolicy: 'model-derived' },
  ],
  'normative-content': [
    { id: 'scope', title: '适用范围', aliases: ['适用对象', '覆盖范围'], citationPolicy: 'evidence-required' },
    { id: 'rule', title: '规范结论', aliases: ['规定结论', '规范要求'], citationPolicy: 'evidence-required' },
    { id: 'source', title: '核验来源', aliases: ['依据来源', '核验说明'], citationPolicy: 'evidence-required' },
  ],
  'open-ended-explanation': [
    { id: 'claim', title: '核心结论', aliases: ['要点', '结论'], citationPolicy: 'evidence-required' },
    { id: 'explain', title: '定制化讲解', aliases: ['展开讲解', '换一种说法'], citationPolicy: 'model-derived' },
    { id: 'limit', title: '适用边界', aliases: ['使用边界', '局限'], citationPolicy: 'evidence-required' },
  ],
  'fact-explanation': [
    { id: 'claim', title: '核心结论', aliases: ['定义', '要点'], citationPolicy: 'evidence-required' },
    { id: 'explain', title: '解释', aliases: ['含义说明', '进一步说明'], citationPolicy: 'model-derived' },
    { id: 'limit', title: '适用边界', aliases: ['使用边界', '注意'], citationPolicy: 'evidence-required' },
  ],
};

export function studyQuestionSectionTitles(intent: StudyQuestionIntent): string[] {
  return STUDY_QUESTION_SECTIONS[intent].map((section) => section.title);
}

export function isStudyQuestionIntent(value: unknown): value is StudyQuestionIntent {
  return (STUDY_QUESTION_INTENTS as readonly string[]).includes(String(value));
}

export function evidenceRequiredStudyQuestionSections(
  intent: StudyQuestionIntent,
): readonly StudyQuestionSection[] {
  return STUDY_QUESTION_SECTIONS[intent].filter((section) => section.citationPolicy === 'evidence-required');
}

export function findStudyQuestionSection(
  intent: StudyQuestionIntent,
  sectionId: string,
): StudyQuestionSection | null {
  return STUDY_QUESTION_SECTIONS[intent].find((section) => section.id === sectionId) ?? null;
}

export function detectStudyQuestionSectionHeading(
  line: string,
  intent: StudyQuestionIntent,
): StudyQuestionSection | null {
  const heading = readHeading(line, STUDY_QUESTION_SECTIONS[intent]);
  if (!heading) return null;
  return STUDY_QUESTION_SECTIONS[intent].find((section) => headingMatchesSection(heading, section)) ?? null;
}

function normalizeHeading(value: string): string {
  return value.toLowerCase().normalize('NFKC').replace(/[\s:：#*【】\[\]()（）.-]/g, '');
}

function headingMatchesSection(heading: string, section: StudyQuestionSection): boolean {
  const normalized = normalizeHeading(heading);
  if (!normalized) return false;
  return [section.title, ...section.aliases].some((label) => {
    const expected = normalizeHeading(label);
    return expected.length > 0 && (normalized === expected || normalized.startsWith(expected));
  });
}

function headingEqualsSection(heading: string, section: StudyQuestionSection): boolean {
  const normalized = normalizeHeading(heading);
  if (!normalized) return false;
  return [section.title, ...section.aliases].some((label) => normalizeHeading(label) === normalized);
}

function readHeading(line: string, sections: readonly StudyQuestionSection[]): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const markdown = trimmed.match(/^#{1,3}\s+(.+)$/);
  if (markdown) return markdown[1].trim();
  const bold = trimmed.match(/^\*\*(.+)\*\*$/);
  if (bold) return bold[1].trim();
  const numbered = trimmed.match(/^(?:\d+[\.、\)]|-)\s+(.+)$/);
  if (!numbered) return null;
  const candidate = numbered[1].trim();
  if (candidate.length > 24) return null;
  return sections.some((section) => headingEqualsSection(candidate, section)) ? candidate : null;
}

export function evaluateStudyQuestionStructure(input: {
  answer: string;
  intent: StudyQuestionIntent;
  /**
   * 评分口径（#1900）：默认语义别名口径；`structure-strict-title.v0`
   * 是旧式口径，只接受与 canonical 标题规范化后完全相等的标题行，
   * 不接受别名与前缀匹配，仅用于固定回答的评分器回放。
   */
  caliber?: StudyQuestionScoringCaliber;
}): {
  passed: boolean;
  matchedIds: string[];
  missingIds: string[];
} {
  const sections = STUDY_QUESTION_SECTIONS[input.intent];
  const strictTitle = input.caliber === 'structure-strict-title.v0';
  const sectionPresent = strictTitle
    ? (heading: string, section: StudyQuestionSection) => {
        const normalized = normalizeHeading(heading);
        return normalized.length > 0 && normalized === normalizeHeading(section.title);
      }
    : (heading: string, section: StudyQuestionSection) => headingMatchesSection(heading, section);
  const lines = input.answer.split(/\r?\n/);
  const blocks: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string } | null = null;
  for (const line of lines) {
    const heading = readHeading(line, sections);
    if (heading) {
      if (current) blocks.push(current);
      current = { heading, body: '' };
      continue;
    }
    if (current) {
      const text = line.trim();
      current.body += (current.body && text ? '\n' : '') + text;
    }
  }
  if (current) blocks.push(current);

  const matchedIds: string[] = [];
  const missingIds: string[] = [];
  for (const section of sections) {
    const hit = blocks.some((block) => sectionPresent(block.heading, section) && block.body.trim().length > 0);
    if (hit) matchedIds.push(section.id);
    else missingIds.push(section.id);
  }
  return {
    passed: missingIds.length === 0,
    matchedIds,
    missingIds,
  };
}

export function buildStudyQuestionOutputContractLines(input: {
  intent: StudyQuestionIntent;
  requiredSections: readonly string[];
  depth?: string;
  format?: string;
  hintStrength?: string;
}): string[] {
  const titles = input.requiredSections.join('、');
  return [
    `  - 输出合同: 按「${titles}」分章作答，每章使用 Markdown 二级标题或加粗标题；允许语义等价标题，禁止用无章节的长段落代替。`,
    '  - 输出合同优先于一般字数上限。',
    `  - 表达偏好只改变各章写法（深度=${input.depth ?? 'standard'}，格式=${input.format ?? 'default'}，引导=${input.hintStrength ?? 'full-answer'}），不得省略任一章。`,
  ];
}
