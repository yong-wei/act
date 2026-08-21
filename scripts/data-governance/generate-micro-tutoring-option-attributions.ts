import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  microTutoringOptionAttributionReviewSourceHash,
  type MicroTutoringOptionAttribution,
} from '@/features/assessment/micro-tutoring-option-attribution';
import { resolveMicroTutoringGoalNode } from '@/features/assessment/micro-tutoring-goal-node-catalog';

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const OUTPUT_PATH = path.join(GOVERNANCE_DIR, 'micro-tutoring-option-attributions.json');
const REVIEWED_AT = '2026-08-20T00:00:00.000Z';
const REVIEW_BATCH_ID = 'micro-tutoring-option-attribution-review.v2';

type OptionReview = readonly [
  sourceId: string,
  optionKey: string,
  misconceptionSlug: string,
  evidenceSummary: string,
  nodeIndex?: number,
];

const OPTION_REVIEWS: OptionReview[] = [
  ['control-correction-practice-01', 'A', 'confuses-overshoot-with-steady-error', '逐选项审核确认：把已合格的稳态精度误作校正目标，未针对超调所反映的阻尼不足。'],
  ['control-correction-practice-01', 'C', 'single-gain-change-without-dynamic-check', '逐选项审核确认：以单纯降低增益替代校正设计，遗漏响应速度与相位裕度复核。'],
  ['control-correction-practice-02', 'B', 'ignores-root-locus-geometry', '逐选项审核确认：认为零点位置可任意指定，忽略根轨迹角度条件和目标极点区域。'],
  ['control-correction-practice-02', 'C', 'uses-steady-error-without-pole-check', '逐选项审核确认：只依据稳态误差常数选择方案，未检查闭环极点位置与动态稳定性。'],
  ['control-correction-practice-03', 'B', 'misuses-lead-compensation', '逐选项审核确认：把增加低频积分阶次误作超前校正，混淆低频精度与相位补偿目标。'],
  ['control-correction-practice-03', 'C', 'trades-speed-for-unbounded-noise-amplification', '逐选项审核确认：将高频噪声放大误当作速度改善，忽略带宽和噪声敏感性的工程边界。'],
  ['control-correction-practice-04', 'A', 'ignores-actuator-cost', '逐选项审核确认：只依据输出速度评价方案，遗漏控制量峰值与执行器约束。', 1],
  ['control-correction-practice-04', 'C', 'equates-slow-response-with-safety', '逐选项审核确认：把响应缓慢等同于安全，未以性能指标和执行器约束共同判断。', 1],
  ['control-correction-practice-05', 'B', 'single-metric-design', '逐选项审核确认：以单个已达标指标代替完整验收，遗漏其余动态、稳态和控制代价。', 1],
  ['control-correction-practice-05', 'C', 'copies-parameters-without-design-rationale', '逐选项审核确认：照搬最终参数而不提供校正依据，无法形成可复核的多指标设计证据。', 1],
  ['control-correction-practice-06', 'B', 'tuning-without-margin-check', '逐选项审核确认：增加积分作用却不复核稳定裕度，会进一步侵蚀已有的相位安全边界。', 1],
  ['control-correction-practice-06', 'C', 'changes-sampling-density-instead-of-controller', '逐选项审核确认：用减少采样点替代控制器校正，不能补偿相位裕度或提升闭环速度。'],

  ['feedback-loop-concept-foundations-practice-01', 'B', 'ignores-summing-sign', '逐选项审核确认：移动结构元素时忽略比较点符号，会改变误差信号和闭环代数关系。'],
  ['feedback-loop-concept-foundations-practice-01', 'C', 'denies-summing-junction-effect', '逐选项审核确认：认为比较点不影响传递关系，否定了反馈误差形成的基本结构语义。'],
  ['feedback-loop-concept-foundations-practice-02', 'B', 'single-channel-thinking', '逐选项审核确认：把扰动并入给定输入，混淆了不同作用点对应的独立闭环通道。'],
  ['feedback-loop-concept-foundations-practice-02', 'C', 'collapses-distinct-signal-paths', '逐选项审核确认：用单一路径表示多通道系统，无法保留给定与扰动的不同传递关系。'],
  ['feedback-loop-concept-foundations-practice-03', 'A', 'assumes-unity-feedback', '逐选项审核确认：忽略非单位传感器动态，会错误构造误差信号和闭环分母。'],
  ['feedback-loop-concept-foundations-practice-03', 'C', 'moves-sensor-into-forward-controller', '逐选项审核确认：把测量环节误置于前向控制通道，改变了反馈结构及其物理含义。'],
  ['feedback-loop-concept-foundations-practice-04', 'B', 'gain-always-good', '逐选项审核确认：把增益增大直接等同于稳定性提高，忽略稳定裕度可能下降。', 1],
  ['feedback-loop-concept-foundations-practice-04', 'C', 'denies-gain-effect-on-closed-loop', '逐选项审核确认：认为开环增益与闭环无关，遗漏闭环极点、误差和裕度的增益依赖。', 1],
  ['feedback-loop-concept-foundations-practice-05', 'A', 'components-without-connections', '逐选项审核确认：只识别对象名称而不描述连接关系，不能确定闭环模型。'],
  ['feedback-loop-concept-foundations-practice-05', 'C', 'output-only-model-description', '逐选项审核确认：只给最终输出而不保留比较点、方向和反馈路径，模型结构不可追溯。'],
  ['feedback-loop-concept-foundations-practice-06', 'A', 'disturbance-location-ignored', '逐选项审核确认：把扰动与参考输入无符号合并，丢失了扰动作用点和极性。'],
  ['feedback-loop-concept-foundations-practice-06', 'B', 'deletes-disturbance-channel', '逐选项审核确认：删除扰动通道会使模型无法表达对象输入端扰动的传播路径。'],

  ['frequency-response-foundations-practice-01', 'B', 'reads-bode-as-picture', '逐选项审核确认：把图形外观当作分析对象，没有从斜率变化识别零极点结构。'],
  ['frequency-response-foundations-practice-01', 'C', 'ignores-magnitude-slope', '逐选项审核确认：只读取相位而跳过幅频斜率，无法判断转折频率处的结构变化。'],
  ['frequency-response-foundations-practice-02', 'A', 'ignores-phase-margin', '逐选项审核确认：把相位下降误解释为稳态误差改善，混淆频域稳定边界与低频精度。'],
  ['frequency-response-foundations-practice-02', 'B', 'treats-phase-as-plot-only', '逐选项审核确认：认为相位只影响作图，忽略相位滞后对闭环稳定裕度的直接作用。'],
  ['frequency-response-foundations-practice-03', 'A', 'bandwidth-is-always-better', '逐选项审核确认：将截止频率增大设为唯一准则，忽略噪声敏感性和鲁棒性代价。', 1],
  ['frequency-response-foundations-practice-03', 'B', 'omits-bandwidth-analysis', '逐选项审核确认：完全回避带宽，无法建立频域指标与响应速度、噪声放大的联系。', 1],
  ['frequency-response-foundations-practice-04', 'B', 'skips-critical-point-meaning', '逐选项审核确认：只背判据结论而不理解临界点距离和环绕，无法可靠应用奈奎斯特判据。'],
  ['frequency-response-foundations-practice-04', 'C', 'substitutes-time-domain-for-nyquist-reading', '逐选项审核确认：用单一时域响应替代频域曲线阅读，缺少临界点和环绕证据。'],
  ['frequency-response-foundations-practice-05', 'A', 'slope-break-misread', '逐选项审核确认：把斜率再下降误判为一阶零点，颠倒了零点和极点的斜率贡献。'],
  ['frequency-response-foundations-practice-05', 'B', 'confuses-break-with-dc-gain-loss', '逐选项审核确认：把渐近线转折误归因于低频增益特性丢失，未识别新增动态因子。'],
  ['frequency-response-foundations-practice-06', 'B', 'bandwidth-only-speed', '逐选项审核确认：错误联结带宽、速度和噪声，未理解带宽提高通常伴随更快响应与更高噪声敏感性。', 1],
  ['frequency-response-foundations-practice-06', 'C', 'equates-bandwidth-with-steady-error-only', '逐选项审核确认：把带宽影响局限于稳态误差，遗漏快速性、噪声放大和鲁棒性。', 1],

  ['root-locus-analysis-foundations-practice-01', 'A', 'root-locus-endpoint-confusion', '逐选项审核确认：把根轨迹起止点误写为闭环零极点，混淆了根轨迹由开环结构生成的规则。'],
  ['root-locus-analysis-foundations-practice-01', 'C', 'uses-input-and-sampling-as-endpoints', '逐选项审核确认：用输入幅值和采样时间解释起止点，与根轨迹的开环零极点定义无关。'],
  ['root-locus-analysis-foundations-practice-02', 'A', 'wrong-real-axis-rule', '逐选项审核确认：把实轴判据的奇偶条件反转，导致根轨迹区段判断错误。'],
  ['root-locus-analysis-foundations-practice-02', 'B', 'assumes-all-real-axis-is-locus', '逐选项审核确认：认为全部实轴都属于根轨迹，忽略右侧实轴零极点数量条件。'],
  ['root-locus-analysis-foundations-practice-03', 'B', 'uses-input-amplitude-for-asymptotes', '逐选项审核确认：用输入幅值决定渐近线，未依据开环零极点数目和位置计算。'],
  ['root-locus-analysis-foundations-practice-03', 'C', 'uses-overshoot-for-asymptotes', '逐选项审核确认：用时域超调现象替代渐近线几何规则，缺少零极点结构依据。'],
  ['root-locus-analysis-foundations-practice-04', 'A', 'accepts-visual-crossing-without-calculation', '逐选项审核确认：仅凭图形粗估虚轴穿越，缺少特征方程或稳定判据的定量确认。'],
  ['root-locus-analysis-foundations-practice-04', 'C', 'imaginary-crossing-ignored', '逐选项审核确认：认为根轨迹穿越虚轴后仍保持稳定，忽略闭环极点进入右半平面的后果。'],
  ['root-locus-analysis-foundations-practice-05', 'A', 'zero-without-target-region', '逐选项审核确认：把增加零点数量直接等同于稳定性提高，未检查根轨迹与目标极点区域。', 1],
  ['root-locus-analysis-foundations-practice-05', 'B', 'uses-steady-error-without-locus-shape', '逐选项审核确认：只看稳态误差常数，无法判断零点对根轨迹形状和动态性能的影响。'],
  ['root-locus-analysis-foundations-practice-06', 'B', 'angle-gives-gain', '逐选项审核确认：用稳态误差代替幅值条件求增益，混淆根轨迹角度条件与增益计算。'],
  ['root-locus-analysis-foundations-practice-06', 'C', 'forces-poles-to-imaginary-axis', '逐选项审核确认：强令极点实部为零不能替代幅值条件，且会把设计限制在稳定边界。'],

  ['ship-ocean-transfer-application-practice-01', 'A', 'copies-controller-without-context', '逐选项审核确认：直接复用控制器参数，未核对船舶对象、任务指标和约束差异。'],
  ['ship-ocean-transfer-application-practice-01', 'C', 'renames-variables-without-model-transfer', '逐选项审核确认：只替换变量名称而不迁移模型和证据，无法证明方案适用于新任务。', 1],
  ['ship-ocean-transfer-application-practice-02', 'A', 'ignores-ocean-disturbance', '逐选项审核确认：只验证无扰动标称响应，未覆盖海况扰动下的任务鲁棒性。', 1],
  ['ship-ocean-transfer-application-practice-02', 'C', 'uses-score-without-mission-evidence', '逐选项审核确认：只比较题目分数而不检查任务性能，不能构成海洋场景迁移证据。', 1],
  ['ship-ocean-transfer-application-practice-03', 'B', 'assumption-transfer-missing', '逐选项审核确认：把线性模型视为可无条件迁移，未复核工作点、扰动和执行器假设。'],
  ['ship-ocean-transfer-application-practice-03', 'C', 'deletes-inconsistent-parameters', '逐选项审核确认：删除不一致参数掩盖了模型边界差异，不能完成可审计的场景迁移。', 1],
  ['ship-ocean-transfer-application-practice-04', 'B', 'single-objective-transfer', '逐选项审核确认：只追求最快响应，遗漏航向误差、控制代价和安全约束的联合目标。', 1],
  ['ship-ocean-transfer-application-practice-04', 'C', 'steady-error-only-mission-criterion', '逐选项审核确认：把零稳态误差作为唯一任务指标，忽略动态品质与工程安全边界。', 1],
  ['ship-ocean-transfer-application-practice-05', 'B', 'arena-evidence-missing', '逐选项审核确认：只保留结果截图，缺少模型、参数、工况和指标的可复现实验证据。', 1],
  ['ship-ocean-transfer-application-practice-05', 'C', 'memorizes-context-without-evidence', '逐选项审核确认：背诵任务背景不能证明控制方案在该场景下有效，缺少运行证据链。', 1],
  ['ship-ocean-transfer-application-practice-06', 'A', 'single-objective-transfer', '逐选项审核确认：仅以饱和率达标判定较高海况通过，遗漏航向误差指标超限。', 1],
  ['ship-ocean-transfer-application-practice-06', 'B', 'accepts-failed-disturbance-level', '逐选项审核确认：把较低海况的单项指标当作更高海况结论，忽略测试等级与联合判据。', 1],

  ['simulation-validation-practice-practice-01', 'B', 'invalid-simulation-comparison', '逐选项审核确认：按曲线外观筛选结果会破坏同模型、同输入和同工况的比较基础。', 1],
  ['simulation-validation-practice-practice-01', 'C', 'changes-input-before-comparison', '逐选项审核确认：改变输入后直接比较输出，把输入差异误作模型或控制器性能差异。', 1],
  ['simulation-validation-practice-practice-02', 'B', 'unexplained-simulation-gap', '逐选项审核确认：看到解析与仿真差异就否定理论，未检查步长、模型假设和数值误差来源。'],
  ['simulation-validation-practice-practice-02', 'C', 'reruns-without-discrepancy-record', '逐选项审核确认：重复运行但不记录差异和条件，无法定位偏差来源或形成验证证据。'],
  ['simulation-validation-practice-practice-03', 'A', 'missing-run-provenance', '逐选项审核确认：只保存末次截图，丢失模型版本、参数、输入和运行条件的来源链。', 1],
  ['simulation-validation-practice-practice-03', 'B', 'claims-repetition-without-run-records', '逐选项审核确认：用笼统的多次验证陈述替代逐次运行记录，结果不可复核。', 1],
  ['simulation-validation-practice-practice-04', 'A', 'hides-validation-limits', '逐选项审核确认：只汇报标称模型成功，隐去了扰动与参数变化下的适用边界。', 1],
  ['simulation-validation-practice-practice-04', 'C', 'deletes-failed-disturbance-runs', '逐选项审核确认：删除失败工况会造成选择性证据，无法说明模型和方案的真实限制。', 1],
  ['simulation-validation-practice-practice-05', 'A', 'simulation-evidence-not-linked', '逐选项审核确认：只提交最高分截图，未把证据绑定到模型、参数、工况和判据。', 1],
  ['simulation-validation-practice-practice-05', 'C', 'omits-run-conditions', '逐选项审核确认：只记录控制器名称而遗漏运行条件，无法复现或解释仿真结论。', 1],
  ['simulation-validation-practice-practice-06', 'A', 'one-metric-proves-model', '逐选项审核确认：单项指标在容差内不能证明整体有效性，仍需检查其他判据。', 1],
  ['simulation-validation-practice-practice-06', 'B', 'rejects-tolerance-consistent-result', '逐选项审核确认：把容差内的数值差异直接判为失败，忽略预先规定的验收容差。', 1],

  ['stability-margin-frequency-analysis-practice-01', 'A', 'negative-margin-misread', '逐选项审核确认：把负相位裕度解释为快速且安全，颠倒了稳定安全边界的含义。', 1],
  ['stability-margin-frequency-analysis-practice-01', 'B', 'gain-margin-alone-proves-safety', '逐选项审核确认：以幅值裕度单项替代完整安全判断，忽略负相位裕度所揭示的风险。', 1],
  ['stability-margin-frequency-analysis-practice-02', 'A', 'gain-margin-meaning-missing', '逐选项审核确认：把小幅值裕度误解为没有稳态误差，混淆鲁棒余量与跟踪精度。', 1],
  ['stability-margin-frequency-analysis-practice-02', 'B', 'equates-margin-with-computation-cost', '逐选项审核确认：把幅值裕度归因于控制器计算量，未理解其描述增益不确定性余量。', 1],
  ['stability-margin-frequency-analysis-practice-03', 'A', 'bandwidth-margin-tradeoff-missing', '逐选项审核确认：把高带宽直接等同于更安全，忽略相位裕度下降造成的鲁棒性损失。', 1],
  ['stability-margin-frequency-analysis-practice-03', 'B', 'denies-bandwidth-margin-coupling', '逐选项审核确认：否认带宽与相位裕度的耦合，无法解释速度提升和安全边界收窄。', 1],
  ['stability-margin-frequency-analysis-practice-04', 'B', 'ignores-actuator-safety', '逐选项审核确认：只保留频域曲线而不讨论执行器饱和，遗漏非线性工程安全约束。', 1],
  ['stability-margin-frequency-analysis-practice-04', 'C', 'uses-overshoot-alone-for-safety', '逐选项审核确认：只凭时域超调评价安全，未联合频域裕度与控制量限制。', 1],
  ['stability-margin-frequency-analysis-practice-05', 'B', 'bandwidth-without-robustness', '逐选项审核确认：把交叉频率与相位裕度变化误推为低频跟踪性能确定恶化，缺少频域因果依据。', 1],
  ['stability-margin-frequency-analysis-practice-05', 'C', 'infers-zero-overshoot-from-crossover', '逐选项审核确认：由交叉频率和相位裕度变化断言无超调，超出了现有频域证据。', 1],
  ['stability-margin-frequency-analysis-practice-06', 'A', 'delay-affects-no-margin', '逐选项审核确认：新增延迟后仅检查低频增益特性，遗漏延迟引入的负相位和裕度侵蚀。', 1],
  ['stability-margin-frequency-analysis-practice-06', 'C', 'skips-delay-stability-review', '逐选项审核确认：认为延迟不需复核，忽略幅频近似不变时相位仍会显著变化。', 1],

  ['time-domain-response-analysis-practice-01', 'A', 'misses-overshoot-metric', '逐选项审核确认：首次峰值超过稳态值时只读稳态误差，遗漏最大超调量与峰值时间。'],
  ['time-domain-response-analysis-practice-01', 'C', 'reads-curve-appearance-instead-of-metrics', '逐选项审核确认：用曲线视觉深浅代替时域指标读取，不能形成可计算的响应证据。'],
  ['time-domain-response-analysis-practice-02', 'B', 'settling-rise-confusion', '逐选项审核确认：把进入并保持在误差带内的时间误作上升时间，混淆两个指标定义。'],
  ['time-domain-response-analysis-practice-02', 'C', 'uses-system-type-for-settling-time', '逐选项审核确认：用系统型别代替调节时间读数，未依据响应进入误差带的过程判断。'],
  ['time-domain-response-analysis-practice-03', 'B', 'steady-error-as-instability', '逐选项审核确认：把非零稳态偏差直接判为不稳定，混淆终态误差与动态发散。'],
  ['time-domain-response-analysis-practice-03', 'C', 'uses-peak-time-for-steady-error', '逐选项审核确认：只读取峰值时间不能解释终态偏差，遗漏稳态误差及其来源。'],
  ['time-domain-response-analysis-practice-04', 'A', 'damping-effect-reversed', '逐选项审核确认：认为阻尼比增大会使超调增大，颠倒了欠阻尼二阶系统的典型趋势。'],
  ['time-domain-response-analysis-practice-04', 'B', 'damping-guarantees-zero-steady-error', '逐选项审核确认：由阻尼比变化断言稳态误差为零，混淆动态阻尼与系统型别及低频增益。'],
  ['time-domain-response-analysis-practice-05', 'B', 'unstructured-response-comparison', '逐选项审核确认：按曲线外观比较方案，没有使用一致的超调、调节时间和稳态误差指标。', 1],
  ['time-domain-response-analysis-practice-05', 'C', 'conclusion-without-time-domain-metrics', '逐选项审核确认：只给优劣结论而不列指标，缺少可复核的时域比较证据。', 1],
  ['time-domain-response-analysis-practice-06', 'A', 'single-index-ranking', '逐选项审核确认：由超调较小推断全部动态指标更优，忽略调节时间变慢的代价。'],
  ['time-domain-response-analysis-practice-06', 'C', 'equates-responses-with-different-dynamics', '逐选项审核确认：把稳态值相同误作动态性能相同，遗漏超调与调节时间差异。'],

  ['transfer-function-modeling-foundations-practice-01', 'B', 'ignores-zero-initial-condition', '逐选项审核确认：直接删除微分符号没有执行零初值拉普拉斯变换，不能得到输入输出传递关系。'],
  ['transfer-function-modeling-foundations-practice-01', 'C', 'keeps-arbitrary-initial-condition-in-transfer-function', '逐选项审核确认：把任意初始条件保留在传递函数定义中，混入了不属于零状态输入输出关系的项。'],
  ['transfer-function-modeling-foundations-practice-02', 'A', 'untracked-physical-variables', '逐选项审核确认：把不同物理参数合并为单一增益，丢失质量、阻尼和刚度的可追溯关系。', 1],
  ['transfer-function-modeling-foundations-practice-02', 'B', 'block-diagram-without-physical-variables', '逐选项审核确认：只画结构方块而不标物理量，无法从对象规律建立可信模型。', 1],
  ['transfer-function-modeling-foundations-practice-03', 'A', 'invalid-block-reduction', '逐选项审核确认：仅凭图形相邻就相乘，未确认方块是否构成真实串联连接。'],
  ['transfer-function-modeling-foundations-practice-03', 'C', 'collapses-all-nodes-into-gain', '逐选项审核确认：把求和点、分支点和动态环节合并为增益，破坏原连接拓扑。'],
  ['transfer-function-modeling-foundations-practice-04', 'A', 'lost-system-order', '逐选项审核确认：直接补高分母阶次掩盖建模遗漏，未回查储能元件和状态变量。'],
  ['transfer-function-modeling-foundations-practice-04', 'B', 'changes-numerator-to-fix-order', '逐选项审核确认：调整分子系数不能恢复缺失的系统阶次，未处理分母动态结构。'],
  ['transfer-function-modeling-foundations-practice-05', 'B', 'measurement-path-omitted', '逐选项审核确认：把传感器当作外部扰动，混淆测量反馈动态与扰动通道。', 1],
  ['transfer-function-modeling-foundations-practice-05', 'C', 'deletes-measurement-path', '逐选项审核确认：为化简而删除测量通道，会改变非单位反馈的闭环表达式。', 1],
  ['transfer-function-modeling-foundations-practice-06', 'A', 'closed-loop-denominator', '逐选项审核确认：使用倒数形式遗漏了负反馈闭环分母中的回路增益项。'],
  ['transfer-function-modeling-foundations-practice-06', 'B', 'adds-one-outside-transfer-ratio', '逐选项审核确认：把前向传递函数与常数直接相加，未形成闭环输入输出比。'],
];

async function readJsonl<T>(fileName: string): Promise<T[]> {
  return (await readFile(path.join(GOVERNANCE_DIR, fileName), 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

async function main() {
  const items = await readJsonl<AdaptiveAssessmentCatalogItem>('adaptive-assessment-item-catalog-items.jsonl');
  const decisions = await readJsonl<AssessmentItemSemanticReviewDecision>(
    'assessment-item-semantic-review-snapshots.jsonl',
  );
  const itemBySourceId = new Map(items.map((item) => [item.sourceId, item]));
  const decisionByCatalogItemId = new Map(decisions.map((decision) => [decision.catalogItemId, decision]));
  const reviewByOption = new Map(OPTION_REVIEWS.map((review) => [`${review[0]}\u0000${review[1]}`, review]));
  if (reviewByOption.size !== OPTION_REVIEWS.length) throw new Error('duplicate option review identity');

  const expectedKeys = new Set<string>();
  const entries: MicroTutoringOptionAttribution[] = [];
  for (const item of items) {
    const decision = decisionByCatalogItemId.get(item.catalogItemId);
    if (decision?.selectedStagePurpose !== 'practice') continue;
    for (const option of item.questionRefs.options ?? []) {
      if (option.isCorrect !== false || !option.key) continue;
      const reviewKey = `${item.sourceId}\u0000${option.key}`;
      expectedKeys.add(reviewKey);
      const review = reviewByOption.get(reviewKey);
      if (!review) throw new Error(`missing option review: ${item.sourceId}:${option.key}`);
      const [, , misconceptionSlug, evidenceSummary] = review;
      const goalNode = resolveMicroTutoringGoalNode(decision.selectedLearningGoalIds[0]);
      if (!goalNode.ok) throw new Error(`unresolved goal node: ${item.sourceId}:${goalNode.reason}`);
      const knowledgeNodeId = goalNode.knowledgeNodeId;
      const attributionWithoutHash = {
        catalogItemId: item.catalogItemId,
        contentHash: item.contentHash,
        optionKey: option.key,
        learningGoalId: decision.selectedLearningGoalIds[0],
        misconceptionTag: `misconception:${decision.selectedLearningGoalIds[0]}:${misconceptionSlug}`,
        knowledgeNodeId,
        version: 'micro-tutoring-option-attribution.v2',
        itemReviewSourceHash: decision.reviewSourceHash!,
        reviewerId: 'course-pedagogy-reviewer:issue-1392',
        reviewerRole: 'assessment-content-reviewer',
        reviewedAt: REVIEWED_AT,
        reviewBatchId: REVIEW_BATCH_ID,
        evidenceSummary,
        limitations: [
          '仅适用于所绑定的目录项、内容哈希和错误选项键；题目内容变更后必须重新审核。',
        ],
      };
      entries.push({
        ...attributionWithoutHash,
        reviewSourceHash: microTutoringOptionAttributionReviewSourceHash(attributionWithoutHash),
      });
    }
  }

  const extraKeys = [...reviewByOption.keys()].filter((key) => !expectedKeys.has(key));
  if (extraKeys.length) throw new Error(`orphan option reviews: ${extraKeys.join(', ')}`);
  if (entries.length !== 108) throw new Error(`expected 108 reviewed error options, received ${entries.length}`);
  entries.sort((left, right) =>
    left.catalogItemId.localeCompare(right.catalogItemId) || left.optionKey.localeCompare(right.optionKey));

  await writeFile(OUTPUT_PATH, `${JSON.stringify({
    version: 'micro-tutoring-option-attributions.v2',
    reviewBatchId: REVIEW_BATCH_ID,
    entries,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath: OUTPUT_PATH, reviewedOptionCount: entries.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
