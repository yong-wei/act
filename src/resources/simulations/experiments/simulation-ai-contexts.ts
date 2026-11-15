import type { AIContextConfig } from '@/types/ai-context';
import {
  DESTROYER_CURRENT_STEPS,
  DESTROYER_EXPERIMENT_STEPS,
  DESTROYER_EXPERIMENT_TITLE,
} from '@/resources/simulations/simulations/destroyer-experiment';
import { VESSEL_EXPERIMENTS } from '@/resources/simulations/simulations/vessel-experiments';
import type { VesselExperiment } from '@/resources/simulations/simulations/vessel-experiment';
import { VESSEL_COURSES, type VesselCourseKey } from './course-catalog';

export interface SimulationCourseAIEntry {
  getStepContext: (stepId: string) => AIContextConfig | null;
  getQuickQuestions: (stepId: string) => Array<{ label: string; question: string }>;
  courseMeta: {
    courseId: string;
    courseTitle: string;
    courseDescription: string;
  };
}

interface SimulationCourseDescriptor {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  vesselId: string;
  prefixes: string[];
  stepsBySeq: Map<number, { title: string; goal: string; watch: string; suggestion: string; keyConcepts: string[] }>;
}

const CATALOG_KEY_BY_COURSE_ID: Record<string, VesselCourseKey> = {
  'destroyer-heading-experiment': 'destroyer',
  'lng-berthing-experiment': 'lng',
  'container-voyage-experiment': 'container',
  'cruise-comfort-experiment': 'cruise',
  'drilling-dp-experiment': 'drilling',
  'icebreaker-ice-experiment': 'icebreaker',
  'dredger-mode-experiment': 'dredger',
};

const VESSEL_KEY_CONCEPTS: Record<VesselCourseKey, string[]> = {
  destroyer: ['航向控制', 'Nomoto 响应模型', '舵机延迟与速率限制', 'PD/PID 参数整定', '风浪流扰动'],
  lng: ['大惯性船舶操纵', '低速舵效衰减', '靠泊制动距离', '推进因果链', '侧推与拖轮配合'],
  container: ['航速与油耗权衡', '推进效率', '准点率约束', '风浪阻力增量', '主机负荷控制'],
  cruise: ['减摇鳍控制', '横摇阻尼', '转向与横倾耦合', '乘坐舒适度指标', '多自由度耦合'],
  drilling: ['动力定位 DP', '风浪流环境前馈', '推进器推力分配', '位置与首向保持', '失效边界判断'],
  icebreaker: ['吊舱推进器', '冰阻力突变特性', '低速高阻操纵', '艏向稳定性', '冰区安全操纵边界'],
  dredger: ['挖泥定位模式切换', '疏浚切削载荷', '推力与姿态协同', '施工漂移限制', '模式切换稳定性'],
};

function buildStepConfig(descriptor: SimulationCourseDescriptor, seq: number, stepId: string): AIContextConfig {
  const detail = descriptor.stepsBySeq.get(seq) ?? {
    title: `第 ${seq} 步实验探究`,
    goal: `完成${descriptor.courseTitle}第 ${seq} 步仿真实验并总结因果证据。`,
    watch: '对比输入指令与响应曲线的关键特征变化。',
    suggestion: '按实验工况运行后读取曲线峰值、稳态或边界现象，禁止直接编造读数。',
    keyConcepts: [],
  };

  return {
    enabled: true,
    courseId: descriptor.courseId,
    courseTitle: descriptor.courseTitle,
    pageType: 'practice',
    stepId,
    topic: detail.title,
    learningObjectives: [
      detail.goal,
      detail.watch,
      '基于实验曲线与物理机理引导排查，不替学生填写读数或直接给出最终评分结果。',
    ],
    knowledgeType: seq >= 18 ? 'D' : 'X',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      {
        label: '这一步怎么做',
        question: `我在做${descriptor.courseTitle}第 ${seq} 步「${detail.title}」。请说明操作思路与观察重点，不要替我填写读数，也不要直接打分。`,
      },
      {
        label: '怎么分析曲线',
        question: `在第 ${seq} 步「${detail.title}」中，我该如何从当前响应曲线判断系统特性与控制效果？`,
      },
    ],
    systemPromptExtension: [
      `当前仿真实验：${descriptor.courseTitle}（第 ${seq} 步：${detail.title}）。`,
      `教学目标：${detail.goal}`,
      `观察要点：${detail.watch}`,
      `操作提示：${detail.suggestion}`,
      '本实验采用船体坐标x向船艏、y向右舷、z向下，世界坐标北、东、下。正航向和正艏摇为俯视顺时针。相对重心的推进器位置为r，力为F，艏摇力矩N = x F_y - y F_x。按当前推进器位置和推力方向逐项判断符号，流体耦合会影响实际响应的幅值和时程。',
      'y>0的安装点位于右舷。该处沿船艏的推力F_x>0产生N=-y F_x<0，对应俯视左转。船艏x>0处的右向推力F_y>0产生N=x F_y>0，对应俯视右转。',
      '装载后的质量、重心、吃水、GM和风面积由同一教学配载几何确定。增减方向以所给运行参数及同条件对照为依据，缺少对照数据时先引导读取状态区并保存。浏览器页面观察须注明尚未由服务端复算，已保存恢复点参数和量测须注明其运行时刻。',
      ...(descriptor.courseId === 'container-voyage-experiment'
        ? ['轴功率对时间的积分为机械能。教学燃油质量由发动机功率、SFOC曲线和持续时间换算，需同时保留功率与燃油的单位。'] : []),
      ...(descriptor.courseId === 'dredger-mode-experiment'
        ? ['天鲸号通过钢桩有限支承、两条单向受拉弹性锚缆及真实绞车进行横移。桥架、绞刀和土层载荷共同影响六自由度运动。局部模型只适用于辨识时的固定作业模式。独立预测假定标称准备时间和固定切削模式，保护退出后的残差需结合实测模式解释。横移RMS目标0.02m/s、深度RMS目标0.15m，未达结果应保留并分析。能耗采用绞刀、横移绞车与推进轴系的机械功口径，土层和设备参数采用已标注适用范围的T级教学值。'] : []),
      '围绕本页实验和已保存证据直接继续指导，学习路径或自适应练习信息缺失时也以本实验上下文为依据。',
      '回答要求：围绕船舶控制物理机理与实验证据启发学生分析；严禁直接代填实验读数、跳过实验步骤或直接给出评分判定。',
    ].join('\n'),
  };
}

function buildDescriptorFromVesselExperiment(
  experiment: VesselExperiment,
  catalogKey: VesselCourseKey,
): SimulationCourseDescriptor {
  const catalogCourse = VESSEL_COURSES[catalogKey];
  const stepsBySeq = new Map<number, { title: string; goal: string; watch: string; suggestion: string; keyConcepts: string[] }>();

  for (const step of catalogCourse.steps) {
    stepsBySeq.set(step.sequence, {
      title: step.title,
      goal: step.evidence,
      watch: step.interaction,
      suggestion: step.condition,
      keyConcepts: VESSEL_KEY_CONCEPTS[catalogKey],
    });
  }

  for (const step of experiment.steps) {
    if (!stepsBySeq.has(step.seq)) {
      stepsBySeq.set(step.seq, {
        title: step.title,
        goal: step.goal,
        watch: step.watch,
        suggestion: step.suggestion,
        keyConcepts: VESSEL_KEY_CONCEPTS[catalogKey],
      });
    }
  }
  if (catalogKey === 'container') {
    const step = stepsBySeq.get(15)!;
    step.watch = '保持同一波场、本人模型和速度计划，关闭与开启T级教学平均附加阻力，比较完整实际航次及燃油。';
    step.suggestion = '短波反射尺度来自ITTC附录G.1，方向扩展和跨装载复用属于教学假设，真实误差尚未校准。';
  }

  return {
    courseId: experiment.courseId,
    courseTitle: catalogCourse.title,
    courseDescription: `${catalogCourse.title}虚拟仿真实验课程，覆盖模型辨识、闭环控制与工况边界验证。`,
    vesselId: experiment.vesselId,
    prefixes: Array.from(new Set([experiment.key, catalogKey])),
    stepsBySeq,
  };
}

function buildDestroyerDescriptor(): SimulationCourseDescriptor {
  const catalogCourse = VESSEL_COURSES.destroyer;
  const stepsBySeq = new Map<number, { title: string; goal: string; watch: string; suggestion: string; keyConcepts: string[] }>();

  for (const step of catalogCourse.steps) {
    stepsBySeq.set(step.sequence, {
      title: step.title,
      goal: step.evidence,
      watch: step.interaction,
      suggestion: step.condition,
      keyConcepts: VESSEL_KEY_CONCEPTS.destroyer,
    });
  }

  for (const step of DESTROYER_EXPERIMENT_STEPS) {
    if (!stepsBySeq.has(step.seq)) {
      stepsBySeq.set(step.seq, {
        title: step.title,
        goal: step.goal,
        watch: step.watch,
        suggestion: step.suggestion,
        keyConcepts: VESSEL_KEY_CONCEPTS.destroyer,
      });
    }
  }

  for (const step of DESTROYER_CURRENT_STEPS) {
    stepsBySeq.set(step.seq, {
      title: step.title,
      goal: step.goal,
      watch: step.watch,
      suggestion: step.suggestion,
      keyConcepts: VESSEL_KEY_CONCEPTS.destroyer,
    });
  }

  return {
    courseId: 'destroyer-heading-experiment',
    courseTitle: DESTROYER_EXPERIMENT_TITLE,
    courseDescription: '055型驱逐舰航向控制全流程虚拟仿真实验，贯穿执行器特性、局部辨识、独立验证、PID 闭环整定与环境扰动边界分析。',
    vesselId: 'destroyer-055',
    prefixes: ['destroyer', 'destroyer-heading'],
    stepsBySeq,
  };
}

function createCourseEntry(descriptor: SimulationCourseDescriptor): SimulationCourseAIEntry {
  const stepContextCache = new Map<string, AIContextConfig>();

  for (let seq = 1; seq <= 20; seq += 1) {
    for (const prefix of descriptor.prefixes) {
      const stepId = `${prefix}-step-${seq}`;
      stepContextCache.set(stepId, buildStepConfig(descriptor, seq, stepId));
    }
  }

  return {
    getStepContext: (stepId: string) => {
      if (stepContextCache.has(stepId)) {
        return stepContextCache.get(stepId) ?? null;
      }
      return null;
    },
    getQuickQuestions: (stepId: string) => stepContextCache.get(stepId)?.quickQuestions ?? [],
    courseMeta: {
      courseId: descriptor.courseId,
      courseTitle: descriptor.courseTitle,
      courseDescription: descriptor.courseDescription,
    },
  };
}

const SIMULATION_DESCRIPTORS: SimulationCourseDescriptor[] = [
  buildDestroyerDescriptor(),
  ...VESSEL_EXPERIMENTS.map((experiment) => {
    const catalogKey = CATALOG_KEY_BY_COURSE_ID[experiment.courseId] ?? 'lng';
    return buildDescriptorFromVesselExperiment(experiment, catalogKey);
  }),
];

const COURSE_ID_TO_VESSEL_ID = new Map<string, string>(
  SIMULATION_DESCRIPTORS.map((descriptor) => [descriptor.courseId, descriptor.vesselId]),
);

export const SIMULATION_COURSE_AI_CONTEXTS: Record<string, SimulationCourseAIEntry> = Object.fromEntries(
  SIMULATION_DESCRIPTORS.map((descriptor) => [descriptor.courseId, createCourseEntry(descriptor)]),
);

export function resolveSimulationVesselIdForCourse(courseId: string): string | null {
  return COURSE_ID_TO_VESSEL_ID.get(courseId.trim()) ?? null;
}

export function resolveSimulationCourseKeyForAI(courseId: string): VesselCourseKey | null {
  return CATALOG_KEY_BY_COURSE_ID[courseId.trim()] ?? null;
}
