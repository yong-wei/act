import type { AdaptiveLearningCapabilityTarget } from '@/features/personalization/path-planning/contracts';
import { CONTROL_CORRECTION_GOAL_ID } from './mappings';

export const CONTROL_CORRECTION_CAPABILITY_TARGETS: AdaptiveLearningCapabilityTarget[] = [
  {
    id: 'control-correction:time-domain-targets:apply',
    knowledgeNodeRef: 'control-correction:time-domain-targets',
    capabilityLevel: 'apply',
    behaviorVerb: 'translate',
    successCriteria: [
      'Translate overshoot, settling-time, and steady-state requirements into a target pole-region constraint.',
      'Explain which time-domain target drives the dominant pole placement decision.',
    ],
    observableEvidenceType: 'simulation-run',
    evaluationMethod: 'governed step-response simulation with target-region justification',
    goalSliceId: CONTROL_CORRECTION_GOAL_ID,
    competencyDimensions: ['controlModeling', 'parameterDesign'],
    learnerStateFeatureGroups: ['knowledgeMastery', 'primaryCompetencies', 'simulationArena'], // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: feature group name is compatibility-only.
  },
  {
    id: 'control-correction:root-locus-design:analyze',
    knowledgeNodeRef: 'control-correction:root-locus-design',
    capabilityLevel: 'analyze',
    behaviorVerb: 'compare',
    successCriteria: [
      'Compare feasible compensator choices against root-locus movement and design constraints.',
      'Identify why a candidate correction improves or violates the target dynamic behavior.',
    ],
    observableEvidenceType: 'question',
    evaluationMethod: 'assessment-backed root-locus reasoning item plus governed simulation evidence',
    goalSliceId: CONTROL_CORRECTION_GOAL_ID,
    competencyDimensions: ['parameterDesign', 'engineeringDecision'],
    learnerStateFeatureGroups: ['knowledgeMastery', 'primaryCompetencies', 'simulationArena'], // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: feature group name is compatibility-only.
    prerequisiteKnowledgeRefs: ['control-correction:time-domain-targets'],
  },
  {
    id: 'control-correction:simulation-validation:evaluate',
    knowledgeNodeRef: 'control-correction:simulation-validation',
    capabilityLevel: 'evaluate',
    behaviorVerb: 'validate',
    successCriteria: [
      'Validate the corrected response against declared constraints using governed replay evidence.',
      'State whether failures are caused by model, parameter, or constraint assumptions.',
    ],
    observableEvidenceType: 'simulation-run',
    evaluationMethod: 'course-launched simulation replay with confidence and constraint coverage',
    goalSliceId: CONTROL_CORRECTION_GOAL_ID,
    competencyDimensions: ['parameterDesign', 'engineeringDecision'],
    learnerStateFeatureGroups: ['simulationArena', 'pathExecution', 'primaryCompetencies'], // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: feature group name is compatibility-only.
    prerequisiteKnowledgeRefs: ['control-correction:root-locus-design'],
  },
  {
    id: 'control-correction:arena-transfer:create',
    knowledgeNodeRef: 'control-correction:arena-transfer',
    capabilityLevel: 'create',
    behaviorVerb: 'transfer',
    successCriteria: [
      'Transfer a correction strategy to the official Arena task without relying on preview-only evidence.',
      'Justify controller changes with traceable design and validation evidence.',
    ],
    observableEvidenceType: 'arena-official-evaluation',
    evaluationMethod: 'official Arena evaluation protocol with governed controller artifact evidence',
    goalSliceId: CONTROL_CORRECTION_GOAL_ID,
    competencyDimensions: ['crossDomainTransfer', 'engineeringDecision'],
    learnerStateFeatureGroups: ['simulationArena', 'pathExecution', 'primaryCompetencies'], // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: feature group name is compatibility-only.
    prerequisiteKnowledgeRefs: ['control-correction:simulation-validation'],
  },
];
