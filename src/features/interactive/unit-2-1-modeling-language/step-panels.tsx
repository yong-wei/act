'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { BlockMath } from 'react-katex';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  getUNIT_2_1PageContract,
  UNIT_2_1_COURSE_TITLE,
  UNIT_2_1_LESSON_STEPS,
  UNIT_2_1_STAGE_LABEL,
  type UNIT_2_1PageType,
  type UNIT_2_1StepDefinition,
  type UNIT_2_1StepResponse,
} from '@/lib/unit-2-1-course';
import type { WorkspaceParameterChange } from './workspace';

type Tone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

interface StepSection {
  title: string;
  body?: string;
  bullets?: string[];
  tone?: Tone;
}

interface ChoiceOption {
  value: string;
  label: string;
}

interface QuizQuestion {
  key: string;
  prompt: string;
  options: ChoiceOption[];
  answer: string;
  explanation: string;
}

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'radio' | 'checkbox';
  placeholder?: string;
  answer?: string | string[];
  options?: ChoiceOption[];
}

interface DragMatchSlot {
  id: string;
  label: string;
  expectedCardIds: string[];
}

interface DragMatchCard {
  id: string;
  label: string;
  tone?: Tone;
}

interface HotspotTarget {
  id: string;
  label: string;
  left: string;
  top: string;
  expected?: boolean;
  description?: string;
}

interface BucketSortBucket {
  id: string;
  label: string;
}

interface BucketSortCard {
  id: string;
  label: string;
  bucketId: string;
}

interface ActivitySpec {
  kind: UNIT_2_1PageType | 'none';
  helper: string;
  submitLabel?: string;
  releaseLabel?: string;
  questions?: QuizQuestion[];
  fields?: FormField[];
  dragSlots?: DragMatchSlot[];
  dragCards?: DragMatchCard[];
  hotspotTargets?: HotspotTarget[];
  bucketBuckets?: BucketSortBucket[];
  bucketCards?: BucketSortCard[];
  highlightTargets?: HotspotTarget[];
  successMessage?: string;
  failureMessage?: string;
}

interface StepBlueprint {
  kicker: string;
  intro: string;
  sections: StepSection[];
  formulas?: string[];
  tables?: Array<{
    title: string;
    headers: string[];
    rows: string[][];
  }>;
  conclusions?: string[];
  note?: string;
  prompts?: string[];
}

export interface UNIT_2_1TeacherResponseItem {
  studentName: string;
  response: UNIT_2_1StepResponse;
}

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function getStepBlueprint(step: UNIT_2_1StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Roadmap',
        intro: '模块 1 让我们先看到系统会快、会慢、会振、会稳；2-1 开始把这些现象翻译成后续可反复调用的对象语言。今天的任务不是继续“看现象”，而是把对象真正写出来、连起来、收束起来。',
        sections: [
          {
            title: '本课要建立的四段主线',
            tone: 'cyan',
            bullets: ['对象建立：从微分方程进入拉氏域', '对象识别：用传递函数与典型环节看清对象由什么组成', '结构表达：用结构图和信号流图说明对象如何连接', '总体对象：把复杂系统收束成后续可分析的闭环对象'],
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Engineering Scenario',
        intro: '给定船舶航向动力学方程，只能看到“物理来源”，却还看不清对象由哪些标准部件构成、如何和控制器接成系统，也看不清反馈之后的总体对象怎样写。',
        formulas: [String.raw`J\ddot{\theta}(t)+B\dot{\theta}(t)=Ku(t)`],
        sections: [
          {
            title: '为什么单有微分方程还不够',
            tone: 'amber',
            bullets: ['不便于和控制器、传感器、反馈结构直接连接', '不便于复用同一对象去做时域、频域和结构分析', '更不便于把复杂系统收束成统一总体对象'],
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Object Chain',
        intro: '今天的主线不是若干工具并列，而是一条严格的对象建立链。每一步都在回答一个更精确的问题：对象怎么来、怎样认、怎样连、怎样收束。',
        conclusions: ['微分方程 -> 拉氏变换 -> 传递函数 -> 典型环节 -> 结构表达 -> 总体对象'],
        sections: [
          {
            title: '六段对象链',
            tone: 'emerald',
            bullets: ['微分方程：从真实系统出发', '拉氏变换：把微分关系切换到代数表达', '传递函数：把系统对象和具体输入分离', '典型环节：先认对象由什么组成', '结构表达：说明对象如何连接', '总体对象：为 2-2 之后的响应分析准备入口'],
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Pre-Assessment',
        intro: '前测不要求复杂计算，只要求你先把最容易混淆的三件事分开：对象定义、初始状态和结构表达。',
        sections: [
          {
            title: '本页重点',
            tone: 'amber',
            bullets: ['零初值不是可省略修饰词', '遇到复杂分式时，第一步通常应先识别对象而不是立刻盲算', '信号流图不是方框图的另一个名字'],
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Laplace Motivation',
        intro: '控制课程里强调拉氏变换，不是为了训练积分技巧，而是为了把“含导数的微分关系”统一改写成“关于 s 的代数关系”，让对象可以被比较、组合和复用。',
        formulas: [
          String.raw`F(s)=\mathcal{L}\{f(t)\}`,
          String.raw`\mathcal{L}\{\dot f(t)\}=sF(s)`,
          String.raw`\mathcal{L}\{\ddot f(t)\}=s^2F(s)`,
        ],
        tables: [
          {
            title: '时域微分方程语言与变换域对象语言的区别',
            headers: ['语言视角', '时域微分方程语言', '变换域对象语言'],
            rows: [
              ['描述重点', '直接描述微分关系与初值演化', '把系统写成关于 s 的统一代数对象'],
              ['后续用途', '更接近物理来源，但不便于结构连接', '便于对象识别、连接、收束与复用'],
            ],
          },
          {
            title: '本课最少要记住的拉氏对应关系',
            headers: ['时域表达', '变换域表达', '本课只抓的意义'],
            rows: [
              ['1(t)', '1/s', '常值输入在变换域里也能被统一表示'],
              [String.raw`\dot f(t)`, String.raw`sF(s)-f(0^-)`, '微分关系被改写为代数项'],
              [String.raw`\ddot f(t)`, String.raw`s^2F(s)-sf(0^-)-\dot f(0^-)`, '二阶动态也能继续按同一语言组织'],
              [String.raw`\int_0^t f(\tau)\,d\tau`, String.raw`F(s)/s`, '积分关系也能并入统一对象表达'],
            ],
          },
        ],
        sections: [
          {
            title: '工程意义',
            tone: 'violet',
            bullets: ['微分运算被代数乘法取代，系统对象更容易统一表达', '输入与输出能在同一域内比较和整理', '复杂连接关系之后也能继续围绕同一对象语言推进'],
          },
        ],
        note: '本页只讲动机，不讲积分技巧。',
      };
    case 'step-06':
      return {
        kicker: 'Transfer Function',
        intro: '零初值下，拉氏变换把系统对象与具体输入分开，于是传递函数不再只是“原方程换个写法”，而是后续反复复用的统一分析对象。',
        formulas: [String.raw`G(s)=\frac{Y(s)}{U(s)}\bigg|_{\text{零初值}}`],
        sections: [
          {
            title: '这一步真正完成了什么',
            tone: 'cyan',
            bullets: ['系统对象被从具体输入中抽离出来', '后续时域、频域和结构分析都能继续围绕它展开', '同一对象可以被放到不同连接结构中反复使用'],
          },
          {
            title: '关键提醒',
            bullets: ['传递函数定义里必须带零初值条件', '对象项和历史状态项不能混成一件事'],
          },
        ],
      };
    case 'step-07':
      return {
        kicker: 'Initial Condition',
        intro: '非零初值会额外带出和初始状态有关的项。它们确实会影响输出，但不属于“对象本身”，因此不能混进传递函数定义里。',
        formulas: [String.raw`Y(s)=G(s)U(s)`, String.raw`Y(s)=G(s)U(s)+\text{初值项}`],
        sections: [
          {
            title: '这一页只抓两件事',
            tone: 'rose',
            bullets: ['为什么会出现初值项', '为什么对象项和初值项不能混为同一件事'],
          },
          {
            title: '推荐动作链',
            bullets: ['先自己写一句判断', '再用页内 AI 核对推理链', '最后回头检查自己有没有把“对象”和“状态”分开'],
          },
        ],
        prompts: [
          '请只围绕“对象项”和“初值项”的区别回答：为什么一阶系统在非零初值下会额外出现与初始状态有关的项？这些项为什么不能混进传递函数定义？',
          '请不要重做整道推导，只用一条公式和两三句解释，帮助我核对自己对“零初值传递函数”的理解是否正确。',
        ],
      };
    case 'step-08':
      return {
        kicker: 'Typical Elements',
        intro: '典型环节对象库的价值，不在于背名字，而在于形成第一眼对象识别能力。看到传递函数后，先把它拆成标准部件，再决定后续怎么算、怎么连。',
        tables: [
          {
            title: '五类典型环节及其第一判断',
            headers: ['典型环节', '传递函数形式', '你应先抓住的物理或工程含义', '第一眼判断'],
            rows: [
              ['比例环节', 'G(s)=K', '只有比例放大或缩小，不引入动态记忆', '改变强弱，不改变动态阶次'],
              ['积分环节', String.raw`G(s)=\dfrac{1}{s}`, '输出是输入随时间的累积', '引入“记忆”，常使系统更容易慢慢积累'],
              ['微分环节', 'G(s)=s', '输出更敏感于输入变化率', '强调变化趋势，对快变化敏感'],
              ['一阶惯性环节', String.raw`G(s)=\dfrac{1}{Ts+1}`, '存在滞后，响应不会立刻到位', '不振荡，主要体现快慢差异'],
              ['振荡环节', String.raw`G(s)=\dfrac{\omega_n^2}{s^2+2\zeta\omega_n s+\omega_n^2}`, '同时包含快慢与振荡特征', '可能超调、振荡、再稳定'],
            ],
          },
        ],
        sections: [
          {
            title: '先认对象，再做运算',
            tone: 'emerald',
            bullets: ['比例环节：先看比例放大关系', '积分环节：先意识到累积效应', '微分环节：先看到变化趋势放大', '惯性环节：先想到“有快慢但不振荡”的一阶对象', '振荡环节：先联想到二阶动态品质'],
          },
        ],
      };
    case 'step-09':
      return {
        kicker: 'Connection Rules',
        intro: '再复杂的结构图，最终都要回到串联、并联、反馈这三类基本连接。今天只把这三类规则立住，不进入复杂化简技巧。',
        formulas: ['G(s)=G_1(s)G_2(s)', 'G(s)=G_1(s)+G_2(s)', String.raw`\frac{Y(s)}{R(s)}=\frac{G(s)}{1+G(s)H(s)}`],
        sections: [
          {
            title: '三类基本连接',
            tone: 'cyan',
            bullets: ['串联：前一级输出就是后一级输入，等效传函相乘', '并联：多个支路共享同一输入，总输出在比较点相加', '反馈：输出回到输入端形成闭环，控制系统由此真正建立'],
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Ship Heading Loop',
        intro: '抽象规则只有放回工程系统里才会真正站稳。船舶航向控制图把控制器、舵机、船体和传感器放进同一条闭环链，让你看到对象如何连成系统。',
        sections: [
          {
            title: '工程角色分工',
            tone: 'amber',
            bullets: ['控制器：根据偏差生成指令', '舵机：把指令变成实际舵角', '船体：把舵角转成航向变化', '传感器：把实际航向反馈回来修正输入'],
          },
          {
            title: '本页必须看清的反馈信号',
            tone: 'cyan',
            bullets: ['被反馈回来修正输入的是“实际航向反馈信号”', '传感器把实际航向送回比较点，闭环正是在这里真正闭上'],
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Signal Flow Graph',
        intro: '当结构越来越复杂时，继续在结构图上搬比较点、搬引出点会越来越绕。信号流图把视角切到“节点与路径”，更适合看前向通路、回路和接触关系。',
        sections: [
          {
            title: '两种图形语言各自负责什么',
            tone: 'slate',
            bullets: ['方框图：更适合看模块组成和连接关系', '信号流图：更适合看信号节点、路径和回路', '复杂结构下，后者更容易直接进入梅森公式'],
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Mason Basics',
        intro: '本课只讲梅森公式的最小使用集。目标不是公式炫技，而是理解它在回答什么问题：复杂结构怎样不靠层层等效变换，直接写出总体对象。',
        formulas: [
          String.raw`\frac{Y(s)}{R(s)}=\frac{\sum P_k\Delta_k}{\Delta}`,
          String.raw`\frac{Y(s)}{R(s)}=\frac{\sum_{k=1}^{N} P_k \Delta_k}{\Delta}`,
        ],
        sections: [
          {
            title: '四个关键词',
            tone: 'violet',
            bullets: ['前向通路：从输入到输出的前进路径', '回路：从某点出发又回到原点的闭合路径', '互不接触回路：彼此不共享节点的回路组', '余子式：对某条前向通路而言，与它不接触的回路影响'],
          },
        ],
        note: '重点不是背公式，而是读懂路径、回路和接触关系。',
      };
    case 'step-13':
      return {
        kicker: 'Worked Example',
        intro: '例题一用最标准的单回路闭环对象，把对象识别、前向通路、反馈通道和信号流图验证放在同一条链上，帮助你看到“闭环对象”才是后续真正要分析的对象。',
        formulas: [
          String.raw`\displaystyle G(s)=\frac{K_cK_p}{s(T_as+1)(T_ps+1)}`,
          String.raw`\displaystyle \Phi(s)=\frac{Y(s)}{R(s)}=\frac{K_cK_p}{s(T_as+1)(T_ps+1)+K_cK_pK_h}`,
        ],
        sections: [
          {
            title: '解题组织顺序',
            tone: 'cyan',
            bullets: ['先认清前向通道与反馈通道', '再写出闭环对象关系', '最后用信号流图复核路径与回路识别'],
          },
          {
            title: '本页结论',
            tone: 'amber',
            bullets: ['前向通道负责把输入一路送到输出', '反馈通道改变了分母，因此真正进入后续分析的是闭环对象'],
          },
        ],
        conclusions: ['例题一最终真正要分析的是闭环对象，而不是局部模块。'],
      };
    case 'step-14':
      return {
        kicker: 'Delta-k Distinction',
        intro: '余子式不一定等于 1。真正要判断的是：某条前向通路是否接触所有相关回路。它和“回路之间是否互不接触”属于两个不同层次。',
        formulas: [
          String.raw`P_1=\frac{K_cK_p}{s(T_as+1)(T_ps+1)}`,
          String.raw`L_1=-\frac{K_cK_pK_h}{s(T_as+1)(T_ps+1)}`,
          String.raw`\Delta=1-L_1`,
          String.raw`\Delta_1=1`,
        ],
        sections: [
          {
            title: '例题一本体',
            tone: 'rose',
            bullets: ['在这道单回路例题里，先算的是全图特征式 \\Delta=1-L_1', '对应这条前向通路的余子式是 \\Delta_1=1，不要和附录补充情形混写'],
          },
          {
            title: '附录补充情形',
            tone: 'amber',
            bullets: ['只有当存在“不接触该前向通路”的局部回路时，才会出现 \\Delta_k=1-L_1', '这解释的是多前向通路补充情形，不是把例题一的 \\Delta_1=1 推翻'],
          },
          {
            title: '本页只辨析一个误区',
            tone: 'cyan',
            bullets: ['互不接触回路：看回路和回路之间', '对应前向通路的余子式：看回路是否接触这条前向通路', '只有后者，才能决定某条 Delta_k 是否保留下来'],
          },
        ],
        conclusions: ['附录补充情形下，只有存在不接触该前向通路的局部回路时，才会出现 \\Delta_k=1-L_1。'],
      };
    case 'step-15':
      return {
        kicker: 'Post-Assessment',
        intro: '后测不只检查术语记忆，而是检查你能否用对象语言完整复述本课的主线，并能分清零初值、结构表达与余子式判断。',
        sections: [
          {
            title: '后测关注点',
            tone: 'amber',
            bullets: ['传递函数为什么要和零初值一起理解', '看到分式时第一步应先做什么', '什么时候余子式不等于 1'],
          },
        ],
      };
    case 'step-16':
      return {
        kicker: 'Wrap-Up',
        intro: '这一课真正建立的是对象语言：对象建立、对象识别、结构表达、总体对象。下一课 2-2 不再问“对象怎么来”，而会继续问“对象在时间里怎么动”。',
        conclusions: ['对象建立 -> 对象识别 -> 结构表达 -> 总体对象'],
        sections: [
          {
            title: '从 2-1 走向 2-2',
            tone: 'emerald',
            bullets: ['今天把对象立住', '下一课在这些对象上研究单位阶跃响应与动态指标', '模块 2 的“对象建立链”从这里正式开始运行'],
          },
        ],
      };
    default:
      return {
        kicker: 'Interactive Lesson',
        intro: step.hint,
        sections: [],
      };
  }
}

function getStepActivity(step: UNIT_2_1StepDefinition): ActivitySpec {
  switch (step.id) {
    case 'step-02':
      return {
        kind: 'binary_choice',
        helper: '先完成一次二选一判断，确认自己把“微分方程”和“统一对象语言”区分开。',
        submitLabel: '提交判断',
        releaseLabel: '释放判断',
        questions: [
          {
            key: 'motivation',
            prompt: '只要有微分方程，后续所有分析都能直接完成吗？',
            options: [
              { value: 'A', label: '能，微分方程本身就足够了' },
              { value: 'B', label: '不能，还需要翻译成统一对象语言' },
            ],
            answer: 'B',
            explanation: '微分方程是起点，但后续的连接、反馈、时域和频域分析都需要依赖统一对象语言继续推进。',
          },
        ],
      };
    case 'step-04':
      return {
        kind: 'quiz_group',
        helper: '三道轻量前测，用来暴露对象定义、初值条件和结构表达的常见混淆。',
        submitLabel: '提交前测',
        releaseLabel: '释放前测',
        questions: [
          {
            key: 'zeroInitial',
            prompt: '传递函数里的“零初值”在概念上能不能省略？',
            options: [
              { value: 'A', label: '能，默认所有题都这样理解' },
              { value: 'B', label: '不能，它决定对象项和初值项是否被区分开' },
            ],
            answer: 'B',
            explanation: '零初值不是可有可无的背景条件，而是传递函数成立的定义边界。',
          },
          {
            key: 'firstAction',
            prompt: '看到一个复杂分式时，第一步更应该先做什么？',
            options: [
              { value: 'A', label: '先识别典型环节和对象组成' },
              { value: 'B', label: '立刻把它整体化成一个最简分式' },
            ],
            answer: 'A',
            explanation: '对象识别优先，后续你才知道应该怎么连、怎么收束、怎么解释。',
          },
          {
            key: 'graphDifference',
            prompt: '信号流图是不是方框图的另一种叫法？',
            options: [
              { value: 'A', label: '是，只是画法不同' },
              { value: 'B', label: '不是，它强调节点、路径和回路视角' },
            ],
            answer: 'B',
            explanation: '两种图形语言关注的层面不同，不能混为一谈。',
          },
        ],
      };
    case 'step-05':
      return {
        kind: 'short_response',
        helper: '请用自己的语言完成一句话填空，确认你理解的不是纯数学技巧，而是工程上的语言切换。',
        submitLabel: '提交动机概括',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'from',
            label: '拉氏变换把什么改写成什么？（前半句）',
            type: 'text',
            placeholder: '例如：时域微分关系',
            answer: '时域微分关系',
          },
          {
            key: 'to',
            label: '拉氏变换把什么改写成什么？（后半句）',
            type: 'text',
            placeholder: '例如：关于 s 的代数关系',
            answer: '关于 s 的代数关系',
          },
          {
            key: 'meaning',
            label: '用一句话说明这对控制课程的核心价值',
            type: 'textarea',
            placeholder: '提示：为什么这会让对象更容易统一表达和复用？',
          },
        ],
      };
    case 'step-06':
      return {
        kind: 'multi_check',
        helper: '勾选区只检查本页最关键的对象边界，再用一句短答补全理由。',
        submitLabel: '提交勾选',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'definitionChecklist',
            label: '勾选传递函数定义必须同时满足的条件',
            type: 'checkbox',
            answer: ['separate-object', 'zero-initial', 'reusable'],
            options: [
              { value: 'separate-object', label: '系统对象与具体输入被分离出来' },
              { value: 'zero-initial', label: '零初值条件被明确保留' },
              { value: 'reusable', label: '同一对象可以进入后续连接与复用' },
              { value: 'integral-skill', label: '核心价值是积分技巧更熟练' },
            ],
          },
          {
            key: 'whyReusable',
            label: '用一句话说明：为什么传递函数不只是“原方程换个写法”？',
            type: 'textarea',
            placeholder: '提示：从后续可复用性解释',
          },
        ],
      };
    case 'step-07':
      return {
        kind: 'reflection_form',
        helper: '先写自己的判断，再打开 AI 对照。请特别注意“对象项”和“初值项”的边界。',
        submitLabel: '提交对照记录',
        releaseLabel: '释放 AI 对照',
        fields: [
          {
            key: 'personalJudgment',
            label: '先用自己的话解释：为什么会多出初值项？',
            type: 'textarea',
            placeholder: '提示：非零初值下的导数拉氏变换会留下什么？',
          },
          {
            key: 'objectVsState',
            label: '为什么对象项与初值项不能混成同一件事？',
            type: 'textarea',
            placeholder: '提示：系统对象和历史状态分别描述什么？',
          },
          {
            key: 'afterAi',
            label: 'AI 对照后，你修正了哪一点理解？',
            type: 'textarea',
            placeholder: '写下你与 AI 对照后的修正或确认',
          },
        ],
      };
    case 'step-08':
      return {
        kind: 'drag_match',
        helper: '拖拽三类卡片到五个对象槽位中；提交后只反馈错位数量，不直接公布完整答案。',
        submitLabel: '提交对象识别',
        releaseLabel: '释放配对',
        dragSlots: [
          { id: 'proportion-slot', label: '比例对象槽位', expectedCardIds: ['formula-proportion', 'name-proportion', 'meaning-proportion'] },
          { id: 'integral-slot', label: '积分对象槽位', expectedCardIds: ['formula-integral', 'name-integral', 'meaning-integral'] },
          { id: 'derivative-slot', label: '微分对象槽位', expectedCardIds: ['formula-derivative', 'name-derivative', 'meaning-derivative'] },
          { id: 'inertia-slot', label: '惯性对象槽位', expectedCardIds: ['formula-inertia', 'name-inertia', 'meaning-inertia'] },
          { id: 'oscillation-slot', label: '振荡对象槽位', expectedCardIds: ['formula-oscillation', 'name-oscillation', 'meaning-oscillation'] },
        ],
        dragCards: [
          { id: 'formula-proportion', label: 'G(s)=K', tone: 'cyan' },
          { id: 'formula-integral', label: 'G(s)=1/s', tone: 'cyan' },
          { id: 'formula-derivative', label: 'G(s)=s', tone: 'cyan' },
          { id: 'formula-inertia', label: 'G(s)=1/(Ts+1)', tone: 'cyan' },
          { id: 'formula-oscillation', label: 'G(s)=ω_n^2/(s^2+2ζω_ns+ω_n^2)', tone: 'cyan' },
          { id: 'name-proportion', label: '比例环节', tone: 'emerald' },
          { id: 'name-integral', label: '积分环节', tone: 'emerald' },
          { id: 'name-derivative', label: '微分环节', tone: 'emerald' },
          { id: 'name-inertia', label: '惯性环节', tone: 'emerald' },
          { id: 'name-oscillation', label: '振荡环节', tone: 'emerald' },
          { id: 'meaning-proportion', label: '改变强弱，不改变动态阶次', tone: 'amber' },
          { id: 'meaning-integral', label: '引入记忆，常使系统慢慢积累', tone: 'amber' },
          { id: 'meaning-derivative', label: '强调变化趋势，对快变化敏感', tone: 'amber' },
          { id: 'meaning-inertia', label: '不振荡，主要体现快慢差异', tone: 'amber' },
          { id: 'meaning-oscillation', label: '可能超调、振荡、再稳定', tone: 'amber' },
          { id: 'distractor-combo', label: 'G(s)=1/(s(Ts+1))', tone: 'rose' },
          { id: 'distractor-sum', label: '先直接算总式', tone: 'rose' },
          { id: 'distractor-steady', label: '所有对象都先看稳态误差', tone: 'rose' },
        ],
        successMessage: '所有槽位都已正确配对。',
        failureMessage: '还有错位槽位，先回到上方对象总表核对。',
      };
    case 'step-09':
      return {
        kind: 'rule_judge',
        helper: '三类规则先立住，不做复杂技巧。请用最少的话把每类规则说清。',
        submitLabel: '提交连接判断',
        releaseLabel: '释放判断',
        fields: [
          {
            key: 'seriesRule',
            label: '串联连接的等效传递函数规则是？',
            type: 'radio',
            options: [
              { value: 'mul', label: '相乘' },
              { value: 'add', label: '相加' },
            ],
            answer: 'mul',
          },
          {
            key: 'parallelRule',
            label: '并联连接的总输出在比较点应如何处理？',
            type: 'radio',
            options: [
              { value: 'sum', label: '按正负号相加' },
              { value: 'mul', label: '相乘' },
            ],
            answer: 'sum',
          },
          {
            key: 'feedbackMeaning',
            label: '为什么反馈是把对象真正变成控制系统的关键步骤？',
            type: 'textarea',
            placeholder: '提示：从输出如何回到输入端解释',
          },
        ],
      };
    case 'step-10':
      return {
        kind: 'hotspot_labeling',
        helper: '先在结构图上点出反馈信号回送位置，再补一句传感器在闭环中的作用。',
        submitLabel: '提交工程识别',
        releaseLabel: '释放工程任务',
        hotspotTargets: [
          { id: 'controller', label: '控制器', left: '15%', top: '45%' },
          { id: 'rudder', label: '舵机', left: '38%', top: '45%' },
          { id: 'ship-body', label: '船体', left: '62%', top: '45%' },
          { id: 'sensor-feedback', label: '反馈信号回送位置', left: '78%', top: '26%', expected: true, description: '传感器把实际航向送回比较点，闭环在这里真正闭上。' },
        ],
        fields: [
          {
            key: 'sensorRole',
            label: '用一句话写出传感器在这张结构图里的闭环作用',
            type: 'textarea',
            placeholder: '提示：它怎样把闭环真正闭上？',
          },
        ],
      };
    case 'step-12':
      return {
        kind: 'drag_match',
        helper: '把术语卡拖到对应定义槽位；本页只处理四个最小术语，不进入复杂计算。',
        submitLabel: '提交术语配对',
        releaseLabel: '释放配对',
        dragSlots: [
          { id: 'path-def', label: '前向通路定义', expectedCardIds: ['term-path'] },
          { id: 'loop-def', label: '回路定义', expectedCardIds: ['term-loop'] },
          { id: 'non-touching-def', label: '互不接触回路定义', expectedCardIds: ['term-non-touching'] },
          { id: 'delta-def', label: '余子式定义', expectedCardIds: ['term-delta'] },
        ],
        dragCards: [
          { id: 'term-path', label: '从输入到输出、沿箭头前进且不重复节点的路径', tone: 'cyan' },
          { id: 'term-loop', label: '沿箭头方向走一圈又回到原节点的闭合路径', tone: 'cyan' },
          { id: 'term-non-touching', label: '彼此不共享节点的回路组', tone: 'cyan' },
          { id: 'term-delta', label: '对某条前向通路而言，与它不接触的回路影响', tone: 'cyan' },
          { id: 'term-distractor-module', label: '局部模块', tone: 'rose' },
          { id: 'term-distractor-noise', label: '传感器噪声', tone: 'rose' },
        ],
        successMessage: '四个术语均已正确归位。',
        failureMessage: '仍有术语归位错误，请回到上方术语卡核对。',
      };
    case 'step-13':
      return {
        kind: 'choice_check',
        helper: '围绕前向通道、反馈通道和真正分析对象做三道选择校验。',
        submitLabel: '提交例题链',
        releaseLabel: '释放例题',
        questions: [
          {
            key: 'forwardPath',
            prompt: '例题一中，前向通道最核心的作用是什么？',
            options: [
              { value: 'carry', label: '把输入沿前向通道一路传到输出' },
              { value: 'memory', label: '单独记录初始状态' },
              { value: 'noise', label: '只负责传感器噪声' },
            ],
            answer: 'carry',
            explanation: '前向通道负责把输入一路送到输出，是闭环对象收束的主体链。 ',
          },
          {
            key: 'feedbackPath',
            prompt: '反馈通道为什么不能丢？',
            options: [
              { value: 'denominator', label: '它改变闭环对象分母，决定真正进入后续分析的对象' },
              { value: 'pretty', label: '只是为了让结构图更完整' },
              { value: 'static', label: '只影响稳态误差，不影响对象表达' },
            ],
            answer: 'denominator',
            explanation: '反馈通道进入后，真正要分析的是闭环对象，不再只是局部模块。 ',
          },
          {
            key: 'analysisFocus',
            prompt: '例题一最终真正要分析的对象是什么？',
            options: [
              { value: 'closed-loop', label: '闭环对象' },
              { value: 'controller', label: '控制器模块' },
              { value: 'sensor', label: '传感器模块' },
            ],
            answer: 'closed-loop',
            explanation: '后续时域与频域分析都围绕闭环对象展开，而不是某个局部模块。 ',
          },
        ],
      };
    case 'step-14':
      return {
        kind: 'path_highlight',
        helper: '先高亮前向通路与局部回路，再用一句话写出为什么这里的余子式不一定等于 1。',
        submitLabel: '提交辨析',
        releaseLabel: '释放辨析',
        highlightTargets: [
          { id: 'path-upper', label: '上支路前向通路', left: '20%', top: '30%' },
          { id: 'path-lower', label: '下支路前向通路', left: '22%', top: '66%', expected: true, description: '这条前向通路没有碰到局部回路，因此对应余子式会保留下来。' },
          { id: 'loop-local', label: '局部回路', left: '70%', top: '40%', expected: true, description: '是否接触某条前向通路，决定对应余子式是否等于 1。' },
        ],
        fields: [
          {
            key: 'difference',
            label: '用一句话写出：“回路之间互不接触”和“回路不接触某条前向通路”有什么区别？',
            type: 'textarea',
            placeholder: '提示：前者看回路与回路，后者看回路与前向通路。',
          },
        ],
      };
    case 'step-15':
      return {
        kind: 'quiz_group',
        helper: '后测看的是对象语言是否真正立住，尤其是零初值、对象识别和余子式判断。',
        submitLabel: '提交后测',
        releaseLabel: '释放后测',
        questions: [
          {
            key: 'zeroInitialBinding',
            prompt: '为什么传递函数必须和零初值一起理解？',
            options: [
              { value: 'A', label: '否则对象项与初值项会被混在一起' },
              { value: 'B', label: '否则公式就完全无法书写' },
            ],
            answer: 'A',
            explanation: '零初值定义保证我们讨论的是系统对象本身，而不是对象与历史状态的混合。',
          },
          {
            key: 'firstMove',
            prompt: '看到一个长分式时，第一步通常更应该做什么？',
            options: [
              { value: 'A', label: '先识别典型环节和对象组成' },
              { value: 'B', label: '立刻把全部式子算到最简' },
            ],
            answer: 'A',
            explanation: '对象识别优先，后续才知道应该如何连接、收束和解释。',
          },
          {
            key: 'deltaNotOne',
            prompt: '什么时候某条前向通路对应的余子式不等于 1？',
            options: [
              { value: 'A', label: '当存在与这条前向通路不接触的回路时' },
              { value: 'B', label: '只要图里回路很多就一定不等于 1' },
            ],
            answer: 'A',
            explanation: 'Delta_k 是否保留，要看相关回路是否接触这条前向通路，而不是单看回路数量。',
          },
        ],
      };
    default:
      return {
        kind: 'none',
        helper: '本页以讲授、观察和课堂推进为主。',
      };
  }
}

function getAiPrompts(step: UNIT_2_1StepDefinition) {
  if (step.id !== 'step-07') {
    return [];
  }
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_2_1StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit21:${step.id}`,
    registryId: 'unit21-inline-ai',
    title: `${step.title} · 页内 AI 助手`,
    description: '当前课程页的就地 AI 对照助手',
    aiHints: `围绕 ${step.title} 进行对照与解释，只回答当前页面问题。`,
    config: {
      ai: {
        enabled: true,
        persona: 'tutor',
      },
      layout: {
        showAIPanel: true,
      },
    },
  };
}

function getDefaultDraft(activity: ActivitySpec, savedResponse?: UNIT_2_1StepResponse) {
  if (savedResponse) {
    return savedResponse.answers as Record<string, unknown>;
  }
  const defaults: Record<string, unknown> = {};
  for (const field of activity.fields ?? []) {
    defaults[field.key] = field.type === 'checkbox' ? [] : '';
  }
  for (const question of activity.questions ?? []) {
    defaults[question.key] = '';
  }
  if (activity.kind === 'drag_match') {
    defaults.placements = {};
  }
  if (activity.kind === 'bucket_sort') {
    defaults.assignments = {};
  }
  if (activity.kind === 'hotspot_labeling') {
    defaults.selectedHotspotId = '';
  }
  if (activity.kind === 'path_highlight') {
    defaults.selectedHighlightIds = [];
  }
  return defaults;
}

function getWordCloudEntries(responses: UNIT_2_1TeacherResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of responses) {
    Object.values(item.response.answers)
      .flatMap((value) => {
        if (typeof value === 'string') {
          return [value];
        }
        if (Array.isArray(value)) {
          return value.filter((entry): entry is string => typeof entry === 'string');
        }
        return [];
      })
      .join(' ')
      .split(/[\s,，。；;、/]+/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
      .forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12);
}

function renderFieldValue(field: FormField | undefined, value: unknown) {
  const stringValue = typeof value === 'string' ? value : '';
  const arrayValue = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  if (!field) {
    if (stringValue) {
      return stringValue;
    }
    return arrayValue.length ? arrayValue.join('、') : '未作答';
  }
  if (field.type === 'checkbox') {
    if (!arrayValue.length) {
      return '未作答';
    }
    return arrayValue
      .map((item) => field.options?.find((option) => option.value === item)?.label ?? item)
      .join('、');
  }
  if (field.type !== 'radio') {
    return stringValue || '未作答';
  }
  return field.options?.find((option) => option.value === stringValue)?.label ?? stringValue ?? '未作答';
}

function getAttemptCount(savedResponse?: UNIT_2_1StepResponse) {
  const current = savedResponse?.summary?.attemptCount;
  return typeof current === 'number' ? current + 1 : savedResponse ? 2 : 1;
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getRecordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function looksLikeFormula(value: string) {
  return /\\|G\(s\)|Y\(s\)|R\(s\)|\^|_/.test(value);
}

function ObjectChainMiniVisual({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const chain = ['微分方程', '拉氏变换', '传递函数', '典型环节', '结构表达', '总体对象'];
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {chain.map((item, index) => (
        <button
          key={item}
          type="button"
          onClick={() => onParameterChange?.({ key: 'objectChain', value: index + 1, source: 'preset' })}
          className={`premium-lesson-surface-elevated px-4 py-4 text-left text-sm ${index === 2 ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
        >
          <div className="premium-lesson-title text-sm font-semibold">{item}</div>
          <div className="premium-lesson-muted mt-2">{index < chain.length - 1 ? '为下一步提供输入' : '成为后续分析入口'}</div>
        </button>
      ))}
    </div>
  );
}

function InitialStateContrastLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [mode, setMode] = useState<'object' | 'initial'>('object');
  const cards = {
    object: {
      title: '对象项',
      formula: String.raw`Y(s)=G(s)U(s)`,
      description: '对象项只描述系统本身的输入输出关系，它应该能脱离具体历史状态被复用。',
    },
    initial: {
      title: '初值项',
      formula: String.raw`Y(s)=G(s)U(s)+\text{初值项}`,
      description: '初值项描述的是系统一开始带着什么历史状态进入分析，它会影响输出，但不属于传递函数定义。',
    },
  } as const;
  const activeCard = cards[mode];

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">对象项 / 初值项双列对照</div>
      <div className="premium-lesson-muted mt-2 text-sm">点选卡片，看当前页面更想强调哪一类信息。</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { value: 'object', label: '对象项' },
          { value: 'initial', label: '初值项' },
        ].map((item, index) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              const value = item.value as 'object' | 'initial';
              setMode(value);
              onParameterChange?.({ key: 'initialStateMode', value: index + 1, source: 'toggle' });
            }}
            className={`premium-lesson-action-secondary ${mode === item.value ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="premium-lesson-surface-elevated px-4 py-4 text-sm">
          <div className="premium-lesson-title text-sm font-medium">对象项</div>
          <div className="mt-3">
            <BlockMath math={cards.object.formula} />
          </div>
          <div className="premium-lesson-muted mt-3">{cards.object.description}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-4 py-4 text-sm">
          <div className="premium-lesson-title text-sm font-medium">初值项</div>
          <div className="mt-3">
            <BlockMath math={cards.initial.formula} />
          </div>
          <div className="premium-lesson-muted mt-3">{cards.initial.description}</div>
        </div>
      </div>
      <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">
        <div className="font-medium">{activeCard.title}</div>
        <div className="mt-2">{activeCard.description}</div>
      </div>
    </section>
  );
}

function TypicalElementsLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const cards = [
    ['比例环节', 'K', '直接放大比例关系'],
    ['积分环节', 'K/s', '突出累积效应'],
    ['微分环节', 'Ks', '突出变化趋势'],
    ['惯性环节', 'K/(Ts+1)', '体现一阶快慢特征'],
    ['振荡环节', 'Kω_n²/(s²+2ζω_ns+ω_n²)', '体现二阶动态品质'],
  ] as const;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCard = cards[activeIndex];

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">典型环节对象浏览器</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card, index) => (
          <button
            key={card[0]}
            type="button"
            onClick={() => {
              setActiveIndex(index);
              onParameterChange?.({ key: 'typicalElement', value: index + 1, source: 'preset' });
            }}
            className={`premium-lesson-action-secondary ${activeIndex === index ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {card[0]}
          </button>
        ))}
      </div>
      <div className="premium-lesson-surface-elevated mt-4 px-4 py-4 text-sm">
        <div className="premium-lesson-title text-base font-semibold">{activeCard[0]}</div>
        <div className="mt-2 font-mono text-[13px]">{activeCard[1]}</div>
        <div className="premium-lesson-muted mt-2">{activeCard[2]}</div>
      </div>
    </section>
  );
}

function ConnectionRuleLab({
  stepId,
  onParameterChange,
}: {
  stepId: string;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const rules = [
    ['串联', 'G = G1 · G2', '前一级输出就是后一级输入'],
    ['并联', 'G = G1 ± G2', '共享同一输入，总输出在比较点相加'],
    ['反馈', 'Φ = G / (1 + GH)', '输出回到输入端形成闭环'],
  ] as const;
  const [activeIndex, setActiveIndex] = useState(stepId === 'step-10' ? 2 : 0);
  const active = rules[activeIndex];

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">{stepId === 'step-10' ? '船舶航向闭环观察器' : '三类基本连接规则'}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {rules.map((rule, index) => (
          <button
            key={rule[0]}
            type="button"
            onClick={() => {
              setActiveIndex(index);
              onParameterChange?.({ key: 'connectionRule', value: index + 1, source: 'toggle' });
            }}
            className={`premium-lesson-action-secondary ${activeIndex === index ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {rule[0]}
          </button>
        ))}
      </div>
      <div className="premium-lesson-surface-elevated mt-4 px-4 py-4 text-sm">
        <div className="premium-lesson-title text-base font-semibold">{active[0]}</div>
        <div className="mt-2 font-mono text-[13px]">{active[1]}</div>
        <div className="premium-lesson-muted mt-2">{active[2]}</div>
        {stepId === 'step-10' ? (
          <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm">
            船舶航向控制图中，传感器把实际航向送回比较点，控制器据此修正输入，这就是闭环真正“闭上”的位置。
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SignalFlowTermLab({
  onParameterChange,
}: {
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const items = [
    ['前向通路', '从输入到输出，沿箭头方向前进且不重复节点的路径。'],
    ['回路', '从某个节点出发，沿箭头方向走一圈又回到原节点的闭合路径。'],
    ['余子式', '对某条前向通路而言，与它不接触的回路组合仍会保留下来的影响。'],
  ] as const;
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex];

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">梅森术语阅读器</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <button
            key={item[0]}
            type="button"
            onClick={() => {
              setActiveIndex(index);
              onParameterChange?.({ key: 'signalFlowTerm', value: index + 1, source: 'preset' });
            }}
            className={`premium-lesson-action-secondary ${activeIndex === index ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {item[0]}
          </button>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-violet mt-4 text-sm">
        <div className="font-medium">{active[0]}</div>
        <div className="mt-2">{active[1]}</div>
      </div>
    </section>
  );
}

function MasonHighlightLab({
  stepId,
  onParameterChange,
}: {
  stepId: string;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const step13Items = [
    ['前向通路', '这是输入怎样一路传到输出的主通道。'],
    ['反馈通道', '它决定闭环对象分母如何形成。'],
    ['闭环对象', '后续时域与频域分析真正围绕它展开。'],
  ] as const;
  const step14Items = [
    ['下支路前向通路', '它没有碰到局部回路，因此对应的 Delta_k 会保留下来。'],
    ['局部回路', '是否接触某条前向通路，决定对应余子式是否等于 1。'],
    ['判断层次', '回路之间互不接触，与“不接触某条前向通路”不是同一件事。'],
  ] as const;
  const items = stepId === 'step-14' ? step14Items : step13Items;
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex];

  return (
    <section className="premium-lesson-panel-soft mt-4 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">{stepId === 'step-14' ? 'Delta_k 接触关系高亮' : '单回路对象收束高亮'}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <button
            key={item[0]}
            type="button"
            onClick={() => {
              setActiveIndex(index);
              onParameterChange?.({ key: 'masonHighlight', value: index + 1, source: 'preset' });
            }}
            className={`premium-lesson-action-secondary ${activeIndex === index ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            {item[0]}
          </button>
        ))}
      </div>
      <div className={`premium-lesson-tone-block mt-4 text-sm ${stepId === 'step-14' ? 'premium-tone-rose' : 'premium-tone-cyan'}`}>
        <div className="font-medium">{active[0]}</div>
        <div className="mt-2">{active[1]}</div>
      </div>
    </section>
  );
}

function StepInlineVisual({
  step,
  onParameterChange,
}: {
  step: UNIT_2_1StepDefinition;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  switch (step.workspaceKind) {
    case 'object-chain':
      return <ObjectChainMiniVisual onParameterChange={onParameterChange} />;
    case 'initial-state':
      return <InitialStateContrastLab onParameterChange={onParameterChange} />;
    case 'typical-elements':
      return <TypicalElementsLab onParameterChange={onParameterChange} />;
    case 'connection-rules':
      return <ConnectionRuleLab stepId={step.id} onParameterChange={onParameterChange} />;
    case 'signal-flow-terms':
      return <SignalFlowTermLab onParameterChange={onParameterChange} />;
    case 'mason-highlight':
      return <MasonHighlightLab stepId={step.id} onParameterChange={onParameterChange} />;
    default:
      return null;
  }
}

export function UNIT_2_1KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft px-4 py-5">
      <div className="premium-lesson-kicker">Module 2 Entry</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">2-1 是模块 2 的对象入口课</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['模块 1', '先见森林：看到系统会快、会慢、会振、会稳，但对象语言还不完整。'],
          ['2-1', '开始建立统一对象语言：微分方程、传递函数、结构图、信号流图、梅森公式。'],
          ['2-2', '对象已立住，下一课开始研究对象在时间里怎样响应。'],
        ].map(([title, body], index) => (
          <div
            key={title}
            className={`premium-lesson-surface-elevated px-4 py-4 ${index === 1 ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            <div className="premium-lesson-title text-base font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_2_1StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  onWorkspaceParameterChange,
}: {
  step: UNIT_2_1StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = useMemo(() => getStepBlueprint(step), [step]);
  const pageContract = useMemo(() => getUNIT_2_1PageContract(step.id), [step.id]);

  const renderMediaFigure = (maxHeightClass = 'max-h-[420px]') =>
    mediaSrc ? (
      <figure className="premium-lesson-panel-soft overflow-hidden px-4 py-4">
        <Image
          src={mediaSrc}
          alt={mediaAlt ?? step.title}
          width={1200}
          height={720}
          unoptimized
          className={`mx-auto w-full rounded-2xl object-contain ${maxHeightClass}`}
        />
      </figure>
    ) : null;

  const renderFormulaCards = () =>
    blueprint.formulas?.length ? (
      <div className="grid gap-3">
        {blueprint.formulas.map((formula) => (
          <div key={formula} className="premium-lesson-panel-soft px-4 py-4">
            <div className="premium-lesson-caption mb-2 text-xs">页面必须显式呈现的核心公式</div>
            <BlockMath math={formula} />
          </div>
        ))}
      </div>
    ) : null;

  const renderTables = () =>
    blueprint.tables?.length ? (
      <div className="grid gap-4">
        {blueprint.tables.map((table) => (
          <div key={table.title} className="premium-lesson-panel-soft overflow-x-auto px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">{table.title}</div>
            <table className="mt-3 min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  {table.headers.map((header) => (
                    <th key={header} className="border border-border bg-muted/40 px-3 py-2 text-left font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.join('|')}>
                    {row.map((cell) => (
                      <td key={cell} className="border border-border px-3 py-2 align-top">
                        {looksLikeFormula(cell) ? <BlockMath math={cell} /> : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    ) : null;

  const renderSections = () =>
    blueprint.sections.length ? (
      <div className="grid gap-4">
        {blueprint.sections.map((section) => (
          <div key={section.title} className={`premium-lesson-tone-block ${getToneClass(section.tone)}`}>
            <div className="premium-lesson-title text-sm font-medium">{section.title}</div>
            {section.body ? <p className="mt-2 text-sm leading-7">{section.body}</p> : null}
            {section.bullets?.length ? (
              <div className="mt-3 grid gap-2">
                {section.bullets.map((bullet) => (
                  <div key={bullet} className="text-sm leading-7">
                    {bullet}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    ) : null;

  const renderConclusions = () =>
    blueprint.conclusions?.length ? (
      <div className="grid gap-3 md:grid-cols-2">
        {blueprint.conclusions.map((conclusion) => (
          <div key={conclusion} className="premium-lesson-tone-block premium-tone-emerald text-sm">
            {conclusion}
          </div>
        ))}
      </div>
    ) : null;

  const renderStepSpecificRegion = (regionId: string) => {
    switch (regionId) {
      case 'comic':
      case 'map-zone':
      case 'diagram':
      case 'diagram-zone':
      case 'highlight-stage':
      case 'lead':
      case 'infographic':
      case 'finished-steps':
        return renderMediaFigure();
      case 'left-diagram':
        return renderMediaFigure('max-h-[320px]');
      case 'right-diagram':
        if (step.id === 'step-11') {
          return (
            <div className="grid gap-3">
              <div className="premium-lesson-surface-elevated px-4 py-4 text-sm">
                <div className="premium-lesson-title text-sm font-semibold">方框图</div>
                <div className="premium-lesson-muted mt-2">看模块与连接。</div>
              </div>
              <div className="premium-lesson-surface-elevated px-4 py-4 text-sm">
                <div className="premium-lesson-title text-sm font-semibold">信号流图</div>
                <div className="premium-lesson-muted mt-2">看路径与回路。</div>
              </div>
            </div>
          );
        }
        return renderMediaFigure('max-h-[320px]');
      case 'equation':
        return (
          <div className="grid gap-4">
            <p className="premium-lesson-muted text-sm leading-7">{blueprint.intro}</p>
            {renderFormulaCards()}
            {renderSections()}
          </div>
        );
      case 'chain':
      case 'summary-chain':
        return (
          <div className="grid gap-4">
            <p className="premium-lesson-muted text-sm leading-7">{blueprint.intro}</p>
            {renderConclusions()}
          </div>
        );
      case 'cards':
      case 'summary':
      case 'conclusion-zone':
      case 'comparison-table':
      case 'rule-cards':
        return renderSections();
      case 'table-zone':
      case 'contrast':
        return renderTables();
      case 'formula-zone':
      case 'formula-card':
      case 'formula-chain':
      case 'formula-strip':
        return (
          <div className="grid gap-4">
            {renderFormulaCards()}
            {step.id === 'step-14' ? renderSections() : null}
            {step.id === 'step-12' && blueprint.note ? (
              <div className="premium-lesson-tone-block premium-tone-amber text-sm">{blueprint.note}</div>
            ) : null}
          </div>
        );
      case 'compare-zone':
      case 'compare-table':
        return (
          <div className="grid gap-4">
            {renderFormulaCards()}
            <InitialStateContrastLab onParameterChange={onWorkspaceParameterChange} />
          </div>
        );
      case 'reflection-zone':
      case 'ai-zone':
      case 'reflection':
      case 'self-judgment':
      case 'ai-panel':
      case 'explain-cards':
        return renderSections();
      case 'reason-checklist':
      case 'quiz-stack':
      case 'distribution':
        return null;
      case 'role-cards':
        return (
          <div className="grid gap-3 md:grid-cols-4">
            {['控制器', '舵机', '船体', '传感器'].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated px-4 py-4 text-sm">
                <div className="premium-lesson-title text-sm font-semibold">{item}</div>
              </div>
            ))}
            <div className="premium-lesson-tone-block premium-tone-cyan md:col-span-4 text-sm">
              反馈信号在闭环中的回送位置与传感器作用需要与上方结构图一起理解。
            </div>
          </div>
        );
      case 'term-cards':
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {['前向通路', '回路', '互不接触回路', '余子式'].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated px-4 py-4 text-sm">
                <div className="premium-lesson-title text-sm font-semibold">{item}</div>
              </div>
            ))}
          </div>
        );
      case 'step-cards':
        return (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              {['对象识别', '前向通道', '闭环对象', '信号流图验证'].map((item) => (
                <div key={item} className="premium-lesson-surface-elevated px-4 py-4 text-sm">
                  <div className="premium-lesson-title text-sm font-semibold">{item}</div>
                </div>
              ))}
            </div>
            {renderFormulaCards()}
            {renderConclusions()}
          </div>
        );
      case 'next-lesson':
        return (
          <div className="grid gap-4">
            {renderSections()}
            {renderConclusions()}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="premium-lesson-tone-pill premium-tone-slate">{UNIT_2_1_STAGE_LABEL[step.stage]}</span>
        <span className="premium-lesson-tone-pill premium-tone-cyan">{blueprint.kicker}</span>
        <span className="premium-lesson-tone-pill premium-tone-amber">⏱ {step.duration}</span>
      </div>
      <h2 className="premium-lesson-title mt-4 text-2xl font-semibold">{step.title}</h2>
      {pageContract.layout.regions
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((region) => {
          const regionBody = renderStepSpecificRegion(region.id);
          if (!regionBody) {
            return null;
          }
          return (
            <div key={region.id} className="mt-5">
              {regionBody}
            </div>
          );
        })}

      {!pageContract.layout.regions.some((region) => region.id === 'equation' || region.id === 'chain' || region.id === 'compare-zone' || region.id === 'compare-table') ? (
        <p className="premium-lesson-muted mt-5 text-sm leading-7">{blueprint.intro}</p>
      ) : null}

      {!pageContract.layout.regions.some((region) => region.id === 'table-zone' || region.id === 'contrast') ? renderTables() : null}
      {!pageContract.layout.regions.some((region) => region.id === 'formula-zone' || region.id === 'formula-card' || region.id === 'equation' || region.id === 'formula-chain' || region.id === 'formula-strip' || region.id === 'chain') ? renderFormulaCards() : null}
      {!pageContract.layout.regions.some((region) => region.id === 'cards' || region.id === 'summary' || region.id === 'comparison-table' || region.id === 'reflection' || region.id === 'explain-cards' || region.id === 'self-judgment' || region.id === 'rule-cards' || region.id === 'step-cards' || region.id === 'role-cards' || region.id === 'next-lesson' || region.id === 'compare-zone' || region.id === 'compare-table' || region.id === 'reflection-zone' || region.id === 'ai-zone' || region.id === 'ai-panel' || region.id === 'quiz-stack') ? (
        <div className="mt-5">{renderSections()}</div>
      ) : null}
      {!pageContract.layout.regions.some((region) => region.id === 'summary-chain' || region.id === 'step-cards' || region.id === 'next-lesson') ? (
        <div className="mt-5">{renderConclusions()}</div>
      ) : null}

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_2_1StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  readOnly = false,
}: {
  step: UNIT_2_1StepDefinition;
  savedResponse?: UNIT_2_1StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_2_1StepResponse) => void;
  readOnly?: boolean;
}) {

  void readOnly;
  const activity = useMemo(() => getStepActivity(step), [step]);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => getDefaultDraft(activity, savedResponse));
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  if (activity.kind === 'none') {
    return null;
  }

  if (!released) {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">等待教师释放</div>
        <div className="premium-lesson-muted mt-2 text-sm">本题尚未开放，请先跟随教师讲解，等待教师释放后再作答。</div>
      </section>
    );
  }

  const answerFields = (activity.fields ?? []).filter((field) => field.answer);
  const attemptCount = getAttemptCount(savedResponse);
  const dragPlacements = getRecordValue(draft.placements);
  const bucketAssignments = getRecordValue(draft.assignments);
  const selectedHighlightIds = getStringArray(draft.selectedHighlightIds);

  const moveCardIntoSlot = (slotId: string, cardId: string) => {
    setDraft((prev) => {
      const previousPlacements = getRecordValue(prev.placements);
      const nextPlacements = Object.fromEntries(
        Object.entries(previousPlacements).map(([key, value]) => [
          key,
          getStringArray(value).filter((item) => item !== cardId),
        ]),
      );
      nextPlacements[slotId] = [...getStringArray(nextPlacements[slotId]), cardId];
      return { ...prev, placements: nextPlacements };
    });
  };

  const moveCardIntoBucket = (bucketId: string, cardId: string) => {
    setDraft((prev) => {
      const previousAssignments = getRecordValue(prev.assignments);
      const nextAssignments = Object.fromEntries(
        Object.entries(previousAssignments).map(([key, value]) => [
          key,
          getStringArray(value).filter((item) => item !== cardId),
        ]),
      );
      nextAssignments[bucketId] = [...getStringArray(nextAssignments[bucketId]), cardId];
      return { ...prev, assignments: nextAssignments };
    });
  };

  const buildResponse = (): UNIT_2_1StepResponse => {
    const submittedAt = Date.now();
    const baseResponse: UNIT_2_1StepResponse = {
      stepId: step.id,
      submittedAt,
      answers: draft,
      summary: {
        attemptCount,
        interactionKind: activity.kind,
      },
    };

    if (activity.questions?.length) {
      const correctCount = activity.questions.filter((question) => draft[question.key] === question.answer).length;
      baseResponse.summary = {
        ...baseResponse.summary,
        resultState: correctCount === activity.questions.length ? 'correct' : 'incorrect',
        correctCount,
        totalCount: activity.questions.length,
        selectedOption:
          activity.questions.length === 1 && typeof draft[activity.questions[0]?.key ?? ''] === 'string'
            ? draft[activity.questions[0]?.key ?? '']
            : undefined,
      };
      return baseResponse;
    }

    switch (activity.kind) {
      case 'multi_check': {
        const selectedItems = getStringArray(draft.definitionChecklist);
        const expectedItems = getStringArray(activity.fields?.find((field) => field.key === 'definitionChecklist')?.answer);
        const isCorrect =
          selectedItems.length === expectedItems.length && selectedItems.every((item) => expectedItems.includes(item));
        baseResponse.summary = {
          ...baseResponse.summary,
          resultState: isCorrect ? 'correct' : 'incorrect',
          selectedItems,
        };
        return baseResponse;
      }
      case 'drag_match': {
        const slots = activity.dragSlots ?? [];
        const slotSummaries = slots.map((slot) => {
          const placed = getStringArray(dragPlacements[slot.id]);
          const correct = placed.length === slot.expectedCardIds.length && slot.expectedCardIds.every((item) => placed.includes(item));
          return {
            slotId: slot.id,
            placed,
            correct,
          };
        });
        const allCorrect = slotSummaries.every((item) => item.correct);
        baseResponse.summary = {
          ...baseResponse.summary,
          resultState: allCorrect ? 'correct' : 'incorrect',
          matchedPairs: slotSummaries,
          errorCount: slotSummaries.filter((item) => !item.correct).length,
        };
        return baseResponse;
      }
      case 'hotspot_labeling': {
        const correctId = activity.hotspotTargets?.find((target) => target.expected)?.id ?? '';
        const selectedHotspotId = typeof draft.selectedHotspotId === 'string' ? draft.selectedHotspotId : '';
        baseResponse.summary = {
          ...baseResponse.summary,
          resultState: selectedHotspotId === correctId ? 'correct' : 'incorrect',
          hotspotTargetId: selectedHotspotId,
        };
        return baseResponse;
      }
      case 'bucket_sort': {
        const cards = activity.bucketCards ?? [];
        const assignmentsSummary = cards.map((card) => {
          const bucketId =
            Object.entries(bucketAssignments).find(([, value]) => getStringArray(value).includes(card.id))?.[0] ?? null;
          return {
            cardId: card.id,
            bucketId,
            correct: bucketId === card.bucketId,
          };
        });
        baseResponse.summary = {
          ...baseResponse.summary,
          resultState: assignmentsSummary.every((item) => item.correct) ? 'correct' : 'incorrect',
          bucketAssignments: assignmentsSummary,
        };
        return baseResponse;
      }
      case 'path_highlight': {
        const expectedIds = (activity.highlightTargets ?? []).filter((target) => target.expected).map((target) => target.id);
        const resultState =
          selectedHighlightIds.length === expectedIds.length && selectedHighlightIds.every((item) => expectedIds.includes(item))
            ? 'correct'
            : 'incorrect';
        baseResponse.summary = {
          ...baseResponse.summary,
          resultState,
          highlightedPathIds: selectedHighlightIds,
        };
        return baseResponse;
      }
      default:
        return baseResponse;
    }
  };

  const renderDragMatchBoard = () => {
    const placedIds = new Set(
      Object.values(dragPlacements).flatMap((value) => getStringArray(value)),
    );
    const availableCards = (activity.dragCards ?? []).filter((card) => !placedIds.has(card.id));

    return (
      <div className="grid gap-4">
        <div className="premium-lesson-surface-elevated px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">可拖拽卡片池</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableCards.map((card) => (
              <button
                key={card.id}
                type="button"
                draggable
                onDragStart={() => setDraggingCardId(card.id)}
                className={`premium-lesson-tone-pill ${getToneClass(card.tone ?? 'slate')}`}
              >
                {card.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(activity.dragSlots ?? []).map((slot) => (
            <div
              key={slot.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingCardId) {
                  moveCardIntoSlot(slot.id, draggingCardId);
                  setDraggingCardId(null);
                }
              }}
              className="premium-lesson-surface-elevated min-h-36 border border-dashed border-border px-4 py-4"
            >
              <div className="premium-lesson-title text-sm font-medium">{slot.label}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {getStringArray(dragPlacements[slot.id]).map((cardId) => {
                  const card = activity.dragCards?.find((item) => item.id === cardId);
                  return (
                    <button
                      key={cardId}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => {
                          const placements = getRecordValue(prev.placements);
                          return {
                            ...prev,
                            placements: {
                              ...placements,
                              [slot.id]: getStringArray(placements[slot.id]).filter((item) => item !== cardId),
                            },
                          };
                        })
                      }
                      className={`premium-lesson-tone-pill ${getToneClass(card?.tone ?? 'slate')}`}
                    >
                      {card?.label ?? cardId}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHotspotPanel = () => {
    const selectedHotspotId = typeof draft.selectedHotspotId === 'string' ? draft.selectedHotspotId : '';
    return (
      <div className="premium-lesson-surface-elevated px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">热点标注区</div>
        <div className="relative mt-4 h-60 rounded-2xl border border-dashed border-border bg-muted/20">
          {(activity.hotspotTargets ?? []).map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, selectedHotspotId: target.id }))}
              className={`absolute rounded-full border px-3 py-1 text-xs ${
                selectedHotspotId === target.id ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700' : 'border-border bg-background'
              }`}
              style={{ left: target.left, top: target.top, transform: 'translate(-50%, -50%)' }}
            >
              {target.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderBucketBoard = () => {
    const assignedIds = new Set(
      Object.values(bucketAssignments).flatMap((value) => getStringArray(value)),
    );
    const availableCards = (activity.bucketCards ?? []).filter((card) => !assignedIds.has(card.id));

    return (
      <div className="grid gap-4">
        <div className="premium-lesson-surface-elevated px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">任务卡池</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableCards.map((card) => (
              <button
                key={card.id}
                type="button"
                draggable
                onDragStart={() => setDraggingCardId(card.id)}
                className="premium-lesson-tone-pill premium-tone-slate"
              >
                {card.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {(activity.bucketBuckets ?? []).map((bucket) => (
            <div
              key={bucket.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingCardId) {
                  moveCardIntoBucket(bucket.id, draggingCardId);
                  setDraggingCardId(null);
                }
              }}
              className="premium-lesson-surface-elevated min-h-40 border border-dashed border-border px-4 py-4"
            >
              <div className="premium-lesson-title text-sm font-medium">{bucket.label}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {getStringArray(bucketAssignments[bucket.id]).map((cardId) => {
                  const card = activity.bucketCards?.find((item) => item.id === cardId);
                  return (
                    <button
                      key={cardId}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => {
                          const assignments = getRecordValue(prev.assignments);
                          return {
                            ...prev,
                            assignments: {
                              ...assignments,
                              [bucket.id]: getStringArray(assignments[bucket.id]).filter((item) => item !== cardId),
                            },
                          };
                        })
                      }
                      className="premium-lesson-tone-pill premium-tone-cyan"
                    >
                      {card?.label ?? cardId}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHighlightPanel = () => (
    <div className="premium-lesson-surface-elevated px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">路径高亮区</div>
      <div className="relative mt-4 h-60 rounded-2xl border border-dashed border-border bg-muted/20">
        {(activity.highlightTargets ?? []).map((target) => {
          const selected = selectedHighlightIds.includes(target.id);
          return (
            <button
              key={target.id}
              type="button"
              onClick={() =>
                setDraft((prev) => {
                  const current = getStringArray(prev.selectedHighlightIds);
                  return {
                    ...prev,
                    selectedHighlightIds: current.includes(target.id)
                      ? current.filter((item) => item !== target.id)
                      : [...current, target.id],
                  };
                })
              }
              className={`absolute rounded-full border px-3 py-1 text-xs ${
                selected ? 'border-rose-500 bg-rose-500/10 text-rose-700' : 'border-border bg-background'
              }`}
              style={{ left: target.left, top: target.top, transform: 'translate(-50%, -50%)' }}
            >
              {target.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <div className="premium-lesson-muted mt-2 text-sm">{activity.helper}</div>

      <div className="mt-4 grid gap-4">
        {activity.questions?.map((question) => (
          <div key={question.key} className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
            <div className="mt-3 grid gap-2">
              {question.options.map((option) => (
                <label key={option.value} className="premium-lesson-control flex items-start gap-2">
                  <input
                    type="radio"
                    name={question.key}
                    checked={draft[question.key] === option.value}
                    onChange={() => setDraft((prev) => ({ ...prev, [question.key]: option.value }))}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {activity.kind === 'drag_match' ? renderDragMatchBoard() : null}
        {activity.kind === 'hotspot_labeling' ? renderHotspotPanel() : null}
        {activity.kind === 'bucket_sort' ? renderBucketBoard() : null}
        {activity.kind === 'path_highlight' ? renderHighlightPanel() : null}

        {activity.fields?.map((field) => (
          <label key={field.key} className="premium-lesson-caption block text-xs">
            {field.label}
            {field.type === 'textarea' ? (
              <textarea
                value={typeof draft[field.key] === 'string' ? (draft[field.key] as string) : ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="premium-lesson-input mt-2 min-h-28"
              />
            ) : field.type === 'checkbox' ? (
              <div className="mt-2 grid gap-2">
                {field.options?.map((option) => (
                  <label key={option.value} className="premium-lesson-control flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={getStringArray(draft[field.key]).includes(option.value)}
                      onChange={(event) =>
                        setDraft((prev) => {
                          const current = getStringArray(prev[field.key]);
                          return {
                            ...prev,
                            [field.key]: event.target.checked
                              ? [...current, option.value]
                              : current.filter((item) => item !== option.value),
                          };
                        })
                      }
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            ) : field.type === 'radio' ? (
              <div className="mt-2 grid gap-2">
                {field.options?.map((option) => (
                  <label key={option.value} className="premium-lesson-control flex items-center gap-2">
                    <input
                      type="radio"
                      name={field.key}
                      checked={draft[field.key] === option.value}
                      onChange={() => setDraft((prev) => ({ ...prev, [field.key]: option.value }))}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type={field.type}
                value={typeof draft[field.key] === 'string' ? (draft[field.key] as string) : ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="premium-lesson-input mt-2"
              />
            )}
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSubmit(buildResponse())}
        className="premium-lesson-action-primary mt-5"
      >
        {activity.submitLabel ?? '提交'}
      </button>

      <SubmissionStatus
        submitted={Boolean(savedResponse)}
        submittedText="提交成功，教师端已收到你的作答。"
        idleText="提交后会同步到教师端汇总。"
      />

      {savedResponse?.summary?.resultState ? (
        <div
          className={`mt-4 text-sm ${
            savedResponse.summary.resultState === 'correct'
              ? 'premium-lesson-tone-block premium-tone-emerald'
              : 'premium-lesson-tone-block premium-tone-amber'
          }`}
        >
          {savedResponse.summary.resultState === 'correct'
            ? activity.successMessage ?? '本次提交判断正确。'
            : activity.failureMessage ?? '本次提交仍有待纠正内容，请根据页面固定内容继续核对。'}
        </div>
      ) : null}

      {answerVisible && activity.questions?.length ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4">
          <div className="premium-lesson-title text-sm font-medium">客观题答案</div>
          <div className="mt-3 grid gap-3">
            {activity.questions.map((question) => (
              <div key={question.key} className="text-sm leading-7">
                <div className="font-medium">{question.prompt}</div>
                <div>答案：{question.options.find((option) => option.value === question.answer)?.label ?? question.answer}</div>
                <div className="premium-lesson-muted">{question.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {answerVisible && activity.kind === 'drag_match' && activity.dragSlots?.length ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm">
          <div className="premium-lesson-title text-sm font-medium">标准配对</div>
          <div className="mt-3 grid gap-2">
            {activity.dragSlots.map((slot) => (
              <div key={slot.id}>
                <span className="font-medium">{slot.label}：</span>
                <span>
                  {slot.expectedCardIds
                    .map((cardId) => activity.dragCards?.find((card) => card.id === cardId)?.label ?? cardId)
                    .join(' / ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {answerVisible && activity.kind === 'hotspot_labeling' ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm">
          <div className="premium-lesson-title text-sm font-medium">参考答案</div>
          <div className="mt-3">
            {(activity.hotspotTargets ?? [])
              .filter((target) => target.expected)
              .map((target) => (
                <div key={target.id}>
                  <span className="font-medium">{target.label}：</span>
                  <span>{target.description}</span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {answerVisible && activity.kind === 'bucket_sort' ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm">
          <div className="premium-lesson-title text-sm font-medium">标准分类</div>
          <div className="mt-3 grid gap-2">
            {(activity.bucketBuckets ?? []).map((bucket) => (
              <div key={bucket.id}>
                <span className="font-medium">{bucket.label}：</span>
                <span>
                  {(activity.bucketCards ?? [])
                    .filter((card) => card.bucketId === bucket.id)
                    .map((card) => card.label)
                    .join('、')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {answerVisible && activity.kind === 'path_highlight' ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm">
          <div className="premium-lesson-title text-sm font-medium">标准高亮</div>
          <div className="mt-3 grid gap-2">
            {(activity.highlightTargets ?? [])
              .filter((target) => target.expected)
              .map((target) => (
                <div key={target.id}>
                  <span className="font-medium">{target.label}：</span>
                  <span>{target.description}</span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {answerVisible && answerFields.length ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4">
          <div className="premium-lesson-title text-sm font-medium">参考答案</div>
          <div className="mt-3 grid gap-2 text-sm">
            {answerFields.map((field) => (
              <div key={field.key}>
                <span className="font-medium">{field.label}：</span>
                <span>{renderFieldValue(field, field.answer)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_2_1TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_2_1StepDefinition;
  responses: UNIT_2_1TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const activity = getStepActivity(step);
  const wordCloud = getWordCloudEntries(responses);
  const answerFields = (activity.fields ?? []).filter((field) => field.answer);
  const correctCount = responses.filter((item) => item.response.summary?.resultState === 'correct').length;
  const incorrectCount = responses.length - correctCount;

  const summaryCounts = (values: Array<string | null | undefined>) => {
    const counts = new Map<string, number>();
    values
      .filter((value): value is string => Boolean(value))
      .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  };

  const dragSlotErrors = summaryCounts(
    responses.flatMap((item) => {
      const matchedPairs = item.response.summary?.matchedPairs;
      if (!Array.isArray(matchedPairs)) {
        return [];
      }
      return matchedPairs
        .filter((entry): entry is { slotId: string; correct: boolean } => Boolean(entry) && typeof entry === 'object' && 'slotId' in entry)
        .filter((entry) => !entry.correct)
        .map((entry) => entry.slotId);
    }),
  );

  const hotspotCounts = summaryCounts(
    responses.map((item) => (typeof item.response.summary?.hotspotTargetId === 'string' ? item.response.summary.hotspotTargetId : null)),
  );

  const bucketErrorCounts = summaryCounts(
    responses.flatMap((item) => {
      const assignments = item.response.summary?.bucketAssignments;
      if (!Array.isArray(assignments)) {
        return [];
      }
      return assignments
        .filter((entry): entry is { cardId: string; correct: boolean } => Boolean(entry) && typeof entry === 'object' && 'cardId' in entry)
        .filter((entry) => !entry.correct)
        .map((entry) => entry.cardId);
    }),
  );

  const highlightCounts = summaryCounts(
    responses.flatMap((item) => {
      const highlights = item.response.summary?.highlightedPathIds;
      return Array.isArray(highlights) ? highlights.filter((entry): entry is string => typeof entry === 'string') : [];
    }),
  );

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">教师端汇总</div>
          <div className="premium-lesson-muted mt-1 text-sm">当前步骤已收到 {responses.length} 份提交。</div>
        </div>
        {activity.kind !== 'none' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
              {released ? '已释放活动' : activity.releaseLabel ?? '释放活动'}
            </button>
            {(activity.questions?.length ?? 0) > 0 || answerFields.length ? (
              <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
                {answerVisible ? '已显示答案' : '显示答案'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {activity.kind !== 'none' ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="premium-lesson-surface-elevated px-4 py-4 text-sm">
            <div className="premium-lesson-title text-sm font-medium">正确提交</div>
            <div className="mt-2 text-2xl font-semibold">{correctCount}</div>
          </div>
          <div className="premium-lesson-surface-elevated px-4 py-4 text-sm">
            <div className="premium-lesson-title text-sm font-medium">待纠正提交</div>
            <div className="mt-2 text-2xl font-semibold">{incorrectCount}</div>
          </div>
          <div className="premium-lesson-surface-elevated px-4 py-4 text-sm">
            <div className="premium-lesson-title text-sm font-medium">总提交数</div>
            <div className="mt-2 text-2xl font-semibold">{responses.length}</div>
          </div>
        </div>
      ) : null}

      {activity.questions?.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {activity.questions.map((question) => {
            const counts = question.options.map((option) => ({
              option,
              count: responses.filter((item) => item.response.answers[question.key] === option.value).length,
            }));
            return (
              <div key={question.key} className="premium-lesson-surface-elevated px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3 grid gap-2">
                  {counts.map(({ option, count }) => (
                    <div key={option.value} className="flex items-center justify-between text-sm">
                      <span>{option.label}</span>
                      <span>{count} 人</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {activity.fields?.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">词云</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {wordCloud.length ? (
                wordCloud.map(([word, count]) => (
                  <span key={word} className="premium-lesson-tone-pill premium-tone-cyan">
                    {word} × {count}
                  </span>
                ))
              ) : (
                <span className="premium-lesson-muted text-sm">暂无文本提交，词云将在学生提交后出现。</span>
              )}
            </div>
          </div>

          <details className="premium-lesson-surface-elevated px-4 py-4">
            <summary className="premium-lesson-title cursor-pointer text-sm font-medium">学生回复列表</summary>
            <div className="mt-3 grid gap-3">
              {responses.length ? (
                responses.map((item) => (
                  <div key={`${item.studentName}-${item.response.submittedAt}`} className="rounded-2xl border border-border px-3 py-3 text-sm">
                    <div className="font-medium">{item.studentName}</div>
                    <div className="premium-lesson-muted mt-1 text-xs">
                      {new Date(item.response.submittedAt).toLocaleString('zh-CN', { hour12: false })}
                    </div>
                    <div className="mt-2 grid gap-2">
                      {Object.entries(item.response.answers).map(([key, value]) => {
                        const field = activity.fields?.find((candidate) => candidate.key === key);
                        return (
                          <div key={key}>
                            <span className="font-medium">{field?.label ?? key}：</span>
                            <span>{renderFieldValue(field, value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="premium-lesson-muted text-sm">暂无学生提交。</div>
              )}
            </div>
          </details>
        </div>
      ) : null}

      {activity.kind === 'drag_match' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">错位槽位热点</div>
            <div className="mt-3 grid gap-2 text-sm">
              {dragSlotErrors.length ? (
                dragSlotErrors.map(([slotId, count]) => (
                  <div key={slotId} className="flex items-center justify-between">
                    <span>{activity.dragSlots?.find((slot) => slot.id === slotId)?.label ?? slotId}</span>
                    <span>{count} 次</span>
                  </div>
                ))
              ) : (
                <div className="premium-lesson-muted">暂无错位槽位。</div>
              )}
            </div>
          </div>
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">常见错因标签</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(getUNIT_2_1PageContract(step.id).misconceptionTags ?? []).map((tag) => (
                <span key={tag} className="premium-lesson-tone-pill premium-tone-amber">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activity.kind === 'hotspot_labeling' ? (
        <div className="mt-4 premium-lesson-surface-elevated px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">热点命中分布</div>
          <div className="mt-3 grid gap-2 text-sm">
            {hotspotCounts.length ? (
              hotspotCounts.map(([targetId, count]) => (
                <div key={targetId} className="flex items-center justify-between">
                  <span>{activity.hotspotTargets?.find((target) => target.id === targetId)?.label ?? targetId}</span>
                  <span>{count} 次</span>
                </div>
              ))
            ) : (
              <div className="premium-lesson-muted">暂无热点标注提交。</div>
            )}
          </div>
        </div>
      ) : null}

      {activity.kind === 'bucket_sort' ? (
        <div className="mt-4 premium-lesson-surface-elevated px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">错误任务分配</div>
          <div className="mt-3 grid gap-2 text-sm">
            {bucketErrorCounts.length ? (
              bucketErrorCounts.map(([cardId, count]) => (
                <div key={cardId} className="flex items-center justify-between">
                  <span>{activity.bucketCards?.find((card) => card.id === cardId)?.label ?? cardId}</span>
                  <span>{count} 次</span>
                </div>
              ))
            ) : (
              <div className="premium-lesson-muted">暂无错误分配。</div>
            )}
          </div>
        </div>
      ) : null}

      {activity.kind === 'path_highlight' ? (
        <div className="mt-4 premium-lesson-surface-elevated px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">路径高亮分布</div>
          <div className="mt-3 grid gap-2 text-sm">
            {highlightCounts.length ? (
              highlightCounts.map(([targetId, count]) => (
                <div key={targetId} className="flex items-center justify-between">
                  <span>{activity.highlightTargets?.find((target) => target.id === targetId)?.label ?? targetId}</span>
                  <span>{count} 次</span>
                </div>
              ))
            ) : (
              <div className="premium-lesson-muted">暂无路径高亮提交。</div>
            )}
          </div>
        </div>
      ) : null}

      {answerVisible && answerFields.length ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm">
          <div className="premium-lesson-title text-sm font-medium">参考答案</div>
          <div className="mt-3 grid gap-2">
            {answerFields.map((field) => (
              <div key={field.key}>
                <span className="font-medium">{field.label}：</span>
                <span>{renderFieldValue(field, field.answer)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_2_1StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_2_1StepResponse>;
}) {
  const finishedSteps = UNIT_2_1_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_2_1_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {['对象建立', '对象识别', '结构表达', '总体对象'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是 2-1 收束建模语言的关键词。</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {finishedSteps.map((item) => (
          <div key={item.id} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{item.title}</div>
            <div className="premium-lesson-muted mt-1">{item.hint}</div>
          </div>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
        下一课 2-2 将在今天建立的对象语言上继续研究单位阶跃响应与动态性能指标：对象已经立住，接下来开始看它怎样在时间里运动。
      </div>
    </section>
  );
}

export function UNIT_2_1StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_2_1StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '2-1',
      stepId: step.id,
      prompts,
    },
    onEvent: onAiEvent,
  });

  useEffect(() => {
    if (!copiedPrompt) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopiedPrompt(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedPrompt]);

  if (!prompts.length) {
    return null;
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        页内 AI 助手
      </div>
      <p className="premium-lesson-muted mt-2 text-sm">
        先完成个人判断，再把下面的提示词发给 AI 做对照。AI 只围绕当前页面问题解释，不替你跳过第一步。
      </p>
      <div className="mt-4 grid gap-3">
        {prompts.map((prompt) => (
          <div key={prompt} className="premium-lesson-surface-elevated flex flex-wrap items-start justify-between gap-3 px-4 py-4">
            <pre className="whitespace-pre-wrap text-sm leading-7 text-foreground">{prompt}</pre>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(prompt);
                setCopiedPrompt(prompt);
              }}
              className="premium-lesson-action-secondary"
            >
              <Copy className="h-4 w-4" />
              {copiedPrompt === prompt ? '已复制' : '复制提示词'}
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={ai.togglePanel} className="premium-lesson-action-primary mt-4">
        向 AI 对照
      </button>

      <Dialog open={ai.isPanelOpen} onOpenChange={ai.togglePanel}>
        <DialogContent className="max-w-5xl border-border bg-background p-0 text-foreground">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="premium-lesson-title">{UNIT_2_1_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription className="premium-lesson-muted">
              围绕当前步骤进行解释、核对和反思，不离开课程页。
            </DialogDescription>
          </DialogHeader>
          <div className="h-[560px] overflow-hidden">
            <InteractiveAIPanel ai={ai} title={`${step.title} · 页内 AI 助手`} onClose={ai.togglePanel} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
