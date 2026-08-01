import type { ResourceNodePlanningOverride } from './resource-node-registry';

export interface RegisteredResourceMetadata {
    id: string;
    label: string;
    type: 'INTERACTIVE_COMP' | 'SIMULATION_APP';
    renderTarget?: string | null;
    launchTarget?: string | null;
    knowledgeNodeIds?: string[];
    prerequisiteNodeIds?: string[];
    planningOverride?: ResourceNodePlanningOverride;
    defaultConfig?: Record<string, unknown>;
}

type RegisteredResourceMetadataPatch = Partial<RegisteredResourceMetadata>;

const registeredResourceMetadata: Record<string, RegisteredResourceMetadata> = {
    'sim-pid-v1': {
        id: 'sim-pid-v1',
        label: 'PID Parameter Tuning Simulator',
        type: 'SIMULATION_APP',
        defaultConfig: { kp: 1, ki: 0.1, kd: 0.5, model: 'ship' }
    },
    'sim-scene-cruise': {
        id: 'sim-scene-cruise',
        label: '邮轮横摇控制仿真课程资源',
        type: 'SIMULATION_APP',
        defaultConfig: {
            resourceKind: 'simulation-scene',
            sceneId: 'cruise',
            launchMode: 'route',
            telemetryPolicy: 'course-context',
            governanceContext: { source: 'simulation-course-resource' }
        }
    },
    'sim-scene-destroyer': {
        id: 'sim-scene-destroyer',
        label: '驱逐舰航向控制仿真课程资源',
        type: 'SIMULATION_APP',
        defaultConfig: {
            resourceKind: 'simulation-scene',
            sceneId: 'destroyer',
            launchMode: 'route',
            telemetryPolicy: 'course-context',
            governanceContext: { source: 'simulation-course-resource' }
        }
    },
    'sim-scene-dredger': {
        id: 'sim-scene-dredger',
        label: '挖泥船动力定位仿真课程资源',
        type: 'SIMULATION_APP',
        defaultConfig: {
            resourceKind: 'simulation-scene',
            sceneId: 'dredger',
            launchMode: 'route',
            telemetryPolicy: 'course-context',
            governanceContext: { source: 'simulation-course-resource' }
        }
    },
    'sim-scene-drilling': {
        id: 'sim-scene-drilling',
        label: '钻井平台定位仿真课程资源',
        type: 'SIMULATION_APP',
        defaultConfig: {
            resourceKind: 'simulation-scene',
            sceneId: 'drilling',
            launchMode: 'route',
            telemetryPolicy: 'course-context',
            governanceContext: { source: 'simulation-course-resource' }
        }
    },
    'sim-scene-icebreaker': {
        id: 'sim-scene-icebreaker',
        label: '破冰船航行控制仿真课程资源',
        type: 'SIMULATION_APP',
        defaultConfig: {
            resourceKind: 'simulation-scene',
            sceneId: 'icebreaker',
            launchMode: 'route',
            telemetryPolicy: 'course-context',
            governanceContext: { source: 'simulation-course-resource' }
        }
    },
    'sim-scene-lng': {
        id: 'sim-scene-lng',
        label: 'LNG 船晃荡抑制仿真课程资源',
        type: 'SIMULATION_APP',
        defaultConfig: {
            resourceKind: 'simulation-scene',
            sceneId: 'lng',
            launchMode: 'route',
            telemetryPolicy: 'course-context',
            governanceContext: { source: 'simulation-course-resource' }
        }
    },
    'sim-scene-container': {
        id: 'sim-scene-container',
        label: '集装箱船航迹保持仿真课程资源',
        type: 'SIMULATION_APP',
        defaultConfig: {
            resourceKind: 'simulation-scene',
            sceneId: 'container',
            launchMode: 'route',
            telemetryPolicy: 'course-context',
            governanceContext: { source: 'simulation-course-resource' }
        }
    },
    'arena-challenge-workbench': {
        id: 'arena-challenge-workbench',
        label: 'Arena 挑战工作台课程资源',
        type: 'SIMULATION_APP',
        launchTarget: '/arena/challenges/task-second-order-lead-pid',
        defaultConfig: {
            resourceKind: 'arena-workbench',
            arenaTaskId: 'task-second-order-lead-pid',
            launchMode: 'route',
            telemetryPolicy: 'arena-course-context',
            sourcePathOrUrl: 'src/lib/arena-path-target-integrity.ts',
            sourceHash: 'sha256:a6cf058391795bb1519adb2784460dc4ff9ab3d571b617ce404220f538e1ca5e',
            sourceVersionRef: 'arena-path-target-integrity.v1',
            governanceContext: { source: 'arena-course-resource' }
        }
    },
    'arena-cruise-blackbox-workbench': {
        id: 'arena-cruise-blackbox-workbench',
        label: '邮轮黑箱辨识 Arena 课程资源',
        type: 'SIMULATION_APP',
        launchTarget: '/arena/challenges/task-cruise-roll-blackbox-identification',
        defaultConfig: {
            resourceKind: 'arena-workbench',
            sceneId: 'cruise',
            arenaTaskId: 'task-cruise-roll-blackbox-identification',
            routeHref: '/simulations/cruise',
            launchMode: 'route',
            telemetryPolicy: 'arena-course-context',
            sourcePathOrUrl: 'src/lib/arena-path-target-integrity.ts',
            sourceHash: 'sha256:a6cf058391795bb1519adb2784460dc4ff9ab3d571b617ce404220f538e1ca5e',
            sourceVersionRef: 'arena-path-target-integrity.v1',
            governanceContext: { source: 'arena-course-resource' }
        }
    },
    'ethics-arctic-v1': {
        id: 'ethics-arctic-v1',
        label: 'Arctic Navigation Ethics Sandbox',
        type: 'INTERACTIVE_COMP',
        defaultConfig: { scenario: 'arctic_collision' }
    },
    'widget-physics-mech': {
        id: 'widget-physics-mech',
        label: 'Physics Builder (Mechanical)',
        type: 'INTERACTIVE_COMP',
        defaultConfig: { mode: 'mechanical', items: ['mass', 'spring', 'damper', 'force'] }
    },
    'widget-physics-elec': {
        id: 'widget-physics-elec',
        label: 'Physics Builder (Electrical)',
        type: 'INTERACTIVE_COMP',
        defaultConfig: { mode: 'electrical', items: ['resistor', 'inductor', 'capacitor', 'source'] }
    },
    'widget-analogy-mapper': {
        id: 'widget-analogy-mapper',
        label: 'Analogy Mapper',
        type: 'INTERACTIVE_COMP',
        defaultConfig: { leftEq: "m*x''+f*x'+k*x=F", rightEq: "L*q''+R*q'+(1/C)*q=E" }
    },
    'widget-argument-principle': {
        id: 'widget-argument-principle',
        label: 'Argument Principle (Nyquist)',
        type: 'INTERACTIVE_COMP',
        defaultConfig: { showControls: true }
    },
    'lesson02-legacy-bridge-v1': {
        id: 'lesson02-legacy-bridge-v1',
        label: 'Lesson 02 Legacy - Bridge In',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-objective-v1': {
        id: 'lesson02-legacy-objective-v1',
        label: 'Lesson 02 Legacy - Objectives',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-pretest-v1': {
        id: 'lesson02-legacy-pretest-v1',
        label: 'Lesson 02 Legacy - Pretest',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-mechanical-v1': {
        id: 'lesson02-legacy-mechanical-v1',
        label: 'Lesson 02 Legacy - Mechanical Modeling',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-electrical-v1': {
        id: 'lesson02-legacy-electrical-v1',
        label: 'Lesson 02 Legacy - Electrical Modeling',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-analogy-v1': {
        id: 'lesson02-legacy-analogy-v1',
        label: 'Lesson 02 Legacy - Analogy Mapping',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-posttest-v1': {
        id: 'lesson02-legacy-posttest-v1',
        label: 'Lesson 02 Legacy - Posttest',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-summary-v1': {
        id: 'lesson02-legacy-summary-v1',
        label: 'Lesson 02 Legacy - Summary',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-bridge-v1': {
        id: 'lesson02-bridge-v1',
        label: 'Lesson 02 - Bridge In',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-objective-v1': {
        id: 'lesson02-objective-v1',
        label: 'Lesson 02 - Objectives',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-pretest-v1': {
        id: 'lesson02-pretest-v1',
        label: 'Lesson 02 - Pretest',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-mechanical-v1': {
        id: 'lesson02-mechanical-v1',
        label: 'Lesson 02 - Mechanical Modeling',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-electrical-v1': {
        id: 'lesson02-electrical-v1',
        label: 'Lesson 02 - Electrical Modeling',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-analogy-v1': {
        id: 'lesson02-analogy-v1',
        label: 'Lesson 02 - Analogy Mapping',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-posttest-v1': {
        id: 'lesson02-posttest-v1',
        label: 'Lesson 02 - Posttest',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-summary-v1': {
        id: 'lesson02-summary-v1',
        label: 'Lesson 02 - Summary',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-modeling-handout-v1': {
        id: 'lesson02-modeling-handout-v1',
        label: 'Lesson 02 Modeling Handout',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-nyquist-stability-quiz-v1': {
        id: 'lesson02-nyquist-stability-quiz-v1',
        label: 'Lesson 02 Nyquist Stability Quiz',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-bridge-media-v1': {
        id: 'lesson02-legacy-bridge-media-v1',
        label: 'Lesson 02 Legacy Bridge Media',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-objectives-handout-v1': {
        id: 'lesson02-legacy-objectives-handout-v1',
        label: 'Lesson 02 Legacy Objectives Handout',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-pretest-laws-v1': {
        id: 'lesson02-legacy-pretest-laws-v1',
        label: 'Lesson 02 Legacy Pretest Laws',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-launcher-modeling-challenge-v1': {
        id: 'lesson02-legacy-launcher-modeling-challenge-v1',
        label: 'Lesson 02 Legacy Launcher Modeling Challenge',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-legacy-summary-notes-v1': {
        id: 'lesson02-legacy-summary-notes-v1',
        label: 'Lesson 02 Legacy Summary Notes',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-laplace-bridge-v1': {
        id: 'lesson02-laplace-bridge-v1',
        label: 'Lesson 02 - Laplace Bridge',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-laplace-objective-v1': {
        id: 'lesson02-laplace-objective-v1',
        label: 'Lesson 02 - Laplace Objectives',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-laplace-precheck-v1': {
        id: 'lesson02-laplace-precheck-v1',
        label: 'Lesson 02 - Laplace Precheck',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-laplace-knowledge-deck-v1': {
        id: 'lesson02-laplace-knowledge-deck-v1',
        label: 'Lesson 02 - Laplace Knowledge Deck',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-laplace-property-match-v1': {
        id: 'lesson02-laplace-property-match-v1',
        label: 'Lesson 02 - Laplace Property Match',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-laplace-inverse-lab-v1': {
        id: 'lesson02-laplace-inverse-lab-v1',
        label: 'Lesson 02 - Laplace Inverse Lab',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-laplace-exit-quiz-v1': {
        id: 'lesson02-laplace-exit-quiz-v1',
        label: 'Lesson 02 - Laplace Exit Quiz',
        type: 'INTERACTIVE_COMP'
    },
    'lesson02-laplace-summary-v1': {
        id: 'lesson02-laplace-summary-v1',
        label: 'Lesson 02 - Laplace Summary',
        type: 'INTERACTIVE_COMP'
    },
    'lesson01-feedback-bridge-v1': {
        id: 'lesson01-feedback-bridge-v1',
        label: 'Lesson 01 - Feedback Bridge',
        type: 'INTERACTIVE_COMP'
    },
    'lesson01-feedback-objective-v1': {
        id: 'lesson01-feedback-objective-v1',
        label: 'Lesson 01 - Feedback Objectives',
        type: 'INTERACTIVE_COMP'
    },
    'lesson01-feedback-precheck-v1': {
        id: 'lesson01-feedback-precheck-v1',
        label: 'Lesson 01 - Feedback Precheck',
        type: 'INTERACTIVE_COMP'
    },
    'lesson01-feedback-knowledge-deck-v1': {
        id: 'lesson01-feedback-knowledge-deck-v1',
        label: 'Lesson 01 - Feedback Knowledge Deck',
        type: 'INTERACTIVE_COMP'
    },
    'lesson01-component-role-match-v1': {
        id: 'lesson01-component-role-match-v1',
        label: 'Lesson 01 - Component Role Match',
        type: 'INTERACTIVE_COMP'
    },
    'lesson01-loop-scenario-lab-v1': {
        id: 'lesson01-loop-scenario-lab-v1',
        label: 'Lesson 01 - Loop Scenario Lab',
        type: 'INTERACTIVE_COMP'
    },
    'lesson01-feedback-exit-quiz-v1': {
        id: 'lesson01-feedback-exit-quiz-v1',
        label: 'Lesson 01 - Feedback Exit Quiz',
        type: 'INTERACTIVE_COMP'
    },
    'lesson01-feedback-summary-v1': {
        id: 'lesson01-feedback-summary-v1',
        label: 'Lesson 01 - Feedback Summary',
        type: 'INTERACTIVE_COMP'
    },
    'physics-modeling-intro-v1': {
        id: 'physics-modeling-intro-v1',
        label: 'Physics Modeling - Intro',
        type: 'INTERACTIVE_COMP'
    },
    'physics-modeling-mechanical-v1': {
        id: 'physics-modeling-mechanical-v1',
        label: 'Physics Modeling - Mechanical',
        type: 'INTERACTIVE_COMP'
    },
    'physics-modeling-electrical-v1': {
        id: 'physics-modeling-electrical-v1',
        label: 'Physics Modeling - Electrical',
        type: 'INTERACTIVE_COMP'
    },
    'physics-modeling-analogy-v1': {
        id: 'physics-modeling-analogy-v1',
        label: 'Physics Modeling - Analogy',
        type: 'INTERACTIVE_COMP'
    },
    'physics-modeling-practice-v1': {
        id: 'physics-modeling-practice-v1',
        label: 'Physics Modeling - Practice',
        type: 'INTERACTIVE_COMP'
    },
    'lesson06-metric-quick-check': {
        id: 'lesson06-metric-quick-check',
        label: '指标速判',
        type: 'INTERACTIVE_COMP'
    },
    'lesson06-metric-handbook': {
        id: 'lesson06-metric-handbook',
        label: '指标裁判手册',
        type: 'INTERACTIVE_COMP'
    },
    'lesson06-judge-bench': {
        id: 'lesson06-judge-bench',
        label: '裁判席计分器',
        type: 'INTERACTIVE_COMP'
    },
    'lesson07-static-classification': {
        id: 'lesson07-static-classification',
        label: '二阶系统传递函数与分类',
        type: 'INTERACTIVE_COMP'
    },
    'lesson07-static-step-response': {
        id: 'lesson07-static-step-response',
        label: '单位阶跃响应与指标',
        type: 'INTERACTIVE_COMP'
    },
    'lesson08-static-roadmap': {
        id: 'lesson08-static-roadmap',
        label: '课程路线图：稳定与稳态误差',
        type: 'INTERACTIVE_COMP'
    },
    'lesson08-static-stability-concept': {
        id: 'lesson08-static-stability-concept',
        label: '稳定性的概念与充要条件',
        type: 'INTERACTIVE_COMP'
    },
    'lesson08-static-routh-table': {
        id: 'lesson08-static-routh-table',
        label: '劳斯表构造与判别步骤',
        type: 'INTERACTIVE_COMP'
    },
    'lesson08-static-error-flow': {
        id: 'lesson08-static-error-flow',
        label: '稳态误差计算流程',
        type: 'INTERACTIVE_COMP'
    },
    'lesson09-static-roadmap': {
        id: 'lesson09-static-roadmap',
        label: '课程路线图：校正与时域综合',
        type: 'INTERACTIVE_COMP'
    },
    'lesson09-static-pd-feedback': {
        id: 'lesson09-static-pd-feedback',
        label: '比例-微分控制 vs 输出微分反馈',
        type: 'INTERACTIVE_COMP'
    },
    'lesson09-static-feedforward-disturbance': {
        id: 'lesson09-static-feedforward-disturbance',
        label: '前馈补偿与扰动补偿',
        type: 'INTERACTIVE_COMP'
    },
    'lesson09-static-time-domain-workflow': {
        id: 'lesson09-static-time-domain-workflow',
        label: '航向系统时域综合流程',
        type: 'INTERACTIVE_COMP'
    },
    'lesson13-physics-builder-simple': {
        id: 'lesson13-physics-builder-simple',
        label: '阻尼调节实验',
        type: 'INTERACTIVE_COMP'
    },
    'lesson13-iso2631-mapping': {
        id: 'lesson13-iso2631-mapping',
        label: 'ISO 2631 舒适度映射',
        type: 'INTERACTIVE_COMP'
    },
    'lesson13-cruise-typhoon-sim': {
        id: 'lesson13-cruise-typhoon-sim',
        label: '香槟塔保卫战',
        type: 'SIMULATION_APP'
    },
    'lesson13-cruise-bridge': {
        id: 'lesson13-cruise-bridge',
        label: '邮轮舒适度导入视频',
        type: 'INTERACTIVE_COMP'
    },
    'lesson13-phase-concept-quiz': {
        id: 'lesson13-phase-concept-quiz',
        label: '幅相概念速判',
        type: 'INTERACTIVE_COMP'
    },
    'lesson13-phase-knowledge-deck': {
        id: 'lesson13-phase-knowledge-deck',
        label: '幅相特性知识卡片',
        type: 'INTERACTIVE_COMP'
    },
    'lesson13-nyquist-stability-scenario': {
        id: 'lesson13-nyquist-stability-scenario',
        label: 'Nyquist 判稳场景',
        type: 'INTERACTIVE_COMP'
    },
    'lesson13-phase-stability-exit-quiz': {
        id: 'lesson13-phase-stability-exit-quiz',
        label: '对数判据速测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson13-summary-card': {
        id: 'lesson13-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson14-margin-quick-check': {
        id: 'lesson14-margin-quick-check',
        label: '稳定裕度速判',
        type: 'INTERACTIVE_COMP'
    },
    'lesson14-margin-knowledge-deck': {
        id: 'lesson14-margin-knowledge-deck',
        label: '稳定裕度与三频段知识卡片',
        type: 'INTERACTIVE_COMP'
    },
    'lesson14-margin-tradeoff-lab': {
        id: 'lesson14-margin-tradeoff-lab',
        label: '稳定裕度策略实验室',
        type: 'INTERACTIVE_COMP'
    },
    'lesson14-three-band-studio': {
        id: 'lesson14-three-band-studio',
        label: '三频段调优工作台',
        type: 'INTERACTIVE_COMP'
    },
    'lesson14-margin-exit-quiz': {
        id: 'lesson14-margin-exit-quiz',
        label: '稳定裕度后测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson14-summary-card': {
        id: 'lesson14-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson15-series-precheck': {
        id: 'lesson15-series-precheck',
        label: '串联校正速判',
        type: 'INTERACTIVE_COMP'
    },
    'lesson15-series-knowledge-deck': {
        id: 'lesson15-series-knowledge-deck',
        label: '串联校正与滞后超前知识卡片',
        type: 'INTERACTIVE_COMP'
    },
    'lesson15-series-strategy-lab': {
        id: 'lesson15-series-strategy-lab',
        label: '串联校正策略实验室',
        type: 'INTERACTIVE_COMP'
    },
    'lesson15-lag-lead-workshop': {
        id: 'lesson15-lag-lead-workshop',
        label: '滞后-超前流程拼图',
        type: 'INTERACTIVE_COMP'
    },
    'lesson15-series-exit-quiz': {
        id: 'lesson15-series-exit-quiz',
        label: '滞后超前速测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson15-summary-card': {
        id: 'lesson15-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson16-nonlinear-precheck': {
        id: 'lesson16-nonlinear-precheck',
        label: '非线性速判',
        type: 'INTERACTIVE_COMP'
    },
    'lesson16-nonlinear-knowledge-deck': {
        id: 'lesson16-nonlinear-knowledge-deck',
        label: '非线性与描述函数知识卡片',
        type: 'INTERACTIVE_COMP'
    },
    'lesson16-nonlinear-feature-match': {
        id: 'lesson16-nonlinear-feature-match',
        label: '非线性特性识别',
        type: 'INTERACTIVE_COMP'
    },
    'lesson16-harmonic-linearization-guide': {
        id: 'lesson16-harmonic-linearization-guide',
        label: '谐波线性化导航',
        type: 'INTERACTIVE_COMP'
    },
    'lesson16-nonlinear-exit-quiz': {
        id: 'lesson16-nonlinear-exit-quiz',
        label: '非线性基础后测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson16-summary-card': {
        id: 'lesson16-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson17-df-precheck': {
        id: 'lesson17-df-precheck',
        label: '描述函数判别速查',
        type: 'INTERACTIVE_COMP'
    },
    'lesson17-df-knowledge-deck': {
        id: 'lesson17-df-knowledge-deck',
        label: '描述函数分析知识卡片',
        type: 'INTERACTIVE_COMP'
    },
    'lesson17-negative-inverse-workshop': {
        id: 'lesson17-negative-inverse-workshop',
        label: '负倒描述函数工作坊',
        type: 'INTERACTIVE_COMP'
    },
    'lesson17-limit-cycle-lab': {
        id: 'lesson17-limit-cycle-lab',
        label: '自振判别实验室',
        type: 'INTERACTIVE_COMP'
    },
    'lesson17-df-exit-quiz': {
        id: 'lesson17-df-exit-quiz',
        label: '自振判别后测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson17-summary-card': {
        id: 'lesson17-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson03-diff-precheck': {
        id: 'lesson03-diff-precheck',
        label: '微分方程速判',
        type: 'INTERACTIVE_COMP'
    },
    'lesson03-diff-knowledge-deck': {
        id: 'lesson03-diff-knowledge-deck',
        label: '微分方程建模知识卡片',
        type: 'INTERACTIVE_COMP'
    },
    'lesson03-modeling-scenario-lab': {
        id: 'lesson03-modeling-scenario-lab',
        label: '建模场景决策',
        type: 'INTERACTIVE_COMP'
    },
    'lesson03-modeling-workflow-puzzle': {
        id: 'lesson03-modeling-workflow-puzzle',
        label: '建模流程拼图',
        type: 'INTERACTIVE_COMP'
    },
    'lesson03-diff-exit-quiz': {
        id: 'lesson03-diff-exit-quiz',
        label: '基础模型速测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson03-summary-card': {
        id: 'lesson03-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson04-transfer-precheck': {
        id: 'lesson04-transfer-precheck',
        label: '传递函数前测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson04-transfer-knowledge-deck': {
        id: 'lesson04-transfer-knowledge-deck',
        label: '传递函数知识卡片',
        type: 'INTERACTIVE_COMP'
    },
    'lesson04-transfer-derivation-lab': {
        id: 'lesson04-transfer-derivation-lab',
        label: '传函推导演练',
        type: 'INTERACTIVE_COMP'
    },
    'lesson04-transfer-element-workshop': {
        id: 'lesson04-transfer-element-workshop',
        label: '典型环节工作坊',
        type: 'INTERACTIVE_COMP'
    },
    'lesson04-transfer-exit-quiz': {
        id: 'lesson04-transfer-exit-quiz',
        label: '传递函数后测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson04-summary-card': {
        id: 'lesson04-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson05-block-diagram-precheck': {
        id: 'lesson05-block-diagram-precheck',
        label: '结构图速判',
        type: 'INTERACTIVE_COMP'
    },
    'lesson05-structure-knowledge-deck': {
        id: 'lesson05-structure-knowledge-deck',
        label: '结构图与拓扑知识卡片',
        type: 'INTERACTIVE_COMP'
    },
    'lesson05-block-diagram-workshop': {
        id: 'lesson05-block-diagram-workshop',
        label: '结构图化简路线',
        type: 'INTERACTIVE_COMP'
    },
    'lesson05-signal-flow-lab': {
        id: 'lesson05-signal-flow-lab',
        label: '信号流图速练',
        type: 'INTERACTIVE_COMP'
    },
    'lesson05-mason-loop-challenge': {
        id: 'lesson05-mason-loop-challenge',
        label: '梅森公式数圈圈',
        type: 'INTERACTIVE_COMP'
    },
    'lesson05-structure-exit-quiz': {
        id: 'lesson05-structure-exit-quiz',
        label: '结构图与梅森公式后测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson05-summary-card': {
        id: 'lesson05-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson07-damping-quick-check': {
        id: 'lesson07-damping-quick-check',
        label: '欠阻尼速判',
        type: 'INTERACTIVE_COMP'
    },
    'lesson07-second-order-theory': {
        id: 'lesson07-second-order-theory',
        label: '二阶系统标准型知识卡',
        type: 'INTERACTIVE_COMP'
    },
    'lesson07-pole-manipulator': {
        id: 'lesson07-pole-manipulator',
        label: '极点操纵器',
        type: 'INTERACTIVE_COMP'
    },
    'lesson07-response-explorer': {
        id: 'lesson07-response-explorer',
        label: '衰减振荡实验室',
        type: 'INTERACTIVE_COMP'
    },
    'lesson07-parameter-challenge': {
        id: 'lesson07-parameter-challenge',
        label: '参数匹配挑战',
        type: 'INTERACTIVE_COMP'
    },
    'lesson07-summary-card': {
        id: 'lesson07-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson08-stability-precheck': {
        id: 'lesson08-stability-precheck',
        label: '稳定与误差前测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson08-routh-guide': {
        id: 'lesson08-routh-guide',
        label: '劳斯判据速览',
        type: 'INTERACTIVE_COMP'
    },
    'lesson08-routh-practice': {
        id: 'lesson08-routh-practice',
        label: '劳斯判据练习',
        type: 'INTERACTIVE_COMP'
    },
    'lesson08-steady-error-deck': {
        id: 'lesson08-steady-error-deck',
        label: '稳态误差知识卡',
        type: 'INTERACTIVE_COMP'
    },
    'lesson08-post-quiz': {
        id: 'lesson08-post-quiz',
        label: '稳定与误差后测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson08-summary-card': {
        id: 'lesson08-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson09-correction-precheck': {
        id: 'lesson09-correction-precheck',
        label: '校正前测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson09-correction-strategy': {
        id: 'lesson09-correction-strategy',
        label: '校正手段速览',
        type: 'INTERACTIVE_COMP'
    },
    'lesson09-time-domain-synthesis': {
        id: 'lesson09-time-domain-synthesis',
        label: '时域综合流程',
        type: 'INTERACTIVE_COMP'
    },
    'lesson09-summary-card': {
        id: 'lesson09-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson10-root-locus-workshop': {
        id: 'lesson10-root-locus-workshop',
        label: '根轨迹规则工作坊',
        type: 'INTERACTIVE_COMP'
    },
    'lesson10-static-roadmap': {
        id: 'lesson10-static-roadmap',
        label: '课程路线图：根轨迹法',
        type: 'INTERACTIVE_COMP'
    },
    'lesson10-static-conditions': {
        id: 'lesson10-static-conditions',
        label: '根轨迹条件：模值与相角',
        type: 'INTERACTIVE_COMP'
    },
    'lesson10-static-rules': {
        id: 'lesson10-static-rules',
        label: '根轨迹基本法则',
        type: 'INTERACTIVE_COMP'
    },
    'lesson10-static-detail-corrections': {
        id: 'lesson10-static-detail-corrections',
        label: '根轨迹细节修正',
        type: 'INTERACTIVE_COMP'
    },
    'lesson11-parameter-root-locus-deck': {
        id: 'lesson11-parameter-root-locus-deck',
        label: '参数根轨迹知识卡',
        type: 'INTERACTIVE_COMP'
    },
    'lesson11-graphical-thinking-workshop': {
        id: 'lesson11-graphical-thinking-workshop',
        label: '图形化思考工作坊',
        type: 'INTERACTIVE_COMP'
    },
    'lesson11-summary-card': {
        id: 'lesson11-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson11-static-roadmap': {
        id: 'lesson11-static-roadmap',
        label: '课程路线图：参数根轨迹',
        type: 'INTERACTIVE_COMP'
    },
    'lesson11-static-equivalent-open-loop': {
        id: 'lesson11-static-equivalent-open-loop',
        label: '等效开环变换步骤',
        type: 'INTERACTIVE_COMP'
    },
    'lesson11-static-visual-workflow': {
        id: 'lesson11-static-visual-workflow',
        label: '图形化思考到仿真验证',
        type: 'INTERACTIVE_COMP'
    },
    'lesson12-frequency-precheck': {
        id: 'lesson12-frequency-precheck',
        label: '频率响应速判',
        type: 'INTERACTIVE_COMP'
    },
    'lesson12-bode-step-sorter': {
        id: 'lesson12-bode-step-sorter',
        label: '伯德图绘制步骤',
        type: 'INTERACTIVE_COMP'
    },
    'lesson12-bode-slope-puzzle': {
        id: 'lesson12-bode-slope-puzzle',
        label: '斜率叠加拼图',
        type: 'INTERACTIVE_COMP'
    },
    'lesson12-bode-plot-recognition': {
        id: 'lesson12-bode-plot-recognition',
        label: '伯德图识别练习',
        type: 'INTERACTIVE_COMP'
    },
    'lesson12-bode-post-quiz': {
        id: 'lesson12-bode-post-quiz',
        label: '伯德图后测',
        type: 'INTERACTIVE_COMP'
    },
    'lesson12-summary-card': {
        id: 'lesson12-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP'
    },
    'lesson12-static-roadmap': {
        id: 'lesson12-static-roadmap',
        label: '课程路线图：频率特性与伯德图',
        type: 'INTERACTIVE_COMP'
    },
    'lesson12-static-frequency-response': {
        id: 'lesson12-static-frequency-response',
        label: '频率响应定义',
        type: 'INTERACTIVE_COMP'
    },
    'lesson12-static-bode-steps': {
        id: 'lesson12-static-bode-steps',
        label: '伯德图绘制步骤',
        type: 'INTERACTIVE_COMP'
    },
    'classroom-video': {
        id: 'classroom-video',
        label: '视频播放组件',
        type: 'INTERACTIVE_COMP'
    },
    'classroom-poll': {
        id: 'classroom-poll',
        label: '课堂投票组件',
        type: 'INTERACTIVE_COMP'
    },
    'classroom-objective': {
        id: 'classroom-objective',
        label: '学习目标展示',
        type: 'INTERACTIVE_COMP'
    },
    'classroom-assessment': {
        id: 'classroom-assessment',
        label: '后测评估探针',
        type: 'INTERACTIVE_COMP'
    },
    'classroom-ethical-trigger': {
        id: 'classroom-ethical-trigger',
        label: '伦理熔断触发器',
        type: 'INTERACTIVE_COMP'
    },
    'classroom-ai-report': {
        id: 'classroom-ai-report',
        label: 'AI动态报告',
        type: 'INTERACTIVE_COMP'
    },
    'ten-drops-game-v1': {
        id: 'ten-drops-game-v1',
        label: '十滴水益智游戏',
        type: 'INTERACTIVE_COMP',
        defaultConfig: {
            initialLevelId: 'tutorial-1',
            showEducation: true
        }
    },
    'control-odyssey-v1': {
        id: 'control-odyssey-v1',
        label: 'Control Odyssey: 穿越误差带',
        type: 'INTERACTIVE_COMP',
        defaultConfig: {
            initialLevelId: 'level-1',
            showEducation: true
        }
    }
};

const registeredResourceProgressionMetadata = buildRegisteredResourceProgressionMetadata();
const registeredResourceOperationalMetadata: Record<string, RegisteredResourceMetadataPatch> = {
    'sim-pid-v1': simulationReadiness('registry:lesson15-lag-lead-workshop', '先完成滞后-超前流程拼图，再进入 PID 参数整定仿真。'),
    'sim-scene-cruise': simulationReadiness('registry:lesson13-iso2631-mapping', '先完成 ISO 2631 舒适度映射，再进入邮轮横摇控制仿真。'),
    'sim-scene-destroyer': simulationReadiness('registry:lesson13-physics-builder-simple', '先完成阻尼调节实验，再进入驱逐舰航向控制仿真。'),
    'sim-scene-dredger': simulationReadiness('registry:lesson13-physics-builder-simple', '先完成阻尼调节实验，再进入挖泥船动力定位仿真。'),
    'sim-scene-drilling': simulationReadiness('registry:lesson13-physics-builder-simple', '先完成阻尼调节实验，再进入钻井平台定位仿真。'),
    'sim-scene-icebreaker': simulationReadiness('registry:lesson13-physics-builder-simple', '先完成阻尼调节实验，再进入破冰船航行控制仿真。'),
    'sim-scene-lng': simulationReadiness('registry:lesson13-physics-builder-simple', '先完成阻尼调节实验，再进入 LNG 船晃荡抑制仿真。'),
    'sim-scene-container': simulationReadiness('registry:lesson13-physics-builder-simple', '先完成阻尼调节实验，再进入集装箱船航迹保持仿真。'),
    'lesson13-cruise-typhoon-sim': simulationReadiness('registry:lesson13-iso2631-mapping', '先完成 ISO 2631 舒适度映射，再进入香槟塔保卫战。'),
    'classroom-video': readyResource(),
    'classroom-poll': readyResource(),
    'classroom-objective': readyResource(),
    'classroom-assessment': readyResource(),
    'classroom-ethical-trigger': readyResource(),
    'classroom-ai-report': readyResource(),
    'ten-drops-game-v1': readyResource(),
    'control-odyssey-v1': readyResource(),
};

const registeredResourceSemanticMetadata: Record<string, Partial<RegisteredResourceMetadata>> = {
    'lesson01-feedback-bridge-v1': {
        knowledgeNodeIds: ['反馈控制系统_1_98dc667a', '自动控制系统_1_9678f418'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['lesson_bridge_view', 'interaction_complete'],
            abilityImpact: { controlModeling: 0.12, inquiryReflection: 0.08 }
        }
    },
    'lesson01-feedback-objective-v1': {
        knowledgeNodeIds: ['反馈控制系统_1_98dc667a', '闭环控制_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            evidenceInstrumentation: ['learning_objective_view'],
            abilityImpact: { selfDirectedLearning: 0.12 }
        }
    },
    'lesson01-feedback-precheck-v1': {
        knowledgeNodeIds: ['反馈_1_1', '开环控制_1_1', '闭环控制_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson01-feedback-knowledge-deck-v1': {
        knowledgeNodeIds: ['反馈控制系统_1_98dc667a', '负反馈控制原理_1_5a06114b'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.22 }
        }
    },
    'lesson01-component-role-match-v1': {
        knowledgeNodeIds: ['控制器_1_1', '执行元件_1_c14acc57', '被控对象_1_d156fc34', '比较元件_1_ec1f7070'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['match_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.22, diagnosticAssessment: 0.12 }
        }
    },
    'lesson01-loop-scenario-lab-v1': {
        knowledgeNodeIds: ['闭环控制_1_1', '反馈控制系统_1_98dc667a', '扰动_1_1cebf383'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['scenario_lab_submit', 'interaction_complete'],
            abilityImpact: { controlModeling: 0.22, engineeringDecision: 0.18 }
        }
    },
    'lesson01-feedback-exit-quiz-v1': {
        knowledgeNodeIds: ['反馈控制系统_1_98dc667a', '负反馈控制原理_1_5a06114b'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson01-feedback-summary-v1': {
        knowledgeNodeIds: ['反馈控制系统_1_98dc667a', '课程总图_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { selfDirectedLearning: 0.1, inquiryReflection: 0.1 }
        }
    },
    'lesson02-laplace-bridge-v1': {
        knowledgeNodeIds: ['拉氏变换_2_243496d4', '微分方程_2_775c96a3'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['lesson_bridge_view', 'interaction_complete'],
            abilityImpact: { controlModeling: 0.14 }
        }
    },
    'lesson02-laplace-objective-v1': {
        knowledgeNodeIds: ['拉氏变换工程动机_2_11001', '零初值传递函数_2_21001'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            evidenceInstrumentation: ['learning_objective_view'],
            abilityImpact: { selfDirectedLearning: 0.12 }
        }
    },
    'lesson02-laplace-precheck-v1': {
        knowledgeNodeIds: ['拉氏变换_2_243496d4', '微分定理_2_11002', '零初值传递函数_2_21001'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson02-laplace-knowledge-deck-v1': {
        knowledgeNodeIds: ['拉氏变换工程动机_2_11001', '传递函数_2_2c5e2589', '零初值传递函数_2_21001'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.24 }
        }
    },
    'lesson02-laplace-property-match-v1': {
        knowledgeNodeIds: ['微分定理_2_11002', '拉普拉斯变换法_2_8c311472'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['match_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.18, diagnosticAssessment: 0.12 }
        }
    },
    'lesson02-laplace-inverse-lab-v1': {
        knowledgeNodeIds: ['传递函数的零点和极点_2_638a0ea8', '零极点分布图_2_2fd76677'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['lab_submit', 'interaction_complete'],
            abilityImpact: { controlModeling: 0.22, parameterDesign: 0.12 }
        }
    },
    'lesson02-laplace-exit-quiz-v1': {
        knowledgeNodeIds: ['传递函数_2_2c5e2589', '零初值传递函数_2_21001'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson02-laplace-summary-v1': {
        knowledgeNodeIds: ['拉氏变换工程动机_2_11001', '传递函数_2_2c5e2589'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { selfDirectedLearning: 0.1, inquiryReflection: 0.1 }
        }
    },
    'lesson02-legacy-bridge-v1': {
        knowledgeNodeIds: ['模型结构相似性_1_2', '机理建模_1_2'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_resource_view'],
            abilityImpact: { inquiryReflection: 0.08 }
        }
    },
    'lesson02-legacy-objective-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '模型结构相似性_1_2'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_resource_view'],
            abilityImpact: { selfDirectedLearning: 0.08 }
        }
    },
    'lesson02-legacy-pretest-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '微分方程_2_775c96a3', '相似系统_2_5477df89'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_answer_submit'],
            abilityImpact: { diagnosticAssessment: 0.16, controlModeling: 0.08 }
        }
    },
    'lesson02-legacy-mechanical-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_widget_interaction'],
            abilityImpact: { controlModeling: 0.16 }
        }
    },
    'lesson02-legacy-electrical-v1': {
        knowledgeNodeIds: ['无源网络_2_71a8b325', '微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_widget_interaction'],
            abilityImpact: { controlModeling: 0.16 }
        }
    },
    'lesson02-legacy-analogy-v1': {
        knowledgeNodeIds: ['相似系统_2_5477df89', '模型结构相似性_1_2', '系统模型转换_1_18f4b178'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_analogy_submit'],
            abilityImpact: { controlModeling: 0.14, crossDomainTransfer: 0.12 }
        }
    },
    'lesson02-legacy-posttest-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '微分方程_2_775c96a3', '相似系统_2_5477df89'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_answer_submit'],
            abilityImpact: { diagnosticAssessment: 0.18, controlModeling: 0.08 }
        }
    },
    'lesson02-legacy-summary-v1': {
        knowledgeNodeIds: ['模型结构相似性_1_2', '系统模型转换_1_18f4b178'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_resource_view'],
            abilityImpact: { inquiryReflection: 0.08, selfDirectedLearning: 0.08 }
        }
    },
    'lesson02-bridge-v1': {
        knowledgeNodeIds: ['模型结构相似性_1_2', '机理建模_1_2'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_resource_view'],
            abilityImpact: { inquiryReflection: 0.08 }
        }
    },
    'lesson02-objective-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '模型结构相似性_1_2'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_resource_view'],
            abilityImpact: { selfDirectedLearning: 0.08 }
        }
    },
    'lesson02-pretest-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '微分方程_2_775c96a3', '相似系统_2_5477df89'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_answer_submit'],
            abilityImpact: { diagnosticAssessment: 0.16, controlModeling: 0.08 }
        }
    },
    'lesson02-mechanical-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_widget_interaction'],
            abilityImpact: { controlModeling: 0.16 }
        }
    },
    'lesson02-electrical-v1': {
        knowledgeNodeIds: ['无源网络_2_71a8b325', '微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_widget_interaction'],
            abilityImpact: { controlModeling: 0.16 }
        }
    },
    'lesson02-analogy-v1': {
        knowledgeNodeIds: ['相似系统_2_5477df89', '模型结构相似性_1_2', '系统模型转换_1_18f4b178'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_analogy_submit'],
            abilityImpact: { controlModeling: 0.14, crossDomainTransfer: 0.12 }
        }
    },
    'lesson02-posttest-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '微分方程_2_775c96a3', '相似系统_2_5477df89'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_answer_submit'],
            abilityImpact: { diagnosticAssessment: 0.18, controlModeling: 0.08 }
        }
    },
    'lesson02-summary-v1': {
        knowledgeNodeIds: ['模型结构相似性_1_2', '系统模型转换_1_18f4b178'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_resource_view'],
            abilityImpact: { inquiryReflection: 0.08, selfDirectedLearning: 0.08 }
        }
    },
    'lesson02-modeling-handout-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '微分方程_2_775c96a3', '无源网络_2_71a8b325'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            availability: 'archived',
            teacherPolicy: 'teacher-assigned',
            evidenceInstrumentation: ['static_text_view'],
            abilityImpact: { controlModeling: 0.12, selfDirectedLearning: 0.08 }
        }
    },
    'lesson02-nyquist-stability-quiz-v1': {
        knowledgeNodeIds: ['奈奎斯特稳定判据_奈氏判据__5_0355b06b', '频域响应_1_1', '稳定性_3_72d04fbd'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            availability: 'archived',
            teacherPolicy: 'teacher-assigned',
            evidenceInstrumentation: ['answer_submit'],
            abilityImpact: { diagnosticAssessment: 0.14, controlModeling: 0.08 }
        }
    },
    'lesson02-legacy-bridge-media-v1': {
        knowledgeNodeIds: ['模型结构相似性_1_2', '机理建模_1_2'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_resource_view'],
            abilityImpact: { inquiryReflection: 0.08 }
        }
    },
    'lesson02-legacy-objectives-handout-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '模型结构相似性_1_2'],
        planningOverride: {
            estimatedTimeMinutes: 4,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_resource_view'],
            abilityImpact: { selfDirectedLearning: 0.08 }
        }
    },
    'lesson02-legacy-pretest-laws-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '微分方程_2_775c96a3'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_answer_submit'],
            abilityImpact: { diagnosticAssessment: 0.12, controlModeling: 0.08 }
        }
    },
    'lesson02-legacy-launcher-modeling-challenge-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_answer_submit'],
            abilityImpact: { controlModeling: 0.14, engineeringDecision: 0.08 }
        }
    },
    'lesson02-legacy-summary-notes-v1': {
        knowledgeNodeIds: ['二阶系统_3_3a0af45b', '机理建模_1_2'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            availability: 'archived',
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['legacy_resource_view'],
            abilityImpact: { inquiryReflection: 0.08, selfDirectedLearning: 0.08 }
        }
    },
    'physics-modeling-intro-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['resource_open', 'interaction_complete'],
            abilityImpact: { controlModeling: 0.12, inquiryReflection: 0.08 }
        }
    },
    'physics-modeling-mechanical-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['model_build_submit', 'widget_interaction_complete'],
            abilityImpact: { controlModeling: 0.24, engineeringDecision: 0.12 }
        }
    },
    'physics-modeling-electrical-v1': {
        knowledgeNodeIds: ['无源网络_2_71a8b325', '微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['model_build_submit', 'widget_interaction_complete'],
            abilityImpact: { controlModeling: 0.24, engineeringDecision: 0.12 }
        }
    },
    'physics-modeling-analogy-v1': {
        knowledgeNodeIds: ['相似系统_2_5477df89', '模型结构相似性_1_2', '系统模型转换_1_18f4b178'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['analogy_match_submit', 'widget_interaction_complete'],
            abilityImpact: { controlModeling: 0.2, crossDomainTransfer: 0.16 }
        }
    },
    'physics-modeling-practice-v1': {
        knowledgeNodeIds: ['机理建模_1_2', '动态数学模型_2_b7f98344', '相似系统_2_5477df89'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['practice_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.24, diagnosticAssessment: 0.14 }
        }
    },
    'ethics-arctic-v1': {
        knowledgeNodeIds: ['工程指标代价函数翻译_4_47003', '剩余风险说明_4_45006'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['ethics_scenario_submit', 'reflection_submit'],
            abilityImpact: { engineeringDecision: 0.24, inquiryReflection: 0.18 }
        }
    },
    'widget-physics-mech': {
        knowledgeNodeIds: ['机理建模_1_2', '微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['widget_interaction_complete', 'model_build_submit'],
            abilityImpact: { controlModeling: 0.26, engineeringDecision: 0.12 }
        }
    },
    'widget-physics-elec': {
        knowledgeNodeIds: ['无源网络_2_71a8b325', '微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['widget_interaction_complete', 'model_build_submit'],
            abilityImpact: { controlModeling: 0.26, engineeringDecision: 0.12 }
        }
    },
    'widget-analogy-mapper': {
        knowledgeNodeIds: ['相似系统_2_5477df89', '模型结构相似性_1_2', '系统模型转换_1_18f4b178'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['analogy_match_submit', 'widget_interaction_complete'],
            abilityImpact: { controlModeling: 0.2, crossDomainTransfer: 0.18 }
        }
    },
    'widget-argument-principle': {
        knowledgeNodeIds: ['奈奎斯特与Bode统一判稳链_3_38002', '稳定性_3_72d04fbd', '频域响应_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['nyquist_workspace_submit', 'widget_interaction_complete'],
            abilityImpact: { controlModeling: 0.2, engineeringDecision: 0.22, parameterDesign: 0.16 }
        }
    },
    'lesson03-diff-precheck': {
        knowledgeNodeIds: ['微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson03-diff-knowledge-deck': {
        knowledgeNodeIds: ['微分方程_2_775c96a3', '动态数学模型_2_b7f98344', '机理建模_1_2'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.24 }
        }
    },
    'lesson03-modeling-scenario-lab': {
        knowledgeNodeIds: ['机理建模_1_2', '动态数学模型_2_b7f98344', '船舶航向控制对象_2_21004'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['scenario_lab_submit', 'model_build_submit'],
            abilityImpact: { controlModeling: 0.26, engineeringDecision: 0.16 }
        }
    },
    'lesson03-modeling-workflow-puzzle': {
        knowledgeNodeIds: ['数学模型_2_b21e01f6', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['workflow_sort_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.18, diagnosticAssessment: 0.1 }
        }
    },
    'lesson03-diff-exit-quiz': {
        knowledgeNodeIds: ['微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson03-summary-card': {
        knowledgeNodeIds: ['微分方程_2_775c96a3', '动态数学模型_2_b7f98344'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'lesson04-transfer-precheck': {
        knowledgeNodeIds: ['传递函数_2_2c5e2589', '零初值传递函数_2_21001'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson04-transfer-knowledge-deck': {
        knowledgeNodeIds: ['传递函数_2_2c5e2589', '传递函数标准形式_2_11003', '零初值传递函数_2_21001'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.24 }
        }
    },
    'lesson04-transfer-derivation-lab': {
        knowledgeNodeIds: ['零初值传递函数_2_21001', '传递函数_2_2c5e2589', '开环传递函数定义_2_12002'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['derivation_submit', 'workspace_complete'],
            abilityImpact: { controlModeling: 0.26, parameterDesign: 0.12 }
        }
    },
    'lesson04-transfer-element-workshop': {
        knowledgeNodeIds: ['比例环节_2_11004', '积分环节_2_11005', '微分环节_2_11006', '惯性环节_2_11007'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['workshop_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.22, diagnosticAssessment: 0.1 }
        }
    },
    'lesson04-transfer-exit-quiz': {
        knowledgeNodeIds: ['传递函数_2_2c5e2589', '零初值传递函数_2_21001'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson04-summary-card': {
        knowledgeNodeIds: ['传递函数_2_2c5e2589', '零初值传递函数_2_21001'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'lesson05-block-diagram-precheck': {
        knowledgeNodeIds: ['结构图_2_3f312ccc', '方框图_1_2'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson05-structure-knowledge-deck': {
        knowledgeNodeIds: ['结构图_2_3f312ccc', '结构图等效变换_2_12001', '闭环传递函数_2_5399c369'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.24 }
        }
    },
    'lesson05-block-diagram-workshop': {
        knowledgeNodeIds: ['结构图等效变换_2_12001', '串联连接_2_98ee18bc', '反馈连接_2_40a881cb'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['workshop_submit', 'diagram_transform_submit'],
            abilityImpact: { controlModeling: 0.25, engineeringDecision: 0.12 }
        }
    },
    'lesson05-signal-flow-lab': {
        knowledgeNodeIds: ['信号流图_2_372d4084', '梅森增益公式_2_419eab0c'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['signal_flow_submit', 'workspace_complete'],
            abilityImpact: { controlModeling: 0.24, parameterDesign: 0.12 }
        }
    },
    'lesson05-mason-loop-challenge': {
        knowledgeNodeIds: ['梅森增益公式_2_419eab0c', '余子式接触判定_2_21003'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['challenge_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.2, diagnosticAssessment: 0.16, engineeringDecision: 0.12 }
        }
    },
    'lesson05-structure-exit-quiz': {
        knowledgeNodeIds: ['结构图_2_3f312ccc', '梅森增益公式_2_419eab0c'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson05-summary-card': {
        knowledgeNodeIds: ['结构图_2_3f312ccc', '信号流图_2_372d4084', '梅森增益公式_2_419eab0c'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'lesson06-metric-quick-check': {
        knowledgeNodeIds: ['性能指标_1_1', '动态性能指标_3_a10733c1'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson06-metric-handbook': {
        knowledgeNodeIds: ['动态性能指标_3_a10733c1', '上升时间_3_6fa0ec00', '峰值时间_3_adc7ea95'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['handbook_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.2, selfDirectedLearning: 0.1 }
        }
    },
    'lesson06-judge-bench': {
        knowledgeNodeIds: ['动态性能指标_3_a10733c1', '时域响应_1_1', '稳态误差_3_c0207063'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['judge_bench_submit', 'answer_submit'],
            abilityImpact: { diagnosticAssessment: 0.18, engineeringDecision: 0.18, controlModeling: 0.16 }
        }
    },
    'lesson07-static-classification': {
        knowledgeNodeIds: ['二阶系统_3_3a0af45b', '二阶系统标准型_3_L2a'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.12 }
        }
    },
    'lesson07-static-step-response': {
        knowledgeNodeIds: ['单位阶跃响应_3_04fc55dc', '动态性能指标_3_a10733c1'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.12, diagnosticAssessment: 0.08 }
        }
    },
    'lesson08-static-roadmap': {
        knowledgeNodeIds: ['稳定性_3_72d04fbd', '稳态误差_3_c0207063'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { selfDirectedLearning: 0.08, inquiryReflection: 0.08 }
        }
    },
    'lesson08-static-stability-concept': {
        knowledgeNodeIds: ['稳定性_3_72d04fbd', '线性系统稳定的充分必要条件_3_530c07d0'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.12 }
        }
    },
    'lesson08-static-routh-table': {
        knowledgeNodeIds: ['劳斯判据_3_e3500ac9', '劳斯-赫尔维茨稳定判据_3_34d8fbe7'],
        planningOverride: {
            estimatedTimeMinutes: 7,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.14 }
        }
    },
    'lesson08-static-error-flow': {
        knowledgeNodeIds: ['稳态误差_3_c0207063', '系统型别_3_5573c2c3'],
        planningOverride: {
            estimatedTimeMinutes: 7,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.12, parameterDesign: 0.08 }
        }
    },
    'lesson09-static-roadmap': {
        knowledgeNodeIds: ['时域指标到目标极点区域_3_36001', '根轨迹增益换算_3_4b1d9e6c'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { inquiryReflection: 0.08, selfDirectedLearning: 0.08 }
        }
    },
    'lesson09-static-pd-feedback': {
        knowledgeNodeIds: ['PD与测速反馈的等效阻尼对比_3_35003', '测速反馈控制_3_4c2ec80f'],
        planningOverride: {
            estimatedTimeMinutes: 7,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { parameterDesign: 0.12, controlModeling: 0.1 }
        }
    },
    'lesson09-static-feedforward-disturbance': {
        knowledgeNodeIds: ['复合控制_3_a1570156', '扰动作用下的稳态误差_3_5c9fcfe1'],
        planningOverride: {
            estimatedTimeMinutes: 7,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { engineeringDecision: 0.12, parameterDesign: 0.08 }
        }
    },
    'lesson09-static-time-domain-workflow': {
        knowledgeNodeIds: ['时域指标到目标极点区域_3_36001', '目标驱动测速反馈校正_3_36003'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { parameterDesign: 0.14, engineeringDecision: 0.1 }
        }
    },
    'lesson07-damping-quick-check': {
        knowledgeNodeIds: ['二阶系统_3_3a0af45b', '欠阻尼二阶系统_3_242477a2'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson07-second-order-theory': {
        knowledgeNodeIds: ['二阶系统标准型_3_L2a', '无阻尼自然频率_3_13001', '最佳阻尼比_3_L2b002'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.24 }
        }
    },
    'lesson07-pole-manipulator': {
        knowledgeNodeIds: ['极点配置_3_d367ec42', '主导极点_3_4c4c6bbd', '时域指标到极点参数映射_3_13003'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['pole_workspace_submit', 'interaction_complete'],
            abilityImpact: { controlModeling: 0.22, parameterDesign: 0.18 }
        }
    },
    'lesson07-response-explorer': {
        knowledgeNodeIds: ['单位阶跃响应_3_04fc55dc', '欠阻尼响应_3_c2d57b37', '时域响应包络_3_Lsum002'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['response_explorer_submit', 'simulation_run'],
            abilityImpact: { controlModeling: 0.22, engineeringDecision: 0.12 }
        }
    },
    'lesson07-parameter-challenge': {
        knowledgeNodeIds: ['时域指标到极点参数映射_3_13003', '动态性能指标_3_a10733c1'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['challenge_submit', 'answer_submit'],
            abilityImpact: { parameterDesign: 0.24, diagnosticAssessment: 0.14 }
        }
    },
    'lesson07-summary-card': {
        knowledgeNodeIds: ['二阶系统_3_3a0af45b', '时域指标到极点参数映射_3_13003'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'lesson08-stability-precheck': {
        knowledgeNodeIds: ['稳定性_3_72d04fbd', '劳斯判据_3_e3500ac9'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson08-routh-guide': {
        knowledgeNodeIds: ['劳斯判据_3_e3500ac9', '劳斯-赫尔维茨稳定判据_3_34d8fbe7'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['guide_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.22 }
        }
    },
    'lesson08-routh-practice': {
        knowledgeNodeIds: ['劳斯判据_3_e3500ac9', '劳斯表特殊情况_3_f787433f'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['routh_table_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.2, diagnosticAssessment: 0.18 }
        }
    },
    'lesson08-steady-error-deck': {
        knowledgeNodeIds: ['稳态误差_3_c0207063', '系统型别_3_5573c2c3', '动态误差系数_3_b5d0306a'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.22, parameterDesign: 0.12 }
        }
    },
    'lesson08-post-quiz': {
        knowledgeNodeIds: ['稳定性_3_72d04fbd', '劳斯判据_3_e3500ac9', '稳态误差_3_c0207063'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson08-summary-card': {
        knowledgeNodeIds: ['稳定性_3_72d04fbd', '稳态误差_3_c0207063'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'sim-pid-v1': {
        knowledgeNodeIds: ['比例控制_1_1', '比例-积分控制器_3_2d540516', '比例-微分控制器_3_3b512e79'],
        planningOverride: {
            estimatedTimeMinutes: 20,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run', 'simulation_trace_verified'],
            abilityImpact: { parameterDesign: 0.3, engineeringDecision: 0.2, controlModeling: 0.18 }
        }
    },
    'sim-scene-cruise': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '反馈控制系统_1_98dc667a', '船舶航向控制对象_2_21004'],
        planningOverride: {
            estimatedTimeMinutes: 25,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run', 'simulation_trace_verified'],
            abilityImpact: { engineeringDecision: 0.3, crossDomainTransfer: 0.22, controlModeling: 0.18 }
        }
    },
    'sim-scene-destroyer': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '船舶航向控制对象_2_21004', '系统模型转换_1_18f4b178'],
        planningOverride: {
            estimatedTimeMinutes: 25,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run', 'simulation_trace_verified'],
            abilityImpact: { engineeringDecision: 0.3, crossDomainTransfer: 0.24, controlModeling: 0.18 }
        }
    },
    'sim-scene-dredger': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '系统模型转换_1_18f4b178', '反馈控制系统_1_98dc667a'],
        planningOverride: {
            estimatedTimeMinutes: 25,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run', 'simulation_trace_verified'],
            abilityImpact: { engineeringDecision: 0.3, crossDomainTransfer: 0.24, controlModeling: 0.18 }
        }
    },
    'sim-scene-drilling': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '系统模型转换_1_18f4b178', '反馈控制系统_1_98dc667a'],
        planningOverride: {
            estimatedTimeMinutes: 25,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run', 'simulation_trace_verified'],
            abilityImpact: { engineeringDecision: 0.3, crossDomainTransfer: 0.24, controlModeling: 0.18 }
        }
    },
    'sim-scene-icebreaker': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '系统模型转换_1_18f4b178', '反馈控制系统_1_98dc667a'],
        planningOverride: {
            estimatedTimeMinutes: 25,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run', 'simulation_trace_verified'],
            abilityImpact: { engineeringDecision: 0.3, crossDomainTransfer: 0.24, controlModeling: 0.18 }
        }
    },
    'sim-scene-lng': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '系统模型转换_1_18f4b178', '反馈控制系统_1_98dc667a'],
        planningOverride: {
            estimatedTimeMinutes: 25,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run', 'simulation_trace_verified'],
            abilityImpact: { engineeringDecision: 0.3, crossDomainTransfer: 0.24, controlModeling: 0.18 }
        }
    },
    'sim-scene-container': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '系统模型转换_1_18f4b178', '反馈控制系统_1_98dc667a'],
        planningOverride: {
            estimatedTimeMinutes: 25,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run', 'simulation_trace_verified'],
            abilityImpact: { engineeringDecision: 0.3, crossDomainTransfer: 0.24, controlModeling: 0.18 }
        }
    },
    'arena-challenge-workbench': {
        knowledgeNodeIds: ['control-correction:arena-transfer'],
        prerequisiteNodeIds: ['registry:lesson09-summary-card'],
        planningOverride: {
            estimatedTimeMinutes: 22,
            cognitiveLoad: 'high',
            privacyLevel: 'student-visible',
            terminalConstraints: ['terminal-validation'],
            evidenceInstrumentation: ['arena_workspace_start', 'arena_evaluation_complete'],
            pathDisposition: {
                kind: 'path-plannable',
                reviewStatus: 'human-confirmed',
                rationale: '已核验二阶超前校正 Arena 的规范任务身份、启动路由、证据契约与终端校验职责。',
                sourceFamily: 'arena_task',
                stableSourceRef: 'task-second-order-lead-pid',
                sourceVersionRef: 'arena-path-target-integrity.v1',
                reviewBatchId: 'full-resource-semantic-closure-884.v1',
                parentResourceNodeId: null,
                reviewedAt: '2026-07-18T04:30:00.000Z',
                reviewerId: 'full-resource-semantic-closure-reviewer'
            },
            readiness: {
                minimumCompetency: { parameterDesign: 0.3, engineeringDecision: 0.3 },
                minimumEvidenceCount: 2,
                requiredCompletedNodeIds: ['registry:lesson09-summary-card'],
                requiredOutcomeRefs: ['simulation_run:lesson09-time-domain-synthesis'],
                unlockMessage: '先完成至少一次可复核的仿真验证，再进入 Arena 终点校验。',
                fallbackNodeIds: ['registry:lesson09-summary-card']
            },
            abilityImpact: { crossDomainTransfer: 0.3, engineeringDecision: 0.24, parameterDesign: 0.18 }
        }
    },
    'arena-cruise-blackbox-workbench': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '船舶航向控制对象_2_21004'],
        planningOverride: {
            estimatedTimeMinutes: 24,
            cognitiveLoad: 'high',
            privacyLevel: 'student-visible',
            terminalConstraints: ['terminal-validation'],
            evidenceInstrumentation: ['arena_workspace_start', 'arena_evaluation_complete'],
            pathDisposition: {
                kind: 'path-plannable',
                reviewStatus: 'human-confirmed',
                rationale: '已核验邮轮黑箱 Arena 的规范任务身份、启动路由、证据契约与有界补救入口。',
                sourceFamily: 'arena_task',
                stableSourceRef: 'task-cruise-roll-blackbox-identification',
                sourceVersionRef: 'arena-path-target-integrity.v1',
                reviewBatchId: 'full-resource-semantic-closure-884.v1',
                parentResourceNodeId: null,
                reviewedAt: '2026-07-18T04:30:00.000Z',
                reviewerId: 'full-resource-semantic-closure-reviewer'
            },
            readiness: {
                minimumCompetency: { controlModeling: 0.3, engineeringDecision: 0.3 },
                minimumEvidenceCount: 2,
                requiredCompletedNodeIds: [],
                requiredOutcomeRefs: [],
                unlockMessage: '先完成串联校正预检并补充对象建模与仿真证据，再进入邮轮黑箱 Arena 终点校验。',
                fallbackNodeIds: ['registry:lesson15-series-precheck']
            },
            abilityImpact: { crossDomainTransfer: 0.32, engineeringDecision: 0.24, controlModeling: 0.18 }
        }
    },
    'lesson09-correction-precheck': {
        knowledgeNodeIds: ['时域指标到目标极点区域_3_36001', '根轨迹增益换算_3_4b1d9e6c'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { parameterDesign: 0.2, diagnosticAssessment: 0.18 }
        }
    },
    'lesson09-correction-strategy': {
        knowledgeNodeIds: ['时域指标到目标极点区域_3_36001', '根轨迹增益换算_3_4b1d9e6c'],
        prerequisiteNodeIds: ['registry:lesson09-correction-precheck'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['strategy_card_view', 'interaction_complete'],
            abilityImpact: { parameterDesign: 0.26, engineeringDecision: 0.16 },
            readiness: {
                minimumCompetency: {},
                minimumEvidenceCount: 0,
                requiredCompletedNodeIds: ['registry:lesson09-correction-precheck'],
                requiredOutcomeRefs: [],
                unlockMessage: '先完成控制校正目标前测，再进入校正手段速览。',
                fallbackNodeIds: ['registry:lesson09-correction-precheck']
            }
        }
    },
    'lesson09-time-domain-synthesis': {
        knowledgeNodeIds: ['时域指标到目标极点区域_3_36001', '对象化三域验证_3_56cb3a4e'],
        prerequisiteNodeIds: ['registry:lesson09-correction-precheck'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['synthesis_submit', 'simulation_trace_verified'],
            abilityImpact: { controlModeling: 0.25, parameterDesign: 0.3, engineeringDecision: 0.2 },
            readiness: {
                minimumCompetency: { controlModeling: 0.35 },
                minimumEvidenceCount: 2,
                requiredCompletedNodeIds: ['registry:lesson09-correction-precheck'],
                requiredOutcomeRefs: [],
                unlockMessage: '先完成控制校正目标前测，再进入时域综合。',
                fallbackNodeIds: ['registry:lesson09-correction-precheck']
            }
        }
    },
    'lesson09-summary-card': {
        knowledgeNodeIds: ['根轨迹增益换算_3_4b1d9e6c', '对象化三域验证_3_56cb3a4e'],
        prerequisiteNodeIds: ['registry:lesson09-time-domain-synthesis'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.12, selfDirectedLearning: 0.12 },
            readiness: {
                minimumCompetency: {},
                minimumEvidenceCount: 0,
                requiredCompletedNodeIds: ['registry:lesson09-time-domain-synthesis'],
                requiredOutcomeRefs: [],
                unlockMessage: '先完成时域综合流程，再回顾课程总结卡。',
                fallbackNodeIds: ['registry:lesson09-time-domain-synthesis']
            }
        }
    },
    'lesson10-root-locus-workshop': {
        knowledgeNodeIds: ['根轨迹法_4_4e598387', '根轨迹绘制法则_4_f0ea9a49', '根轨迹方程_4_bc893f65'],
        planningOverride: {
            estimatedTimeMinutes: 20,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['root_locus_workspace_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.24, parameterDesign: 0.22, engineeringDecision: 0.12 }
        }
    },
    'lesson10-static-roadmap': {
        knowledgeNodeIds: ['根轨迹法_4_4e598387', '根轨迹图_4_290e12b6'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { inquiryReflection: 0.08, selfDirectedLearning: 0.08 }
        }
    },
    'lesson10-static-conditions': {
        knowledgeNodeIds: ['根轨迹方程_4_bc893f65', '幅值条件_3_2d5b92ac', '相角条件_4_597a8cf7'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.14, parameterDesign: 0.08 }
        }
    },
    'lesson10-static-rules': {
        knowledgeNodeIds: ['根轨迹绘制法则_4_f0ea9a49', '根轨迹图_4_290e12b6'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.14 }
        }
    },
    'lesson10-static-detail-corrections': {
        knowledgeNodeIds: ['根轨迹绘制法则_4_f0ea9a49', '根轨迹绘制法则_零度__4_205342a7'],
        planningOverride: {
            estimatedTimeMinutes: 7,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.12, diagnosticAssessment: 0.08 }
        }
    },
    'lesson11-parameter-root-locus-deck': {
        knowledgeNodeIds: ['参数根轨迹_4_faab3aea', '广义根轨迹_4_30f5ea13', '根轨迹增益换算_3_4b1d9e6c'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.22, parameterDesign: 0.14 }
        }
    },
    'lesson11-graphical-thinking-workshop': {
        knowledgeNodeIds: ['根轨迹图_4_290e12b6', '关键节点读图_3_8b2f0d12', '根轨迹与虚轴交点_4_65c288cc'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['graphical_workspace_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.2, engineeringDecision: 0.18, diagnosticAssessment: 0.12 }
        }
    },
    'lesson11-summary-card': {
        knowledgeNodeIds: ['参数根轨迹_4_faab3aea', '根轨迹图_4_290e12b6'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'lesson11-static-roadmap': {
        knowledgeNodeIds: ['参数根轨迹_4_faab3aea', '广义根轨迹_4_30f5ea13'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { inquiryReflection: 0.08, selfDirectedLearning: 0.08 }
        }
    },
    'lesson11-static-equivalent-open-loop': {
        knowledgeNodeIds: ['参数根轨迹_4_faab3aea', '根轨迹增益换算_3_4b1d9e6c'],
        planningOverride: {
            estimatedTimeMinutes: 7,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.12, parameterDesign: 0.1 }
        }
    },
    'lesson11-static-visual-workflow': {
        knowledgeNodeIds: ['根轨迹图_4_290e12b6', '关键节点读图_3_8b2f0d12'],
        planningOverride: {
            estimatedTimeMinutes: 7,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { engineeringDecision: 0.1, controlModeling: 0.12 }
        }
    },
    'lesson12-frequency-precheck': {
        knowledgeNodeIds: ['Bode图_1_1', '频域响应_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson12-bode-step-sorter': {
        knowledgeNodeIds: ['Bode图_1_1', '频域响应_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['sequence_sort_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.18, diagnosticAssessment: 0.1 }
        }
    },
    'lesson12-bode-slope-puzzle': {
        knowledgeNodeIds: ['Bode图_1_1', '频域响应_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['puzzle_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.22, parameterDesign: 0.12 }
        }
    },
    'lesson12-bode-plot-recognition': {
        knowledgeNodeIds: ['Bode图_1_1', '频域响应_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['recognition_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.22, diagnosticAssessment: 0.12 }
        }
    },
    'lesson12-bode-post-quiz': {
        knowledgeNodeIds: ['Bode图_1_1', '频域响应_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.14 }
        }
    },
    'lesson12-summary-card': {
        knowledgeNodeIds: ['Bode图_1_1', '频域响应_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'lesson12-static-roadmap': {
        knowledgeNodeIds: ['Bode图_1_1', '频域响应_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 5,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { inquiryReflection: 0.08, selfDirectedLearning: 0.08 }
        }
    },
    'lesson12-static-frequency-response': {
        knowledgeNodeIds: ['频域响应_1_1', '频率特性_5_404adfdd'],
        planningOverride: {
            estimatedTimeMinutes: 7,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.12 }
        }
    },
    'lesson12-static-bode-steps': {
        knowledgeNodeIds: ['Bode图_1_1', 'Bode首轮骨架_5_1e07d9da'],
        planningOverride: {
            estimatedTimeMinutes: 7,
            evidenceInstrumentation: ['static_media_view'],
            abilityImpact: { controlModeling: 0.12, diagnosticAssessment: 0.08 }
        }
    },
    'lesson13-physics-builder-simple': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '系统模型转换_1_18f4b178', '微分方程_2_775c96a3'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'medium',
            evidenceInstrumentation: ['model_build_submit', 'widget_interaction_complete'],
            abilityImpact: { controlModeling: 0.24, crossDomainTransfer: 0.12 }
        }
    },
    'lesson13-iso2631-mapping': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '动态性能指标_3_a10733c1'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['mapping_submit', 'answer_submit'],
            abilityImpact: { engineeringDecision: 0.18, controlModeling: 0.12 }
        }
    },
    'lesson13-cruise-typhoon-sim': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '船舶航向控制对象_2_21004', '反馈控制系统_1_98dc667a'],
        planningOverride: {
            estimatedTimeMinutes: 24,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run', 'simulation_trace_verified'],
            abilityImpact: { engineeringDecision: 0.3, crossDomainTransfer: 0.22, controlModeling: 0.18 }
        }
    },
    'lesson13-cruise-bridge': {
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e', '船舶航向控制对象_2_21004'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['lesson_bridge_view', 'interaction_complete'],
            abilityImpact: { inquiryReflection: 0.1, engineeringDecision: 0.1 }
        }
    },
    'lesson13-phase-concept-quiz': {
        knowledgeNodeIds: ['相角裕度_5_5a74b451', '稳定裕度_5_bfd54f1c'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson13-phase-knowledge-deck': {
        knowledgeNodeIds: ['相位裕度直觉_5_L2c003', '幅值裕度直觉_5_L2c004', '稳定裕度_5_bfd54f1c'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.22 }
        }
    },
    'lesson13-nyquist-stability-scenario': {
        knowledgeNodeIds: ['奈奎斯特稳定判据_5_a1b34560', '奈奎斯特曲线_5_deaa0845', '稳定裕度_5_bfd54f1c'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['scenario_lab_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.2, engineeringDecision: 0.2, diagnosticAssessment: 0.12 }
        }
    },
    'lesson13-phase-stability-exit-quiz': {
        knowledgeNodeIds: ['相角裕度_5_5a74b451', '幅值裕度_5_73af26a5', '稳定裕度_5_bfd54f1c'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson13-summary-card': {
        knowledgeNodeIds: ['相角裕度_5_5a74b451', '奈奎斯特稳定判据_5_a1b34560'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'lesson14-margin-quick-check': {
        knowledgeNodeIds: ['相角裕度_6_b44a6a10', '幅值裕度_6_29a8a2e1'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson14-margin-knowledge-deck': {
        knowledgeNodeIds: ['相角裕度_6_b44a6a10', '幅值裕度_6_29a8a2e1', '频域校正_6_f5beed50'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.22, parameterDesign: 0.12 }
        }
    },
    'lesson14-margin-tradeoff-lab': {
        knowledgeNodeIds: ['频域PD与超前整定_4_42011', '频域PI与滞后整定_4_42010', '主矛盾到频段职责映射_4_42003'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['tradeoff_lab_submit', 'simulation_run'],
            abilityImpact: { parameterDesign: 0.26, engineeringDecision: 0.2, controlModeling: 0.14 }
        }
    },
    'lesson14-three-band-studio': {
        knowledgeNodeIds: ['三频段闭环性能回读_3_38003', '主矛盾到频段职责映射_4_42003', '频域校正_6_f5beed50'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['studio_submit', 'simulation_trace_verified'],
            abilityImpact: { parameterDesign: 0.26, engineeringDecision: 0.2, crossDomainTransfer: 0.12 }
        }
    },
    'lesson14-margin-exit-quiz': {
        knowledgeNodeIds: ['相角裕度_6_b44a6a10', '幅值裕度_6_29a8a2e1', '频域校正_6_f5beed50'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson14-summary-card': {
        knowledgeNodeIds: ['频域校正_6_f5beed50', '主矛盾到频段职责映射_4_42003'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'lesson15-series-precheck': {
        knowledgeNodeIds: ['串联校正_6_fede5751', '超前网络_6_9cc2ad14', '滞后网络_6_89977f28'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, parameterDesign: 0.12 }
        }
    },
    'lesson15-series-knowledge-deck': {
        knowledgeNodeIds: ['串联校正_6_fede5751', '无源超前网络_6_f044ba0d', '无源滞后网络_6_3ce25985'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.18, parameterDesign: 0.18 }
        }
    },
    'lesson15-series-strategy-lab': {
        knowledgeNodeIds: ['传统设计四联图校正_4_47004', '频域校正_6_f5beed50', '串联校正_6_fede5751'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['strategy_lab_submit', 'simulation_trace_verified'],
            abilityImpact: { parameterDesign: 0.28, engineeringDecision: 0.2 }
        }
    },
    'lesson15-lag-lead-workshop': {
        knowledgeNodeIds: ['串联滞后-超前校正_6_23ee8cb9', '无源滞后-超前网络_6_66afb311', '频域校正_6_f5beed50'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['workshop_submit', 'answer_submit'],
            abilityImpact: { parameterDesign: 0.28, engineeringDecision: 0.18 }
        }
    },
    'lesson15-series-exit-quiz': {
        knowledgeNodeIds: ['串联校正_6_fede5751', '超前网络_6_9cc2ad14', '滞后网络_6_89977f28'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, parameterDesign: 0.12 }
        }
    },
    'lesson15-summary-card': {
        knowledgeNodeIds: ['串联校正_6_fede5751', '频域校正_6_f5beed50'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'lesson16-nonlinear-precheck': {
        knowledgeNodeIds: ['非线性系统_8_4ccc0148', '典型非线性边界环节_5_51002'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson16-nonlinear-knowledge-deck': {
        knowledgeNodeIds: ['非线性系统_8_4ccc0148', '典型非线性边界环节_5_51002', '非线性边界工具选择_5_52001'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.22, engineeringDecision: 0.12 }
        }
    },
    'lesson16-nonlinear-feature-match': {
        knowledgeNodeIds: ['饱和非线性_8_deec42d7', '死区饱和非线性_8_e04bd4bd', '滞后继电特性_8_0764b0a8'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['feature_match_submit', 'answer_submit'],
            abilityImpact: { diagnosticAssessment: 0.18, controlModeling: 0.16 }
        }
    },
    'lesson16-harmonic-linearization-guide': {
        knowledgeNodeIds: ['描述函数法_8_849fa8a1', '描述函数适用条件_5_52003', '非线性系统稳定性判据_描述函数法__8_2d9b3f16'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['guide_view', 'answer_submit'],
            abilityImpact: { controlModeling: 0.2, engineeringDecision: 0.18 }
        }
    },
    'lesson16-nonlinear-exit-quiz': {
        knowledgeNodeIds: ['非线性系统_8_4ccc0148', '描述函数法_8_849fa8a1'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson16-summary-card': {
        knowledgeNodeIds: ['非线性系统_8_4ccc0148', '非线性边界工具选择_5_52001'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'lesson17-df-precheck': {
        knowledgeNodeIds: ['描述函数法_8_849fa8a1', '负倒描述函数_8_159ff256'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson17-df-knowledge-deck': {
        knowledgeNodeIds: ['描述函数法_8_849fa8a1', '负倒描述函数_8_159ff256', '极限环_8_146dec32'],
        planningOverride: {
            estimatedTimeMinutes: 14,
            evidenceInstrumentation: ['knowledge_deck_view', 'card_complete'],
            abilityImpact: { controlModeling: 0.22, engineeringDecision: 0.12 }
        }
    },
    'lesson17-negative-inverse-workshop': {
        knowledgeNodeIds: ['负倒描述函数_8_159ff256', '奈奎斯特曲线_8_6ac36648'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['workshop_submit', 'answer_submit'],
            abilityImpact: { controlModeling: 0.22, engineeringDecision: 0.18 }
        }
    },
    'lesson17-limit-cycle-lab': {
        knowledgeNodeIds: ['极限环_8_146dec32', '稳定的极限环_8_0a23bf90', '不稳定的极限环_8_2f352f72'],
        planningOverride: {
            estimatedTimeMinutes: 18,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['limit_cycle_lab_submit', 'simulation_run'],
            abilityImpact: { controlModeling: 0.2, engineeringDecision: 0.22, parameterDesign: 0.12 }
        }
    },
    'lesson17-df-exit-quiz': {
        knowledgeNodeIds: ['描述函数法_8_849fa8a1', '极限环_8_146dec32', '负倒描述函数_8_159ff256'],
        planningOverride: {
            estimatedTimeMinutes: 10,
            evidenceInstrumentation: ['answer_submit', 'exit_quiz_complete'],
            abilityImpact: { diagnosticAssessment: 0.25, controlModeling: 0.12 }
        }
    },
    'lesson17-summary-card': {
        knowledgeNodeIds: ['描述函数法_8_849fa8a1', '极限环_8_146dec32'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['summary_card_view'],
            abilityImpact: { inquiryReflection: 0.1, selfDirectedLearning: 0.1 }
        }
    },
    'classroom-video': {
        knowledgeNodeIds: ['课程总图_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            availability: 'teacher_only',
            teacherPolicy: 'teacher-only',
            privacyLevel: 'teacher-scoped',
            evidenceInstrumentation: ['classroom_video_play'],
            abilityImpact: { selfDirectedLearning: 0.08 }
        }
    },
    'classroom-poll': {
        knowledgeNodeIds: ['课程总图_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 4,
            availability: 'teacher_only',
            teacherPolicy: 'teacher-only',
            privacyLevel: 'teacher-scoped',
            evidenceInstrumentation: ['classroom_poll_submit'],
            abilityImpact: { diagnosticAssessment: 0.12 }
        }
    },
    'classroom-objective': {
        knowledgeNodeIds: ['课程总图_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 3,
            availability: 'teacher_only',
            teacherPolicy: 'teacher-only',
            privacyLevel: 'teacher-scoped',
            evidenceInstrumentation: ['classroom_objective_view'],
            pathDisposition: {
                kind: 'evidence-producing',
                reviewStatus: 'human-confirmed',
                rationale: '既有治理审查确认该教师侧目标展示资源仅产生课堂证据，不作为学生学习路径节点。',
                sourceFamily: 'registered-resource',
                stableSourceRef: 'registry:classroom-objective',
                sourceVersionRef: 'resource-node-registry.v1',
                parentResourceNodeId: null,
                reviewedAt: '2026-07-09T16:30:00.000Z',
                reviewerId: 'core-registered-knowledge-resource-implementing-agent'
            },
            abilityImpact: { selfDirectedLearning: 0.08 }
        }
    },
    'classroom-assessment': {
        knowledgeNodeIds: ['课程总图_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 8,
            availability: 'teacher_only',
            teacherPolicy: 'teacher-only',
            privacyLevel: 'teacher-scoped',
            evidenceInstrumentation: ['classroom_assessment_submit'],
            pathDisposition: {
                kind: 'evidence-producing',
                reviewStatus: 'human-confirmed',
                rationale: '既有治理审查确认该教师侧后测资源用于产生诊断证据，不作为学生学习路径节点。',
                sourceFamily: 'registered-resource',
                stableSourceRef: 'registry:classroom-assessment',
                sourceVersionRef: 'resource-node-registry.v1',
                parentResourceNodeId: null,
                reviewedAt: '2026-07-09T16:30:00.000Z',
                reviewerId: 'core-registered-knowledge-resource-implementing-agent'
            },
            abilityImpact: { diagnosticAssessment: 0.18 }
        }
    },
    'classroom-ethical-trigger': {
        knowledgeNodeIds: ['剩余风险说明_4_45006', '工程指标代价函数翻译_4_47003'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            availability: 'teacher_only',
            teacherPolicy: 'teacher-only',
            privacyLevel: 'teacher-scoped',
            evidenceInstrumentation: ['classroom_ethics_trigger'],
            abilityImpact: { engineeringDecision: 0.12, inquiryReflection: 0.12 }
        }
    },
    'classroom-ai-report': {
        knowledgeNodeIds: ['课程总图_1_1'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            availability: 'teacher_only',
            teacherPolicy: 'teacher-only',
            privacyLevel: 'teacher-scoped',
            evidenceInstrumentation: ['classroom_ai_report_view'],
            abilityImpact: { selfDirectedLearning: 0.08, diagnosticAssessment: 0.08 }
        }
    },
    'ten-drops-game-v1': {
        knowledgeNodeIds: ['系统观念_1_1', '动态过程_3_8a8051ec'],
        planningOverride: {
            estimatedTimeMinutes: 12,
            teacherPolicy: 'teacher-assigned',
            evidenceInstrumentation: ['game_level_complete', 'interaction_complete'],
            abilityImpact: { inquiryReflection: 0.14, selfDirectedLearning: 0.12 }
        }
    },
    'control-odyssey-v1': {
        knowledgeNodeIds: ['误差_1_1', '稳态误差_3_c0207063', '反馈控制系统_1_98dc667a'],
        planningOverride: {
            estimatedTimeMinutes: 16,
            teacherPolicy: 'teacher-assigned',
            evidenceInstrumentation: ['game_level_complete', 'control_odyssey_attempt'],
            abilityImpact: { controlModeling: 0.16, inquiryReflection: 0.12, selfDirectedLearning: 0.1 }
        }
    }
};

export function getRegisteredResourceMetadata(registryId: string): RegisteredResourceMetadata | undefined {
    const metadata = registeredResourceMetadata[registryId];
    return metadata ? withDefaultResourceTarget(metadata) : undefined;
}

export function getRegisteredResourceMetadataByNodeId(resourceNodeId: string): RegisteredResourceMetadata | undefined {
    if (resourceNodeId.startsWith('registry:')) {
        return getRegisteredResourceMetadata(resourceNodeId.slice('registry:'.length));
    }
    if (!resourceNodeId.startsWith('arena-task:')) return undefined;

    const arenaTaskId = resourceNodeId.slice('arena-task:'.length);
    const metadata = Object.values(registeredResourceMetadata).find((candidate) => (
        candidate.type === 'SIMULATION_APP'
        && candidate.defaultConfig?.resourceKind === 'arena-workbench'
        && candidate.defaultConfig?.arenaTaskId === arenaTaskId
    ));
    return metadata ? withDefaultResourceTarget(metadata) : undefined;
}

export function getAllRegisteredResourceMetadata() {
    return Object.values(registeredResourceMetadata).map(withDefaultResourceTarget);
}

function withDefaultResourceTarget(metadata: RegisteredResourceMetadata): RegisteredResourceMetadata {
    const progressionMetadata = registeredResourceProgressionMetadata[metadata.id] ?? {};
    const operationalMetadata = registeredResourceOperationalMetadata[metadata.id] ?? {};
    const semanticMetadata = registeredResourceSemanticMetadata[metadata.id] ?? {};
    const planningOverride = mergePlanningOverrides(
        metadata.planningOverride,
        progressionMetadata.planningOverride,
        operationalMetadata.planningOverride,
        semanticMetadata.planningOverride
    );
    return {
        ...metadata,
        ...progressionMetadata,
        ...operationalMetadata,
        ...semanticMetadata,
        prerequisiteNodeIds: semanticMetadata.prerequisiteNodeIds ??
            operationalMetadata.prerequisiteNodeIds ??
            progressionMetadata.prerequisiteNodeIds ??
            metadata.prerequisiteNodeIds,
        planningOverride,
        renderTarget: metadata.renderTarget ?? `/interactive-learning/resources/${metadata.id}`
    };
}

function buildRegisteredResourceProgressionMetadata(): Record<string, RegisteredResourceMetadataPatch> {
    const progressions: Array<{ ids: string[]; intro?: string }> = [
        {
            ids: [
                'lesson01-feedback-bridge-v1',
                'lesson01-feedback-objective-v1',
                'lesson01-feedback-precheck-v1',
                'lesson01-feedback-knowledge-deck-v1',
                'lesson01-component-role-match-v1',
                'lesson01-loop-scenario-lab-v1',
                'lesson01-feedback-exit-quiz-v1',
                'lesson01-feedback-summary-v1',
            ],
        },
        {
            ids: [
                'lesson02-laplace-bridge-v1',
                'lesson02-laplace-objective-v1',
                'lesson02-laplace-precheck-v1',
                'lesson02-laplace-knowledge-deck-v1',
                'lesson02-laplace-property-match-v1',
                'lesson02-laplace-inverse-lab-v1',
                'lesson02-laplace-exit-quiz-v1',
                'lesson02-laplace-summary-v1',
            ],
        },
        {
            ids: [
                'physics-modeling-intro-v1',
                'physics-modeling-mechanical-v1',
                'physics-modeling-electrical-v1',
                'physics-modeling-analogy-v1',
                'physics-modeling-practice-v1',
            ],
        },
        {
            ids: [
                'lesson03-diff-precheck',
                'lesson03-diff-knowledge-deck',
                'lesson03-modeling-scenario-lab',
                'lesson03-modeling-workflow-puzzle',
                'lesson03-diff-exit-quiz',
                'lesson03-summary-card',
            ],
        },
        {
            ids: [
                'lesson04-transfer-precheck',
                'lesson04-transfer-knowledge-deck',
                'lesson04-transfer-derivation-lab',
                'lesson04-transfer-element-workshop',
                'lesson04-transfer-exit-quiz',
                'lesson04-summary-card',
            ],
        },
        {
            ids: [
                'lesson05-block-diagram-precheck',
                'lesson05-structure-knowledge-deck',
                'lesson05-block-diagram-workshop',
                'lesson05-signal-flow-lab',
                'lesson05-mason-loop-challenge',
                'lesson05-structure-exit-quiz',
                'lesson05-summary-card',
            ],
        },
        {
            ids: [
                'lesson06-metric-quick-check',
                'lesson06-metric-handbook',
                'lesson06-judge-bench',
            ],
        },
        {
            ids: [
                'lesson07-damping-quick-check',
                'lesson07-second-order-theory',
                'lesson07-pole-manipulator',
                'lesson07-response-explorer',
                'lesson07-parameter-challenge',
                'lesson07-summary-card',
            ],
        },
        {
            ids: [
                'lesson08-stability-precheck',
                'lesson08-routh-guide',
                'lesson08-routh-practice',
                'lesson08-steady-error-deck',
                'lesson08-post-quiz',
                'lesson08-summary-card',
            ],
        },
        {
            ids: [
                'lesson09-correction-precheck',
                'lesson09-correction-strategy',
                'lesson09-time-domain-synthesis',
                'lesson09-summary-card',
            ],
        },
        {
            ids: [
                'lesson10-root-locus-workshop',
                'lesson11-parameter-root-locus-deck',
                'lesson11-graphical-thinking-workshop',
                'lesson11-summary-card',
            ],
        },
        {
            ids: [
                'lesson12-frequency-precheck',
                'lesson12-bode-step-sorter',
                'lesson12-bode-slope-puzzle',
                'lesson12-bode-plot-recognition',
                'lesson12-bode-post-quiz',
                'lesson12-summary-card',
            ],
        },
        {
            ids: [
                'lesson13-cruise-bridge',
                'lesson13-physics-builder-simple',
                'lesson13-iso2631-mapping',
                'lesson13-cruise-typhoon-sim',
                'lesson13-phase-concept-quiz',
                'lesson13-phase-knowledge-deck',
                'lesson13-nyquist-stability-scenario',
                'lesson13-phase-stability-exit-quiz',
                'lesson13-summary-card',
            ],
        },
        {
            ids: [
                'lesson14-margin-quick-check',
                'lesson14-margin-knowledge-deck',
                'lesson14-margin-tradeoff-lab',
                'lesson14-three-band-studio',
                'lesson14-margin-exit-quiz',
                'lesson14-summary-card',
            ],
        },
        {
            ids: [
                'lesson15-series-precheck',
                'lesson15-series-knowledge-deck',
                'lesson15-series-strategy-lab',
                'lesson15-lag-lead-workshop',
                'lesson15-series-exit-quiz',
                'lesson15-summary-card',
            ],
        },
        {
            ids: [
                'lesson16-nonlinear-precheck',
                'lesson16-nonlinear-knowledge-deck',
                'lesson16-nonlinear-feature-match',
                'lesson16-harmonic-linearization-guide',
                'lesson16-nonlinear-exit-quiz',
                'lesson16-summary-card',
            ],
        },
        {
            ids: [
                'lesson17-df-precheck',
                'lesson17-df-knowledge-deck',
                'lesson17-negative-inverse-workshop',
                'lesson17-limit-cycle-lab',
                'lesson17-df-exit-quiz',
                'lesson17-summary-card',
            ],
        },
    ];
    const result: Record<string, RegisteredResourceMetadataPatch> = {};
    for (const progression of progressions) {
        progression.ids.forEach((id, index) => {
            const prerequisiteId = index === 0 ? null : `registry:${progression.ids[index - 1]}`;
            result[id] = prerequisiteId
                ? resourceReadiness(prerequisiteId, buildUnlockMessage(prerequisiteId, id))
                : { planningOverride: { readiness: readyImmediately() } };
        });
    }
    return result;
}

function resourceReadiness(
    prerequisiteNodeId: string,
    unlockMessage: string,
): RegisteredResourceMetadataPatch {
    return {
        prerequisiteNodeIds: [prerequisiteNodeId],
        planningOverride: {
            readiness: {
                minimumCompetency: {},
                minimumEvidenceCount: 0,
                requiredCompletedNodeIds: [prerequisiteNodeId],
                requiredOutcomeRefs: [],
                unlockMessage,
                fallbackNodeIds: [prerequisiteNodeId],
            },
        },
    };
}

function simulationReadiness(
    prerequisiteNodeId: string,
    unlockMessage: string,
): RegisteredResourceMetadataPatch {
    return {
        prerequisiteNodeIds: [prerequisiteNodeId],
        planningOverride: {
            readiness: {
                minimumCompetency: { controlModeling: 0.3 },
                minimumEvidenceCount: 1,
                requiredCompletedNodeIds: [prerequisiteNodeId],
                requiredOutcomeRefs: [],
                unlockMessage,
                fallbackNodeIds: [prerequisiteNodeId],
            },
        },
    };
}

function readyImmediately(): NonNullable<ResourceNodePlanningOverride['readiness']> {
    return {
        minimumCompetency: {},
        minimumEvidenceCount: 0,
        requiredCompletedNodeIds: [],
        requiredOutcomeRefs: [],
        unlockMessage: '',
        fallbackNodeIds: [],
    };
}

function readyResource(): RegisteredResourceMetadataPatch {
    return {
        planningOverride: {
            readiness: readyImmediately(),
        },
    };
}

function buildUnlockMessage(prerequisiteNodeId: string, resourceId: string): string {
    const prerequisite = registeredResourceMetadata[prerequisiteNodeId.replace(/^registry:/, '')];
    const resource = registeredResourceMetadata[resourceId];
    return `先完成${prerequisite?.label ?? '前置资源'}，再进入${resource?.label ?? '后续资源'}。`;
}

function mergePlanningOverrides(
    ...overrides: Array<ResourceNodePlanningOverride | undefined>
): ResourceNodePlanningOverride | undefined {
    const defined = overrides.filter((item): item is ResourceNodePlanningOverride => Boolean(item));
    if (defined.length === 0) return undefined;
    return defined.reduce<ResourceNodePlanningOverride>((merged, override) => ({
        ...merged,
        ...override,
        readiness: override.readiness ?? merged.readiness,
    }), {});
}
