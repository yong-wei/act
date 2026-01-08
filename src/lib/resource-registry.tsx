
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
