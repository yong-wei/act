import type {
  ControlAnalysisRequest,
  ControlAnalysisResult,
} from '@/resources/control-system/analysis/types';
import { computeAnalysisServer, getControlEngineWasmPath } from '@/lib/control-engine/server';

export { getControlEngineWasmPath };

export interface ControlAnalysisService {
  compute(request: ControlAnalysisRequest): Promise<ControlAnalysisResult>;
}

export const defaultControlAnalysisService: ControlAnalysisService = {
  async compute(request) {
    const envelope = await computeAnalysisServer(request);
    return envelope.result;
  },
};
