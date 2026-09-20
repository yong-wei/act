/** 最小渲染器契约（避免 quality 模块反向依赖 three 类型细节）。 */
export interface THREE_WebGLRendererLike {
  getContext(): unknown;
}
