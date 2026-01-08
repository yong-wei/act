export interface TelemetryPoint {
  r: number;
  y: number;
  u: number;
  distance: number;
}

const history: TelemetryPoint[] = [];

export const appendTelemetry = (point: TelemetryPoint) => {
  history.push(point);
};

export const clearTelemetry = () => {
  history.length = 0;
};

export const getTelemetryHistory = () => history;
