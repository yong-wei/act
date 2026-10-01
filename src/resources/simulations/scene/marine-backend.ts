/** Three.js 的公开后端标志在生产压缩后仍稳定；类名不属于运行时契约。 */
export function marineBackendName(backend: object): 'WebGPUBackend' | 'WebGLBackend' {
  if ('isWebGPUBackend' in backend && backend.isWebGPUBackend === true) return 'WebGPUBackend';
  if ('isWebGLBackend' in backend && backend.isWebGLBackend === true) return 'WebGLBackend';
  throw new Error('无法识别海面图形后端。');
}
