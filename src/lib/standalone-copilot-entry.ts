import type { EvidenceCopilotNextAction, EvidenceCopilotStatus } from '@/lib/evidence-copilot-context';

export type StandaloneCopilotEntryKind =
  | 'neutral'
  | 'portfolio-reflection'
  | 'evidence-available'
  | 'evidence-missing'
  | 'evidence-unavailable';

export interface StandaloneCopilotSuggestion {
  label: string;
  question: string;
}

export interface StandaloneCopilotAdjacentAction {
  href: string;
  label: string;
}

export interface StandaloneCopilotEntryPresentation {
  kind: StandaloneCopilotEntryKind;
  description: string;
  capabilities: string[];
  suggestions: StandaloneCopilotSuggestion[];
  placeholder: string;
  inputAriaLabel: string;
  limitations: string[];
  adjacentActions: StandaloneCopilotAdjacentAction[];
}

const NEUTRAL_LIMITATION = '当前没有绑定具体课程步骤、仿真状态或个人证据。';

export function resolveStandaloneCopilotEntryKind(input: {
  context: string | null | undefined;
  evidenceStatus?: EvidenceCopilotStatus | null;
  evidenceUnavailable?: boolean;
}): StandaloneCopilotEntryKind {
  if (input.context !== 'portfolio-reflection' && input.context !== 'evidence') return 'neutral';
  if (input.context === 'portfolio-reflection') return 'portfolio-reflection';
  if (input.evidenceUnavailable || input.evidenceStatus === 'unavailable') return 'evidence-unavailable';
  if (input.evidenceStatus === 'missing') return 'evidence-missing';
  return 'evidence-available';
}

export function buildStandaloneCopilotEntryPresentation(input: {
  context: string | null | undefined;
  evidenceStatus?: EvidenceCopilotStatus | null;
  evidenceUnavailable?: boolean;
  evidenceLimitations?: string[];
  evidenceNextAction?: EvidenceCopilotNextAction | null;
  portfolioHref?: string;
}): StandaloneCopilotEntryPresentation {
  const kind = resolveStandaloneCopilotEntryKind(input);
  if (kind === 'portfolio-reflection') {
    return {
      kind,
      description: '当前任务是整理作品集反思候选。建议问题只帮助生成草稿，不会自动保存为正式学习记录。',
      capabilities: ['整理本次协作目标和输出对象', '列出仍需验证的疑问', '写成可显式保存的反思候选'],
      suggestions: [
        {
          label: '整理目标',
          question: '请把本次 AI 协作的任务目标和输出对象整理成反思草稿。',
        },
        {
          label: '保留疑问',
          question: '请列出本次 AI 建议中仍需要我验证的疑问。',
        },
        { label: '下一步', question: '请把下一步验证行动写成作品集反思候选。' },
      ],
      placeholder: '请输入您的问题，例如：请整理本次反思草稿',
      inputAriaLabel: '请输入您的问题，例如：请整理本次反思草稿',
      limitations: ['反思内容仍是候选草稿，需要你在作品集中显式保存。'],
      adjacentActions: [
        {
          href: input.portfolioHref ?? '/profile/portfolio?category=reflection&intent=create',
          label: '打开作品集候选预览',
        },
      ],
    };
  }

  if (kind === 'evidence-missing' || kind === 'evidence-unavailable') {
    const nextAction = input.evidenceNextAction ?? {
      href: '/assessment/adaptive-practice?intent=practice',
      label: '去做一次自适应练习，补充学习证据',
    };
    const limitations = input.evidenceLimitations?.length
      ? input.evidenceLimitations
      : [kind === 'evidence-missing' ? '当前暂无学习证据。' : '学习证据当前不可用。'];
    return {
      kind,
      description: kind === 'evidence-missing'
        ? '当前没有可核验的学习证据。请先补充一次真实学习，再回来讨论证据。'
        : '学习证据当前不可用。页面不会伪造证据或个性化诊断。',
      capabilities: ['说明证据限制', '给出真实可执行的下一步', '不把缺失证据写成已掌握'],
      suggestions: [
        {
          label: '证据限制',
          question: '请先说明当前没有可用学习证据，再给出一个真实可执行的下一步。',
        },
        {
          label: '去练习',
          question: '请根据当前证据限制，建议我去做一次自适应练习来补充证据。',
        },
      ],
      placeholder: '请输入您的问题，例如：当前没有证据时我下一步做什么',
      inputAriaLabel: '请输入您的问题，例如：当前没有证据时我下一步做什么',
      limitations,
      adjacentActions: [nextAction],
    };
  }

  if (kind === 'evidence-available') {
    const nextAction = input.evidenceNextAction ?? {
      href: '/profile/evidence',
      label: '查看学习记录并复核证据',
    };
    return {
      kind,
      description: '当前任务只使用服务端核对过的学习证据。建议仅作参考，不会写入成绩或学习画像。',
      capabilities: ['说明证据来源和限制', '指出一个需要补强的薄弱点', '给出候选练习计划'],
      suggestions: [
        {
          label: '证据来源',
          question: '请先说明当前证据来源，再给出下一步练习建议。',
        },
        {
          label: '薄弱点',
          question: '请根据当前证据摘要指出一个最需要补强的薄弱点。',
        },
        {
          label: '练习计划',
          question: '请把补强建议转成一个候选练习计划，不要写入档案。',
        },
      ],
      placeholder: '请输入您的问题，例如：请根据当前证据给出下一步练习建议',
      inputAriaLabel: '请输入您的问题，例如：请根据当前证据给出下一步练习建议',
      limitations: input.evidenceLimitations ?? ['已加载服务端核对的学习证据，建议仅作参考。'],
      adjacentActions: [nextAction],
    };
  }

  return {
    kind: 'neutral',
    description: '我可以帮你解释自动控制概念、整理当前疑问，并规划下一步学习。当前没有绑定具体课程步骤、仿真状态或个人证据。',
    capabilities: ['解释自动控制概念', '整理当前学习疑问', '规划下一步真实学习入口'],
    suggestions: [
      {
        label: '解释概念',
        question: '请用自动控制原理的语言解释一个基础概念，并标出我还需要补的前置知识。',
      },
      {
        label: '整理疑问',
        question: '请帮我把当前学习疑问整理成可以继续查证的问题清单。',
      },
      {
        label: '选择入口',
        question: '我接下来应该从课程、练习还是作品集开始？请只根据通用学习陪伴给出入口建议，不要假设我正在做仿真。',
      },
    ],
    placeholder: '请输入您的问题，例如：帮我解释一个控制概念',
    inputAriaLabel: '请输入您的问题，例如：帮我解释一个控制概念',
    limitations: [NEUTRAL_LIMITATION],
    adjacentActions: [
      { href: '/interactive-learning', label: '进入互动课' },
      { href: '/assessment/adaptive-practice?intent=practice', label: '去做一次练习' },
      { href: '/knowledge', label: '打开知识图谱' },
    ],
  };
}
