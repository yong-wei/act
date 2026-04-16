import { isDynamicUsageError } from 'next/dist/export/helpers/is-dynamic-usage-error';

/**
 * Next.js 在静态探测阶段会抛出内部动态使用异常，用于把当前路由切换为动态渲染。
 * 这类异常不能被业务层吞掉，否则构建日志会被误报刷屏。
 */
export function rethrowIfNextDynamicError(error: unknown) {
  if (isDynamicUsageError(error)) {
    throw error;
  }
}
