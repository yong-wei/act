
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

const Lesson02LegacyBridge = dynamic(
    () => import('@/resources/interactive-learning/lesson-02-legacy/standalone-resources').then(mod => mod.Lesson02LegacyBridgeResource),
    { loading: loadingFallback('Lesson 02 Legacy Bridge') }
);

const Lesson02LegacyObjective = dynamic(
    () => import('@/resources/interactive-learning/lesson-02-legacy/standalone-resources').then(mod => mod.Lesson02LegacyObjectiveResource),
    { loading: loadingFallback('Lesson 02 Legacy Objectives') }
);

const Lesson02LegacyPretest = dynamic(
    () => import('@/resources/interactive-learning/lesson-02-legacy/standalone-resources').then(mod => mod.Lesson02LegacyPretestResource),
    { loading: loadingFallback('Lesson 02 Legacy Pretest') }
);

const Lesson02LegacyMechanical = dynamic(
    () => import('@/resources/interactive-learning/lesson-02-legacy/standalone-resources').then(mod => mod.Lesson02LegacyMechanicalResource),
    { loading: loadingFallback('Lesson 02 Legacy Mechanical') }
);

const Lesson02LegacyElectrical = dynamic(
    () => import('@/resources/interactive-learning/lesson-02-legacy/standalone-resources').then(mod => mod.Lesson02LegacyElectricalResource),
    { loading: loadingFallback('Lesson 02 Legacy Electrical') }
);

const Lesson02LegacyAnalogy = dynamic(
    () => import('@/resources/interactive-learning/lesson-02-legacy/standalone-resources').then(mod => mod.Lesson02LegacyAnalogyResource),
    { loading: loadingFallback('Lesson 02 Legacy Analogy') }
);

const Lesson02LegacyPosttest = dynamic(
    () => import('@/resources/interactive-learning/lesson-02-legacy/standalone-resources').then(mod => mod.Lesson02LegacyPosttestResource),
    { loading: loadingFallback('Lesson 02 Legacy Posttest') }
);

const Lesson02LegacySummary = dynamic(
    () => import('@/resources/interactive-learning/lesson-02-legacy/standalone-resources').then(mod => mod.Lesson02LegacySummaryResource),
    { loading: loadingFallback('Lesson 02 Legacy Summary') }
);

const Lesson02LaplaceBridge = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/bridge-intro'),
    { ssr: false, loading: loadingFallback('Lesson 02 Laplace Bridge') }
);

const Lesson02LaplaceObjective = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/objective-card'),
    { ssr: false, loading: loadingFallback('Lesson 02 Laplace Objectives') }
);

const Lesson02LaplacePrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/laplace-precheck'),
    { ssr: false, loading: loadingFallback('Lesson 02 Laplace Precheck') }
);

const Lesson02LaplaceKnowledgeDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/laplace-knowledge-deck'),
    { ssr: false, loading: loadingFallback('Lesson 02 Laplace Knowledge Deck') }
);

const Lesson02LaplacePropertyMatch = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/laplace-property-match'),
    { ssr: false, loading: loadingFallback('Lesson 02 Laplace Property Match') }
);

const Lesson02LaplaceInverseLab = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/laplace-inverse-lab'),
    { ssr: false, loading: loadingFallback('Lesson 02 Laplace Inverse Lab') }
);

const Lesson02LaplaceExitQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/laplace-exit-quiz'),
    { ssr: false, loading: loadingFallback('Lesson 02 Laplace Exit Quiz') }
);

const Lesson02LaplaceSummary = dynamic(
    () => import('@/resources/interactive-learning/lesson-02/summary-card'),
    { ssr: false, loading: loadingFallback('Lesson 02 Laplace Summary') }
);

const Lesson01FeedbackBridge = dynamic(
    () => import('@/resources/interactive-learning/lesson-01/bridge-intro'),
    { ssr: false, loading: loadingFallback('Lesson 01 Feedback Bridge') }
);

const Lesson01FeedbackObjective = dynamic(
    () => import('@/resources/interactive-learning/lesson-01/objective-card'),
    { ssr: false, loading: loadingFallback('Lesson 01 Feedback Objectives') }
);

const Lesson01FeedbackPrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-01/feedback-precheck'),
    { ssr: false, loading: loadingFallback('Lesson 01 Feedback Precheck') }
);

const Lesson01FeedbackKnowledgeDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-01/feedback-knowledge-deck'),
    { ssr: false, loading: loadingFallback('Lesson 01 Feedback Knowledge Deck') }
);

const Lesson01ComponentRoleMatch = dynamic(
    () => import('@/resources/interactive-learning/lesson-01/component-role-match'),
    { ssr: false, loading: loadingFallback('Lesson 01 Component Role Match') }
);

const Lesson01LoopScenarioLab = dynamic(
    () => import('@/resources/interactive-learning/lesson-01/loop-scenario-lab'),
    { ssr: false, loading: loadingFallback('Lesson 01 Loop Scenario Lab') }
);

const Lesson01FeedbackExitQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-01/feedback-exit-quiz'),
    { ssr: false, loading: loadingFallback('Lesson 01 Feedback Exit Quiz') }
);

const Lesson01FeedbackSummary = dynamic(
    () => import('@/resources/interactive-learning/lesson-01/summary-card'),
    { ssr: false, loading: loadingFallback('Lesson 01 Feedback Summary') }
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

const Lesson13PhaseConceptQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-13/phase-concept-quiz'),
    { ssr: false, loading: loadingFallback('幅相概念速判') }
);

const Lesson13PhaseKnowledgeDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-13/phase-knowledge-deck'),
    { ssr: false, loading: loadingFallback('幅相知识卡片') }
);

const Lesson13NyquistStabilityScenario = dynamic(
    () => import('@/resources/interactive-learning/lesson-13/nyquist-stability-scenario'),
    { ssr: false, loading: loadingFallback('Nyquist 判稳场景') }
);

const Lesson13PhaseStabilityExitQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-13/phase-stability-exit-quiz'),
    { ssr: false, loading: loadingFallback('对数判据速测') }
);

const Lesson13SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-13/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-14 组件
const Lesson14MarginQuickCheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-14/margin-quick-check'),
    { ssr: false, loading: loadingFallback('稳定裕度速判') }
);

const Lesson14MarginKnowledgeDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-14/margin-knowledge-deck'),
    { ssr: false, loading: loadingFallback('稳定裕度知识卡片') }
);

const Lesson14MarginTradeoffLab = dynamic(
    () => import('@/resources/interactive-learning/lesson-14/margin-tradeoff-lab'),
    { ssr: false, loading: loadingFallback('稳定裕度策略实验室') }
);

const Lesson14ThreeBandStudio = dynamic(
    () => import('@/resources/interactive-learning/lesson-14/three-band-studio'),
    { ssr: false, loading: loadingFallback('三频段调优工作台') }
);

const Lesson14MarginExitQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-14/margin-exit-quiz'),
    { ssr: false, loading: loadingFallback('稳定裕度后测') }
);

const Lesson14SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-14/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-15 组件
const Lesson15SeriesPrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-15/series-precheck'),
    { ssr: false, loading: loadingFallback('串联校正速判') }
);

const Lesson15SeriesKnowledgeDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-15/series-knowledge-deck'),
    { ssr: false, loading: loadingFallback('串联校正知识卡片') }
);

const Lesson15SeriesStrategyLab = dynamic(
    () => import('@/resources/interactive-learning/lesson-15/series-strategy-lab'),
    { ssr: false, loading: loadingFallback('校正策略实验室') }
);

const Lesson15LagLeadWorkshop = dynamic(
    () => import('@/resources/interactive-learning/lesson-15/lag-lead-workshop'),
    { ssr: false, loading: loadingFallback('滞后-超前流程拼图') }
);

const Lesson15SeriesExitQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-15/series-exit-quiz'),
    { ssr: false, loading: loadingFallback('滞后超前后测') }
);

const Lesson15SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-15/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-16 组件
const Lesson16NonlinearPrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-16/nonlinear-precheck'),
    { ssr: false, loading: loadingFallback('非线性速判') }
);

const Lesson16NonlinearKnowledgeDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-16/nonlinear-knowledge-deck'),
    { ssr: false, loading: loadingFallback('非线性知识卡片') }
);

const Lesson16NonlinearFeatureMatch = dynamic(
    () => import('@/resources/interactive-learning/lesson-16/nonlinear-feature-match'),
    { ssr: false, loading: loadingFallback('非线性特性识别') }
);

const Lesson16HarmonicLinearizationGuide = dynamic(
    () => import('@/resources/interactive-learning/lesson-16/harmonic-linearization-guide'),
    { ssr: false, loading: loadingFallback('谐波线性化导航') }
);

const Lesson16NonlinearExitQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-16/nonlinear-exit-quiz'),
    { ssr: false, loading: loadingFallback('非线性后测') }
);

const Lesson16SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-16/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-17 组件
const Lesson17DfPrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-17/df-precheck'),
    { ssr: false, loading: loadingFallback('描述函数速查') }
);

const Lesson17DfKnowledgeDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-17/df-knowledge-deck'),
    { ssr: false, loading: loadingFallback('描述函数知识卡片') }
);

const Lesson17NegativeInverseWorkshop = dynamic(
    () => import('@/resources/interactive-learning/lesson-17/negative-inverse-workshop'),
    { ssr: false, loading: loadingFallback('负倒描述函数工作坊') }
);

const Lesson17LimitCycleLab = dynamic(
    () => import('@/resources/interactive-learning/lesson-17/limit-cycle-lab'),
    { ssr: false, loading: loadingFallback('自振判别实验室') }
);

const Lesson17DfExitQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-17/df-exit-quiz'),
    { ssr: false, loading: loadingFallback('自振判别后测') }
);

const Lesson17SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-17/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-03 组件
const Lesson03DiffPrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-03/diff-precheck'),
    { ssr: false, loading: loadingFallback('微分方程速判') }
);

const Lesson03DiffKnowledgeDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-03/diff-knowledge-deck'),
    { ssr: false, loading: loadingFallback('微分方程知识卡片') }
);

const Lesson03ModelingScenarioLab = dynamic(
    () => import('@/resources/interactive-learning/lesson-03/modeling-scenario-lab'),
    { ssr: false, loading: loadingFallback('建模场景决策') }
);

const Lesson03ModelingWorkflowPuzzle = dynamic(
    () => import('@/resources/interactive-learning/lesson-03/modeling-workflow-puzzle'),
    { ssr: false, loading: loadingFallback('建模流程拼图') }
);

const Lesson03DiffExitQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-03/diff-exit-quiz'),
    { ssr: false, loading: loadingFallback('基础模型后测') }
);

const Lesson03SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-03/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-04 组件
const Lesson04TransferPrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-04/transfer-precheck'),
    { ssr: false, loading: loadingFallback('传递函数前测') }
);

const Lesson04TransferKnowledgeDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-04/transfer-knowledge-deck'),
    { ssr: false, loading: loadingFallback('传递函数知识卡片') }
);

const Lesson04TransferDerivationLab = dynamic(
    () => import('@/resources/interactive-learning/lesson-04/transfer-derivation-lab'),
    { ssr: false, loading: loadingFallback('传函推导演练') }
);

const Lesson04TransferElementWorkshop = dynamic(
    () => import('@/resources/interactive-learning/lesson-04/transfer-element-workshop'),
    { ssr: false, loading: loadingFallback('典型环节工作坊') }
);

const Lesson04TransferExitQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-04/transfer-exit-quiz'),
    { ssr: false, loading: loadingFallback('传递函数后测') }
);

const Lesson04SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-04/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-05 组件
const Lesson05BlockDiagramPrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-05/block-diagram-precheck'),
    { ssr: false, loading: loadingFallback('结构图速判') }
);

const Lesson05StructureKnowledgeDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-05/structure-knowledge-deck'),
    { ssr: false, loading: loadingFallback('结构图知识卡片') }
);

const Lesson05BlockDiagramWorkshop = dynamic(
    () => import('@/resources/interactive-learning/lesson-05/block-diagram-workshop'),
    { ssr: false, loading: loadingFallback('结构图化简路线') }
);

const Lesson05SignalFlowLab = dynamic(
    () => import('@/resources/interactive-learning/lesson-05/signal-flow-lab'),
    { ssr: false, loading: loadingFallback('信号流图速练') }
);

const Lesson05MasonLoopChallenge = dynamic(
    () => import('@/resources/interactive-learning/lesson-05/mason-loop-challenge'),
    { ssr: false, loading: loadingFallback('梅森公式挑战') }
);

const Lesson05StructureExitQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-05/structure-exit-quiz'),
    { ssr: false, loading: loadingFallback('结构图后测') }
);

const Lesson05SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-05/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
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

const Lesson07PoleManipulator = dynamic(
    () => import('@/resources/interactive-learning/lesson-07/pole-manipulator'),
    { ssr: false, loading: loadingFallback('极点操纵器') }
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

// Lesson-11 组件
const Lesson11ParameterRootLocusDeck = dynamic(
    () => import('@/resources/interactive-learning/lesson-11/parameter-root-locus-deck'),
    { ssr: false, loading: loadingFallback('参数根轨迹知识卡') }
);

const Lesson11GraphicalThinkingWorkshop = dynamic(
    () => import('@/resources/interactive-learning/lesson-11/graphical-thinking-workshop'),
    { ssr: false, loading: loadingFallback('图形化思考工作坊') }
);

const Lesson11SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-11/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
);

// Lesson-12 组件
const Lesson12FrequencyPrecheck = dynamic(
    () => import('@/resources/interactive-learning/lesson-12/frequency-precheck'),
    { ssr: false, loading: loadingFallback('频率响应速判') }
);

const Lesson12BodeStepSorter = dynamic(
    () => import('@/resources/interactive-learning/lesson-12/bode-step-sorter'),
    { ssr: false, loading: loadingFallback('伯德图绘制步骤') }
);

const Lesson12BodeSlopePuzzle = dynamic(
    () => import('@/resources/interactive-learning/lesson-12/bode-slope-puzzle'),
    { ssr: false, loading: loadingFallback('斜率叠加拼图') }
);

const Lesson12BodePlotRecognition = dynamic(
    () => import('@/resources/interactive-learning/lesson-12/bode-plot-recognition'),
    { ssr: false, loading: loadingFallback('伯德图识别练习') }
);

const Lesson12BodePostQuiz = dynamic(
    () => import('@/resources/interactive-learning/lesson-12/bode-post-quiz'),
    { ssr: false, loading: loadingFallback('伯德图后测') }
);

const Lesson12SummaryCard = dynamic(
    () => import('@/resources/interactive-learning/lesson-12/summary-card'),
    { ssr: false, loading: loadingFallback('课程总结') }
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
    'lesson02-legacy-bridge-v1': {
        id: 'lesson02-legacy-bridge-v1',
        label: 'Lesson 02 Legacy - Bridge In',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LegacyBridge
    },
    'lesson02-legacy-objective-v1': {
        id: 'lesson02-legacy-objective-v1',
        label: 'Lesson 02 Legacy - Objectives',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LegacyObjective
    },
    'lesson02-legacy-pretest-v1': {
        id: 'lesson02-legacy-pretest-v1',
        label: 'Lesson 02 Legacy - Pretest',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LegacyPretest
    },
    'lesson02-legacy-mechanical-v1': {
        id: 'lesson02-legacy-mechanical-v1',
        label: 'Lesson 02 Legacy - Mechanical Modeling',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LegacyMechanical
    },
    'lesson02-legacy-electrical-v1': {
        id: 'lesson02-legacy-electrical-v1',
        label: 'Lesson 02 Legacy - Electrical Modeling',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LegacyElectrical
    },
    'lesson02-legacy-analogy-v1': {
        id: 'lesson02-legacy-analogy-v1',
        label: 'Lesson 02 Legacy - Analogy Mapping',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LegacyAnalogy
    },
    'lesson02-legacy-posttest-v1': {
        id: 'lesson02-legacy-posttest-v1',
        label: 'Lesson 02 Legacy - Posttest',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LegacyPosttest
    },
    'lesson02-legacy-summary-v1': {
        id: 'lesson02-legacy-summary-v1',
        label: 'Lesson 02 Legacy - Summary',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LegacySummary
    },
    'lesson02-laplace-bridge-v1': {
        id: 'lesson02-laplace-bridge-v1',
        label: 'Lesson 02 - Laplace Bridge',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LaplaceBridge
    },
    'lesson02-laplace-objective-v1': {
        id: 'lesson02-laplace-objective-v1',
        label: 'Lesson 02 - Laplace Objectives',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LaplaceObjective
    },
    'lesson02-laplace-precheck-v1': {
        id: 'lesson02-laplace-precheck-v1',
        label: 'Lesson 02 - Laplace Precheck',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LaplacePrecheck
    },
    'lesson02-laplace-knowledge-deck-v1': {
        id: 'lesson02-laplace-knowledge-deck-v1',
        label: 'Lesson 02 - Laplace Knowledge Deck',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LaplaceKnowledgeDeck
    },
    'lesson02-laplace-property-match-v1': {
        id: 'lesson02-laplace-property-match-v1',
        label: 'Lesson 02 - Laplace Property Match',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LaplacePropertyMatch
    },
    'lesson02-laplace-inverse-lab-v1': {
        id: 'lesson02-laplace-inverse-lab-v1',
        label: 'Lesson 02 - Laplace Inverse Lab',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LaplaceInverseLab
    },
    'lesson02-laplace-exit-quiz-v1': {
        id: 'lesson02-laplace-exit-quiz-v1',
        label: 'Lesson 02 - Laplace Exit Quiz',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LaplaceExitQuiz
    },
    'lesson02-laplace-summary-v1': {
        id: 'lesson02-laplace-summary-v1',
        label: 'Lesson 02 - Laplace Summary',
        type: 'INTERACTIVE_COMP',
        component: Lesson02LaplaceSummary
    },
    'lesson01-feedback-bridge-v1': {
        id: 'lesson01-feedback-bridge-v1',
        label: 'Lesson 01 - Feedback Bridge',
        type: 'INTERACTIVE_COMP',
        component: Lesson01FeedbackBridge
    },
    'lesson01-feedback-objective-v1': {
        id: 'lesson01-feedback-objective-v1',
        label: 'Lesson 01 - Feedback Objectives',
        type: 'INTERACTIVE_COMP',
        component: Lesson01FeedbackObjective
    },
    'lesson01-feedback-precheck-v1': {
        id: 'lesson01-feedback-precheck-v1',
        label: 'Lesson 01 - Feedback Precheck',
        type: 'INTERACTIVE_COMP',
        component: Lesson01FeedbackPrecheck
    },
    'lesson01-feedback-knowledge-deck-v1': {
        id: 'lesson01-feedback-knowledge-deck-v1',
        label: 'Lesson 01 - Feedback Knowledge Deck',
        type: 'INTERACTIVE_COMP',
        component: Lesson01FeedbackKnowledgeDeck
    },
    'lesson01-component-role-match-v1': {
        id: 'lesson01-component-role-match-v1',
        label: 'Lesson 01 - Component Role Match',
        type: 'INTERACTIVE_COMP',
        component: Lesson01ComponentRoleMatch
    },
    'lesson01-loop-scenario-lab-v1': {
        id: 'lesson01-loop-scenario-lab-v1',
        label: 'Lesson 01 - Loop Scenario Lab',
        type: 'INTERACTIVE_COMP',
        component: Lesson01LoopScenarioLab
    },
    'lesson01-feedback-exit-quiz-v1': {
        id: 'lesson01-feedback-exit-quiz-v1',
        label: 'Lesson 01 - Feedback Exit Quiz',
        type: 'INTERACTIVE_COMP',
        component: Lesson01FeedbackExitQuiz
    },
    'lesson01-feedback-summary-v1': {
        id: 'lesson01-feedback-summary-v1',
        label: 'Lesson 01 - Feedback Summary',
        type: 'INTERACTIVE_COMP',
        component: Lesson01FeedbackSummary
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
    'lesson13-phase-concept-quiz': {
        id: 'lesson13-phase-concept-quiz',
        label: '幅相概念速判',
        type: 'INTERACTIVE_COMP',
        component: Lesson13PhaseConceptQuiz
    },
    'lesson13-phase-knowledge-deck': {
        id: 'lesson13-phase-knowledge-deck',
        label: '幅相特性知识卡片',
        type: 'INTERACTIVE_COMP',
        component: Lesson13PhaseKnowledgeDeck
    },
    'lesson13-nyquist-stability-scenario': {
        id: 'lesson13-nyquist-stability-scenario',
        label: 'Nyquist 判稳场景',
        type: 'INTERACTIVE_COMP',
        component: Lesson13NyquistStabilityScenario
    },
    'lesson13-phase-stability-exit-quiz': {
        id: 'lesson13-phase-stability-exit-quiz',
        label: '对数判据速测',
        type: 'INTERACTIVE_COMP',
        component: Lesson13PhaseStabilityExitQuiz
    },
    'lesson13-summary-card': {
        id: 'lesson13-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson13SummaryCard
    },
    // Lesson-14 组件
    'lesson14-margin-quick-check': {
        id: 'lesson14-margin-quick-check',
        label: '稳定裕度速判',
        type: 'INTERACTIVE_COMP',
        component: Lesson14MarginQuickCheck
    },
    'lesson14-margin-knowledge-deck': {
        id: 'lesson14-margin-knowledge-deck',
        label: '稳定裕度与三频段知识卡片',
        type: 'INTERACTIVE_COMP',
        component: Lesson14MarginKnowledgeDeck
    },
    'lesson14-margin-tradeoff-lab': {
        id: 'lesson14-margin-tradeoff-lab',
        label: '稳定裕度策略实验室',
        type: 'INTERACTIVE_COMP',
        component: Lesson14MarginTradeoffLab
    },
    'lesson14-three-band-studio': {
        id: 'lesson14-three-band-studio',
        label: '三频段调优工作台',
        type: 'INTERACTIVE_COMP',
        component: Lesson14ThreeBandStudio
    },
    'lesson14-margin-exit-quiz': {
        id: 'lesson14-margin-exit-quiz',
        label: '稳定裕度后测',
        type: 'INTERACTIVE_COMP',
        component: Lesson14MarginExitQuiz
    },
    'lesson14-summary-card': {
        id: 'lesson14-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson14SummaryCard
    },
    // Lesson-15 组件
    'lesson15-series-precheck': {
        id: 'lesson15-series-precheck',
        label: '串联校正速判',
        type: 'INTERACTIVE_COMP',
        component: Lesson15SeriesPrecheck
    },
    'lesson15-series-knowledge-deck': {
        id: 'lesson15-series-knowledge-deck',
        label: '串联校正与滞后超前知识卡片',
        type: 'INTERACTIVE_COMP',
        component: Lesson15SeriesKnowledgeDeck
    },
    'lesson15-series-strategy-lab': {
        id: 'lesson15-series-strategy-lab',
        label: '串联校正策略实验室',
        type: 'INTERACTIVE_COMP',
        component: Lesson15SeriesStrategyLab
    },
    'lesson15-lag-lead-workshop': {
        id: 'lesson15-lag-lead-workshop',
        label: '滞后-超前流程拼图',
        type: 'INTERACTIVE_COMP',
        component: Lesson15LagLeadWorkshop
    },
    'lesson15-series-exit-quiz': {
        id: 'lesson15-series-exit-quiz',
        label: '滞后超前速测',
        type: 'INTERACTIVE_COMP',
        component: Lesson15SeriesExitQuiz
    },
    'lesson15-summary-card': {
        id: 'lesson15-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson15SummaryCard
    },
    // Lesson-16 组件
    'lesson16-nonlinear-precheck': {
        id: 'lesson16-nonlinear-precheck',
        label: '非线性速判',
        type: 'INTERACTIVE_COMP',
        component: Lesson16NonlinearPrecheck
    },
    'lesson16-nonlinear-knowledge-deck': {
        id: 'lesson16-nonlinear-knowledge-deck',
        label: '非线性与描述函数知识卡片',
        type: 'INTERACTIVE_COMP',
        component: Lesson16NonlinearKnowledgeDeck
    },
    'lesson16-nonlinear-feature-match': {
        id: 'lesson16-nonlinear-feature-match',
        label: '非线性特性识别',
        type: 'INTERACTIVE_COMP',
        component: Lesson16NonlinearFeatureMatch
    },
    'lesson16-harmonic-linearization-guide': {
        id: 'lesson16-harmonic-linearization-guide',
        label: '谐波线性化导航',
        type: 'INTERACTIVE_COMP',
        component: Lesson16HarmonicLinearizationGuide
    },
    'lesson16-nonlinear-exit-quiz': {
        id: 'lesson16-nonlinear-exit-quiz',
        label: '非线性基础后测',
        type: 'INTERACTIVE_COMP',
        component: Lesson16NonlinearExitQuiz
    },
    'lesson16-summary-card': {
        id: 'lesson16-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson16SummaryCard
    },
    // Lesson-17 组件
    'lesson17-df-precheck': {
        id: 'lesson17-df-precheck',
        label: '描述函数判别速查',
        type: 'INTERACTIVE_COMP',
        component: Lesson17DfPrecheck
    },
    'lesson17-df-knowledge-deck': {
        id: 'lesson17-df-knowledge-deck',
        label: '描述函数分析知识卡片',
        type: 'INTERACTIVE_COMP',
        component: Lesson17DfKnowledgeDeck
    },
    'lesson17-negative-inverse-workshop': {
        id: 'lesson17-negative-inverse-workshop',
        label: '负倒描述函数工作坊',
        type: 'INTERACTIVE_COMP',
        component: Lesson17NegativeInverseWorkshop
    },
    'lesson17-limit-cycle-lab': {
        id: 'lesson17-limit-cycle-lab',
        label: '自振判别实验室',
        type: 'INTERACTIVE_COMP',
        component: Lesson17LimitCycleLab
    },
    'lesson17-df-exit-quiz': {
        id: 'lesson17-df-exit-quiz',
        label: '自振判别后测',
        type: 'INTERACTIVE_COMP',
        component: Lesson17DfExitQuiz
    },
    'lesson17-summary-card': {
        id: 'lesson17-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson17SummaryCard
    },
    // Lesson-03 组件
    'lesson03-diff-precheck': {
        id: 'lesson03-diff-precheck',
        label: '微分方程速判',
        type: 'INTERACTIVE_COMP',
        component: Lesson03DiffPrecheck
    },
    'lesson03-diff-knowledge-deck': {
        id: 'lesson03-diff-knowledge-deck',
        label: '微分方程建模知识卡片',
        type: 'INTERACTIVE_COMP',
        component: Lesson03DiffKnowledgeDeck
    },
    'lesson03-modeling-scenario-lab': {
        id: 'lesson03-modeling-scenario-lab',
        label: '建模场景决策',
        type: 'INTERACTIVE_COMP',
        component: Lesson03ModelingScenarioLab
    },
    'lesson03-modeling-workflow-puzzle': {
        id: 'lesson03-modeling-workflow-puzzle',
        label: '建模流程拼图',
        type: 'INTERACTIVE_COMP',
        component: Lesson03ModelingWorkflowPuzzle
    },
    'lesson03-diff-exit-quiz': {
        id: 'lesson03-diff-exit-quiz',
        label: '基础模型速测',
        type: 'INTERACTIVE_COMP',
        component: Lesson03DiffExitQuiz
    },
    'lesson03-summary-card': {
        id: 'lesson03-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson03SummaryCard
    },
    // Lesson-04 组件
    'lesson04-transfer-precheck': {
        id: 'lesson04-transfer-precheck',
        label: '传递函数前测',
        type: 'INTERACTIVE_COMP',
        component: Lesson04TransferPrecheck
    },
    'lesson04-transfer-knowledge-deck': {
        id: 'lesson04-transfer-knowledge-deck',
        label: '传递函数知识卡片',
        type: 'INTERACTIVE_COMP',
        component: Lesson04TransferKnowledgeDeck
    },
    'lesson04-transfer-derivation-lab': {
        id: 'lesson04-transfer-derivation-lab',
        label: '传函推导演练',
        type: 'INTERACTIVE_COMP',
        component: Lesson04TransferDerivationLab
    },
    'lesson04-transfer-element-workshop': {
        id: 'lesson04-transfer-element-workshop',
        label: '典型环节工作坊',
        type: 'INTERACTIVE_COMP',
        component: Lesson04TransferElementWorkshop
    },
    'lesson04-transfer-exit-quiz': {
        id: 'lesson04-transfer-exit-quiz',
        label: '传递函数后测',
        type: 'INTERACTIVE_COMP',
        component: Lesson04TransferExitQuiz
    },
    'lesson04-summary-card': {
        id: 'lesson04-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson04SummaryCard
    },
    // Lesson-05 组件
    'lesson05-block-diagram-precheck': {
        id: 'lesson05-block-diagram-precheck',
        label: '结构图速判',
        type: 'INTERACTIVE_COMP',
        component: Lesson05BlockDiagramPrecheck
    },
    'lesson05-structure-knowledge-deck': {
        id: 'lesson05-structure-knowledge-deck',
        label: '结构图与拓扑知识卡片',
        type: 'INTERACTIVE_COMP',
        component: Lesson05StructureKnowledgeDeck
    },
    'lesson05-block-diagram-workshop': {
        id: 'lesson05-block-diagram-workshop',
        label: '结构图化简路线',
        type: 'INTERACTIVE_COMP',
        component: Lesson05BlockDiagramWorkshop
    },
    'lesson05-signal-flow-lab': {
        id: 'lesson05-signal-flow-lab',
        label: '信号流图速练',
        type: 'INTERACTIVE_COMP',
        component: Lesson05SignalFlowLab
    },
    'lesson05-mason-loop-challenge': {
        id: 'lesson05-mason-loop-challenge',
        label: '梅森公式数圈圈',
        type: 'INTERACTIVE_COMP',
        component: Lesson05MasonLoopChallenge
    },
    'lesson05-structure-exit-quiz': {
        id: 'lesson05-structure-exit-quiz',
        label: '结构图与梅森公式后测',
        type: 'INTERACTIVE_COMP',
        component: Lesson05StructureExitQuiz
    },
    'lesson05-summary-card': {
        id: 'lesson05-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson05SummaryCard
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
    'lesson07-pole-manipulator': {
        id: 'lesson07-pole-manipulator',
        label: '极点操纵器',
        type: 'INTERACTIVE_COMP',
        component: Lesson07PoleManipulator
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
    // Lesson-11 组件
    'lesson11-parameter-root-locus-deck': {
        id: 'lesson11-parameter-root-locus-deck',
        label: '参数根轨迹知识卡',
        type: 'INTERACTIVE_COMP',
        component: Lesson11ParameterRootLocusDeck
    },
    'lesson11-graphical-thinking-workshop': {
        id: 'lesson11-graphical-thinking-workshop',
        label: '图形化思考工作坊',
        type: 'INTERACTIVE_COMP',
        component: Lesson11GraphicalThinkingWorkshop
    },
    'lesson11-summary-card': {
        id: 'lesson11-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson11SummaryCard
    },
    // Lesson-12 组件
    'lesson12-frequency-precheck': {
        id: 'lesson12-frequency-precheck',
        label: '频率响应速判',
        type: 'INTERACTIVE_COMP',
        component: Lesson12FrequencyPrecheck
    },
    'lesson12-bode-step-sorter': {
        id: 'lesson12-bode-step-sorter',
        label: '伯德图绘制步骤',
        type: 'INTERACTIVE_COMP',
        component: Lesson12BodeStepSorter
    },
    'lesson12-bode-slope-puzzle': {
        id: 'lesson12-bode-slope-puzzle',
        label: '斜率叠加拼图',
        type: 'INTERACTIVE_COMP',
        component: Lesson12BodeSlopePuzzle
    },
    'lesson12-bode-plot-recognition': {
        id: 'lesson12-bode-plot-recognition',
        label: '伯德图识别练习',
        type: 'INTERACTIVE_COMP',
        component: Lesson12BodePlotRecognition
    },
    'lesson12-bode-post-quiz': {
        id: 'lesson12-bode-post-quiz',
        label: '伯德图后测',
        type: 'INTERACTIVE_COMP',
        component: Lesson12BodePostQuiz
    },
    'lesson12-summary-card': {
        id: 'lesson12-summary-card',
        label: '课程总结',
        type: 'INTERACTIVE_COMP',
        component: Lesson12SummaryCard
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
