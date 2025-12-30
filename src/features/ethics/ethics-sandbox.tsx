'use client';

/**
 * EthicsSandbox - 伦理决策沙盘主组件
 *
 * 重构自 ethics0318.html，情景浸润式道德推理工坊
 */

import { useState, useCallback, useEffect } from 'react';
import { EthicsCompass } from './compass/ethics-compass';
import { EthicsTheater } from './theater/ethics-theater';
import { ConsequencesPanel } from './consequences/consequences-panel';
import { CaseLibrary } from './library/case-library';

// 伦理场景类型
export interface EthicsScenarioData {
  id: string;
  title: string;
  description: string;
  scenarioType: 'polar_navigation' | 'collision_avoidance' | 'environmental';
  defaultSafety: number;
  defaultEcology: number;
  defaultEconomy: number;
  defaultTimeLimit: number;
  defaultInfoFog: number;
  regulations: RegulationItem[];
}

// 法规条目
export interface RegulationItem {
  id: string;
  code: string;
  title: string;
  description: string;
  category: 'COLREG' | 'POLAR' | 'SAFETY' | 'ENVIRONMENT';
}

// 决策选项
export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  consequences: {
    humanCost: number;
    ecologicalCost: number;
    economicCost: number;
    culturalImpact: number;
  };
}

// 专家观点
export interface ExpertOpinion {
  id: string;
  expertType: 'environmental' | 'ethics' | 'marine_engineer' | 'anthropologist';
  name: string;
  title: string;
  opinion: string;
  stance: 'support' | 'oppose' | 'neutral';
}

// 历史案例
export interface HistoricalCase {
  id: string;
  title: string;
  year: number;
  description: string;
  outcome: string;
  lessons: string[];
}

// 示例场景数据
const sampleScenario: EthicsScenarioData = {
  id: '1',
  title: '北极航道冰区紧急避险',
  description:
    '您指挥的破冰船在北极东北航道航行时，遭遇突发冰山崩塌。前方出现大量浮冰，右侧有濒危北极熊群落栖息地，左侧是原住民传统渔场。您必须在120秒内做出决策。',
  scenarioType: 'polar_navigation',
  defaultSafety: 33,
  defaultEcology: 33,
  defaultEconomy: 34,
  defaultTimeLimit: 120,
  defaultInfoFog: 30,
  regulations: [
    { id: 'r1', code: 'COLREG-8', title: '避碰规则第八条', description: '避让行动应大幅度、及早采取', category: 'COLREG' },
    { id: 'r2', code: 'POLAR-2.1', title: '极地规则2.1条', description: '极地水域航行的特殊预防措施', category: 'POLAR' },
    { id: 'r3', code: 'SOLAS-V', title: 'SOLAS第V章', description: '航行安全', category: 'SAFETY' },
    { id: 'r4', code: 'MARPOL-I', title: '防污公约附则I', description: '防止油污染规则', category: 'ENVIRONMENT' },
  ],
};

const sampleExperts: ExpertOpinion[] = [
  {
    id: 'e1',
    expertType: 'environmental',
    name: '张海洋',
    title: '海洋生态学家',
    opinion: '北极生态系统极其脆弱，任何航行决策都应将生态保护放在首位。建议绕行至少5海里避开濒危物种栖息地。',
    stance: 'neutral',
  },
  {
    id: 'e2',
    expertType: 'marine_engineer',
    name: '李舵手',
    title: '高级船长',
    opinion: '在紧急情况下，船员安全是第一要务。破冰船应选择最短路径快速脱离危险区域，同时控制航速减少冲击。',
    stance: 'support',
  },
  {
    id: 'e3',
    expertType: 'anthropologist',
    name: '王文化',
    title: '极地文化研究员',
    opinion: '原住民渔场是当地因纽特人世代依赖的生存资源，航行时应与当地社区保持沟通，尊重其传统权益。',
    stance: 'oppose',
  },
];

const sampleCases: HistoricalCase[] = [
  {
    id: 'c1',
    title: '泰坦尼克号沉船事件',
    year: 1912,
    description: '史上最著名的海难之一，因忽视冰山预警导致悲剧',
    outcome: '超过1500人遇难',
    lessons: ['冰区航行必须严格遵守安全规程', '救生设备配置至关重要'],
  },
  {
    id: 'c2',
    title: '埃克森·瓦尔迪兹号漏油',
    year: 1989,
    description: '阿拉斯加海域大规模原油泄漏事故',
    outcome: '造成严重生态灾难',
    lessons: ['应急预案的重要性', '生态成本评估'],
  },
];

const sampleDecisionOptions: DecisionOption[] = [
  {
    id: 'opt1',
    label: '直行穿越',
    description: '以当前航向直接穿越浮冰区，最短时间脱离危险',
    consequences: { humanCost: 20, ecologicalCost: 40, economicCost: 10, culturalImpact: 0 },
  },
  {
    id: 'opt2',
    label: '右转避让',
    description: '右转绕行，靠近北极熊栖息地但避开主要浮冰',
    consequences: { humanCost: 10, ecologicalCost: 80, economicCost: 30, culturalImpact: 10 },
  },
  {
    id: 'opt3',
    label: '左转绕行',
    description: '左转绕行，经过传统渔场区域但远离生态敏感区',
    consequences: { humanCost: 15, ecologicalCost: 20, economicCost: 25, culturalImpact: 60 },
  },
];

interface EthicsSandboxProps {
  scenario?: EthicsScenarioData;
  experts?: ExpertOpinion[];
  historicalCases?: HistoricalCase[];
  decisionOptions?: DecisionOption[];
}

export function EthicsSandbox({
  scenario = sampleScenario,
  experts = sampleExperts,
  historicalCases = sampleCases,
  decisionOptions = sampleDecisionOptions,
}: EthicsSandboxProps) {
  // 价值权重状态
  const [safetyWeight, setSafetyWeight] = useState(scenario.defaultSafety);
  const [ecologyWeight, setEcologyWeight] = useState(scenario.defaultEcology);
  const [economyWeight, setEconomyWeight] = useState(scenario.defaultEconomy);

  // 选中的法规
  const [selectedRules, setSelectedRules] = useState<string[]>([]);

  // 时间压力设置
  const [timeLimit, setTimeLimit] = useState(scenario.defaultTimeLimit);
  const [infoFog, setInfoFog] = useState(scenario.defaultInfoFog);

  // 决策状态
  const [selectedOption, setSelectedOption] = useState<DecisionOption | null>(null);
  const [isConsequencesOpen, setIsConsequencesOpen] = useState(false);
  const [decisionMade, setDecisionMade] = useState(false);

  // 倒计时
  const [timeRemaining, setTimeRemaining] = useState(scenario.defaultTimeLimit);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // 开始决策
  const handleStartDecision = useCallback(() => {
    setIsTimerRunning(true);
    setTimeRemaining(timeLimit);
  }, [timeLimit]);

  // 提交决策
  const handleSubmitDecision = useCallback((option: DecisionOption) => {
    setSelectedOption(option);
    setIsTimerRunning(false);
    setDecisionMade(true);
    setIsConsequencesOpen(true);
  }, []);

  // 重置决策
  const handleReset = useCallback(() => {
    setSelectedOption(null);
    setDecisionMade(false);
    setIsConsequencesOpen(false);
    setTimeRemaining(timeLimit);
    setIsTimerRunning(false);
  }, [timeLimit]);

  // 法规选择切换
  const toggleRule = useCallback((ruleId: string) => {
    setSelectedRules((prev) =>
      prev.includes(ruleId) ? prev.filter((id) => id !== ruleId) : [...prev, ruleId]
    );
  }, []);

  // 倒计时效果
  useEffect(() => {
    if (!isTimerRunning || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          // 时间到，强制选择第一个选项
          if (!decisionMade) {
            handleSubmitDecision(decisionOptions[0]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerRunning, timeRemaining, decisionMade, decisionOptions, handleSubmitDecision]);

  return (
    <div className="flex h-screen w-full bg-[#1c2331] text-slate-200">
      {/* 左侧伦理罗盘 */}
      <EthicsCompass
        scenario={scenario}
        safetyWeight={safetyWeight}
        ecologyWeight={ecologyWeight}
        economyWeight={economyWeight}
        onSafetyChange={setSafetyWeight}
        onEcologyChange={setEcologyWeight}
        onEconomyChange={setEconomyWeight}
        selectedRules={selectedRules}
        onToggleRule={toggleRule}
        timeLimit={timeLimit}
        infoFog={infoFog}
        onTimeLimitChange={setTimeLimit}
        onInfoFogChange={setInfoFog}
        experts={experts}
      />

      {/* 中央伦理剧场 */}
      <div className="flex flex-1 flex-col">
        <EthicsTheater
          scenario={scenario}
          timeRemaining={timeRemaining}
          isTimerRunning={isTimerRunning}
          decisionMade={decisionMade}
          decisionOptions={decisionOptions}
          selectedOption={selectedOption}
          infoFog={infoFog}
          onStartDecision={handleStartDecision}
          onSubmitDecision={handleSubmitDecision}
          onReset={handleReset}
        />

        {/* 底部案例库 */}
        <CaseLibrary cases={historicalCases} />
      </div>

      {/* 右侧代价面板 */}
      <ConsequencesPanel
        isOpen={isConsequencesOpen}
        selectedOption={selectedOption}
        safetyWeight={safetyWeight}
        ecologyWeight={ecologyWeight}
        economyWeight={economyWeight}
        onClose={() => setIsConsequencesOpen(false)}
      />
    </div>
  );
}

export default EthicsSandbox;
