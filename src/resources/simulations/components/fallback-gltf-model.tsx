'use client';

import { Component, type ReactNode } from 'react';

export class ModelAssetErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function FallbackGltfModel({
  candidates,
  render,
}: {
  candidates: readonly string[];
  render: (url: string) => ReactNode;
}) {
  const [primary, ...rest] = candidates;
  if (!primary) return null;
  if (rest.length === 0) return <>{render(primary)}</>;
  return (
    <ModelAssetErrorBoundary fallback={<FallbackGltfModel candidates={rest} render={render} />}>
      {render(primary)}
    </ModelAssetErrorBoundary>
  );
}
