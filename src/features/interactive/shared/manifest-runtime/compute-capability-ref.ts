import { stringField } from './manifest-payload-fields';

export function computeCapabilityRef(payload: Record<string, unknown>) {
  return stringField(payload, ['capabilityRef', 'capability_ref', 'capability']);
}
