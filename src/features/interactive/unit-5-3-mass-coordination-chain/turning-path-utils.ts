import type { NonlinearPoint } from '@/resources/control-system/analysis/nonlinear-analysis-types';

export type EqualCoordinateScaleConfig = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  plotX: number;
  plotY: number;
  plotWidth: number;
  plotHeight: number;
};

export function polylineLength(points: NonlinearPoint[]) {
  return points.reduce((sum, point, index) => {
    if (index === 0) return sum;
    const previous = points[index - 1];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

export function completePlannedPathToActualExtent(
  planned: NonlinearPoint[],
  actual: NonlinearPoint[],
) {
  if (planned.length < 2 || actual.length < 2) return planned;

  const completed = [...planned];
  const actualStart = actual[0];
  const plannedStart = completed[0];
  if (Math.hypot(plannedStart.x - actualStart.x, plannedStart.y - actualStart.y) > 1e-6) {
    completed.unshift({ x: actualStart.x, y: actualStart.y });
  }

  const actualLength = polylineLength(actual);
  const completedLength = polylineLength(completed);
  if (actualLength <= 0 || completedLength >= actualLength * 0.92) return completed;

  const direction = lastDistinctDirection(completed) ?? lastDistinctDirection(actual);
  if (!direction) return completed;

  const extensionLength = actualLength - completedLength;
  completed.push({
    x: direction.origin.x + direction.unitX * extensionLength,
    y: direction.origin.y + direction.unitY * extensionLength,
  });
  return completed;
}

function lastDistinctDirection(points: NonlinearPoint[]) {
  const origin = points[points.length - 1];
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const previous = points[index];
    const dx = origin.x - previous.x;
    const dy = origin.y - previous.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength > 1e-6) {
      return {
        origin,
        unitX: dx / segmentLength,
        unitY: dy / segmentLength,
      };
    }
  }
  return null;
}

export function createEqualCoordinateScale(config: EqualCoordinateScaleConfig) {
  const xRange = Math.max(1e-6, config.maxX - config.minX);
  const yRange = Math.max(1e-6, config.maxY - config.minY);
  const scale = Math.min(config.plotWidth / xRange, config.plotHeight / yRange);
  const usedWidth = xRange * scale;
  const usedHeight = yRange * scale;
  const offsetX = config.plotX + (config.plotWidth - usedWidth) / 2;
  const offsetY = config.plotY + (config.plotHeight - usedHeight) / 2;

  const scaleX = (x: number) => offsetX + (x - config.minX) * scale;
  const scaleY = (y: number) => offsetY + usedHeight - (y - config.minY) * scale;
  const scaleRadius = (radius: number) => Math.abs(radius * scale);

  return {
    scaleX,
    scaleY,
    scaleRadius,
    plotLeft: offsetX,
    plotRight: offsetX + usedWidth,
    plotTop: offsetY,
    plotBottom: offsetY + usedHeight,
  };
}
