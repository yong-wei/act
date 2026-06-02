export interface RegisteredResourceMetadata {
    id: string;
    label: string;
    type: 'INTERACTIVE_COMP' | 'SIMULATION_APP';
    defaultConfig?: Record<string, unknown>;
}

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
        defaultConfig: {
            resourceKind: 'arena-workbench',
            arenaTaskId: 'task-second-order-lead-pid',
            launchMode: 'route',
            telemetryPolicy: 'arena-course-context',
            governanceContext: { source: 'arena-course-resource' }
        }
    },
    'arena-cruise-blackbox-workbench': {
        id: 'arena-cruise-blackbox-workbench',
        label: '邮轮黑箱辨识 Arena 课程资源',
        type: 'SIMULATION_APP',
        defaultConfig: {
            resourceKind: 'arena-workbench',
            sceneId: 'cruise',
            arenaTaskId: 'task-cruise-roll-blackbox-identification',
            routeHref: '/simulations/cruise',
            launchMode: 'route',
            telemetryPolicy: 'arena-course-context',
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

export function getRegisteredResourceMetadata(registryId: string): RegisteredResourceMetadata | undefined {
    return registeredResourceMetadata[registryId];
}

export function getAllRegisteredResourceMetadata() {
    return Object.values(registeredResourceMetadata).map(({ id, label, type, defaultConfig }) => ({
        id, label, type, defaultConfig
    }));
}
