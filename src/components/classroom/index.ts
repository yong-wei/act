/**
 * 课堂组件导出
 *
 * 这些组件是功能性的、可编辑的通用组件，供教师在编排课程时填入个性化内容。
 */

// 类型导出
export * from './types';

// 组件导出
export { VideoComponent, createDefaultVideoConfig } from './VideoComponent';
export { PollComponent, createDefaultPollConfig } from './PollComponent';
export { ObjectiveCard, createDefaultObjectiveConfig } from './ObjectiveCard';
export { EthicalTrigger, createDefaultEthicalTriggerConfig } from './EthicalTrigger';
export { AssessmentProbe, createDefaultAssessmentConfig } from './AssessmentProbe';
export { AIDynamicReport, createDefaultReportConfig } from './AIDynamicReport';
