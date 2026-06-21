export const EMPTY_LESSON_PLAN_MESSAGE = '教案至少 1 个环节，请先添加资源或知识节点后再保存或开始上课。';

export function hasLaunchableLessonItems(items: unknown): boolean {
  return Array.isArray(items) && items.length > 0;
}
