
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
