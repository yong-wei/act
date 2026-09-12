/**
 * First-wave teaching-projection knowledge targets for the nine preset goals.
 * IDs are live core-node canonical objects with student-visible bindings.
 * Unbound goals stay empty; the path may be short.
 */
export interface GoalCanonicalKnowledgeTarget {
  canonicalId: string;
  label: string;
}

export const GOAL_CANONICAL_KNOWLEDGE: Record<string, readonly GoalCanonicalKnowledgeTarget[]> = {
  'control-correction': [
    { canonicalId: 'ctkg:v3e-object-f1df5739a34bf55489aeeeeb', label: '校正装置' },
    { canonicalId: 'ctkg:v3e-object-0a05ec9e84791b95d3794bc0', label: '补偿器' },
    { canonicalId: 'ctkg:v3e-object-e1caec9f68da5c573be699d5', label: '串联校正' },
    { canonicalId: 'ctkg:v3e-object-83b0bd3fc503270cb174a500', label: '超前补偿' },
    { canonicalId: 'ctc:v11g-21fba199a9fdef15887d600f', label: '滞后补偿' },
    { canonicalId: 'ctkg:v3e-object-d80dfe6ce979515d21845c81', label: '串联滞后-超前校正' },
  ],
  'frequency-response-foundations': [
    { canonicalId: 'ctkg:v3e-object-8496155b16d82318d90949d0', label: '频率响应' },
    { canonicalId: 'ctkg:v3e-canonical-504581e399675b9792ab8502', label: '伯德图' },
  ],
  'feedback-loop-concept-foundations': [
    { canonicalId: 'ctkg:domainconcept:27b69e7f2e837fd62dc31379', label: '反馈控制系统' },
    { canonicalId: 'ctkg:domainconcept:fef4835248def04a043183ee', label: '闭环系统' },
  ],
  'transfer-function-modeling-foundations': [
    { canonicalId: 'ctc:modeling-865eb1c8824e157c2f05a903', label: '传递函数' },
  ],
  'time-domain-response-analysis': [
    { canonicalId: 'ctkg:v3e-canonical-eaee7091900b796af8d937c1', label: '超调量' },
    { canonicalId: 'ctkg:m3-v1j:canonical-object:c08c249b4c0953e21905b2fd', label: '稳态误差' },
  ],
  'root-locus-analysis-foundations': [
    { canonicalId: 'ctc:v11g-5845390ded447e37f06ea222', label: '根轨迹' },
  ],
  'stability-margin-frequency-analysis': [
    { canonicalId: 'ctkg:v3e-object-1c159c9cc34ce696a62bf837', label: '相角裕度' },
    { canonicalId: 'ctkg:m3-v1i:canonical-object:0aa3a61ec0920c38f4e34c4e', label: '增益裕度' },
    { canonicalId: 'ctkg:v3e-object-c2881833cb4d8b1e415dc742', label: '幅值裕度' },
  ],
  'simulation-validation-practice': [],
  'ship-ocean-transfer-application': [],
};

export function goalCanonicalIds(goalId: string): string[] {
  return (GOAL_CANONICAL_KNOWLEDGE[goalId] ?? []).map((item) => item.canonicalId);
}

export function isPresetAdaptiveLearningGoal(goalId: string): boolean {
  return Object.prototype.hasOwnProperty.call(GOAL_CANONICAL_KNOWLEDGE, goalId);
}
