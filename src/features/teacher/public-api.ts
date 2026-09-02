/**
 * Teacher 域公共边界：跨域调用方（如 AI teaching-assistant runtime）只经
 * 此文件消费 teacher 域合同；域内文件互访不受此约束。
 */

export {
  parsePersistedDocumentRubricGradingDraft,
  validateDocumentRubricGradingDraftInvariants,
  type PersistedDocumentRubricGradingDraft,
} from './document-rubric-grading-workbench';
