/**
 * 控灵品牌常量定义
 *
 * 统一AI助手"控灵"的品牌形象
 */

export type KonlingAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export const KONLING_BRAND = {
  name: '控灵',
  subtitle: 'AI-OBE 智能学习伴侣',
  description: '你的智能学习伙伴，随时解答疑惑',

  avatar: {
    sm: '/images/AI32.png',
    md: '/images/AI64.png',
    lg: '/images/AI128.png',
    xl: '/images/AI1024.png',
  },

  colors: {
    primary: 'amber-500',
    primaryDark: 'amber-600',
    secondary: 'orange-500',
    accent: 'amber-400',
  },

  theme: {
    dark: {
      container: 'bg-slate-900 border-slate-700 text-slate-100',
      header: 'bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-b border-slate-700',
      messageUser: 'bg-amber-600 text-white',
      messageAssistant: 'bg-slate-800 text-slate-200',
      input: 'bg-slate-800 border-slate-700 text-white placeholder-slate-500',
      button: 'bg-amber-600 hover:bg-amber-700',
    },
    light: {
      container: 'bg-white border-slate-200 text-slate-900',
      header: 'bg-gradient-to-r from-amber-100 to-orange-100 border-b border-slate-200',
      messageUser: 'bg-amber-500 text-white',
      messageAssistant: 'bg-slate-100 text-slate-800',
      input: 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
      button: 'bg-amber-500 hover:bg-amber-600',
    },
  },

  welcomeMessages: {
    default: '你好，我是控灵，你的AI学习伴侣。有什么我可以帮助你的吗？',
    theory: (topic: string) => `你好，我是控灵。今天我们将探索「${topic}」，有任何问题随时问我。`,
    practice: (task: string) => `你好，我是控灵。让我协助你完成「${task}」，遇到困难可以向我求助。`,
    quiz: '你好，我是控灵。测试是检验学习成果的好机会，需要提示的话可以问我。',
    reflection: '你好，我是控灵。反思是深度学习的关键，让我们一起回顾今天的收获。',
  },

  quickQuestions: {
    simulation: [
      { label: '仿真状态', question: '请获取当前的仿真状态' },
      { label: 'PID原理', question: '请解释PID控制器的工作原理' },
      { label: '诺莫托模型', question: '什么是诺莫托船舶模型？' },
      { label: '调参建议', question: '如何调整PID参数？' },
    ],
  },
} as const;

/**
 * 获取头像URL
 */
export function getKonlingAvatar(size: KonlingAvatarSize = 'md'): string {
  return KONLING_BRAND.avatar[size];
}

/**
 * 获取欢迎语
 */
export function getWelcomeMessage(pageType: string, topic?: string): string {
  const { welcomeMessages } = KONLING_BRAND;

  switch (pageType) {
    case 'theory':
      return welcomeMessages.theory(topic || '本节内容');
    case 'practice':
      return welcomeMessages.practice(topic || '实践任务');
    case 'quiz':
      return welcomeMessages.quiz;
    case 'reflection':
      return welcomeMessages.reflection;
    default:
      return welcomeMessages.default;
  }
}

/**
 * 获取快捷问题
 */
export function getQuickQuestions(courseId?: string): Array<{ label: string; question: string }> {
  return [...KONLING_BRAND.quickQuestions.simulation];
}
