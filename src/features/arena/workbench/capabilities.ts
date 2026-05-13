import type { ArenaModelCapabilities, ChallengeObject } from '../types';

export function inferArenaObjectCapabilities(object: ChallengeObject): ArenaModelCapabilities {
  const isWhiteBox = object.visibility === 'white-box';
  const hasModel = Boolean(object.model);
  const hasTF = hasModel && (
    object.adapterType === 'transfer-function' ||
    object.adapterType === 'homework'
  );
  const isBlackBox = object.visibility === 'black-box';
  const isVirtualSim = object.source === 'virtual-simulation';
  const isOdyssey = object.source === 'control-odyssey';

  if (isWhiteBox && hasTF) {
    return {
      isLti: true,
      isSiso: true,
      isMimo: false,
      isNonlinear: false,
      hasTransferFunction: true,
      hasStateSpace: false,
      supportsStepResponse: true,
      supportsRootLocus: true,
      supportsBode: true,
      supportsNyquist: true,
      supportsSerialCorrection: true,
      supportsPid: true,
      supportsCompositeControl: false,
      supportsIdentification: false,
      supportsMpc: false,
      supportsVirtualSimulationPreview: false,
      supportsOfficialEvaluation: true,
    };
  }

  if (isWhiteBox && isOdyssey && hasModel) {
    return {
      isLti: true,
      isSiso: true,
      isMimo: false,
      isNonlinear: false,
      hasTransferFunction: true,
      hasStateSpace: false,
      supportsStepResponse: true,
      supportsRootLocus: true,
      supportsBode: true,
      supportsNyquist: true,
      supportsSerialCorrection: false,
      supportsPid: true,
      supportsCompositeControl: false,
      supportsIdentification: false,
      supportsMpc: false,
      supportsVirtualSimulationPreview: false,
      supportsOfficialEvaluation: true,
    };
  }

  if (isWhiteBox && isVirtualSim && hasModel) {
    return {
      isLti: true,
      isSiso: true,
      isMimo: false,
      isNonlinear: false,
      hasTransferFunction: true,
      hasStateSpace: false,
      supportsStepResponse: true,
      supportsRootLocus: true,
      supportsBode: true,
      supportsNyquist: true,
      supportsSerialCorrection: true,
      supportsPid: true,
      supportsCompositeControl: false,
      supportsIdentification: false,
      supportsMpc: true,
      supportsVirtualSimulationPreview: true,
      supportsOfficialEvaluation: true,
    };
  }

  if (isBlackBox && isVirtualSim) {
    return {
      isLti: false,
      isSiso: false,
      isMimo: false,
      isNonlinear: false,
      hasTransferFunction: false,
      hasStateSpace: false,
      supportsStepResponse: false,
      supportsRootLocus: false,
      supportsBode: false,
      supportsNyquist: false,
      supportsSerialCorrection: false,
      supportsPid: false,
      supportsCompositeControl: false,
      supportsIdentification: true,
      supportsMpc: false,
      supportsVirtualSimulationPreview: true,
      supportsOfficialEvaluation: true,
    };
  }

  return {
    isLti: false,
    isSiso: false,
    isMimo: false,
    isNonlinear: false,
    hasTransferFunction: false,
    hasStateSpace: false,
    supportsStepResponse: false,
    supportsRootLocus: false,
    supportsBode: false,
    supportsNyquist: false,
    supportsSerialCorrection: false,
    supportsPid: false,
    supportsCompositeControl: false,
    supportsIdentification: false,
    supportsMpc: false,
    supportsVirtualSimulationPreview: false,
    supportsOfficialEvaluation: false,
  };
}
