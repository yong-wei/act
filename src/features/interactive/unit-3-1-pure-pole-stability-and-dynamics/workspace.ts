export interface WorkspaceParameterChange {
  key: string;
  value: number;
  source: 'slider' | 'toggle' | 'preset' | 'drag';
}

export interface PoleFamilyTab {
  key: 'negative-real' | 'complex-pair' | 'right-half-plane' | 'repeated-pole';
  label: string;
  formula: string;
  phenomenon: string;
  misconception: string;
}

export interface DominantModelCard {
  key: 'ref' | 'a' | 'b';
  label: string;
  formula: string;
  takeaway: string;
}

export interface BandwidthChecklistItem {
  key: 'wn' | 'break' | 'bandwidth';
  label: string;
  question: string;
  meaning: string;
}

export const POLE_FAMILY_TABS: PoleFamilyTab[] = [
  {
    key: 'negative-real',
    label: '负实极点',
    formula: 'e^{pt}, p < 0',
    phenomenon: '单调衰减，不振荡，时间尺度由实部大小控制。',
    misconception: '“不振荡”不等于“响应一定足够快”。',
  },
  {
    key: 'complex-pair',
    label: '左半平面共轭复根',
    formula: 'e^{σt} sin(ω t + φ), σ < 0',
    phenomenon: '带衰减的振荡响应，阻尼与振荡节奏同时出现。',
    misconception: '“会振荡”不等于“会发散”。',
  },
  {
    key: 'right-half-plane',
    label: '右半平面极点',
    formula: 'e^{pt}, p > 0',
    phenomenon: '指数发散，系统不能在该工作点稳定收束。',
    misconception: '发散不是“超调更大”，而是根本不收敛。',
  },
  {
    key: 'repeated-pole',
    label: '重根',
    formula: '(A_1 + A_2 t)e^{pt}',
    phenomenon: '在原本指数项前增加时间因子，拖尾更明显。',
    misconception: '重根多出来的不是新极点，而是额外的时间因子。',
  },
];

export const DOMINANT_MODEL_CARDS: DominantModelCard[] = [
  {
    key: 'ref',
    label: '参考模型',
    formula: 'Gref(s)=3.2 / (s^2 + 1.6s + 3.2)',
    takeaway: '只保留主导共轭极点，作为近似比较基线。',
  },
  {
    key: 'a',
    label: '模型 A',
    formula: 'GA(s)=16 / ((s+5)(s^2 + 1.6s + 3.2))',
    takeaway: '附加极点更靠左，退场更快，通常更接近参考模型。',
  },
  {
    key: 'b',
    label: '模型 B',
    formula: 'GB(s)=4.48 / ((s+1.4)(s^2 + 1.6s + 3.2))',
    takeaway: '附加极点离主导极点更近，主要动态更容易被改写。',
  },
];

export const BANDWIDTH_CHECKLIST: BandwidthChecklistItem[] = [
  {
    key: 'wn',
    label: '固有频率',
    question: '原系统本来的主要动态节奏落在什么量级？',
    meaning: '它是主导极点的本征节奏，不等于额外极点的转折频率。',
  },
  {
    key: 'break',
    label: '附加极点转折频率',
    question: '附加极点从哪里开始对幅频和相频产生明显影响？',
    meaning: '越逼近主要带宽，越要警惕低阶近似失真。',
  },
  {
    key: 'bandwidth',
    label: '主要带宽',
    question: '系统主要响应和控制关注的频段大概落在哪里？',
    meaning: '它是判断“附加极点有没有侵入主要动态”的关键证据。',
  },
];
