import type { ControlAnalysisRequest, ControlAnalysisResult } from './types';
import { computeControlAnalysisServer, preloadServerControlEngine } from '@/lib/control-engine/server';

export function preloadControlAnalysisServerRuntime() {
  preloadServerControlEngine();
}

export function computeControlAnalysisServerRuntime(
  request: ControlAnalysisRequest,
): ControlAnalysisResult {
  return computeControlAnalysisServer(request);
}

export { computeControlAnalysisServer };
