'use client';

import { Component, type ReactNode } from 'react';

export class ModelAssetErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode; onError?: (error: Error) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function FallbackGltfModel({
  candidates,
  render,
  onCandidateError,
}: {
  candidates: readonly string[];
  render: (url: string) => ReactNode;
  onCandidateError?: (url: string, error: Error) => void;
}) {
  const [primary, ...rest] = candidates;
  if (!primary) return null;
  if (rest.length === 0) return <>{render(primary)}</>;
  // 主候选变化时重建边界：一次回退失败后，新的主候选（如更高/更低档 LOD）
  // 仍有机会直接挂载，而不是被已 failed 的边界永远压制在回退链上。
  return (
    <ModelAssetErrorBoundary key={primary} onError={error => onCandidateError?.(primary, error)}
      fallback={<FallbackGltfModel candidates={rest} render={render} onCandidateError={onCandidateError} />}>
      {render(primary)}
    </ModelAssetErrorBoundary>
  );
}
