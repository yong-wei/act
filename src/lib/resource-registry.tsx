
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
