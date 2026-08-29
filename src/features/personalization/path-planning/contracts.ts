export type AdaptiveLearningPathEvidenceType =
  | 'question'
  | 'path-execution'
  | 'simulation-run'
  | 'arena-official-evaluation'
  | 'reflection'
  | 'agent-interaction';

export type AdaptiveLearningCapabilityLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

export interface AdaptiveLearningCapabilityTarget {
  id: string;
  knowledgeNodeRef: string;
  capabilityLevel: AdaptiveLearningCapabilityLevel;
  behaviorVerb: string;
  successCriteria: string[];
  observableEvidenceType: AdaptiveLearningPathEvidenceType;
  evaluationMethod: string;
  goalSliceId: string;
  competencyDimensions: string[];
  learnerStateFeatureGroups: string[];
  prerequisiteKnowledgeRefs?: string[];
}
