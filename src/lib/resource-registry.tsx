
import dynamic from 'next/dynamic';
import React, { ComponentType } from 'react';

// 组件配置接口
export interface ResourceComponentConfig {
    id: string;
    label: string;
    type: 'INTERACTIVE_COMP' | 'SIMULATION_APP';
    defaultConfig?: Record<string, any>;
    component: ComponentType<any>;
}

function loadingFallback(label: string) {
    const LoadingFallbackComponent = () => (
        <div className="p-4 text-center text-slate-400">Loading {label}...</div>
    );
    LoadingFallbackComponent.displayName = `LoadingFallback(${label})`;
    return LoadingFallbackComponent;
}

// 动态导入组件
const PidSimulator = dynamic(() => import('@/resources/interactive-learning/pid-simulator/pid-simulator-component').then(mod => mod.PidSimulatorComponent), {
    loading: () => <div className="p-4 text-center text-slate-400">Loading Simulator...</div>
});

const EthicsSandbox = dynamic(() => import('@/features/ethics/ethics-sandbox'), {
     loading: () => <div className="p-4 text-center text-slate-400">Loading Ethics Sandbox...</div>
});

const PhysicsBuilder = dynamic(() => import('@/resources/widgets/physics-builder'), {
    loading: () => <div className="p-4 text-center text-slate-400">Loading Physics Builder...</div>
});

const AnalogyMapper = dynamic(() => import('@/resources/widgets/analogy-mapper'), {
    loading: () => <div className="p-4 text-center text-slate-400">Loading Analogy Mapper...</div>
});

const ArgumentPrinciple = dynamic(() => import('@/resources/widgets/argument-principle'), {
    loading: () => <div className="p-4 text-center text-slate-400">Loading Argument Principle...</div>
});

const Lesson02Bridge = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/standalone-resources').then(mod => mod.Lesson02BridgeResource),
    { loading: loadingFallback('Lesson 02 Bridge') }
);

const Lesson02Objective = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/standalone-resources').then(mod => mod.Lesson02ObjectiveResource),
    { loading: loadingFallback('Lesson 02 Objectives') }
);

const Lesson02Pretest = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/standalone-resources').then(mod => mod.Lesson02PretestResource),
    { loading: loadingFallback('Lesson 02 Pretest') }
);

const Lesson02Mechanical = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/standalone-resources').then(mod => mod.Lesson02MechanicalResource),
    { loading: loadingFallback('Lesson 02 Mechanical') }
);

const Lesson02Electrical = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/standalone-resources').then(mod => mod.Lesson02ElectricalResource),
    { loading: loadingFallback('Lesson 02 Electrical') }
);

const Lesson02Analogy = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/standalone-resources').then(mod => mod.Lesson02AnalogyResource),
    { loading: loadingFallback('Lesson 02 Analogy') }
);

const Lesson02Posttest = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/standalone-resources').then(mod => mod.Lesson02PosttestResource),
    { loading: loadingFallback('Lesson 02 Posttest') }
);

const Lesson02Summary = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/standalone-resources').then(mod => mod.Lesson02SummaryResource),
    { loading: loadingFallback('Lesson 02 Summary') }
);

const PhysicsModelingIntro = dynamic(
    () => import('@/resources/interactive-learning/physics-modeling/standalone-resources').then(mod => mod.PhysicsModelingIntroResource),
    { loading: loadingFallback('Physics Modeling Intro') }
);

const PhysicsModelingMechanical = dynamic(
    () => import('@/resources/interactive-learning/physics-modeling/standalone-resources').then(mod => mod.PhysicsModelingMechanicalResource),
    { loading: loadingFallback('Physics Modeling Mechanical') }
);

const PhysicsModelingElectrical = dynamic(
    () => import('@/resources/interactive-learning/physics-modeling/standalone-resources').then(mod => mod.PhysicsModelingElectricalResource),
    { loading: loadingFallback('Physics Modeling Electrical') }
);

const PhysicsModelingAnalogy = dynamic(
    () => import('@/resources/interactive-learning/physics-modeling/standalone-resources').then(mod => mod.PhysicsModelingAnalogyResource),
    { loading: loadingFallback('Physics Modeling Analogy') }
);

const PhysicsModelingPractice = dynamic(
    () => import('@/resources/interactive-learning/physics-modeling/standalone-resources').then(mod => mod.PhysicsModelingPracticeResource),
    { loading: loadingFallback('Physics Modeling Practice') }
);

// Lesson-06 组件
const Lesson06MetricQuickCheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-06/metric-quick-check'),
    { ssr: false, loading: loadingFallback('指标速判') }
);

const Lesson06MetricHandbook = dynamic(
    () => import('@/resources/interactive-learning/lesson-06/metric-handbook'),
    { ssr: false, loading: loadingFallback('指标裁判手册') }
);

const Lesson06JudgeBench = dynamic(
    () => import('@/resources/interactive-learning/lesson-06/judge-bench-sim'),
    { ssr: false, loading: loadingFallback('裁判席计分器') }
);

// Lesson-13 组件
const Lesson13PhysicsBuilderSimple = dynamic(
    () => import('@/resources/interactive-learning/lesson-13/physics-builder-simple'),
    { ssr: false, loading: loadingFallback('阻尼调节实验') }
);

const Lesson13ISO2631Mapping = dynamic(
    () => import('@/resources/interactive-learning/lesson-13/iso2631-mapping'),
    { ssr: false, loading: loadingFallback('ISO 2631 舒适度映射') }
);

const Lesson13CruiseTyphoonSim = dynamic(
    () => import('@/resources/interactive-learning/lesson-13/cruise-typhoon-sim'),
    { ssr: false, loading: loadingFallback('香槟塔保卫战') }
);

const Lesson13CruiseBridgeVideo = dynamic(
    () => import('@/resources/interactive-learning/lesson-13/cruise-bridge-video'),
    { ssr: false, loading: loadingFallback('邮轮导入视频') }
);

// Lesson-07 组件
const Lesson07DampingQuickCheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-07/damping-quick-check'),
    { ssr: false, loading: loadingFallback('欠阻尼速判') }
);

const Lesson07SecondOrderTheory = dynamic(
    () => import('@/resources/interactive-learning/lesson-07/theory-deck'),
    { ssr: false, loading: loadingFallback('二阶系统标准型') }
);

const Lesson07ResponseExplorer = dynamic(
    () => import('@/resources/interactive-learning/lesson-07/response-explorer'),
    { ssr: false, loading: loadingFallback('衰减振荡实验室') }
);

const Lesson07ParameterChallenge = dynamic(
    () => import('@/resources/interactive-learning/lesson-07/parameter-challenge'),
    { ssr: false, loading: loadingFallback('参数匹配挑战') }
);

const Lesson07SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-07/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-08 组件
const Lesson08StabilityPrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-08/stability-precheck'),
    { ssr: false, loading: loadingFallback('稳定与误差前测') }
);

const Lesson08RouthGuide = dynamic(
    () => import('@/resources/interactive-learning/lesson-08/routh-guide'),
    { ssr: false, loading: loadingFallback('劳斯判据速览') }
);

const Lesson08RouthPractice = dynamic(
    () => import('@/resources/interactive-learning/lesson-08/routh-practice'),
    { ssr: false, loading: loadingFallback('劳斯判据练习') }
);

const Lesson08SteadyErrorDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-08/steady-error-deck'),
    { ssr: false, loading: loadingFallback('稳态误差知识卡') }
);

const Lesson08PostQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-08/post-quiz'),
    { ssr: false, loading: loadingFallback('稳定与误差后测') }
);

const Lesson08SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-08/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-09 组件
const Lesson09CorrectionPrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-09/correction-precheck'),
    { ssr: false, loading: loadingFallback('校正前测') }
);

const Lesson09CorrectionStrategy = dynamic(
    () => import('@/resources/interactive-learning/lesson-09/correction-strategy'),
    { ssr: false, loading: loadingFallback('校正手段速览') }
);

const Lesson09TimeDomainSynthesis = dynamic(
    () => import('@/resources/interactive-learning/lesson-09/time-domain-synthesis'),
    { ssr: false, loading: loadingFallback('时域综合流程') }
);

const Lesson09SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-09/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-10 组件
const Lesson10RootLocusWorkshop = dynamic(
    () => import('@/resources/interactive-learning/lesson-10/root-locus-workshop'),
    { ssr: false, loading: loadingFallback('根轨迹规则工作坊') }
);

// 课堂组件
const ClassroomVideoComponent = dynamic(
    () => import('@/components/classroom').then(mod => mod.VideoComponent),
    { ssr: false, loading: loadingFallback('视频播放组件') }
);

const ClassroomPollComponent = dynamic(
    () => import('@/components/classroom').then(mod => mod.PollComponent),
    { ssr: false, loading: loadingFallback('课堂投票组件') }
);

const ClassroomObjectiveCard = dynamic(
    () => import('@/components/classroom').then(mod => mod.ObjectiveCard),
    { ssr: false, loading: loadingFallback('学习目标展示') }
);

const ClassroomAssessmentProbe = dynamic(
    () => import('@/components/classroom').then(mod => mod.AssessmentProbe),
    { ssr: false, loading: loadingFallback('后测评估探针') }
);

const ClassroomEthicalTrigger = dynamic(
    () => import('@/components/classroom').then(mod => mod.EthicalTrigger),
    { ssr: false, loading: loadingFallback('伦理熔断触发器') }
);

const ClassroomAIDynamicReport = dynamic(
    () => import('@/components/classroom').then(mod => mod.AIDynamicReport),
    { ssr: false, loading: loadingFallback('AI动态报告') }
);

// 十滴水游戏
const TenDropsGame = dynamic(
    () => import('@/resources/interactive-learning/ten-drops-game'),
    { ssr: false, loading: loadingFallback('十滴水游戏') }
);

// Control Odyssey 游戏
const ControlOdysseyGame = dynamic(
    () => import('@/resources/interactive-learning/control-odyssey').then(mod => mod.ControlOdysseyGame),
    { ssr: false, loading: loadingFallback('Control Odyssey') }
);

// 注册表
const registry: Record<string, ResourceComponentConfig> = {
    'sim-pid-v1': {
        id: 'sim-pid-v1',
        label: 'PID Parameter Tuning Simulator',
        type: 'SIMULATION_APP',
        defaultConfig: { kp: 1, ki: 0.1, kd: 0.5, model: 'ship' },
        component: PidSimulator
    },
    'ethics-arctic-v1': {
        id: 'ethics-arctic-v1',
        label: 'Arctic Navigation Ethics Sandbox',
        type: 'INTERACTIVE_COMP',
        defaultConfig: { scenario: 'arctic_collision' },
        component: EthicsSandbox
    },
    'widget-physics-mech': {
        id: 'widget-physics-mech',
        label: 'Physics Builder (Mechanical)',
        type: 'INTERACTIVE_COMP',
        defaultConfig: { mode: 'mechanical', items: ['mass', 'spring', 'damper', 'force'] },
        component: PhysicsBuilder
    },
    'widget-physics-elec': {
        id: 'widget-physics-elec',
        label: 'Physics Builder (Electrical)',
        type: 'INTERACTIVE_COMP',
        defaultConfig: { mode: 'electrical', items: ['resistor', 'inductor', 'capacitor', 'source'] },
        component: PhysicsBuilder
    },
    'widget-analogy-mapper': {
        id: 'widget-analogy-mapper',
        label: 'Analogy Mapper',
        type: 'INTERACTIVE_COMP',
        defaultConfig: { leftEq: "m*x''+f*x'+k*x=F", rightEq: "L*q''+R*q'+(1/C)*q=E" },
        component: AnalogyMapper
    },
    'widget-argument-principle': {
        id: 'widget-argument-principle',
        label: 'Argument Principle (Nyquist)',
        type: 'INTERACTIVE_COMP',
        defaultConfig: { showControls: true },
        component: ArgumentPrinciple
    },
    'lesson02-bridge-v1': {
        id: 'lesson02-bridge-v1',
        label: 'Lesson 02 - Bridge In',
        type: 'INTERACTIVE_COMP',
        component: Lesson02Bridge
    },
    'lesson02-objective-v1': {
        id: 'lesson02-objective-v1',
        label: 'Lesson 02 - Objectives',
        type: 'INTERACTIVE_COMP',
        component: Lesson02Objective
    },
    'lesson02-pretest-v1': {
        id: 'lesson02-pretest-v1',
        label: 'Lesson 02 - Pretest',
        type: 'INTERACTIVE_COMP',
        component: Lesson02Pretest
    },
    'lesson02-mechanical-v1': {
        id: 'lesson02-mechanical-v1',
        label: 'Lesson 02 - Mechanical Modeling',
        type: 'INTERACTIVE_COMP',
        component: Lesson02Mechanical
    },
    'lesson02-electrical-v1': {
        id: 'lesson02-electrical-v1',
        label: 'Lesson 02 - Electrical Modeling',
        type: 'INTERACTIVE_COMP',
        component: Lesson02Electrical
    },
    'lesson02-analogy-v1': {
        id: 'lesson02-analogy-v1',
        label: 'Lesson 02 - Analogy Mapping',
        type: 'INTERACTIVE_COMP',
        component: Lesson02Analogy
    },
    'lesson02-posttest-v1': {
        id: 'lesson02-posttest-v1',
        label: 'Lesson 02 - Posttest',
        type: 'INTERACTIVE_COMP',
        component: Lesson02Posttest
    },
    'lesson02-summary-v1': {
        id: 'lesson02-summary-v1',
        label: 'Lesson 02 - Summary',
        type: 'INTERACTIVE_COMP',
        component: Lesson02Summary
    },
    'physics-modeling-intro-v1': {
        id: 'physics-modeling-intro-v1',
        label: 'Physics Modeling - Intro',
        type: 'INTERACTIVE_COMP',
        component: PhysicsModelingIntro
    },
    'physics-modeling-mechanical-v1': {
        id: 'physics-modeling-mechanical-v1',
        label: 'Physics Modeling - Mechanical',
        type: 'INTERACTIVE_COMP',
        component: PhysicsModelingMechanical
    },
    'physics-modeling-electrical-v1': {
        id: 'physics-modeling-electrical-v1',
        label: 'Physics Modeling - Electrical',
        type: 'INTERACTIVE_COMP',
        component: PhysicsModelingElectrical
    },
    'physics-modeling-analogy-v1': {
        id: 'physics-modeling-analogy-v1',
        label: 'Physics Modeling - Analogy',
        type: 'INTERACTIVE_COMP',
        component: PhysicsModelingAnalogy
    },
    'physics-modeling-practice-v1': {
        id: 'physics-modeling-practice-v1',
        label: 'Physics Modeling - Practice',
        type: 'INTERACTIVE_COMP',
        component: PhysicsModelingPractice
    },
    // Lesson-06 组件
    'lesson06-metric-quick-check': {
        id: 'lesson06-metric-quick-check',
        label: '指标速判',
        type: 'INTERACTIVE_COMP',
        component: Lesson06MetricQuickCheck
    },
    'lesson06-metric-handbook': {
        id: 'lesson06-metric-handbook',
        label: '指标裁判手册',
        type: 'INTERACTIVE_COMP',
        component: Lesson06MetricHandbook
    },
    'lesson06-judge-bench': {
        id: 'lesson06-judge-bench',
        label: '裁判席计分器',
        type: 'INTERACTIVE_COMP',
        component: Lesson06JudgeBench
    },
    // Lesson-13 组件
    'lesson13-physics-builder-simple': {
        id: 'lesson13-physics-builder-simple',
        label: '阻尼调节实验',
        type: 'INTERACTIVE_COMP',
        component: Lesson13PhysicsBuilderSimple
    },
    'lesson13-iso2631-mapping': {
        id: 'lesson13-iso2631-mapping',
        label: 'ISO 2631 舒适度映射',
        type: 'INTERACTIVE_COMP',
        component: Lesson13ISO2631Mapping
    },
    'lesson13-cruise-typhoon-sim': {
        id: 'lesson13-cruise-typhoon-sim',
        label: '香槟塔保卫战',
        type: 'SIMULATION_APP',
        component: Lesson13CruiseTyphoonSim
    },
    'lesson13-cruise-bridge': {
        id: 'lesson13-cruise-bridge',
        label: '邮轮舒适度导入视频',
        type: 'INTERACTIVE_COMP',
        component: Lesson13CruiseBridgeVideo
    },
    // Lesson-07 组件
    'lesson07-damping-quick-check': {
        id: 'lesson07-damping-quick-check',
        label: '欠阻尼速判',
        type: 'INTERACTIVE_COMP',
        component: Lesson07DampingQuickCheck
    },
    'lesson07-second-order-theory': {
        id: 'lesson07-second-order-theory',
        label: '二阶系统标准型知识卡',
        type: 'INTERACTIVE_COMP',
        component: Lesson07SecondOrderTheory
    },
    'lesson07-response-explorer': {
        id: 'lesson07-response-explorer',
        label: '衰减振荡实验室',
        type: 'INTERACTIVE_COMP',
        component: Lesson07ResponseExplorer
    },
    'lesson07-parameter-challenge': {
        id: 'lesson07-parameter-challenge',
        label: '参数匹配挑战',
        type: 'INTERACTIVE_COMP',
        component: Lesson07ParameterChallenge
    },
    'lesson07-summary-card': {
        id: 'lesson07-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson07SummaryCard
    },
    // Lesson-08 组件
    'lesson08-stability-precheck': {
        id: 'lesson08-stability-precheck',
        label: '稳定与误差前测',
        type: 'INTERACTIVE_COMP',
        component: Lesson08StabilityPrecheck
    },
    'lesson08-routh-guide': {
        id: 'lesson08-routh-guide',
        label: '劳斯判据速览',
        type: 'INTERACTIVE_COMP',
        component: Lesson08RouthGuide
    },
    'lesson08-routh-practice': {
        id: 'lesson08-routh-practice',
        label: '劳斯判据练习',
        type: 'INTERACTIVE_COMP',
        component: Lesson08RouthPractice
    },
    'lesson08-steady-error-deck': {
        id: 'lesson08-steady-error-deck',
        label: '稳态误差知识卡',
        type: 'INTERACTIVE_COMP',
        component: Lesson08SteadyErrorDeck
    },
    'lesson08-post-quiz': {
        id: 'lesson08-post-quiz',
        label: '稳定与误差后测',
        type: 'INTERACTIVE_COMP',
        component: Lesson08PostQuiz
    },
    'lesson08-summary-card': {
        id: 'lesson08-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson08SummaryCard
    },
    // Lesson-09 组件
    'lesson09-correction-precheck': {
        id: 'lesson09-correction-precheck',
        label: '校正前测',
        type: 'INTERACTIVE_COMP',
        component: Lesson09CorrectionPrecheck
    },
    'lesson09-correction-strategy': {
        id: 'lesson09-correction-strategy',
        label: '校正手段速览',
        type: 'INTERACTIVE_COMP',
        component: Lesson09CorrectionStrategy
    },
    'lesson09-time-domain-synthesis': {
        id: 'lesson09-time-domain-synthesis',
        label: '时域综合流程',
        type: 'INTERACTIVE_COMP',
        component: Lesson09TimeDomainSynthesis
    },
    'lesson09-summary-card': {
        id: 'lesson09-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson09SummaryCard
    },
    // Lesson-10 组件
    'lesson10-root-locus-workshop': {
        id: 'lesson10-root-locus-workshop',
        label: '根轨迹规则工作坊',
        type: 'INTERACTIVE_COMP',
        component: Lesson10RootLocusWorkshop
    },
    // 课堂组件（教师专用）
    'classroom-video': {
        id: 'classroom-video',
        label: '视频播放组件',
        type: 'INTERACTIVE_COMP',
        component: ClassroomVideoComponent
    },
    'classroom-poll': {
        id: 'classroom-poll',
        label: '课堂投票组件',
        type: 'INTERACTIVE_COMP',
        component: ClassroomPollComponent
    },
    'classroom-objective': {
        id: 'classroom-objective',
        label: '学习目标展示',
        type: 'INTERACTIVE_COMP',
        component: ClassroomObjectiveCard
    },
    'classroom-assessment': {
        id: 'classroom-assessment',
        label: '后测评估探针',
        type: 'INTERACTIVE_COMP',
        component: ClassroomAssessmentProbe
    },
    'classroom-ethical-trigger': {
        id: 'classroom-ethical-trigger',
        label: '伦理熔断触发器',
        type: 'INTERACTIVE_COMP',
        component: ClassroomEthicalTrigger
    },
    'classroom-ai-report': {
        id: 'classroom-ai-report',
        label: 'AI动态报告',
        type: 'INTERACTIVE_COMP',
        component: ClassroomAIDynamicReport
    },
    // 十滴水益智游戏
    'ten-drops-game-v1': {
        id: 'ten-drops-game-v1',
        label: '十滴水益智游戏',
        type: 'INTERACTIVE_COMP',
        defaultConfig: {
            initialLevelId: 'tutorial-1',
            showEducation: true
        },
        component: TenDropsGame
    },
    'control-odyssey-v1': {
        id: 'control-odyssey-v1',
        label: 'Control Odyssey: 穿越误差带',
        type: 'INTERACTIVE_COMP',
        defaultConfig: {
            initialLevelId: 'level-1',
            showEducation: true
        },
        component: ControlOdysseyGame
    }
};

/**
 * 获取注册的组件
 */
export function getRegisteredResource(registryId: string): ResourceComponentConfig | undefined {
    return registry[registryId];
}

/**
 * 获取所有注册资源列表（供编辑器选择）
 */
export function getAllRegisteredResources() {
    return Object.values(registry).map(({ id, label, type, defaultConfig }) => ({
        id, label, type, defaultConfig
    }));
}
