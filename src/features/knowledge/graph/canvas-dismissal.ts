const BLANK_GESTURE_MOVE_THRESHOLD = 4;

export interface KnowledgeCanvasBlankGesture {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  completed: boolean;
}

export function startKnowledgeCanvasBlankGesture(input: {
  pointerId: number;
  clientX: number;
  clientY: number;
}): KnowledgeCanvasBlankGesture {
  return {
    pointerId: input.pointerId,
    startX: input.clientX,
    startY: input.clientY,
    moved: false,
    completed: false,
  };
}

export function finishKnowledgeCanvasBlankGesture(
  gesture: KnowledgeCanvasBlankGesture | null,
  input: { pointerId: number }
): KnowledgeCanvasBlankGesture | null {
  if (!gesture || gesture.pointerId !== input.pointerId) return gesture;
  return { ...gesture, completed: true };
}

export function moveKnowledgeCanvasBlankGesture(
  gesture: KnowledgeCanvasBlankGesture | null,
  input: { pointerId: number; clientX: number; clientY: number }
): KnowledgeCanvasBlankGesture | null {
  if (!gesture || gesture.pointerId !== input.pointerId || gesture.moved) return gesture;
  return {
    ...gesture,
    moved: Math.hypot(input.clientX - gesture.startX, input.clientY - gesture.startY)
      > BLANK_GESTURE_MOVE_THRESHOLD,
  };
}

export function shouldDismissKnowledgeCanvasBlankGesture(
  gesture: KnowledgeCanvasBlankGesture | null
): boolean {
  return Boolean(gesture?.completed && !gesture.moved);
}

export function isKnowledgeCanvasPolylineHit(input: {
  x: number;
  y: number;
  points: Array<{ x: number; y: number }>;
  tolerance: number;
}): boolean {
  for (let index = 1; index < input.points.length; index += 1) {
    const start = input.points[index - 1];
    const end = input.points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const progress = lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, ((input.x - start.x) * dx + (input.y - start.y) * dy) / lengthSquared));
    const nearestX = start.x + dx * progress;
    const nearestY = start.y + dy * progress;
    if (Math.hypot(input.x - nearestX, input.y - nearestY) <= input.tolerance) return true;
  }
  return false;
}
