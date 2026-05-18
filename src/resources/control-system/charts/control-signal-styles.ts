export type ControlSignalCurveStyle = {
  color: string;
  lineType: 'solid' | 'dashed' | 'dotted';
  width?: number;
};

export const CONTROL_SIGNAL_CURVE_STYLES = {
  reference: { color: '#22c55e', lineType: 'dashed' },
  uncorrectedOutput: { color: '#64748b', lineType: 'solid' },
  correctedOutput: { color: '#0ea5e9', lineType: 'solid' },
  disturbance: { color: '#ef4444', lineType: 'dashed' },
  uncorrectedOpenLoop: { color: '#64748b', lineType: 'solid' },
  correctedOpenLoop: { color: '#0ea5e9', lineType: 'solid' },
  correctionDevice: { color: '#f97316', lineType: 'dashed' },
} as const satisfies Record<string, ControlSignalCurveStyle>;
