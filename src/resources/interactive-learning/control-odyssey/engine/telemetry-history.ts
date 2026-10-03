export interface TelemetryPoint {
  r: number;
  y: number;
  u: number;
  distance: number;
}

const listeners = new Set<() => void>();
export const subscribeTelemetry = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const changed = () => { listeners.forEach(listener => listener()); };

const history: TelemetryPoint[] = [];

export const appendTelemetry = (point: TelemetryPoint) => {
  history.push(point);
  changed();
};

export const clearTelemetry = () => {
  history.length = 0;
  changed();
};

export const getTelemetryHistory = () => history;
