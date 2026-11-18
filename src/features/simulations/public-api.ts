export { sensorKey, vesselTraceMetadata, vesselDredgerMetricPoint, vesselDredgerFineMetrics, vesselDredgerModeEvents } from './run-evidence';
export type { VesselTracePoint, VesselTraceChunkMetadata, CourseRunRecovery } from './run-evidence';
export { MAX_VESSEL_EVIDENCE_BYTES, VESSEL_TRACE_COLUMNS, recoveryTraceReference,
  simulationOssReference, simulationOssLocation, simulationTraceReferencePattern } from './evidence-reference';
export { decodeVesselTraceColumns } from './evidence-chunk-columns';
