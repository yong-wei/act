import type { ThreeElement } from '@react-three/fiber';
import type * as THREE from 'three';

type WaterShaderMaterialProps = ThreeElement<typeof THREE.ShaderMaterial> & {
  uTime?: number;
  uColor?: THREE.Color;
  uFoamColor?: THREE.Color;
  uSunPosition?: THREE.Vector3;
  uWaveAmplitude?: number;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      waterShaderMaterial: WaterShaderMaterialProps;
    }
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      waterShaderMaterial: WaterShaderMaterialProps;
    }
  }
}

declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      waterShaderMaterial: WaterShaderMaterialProps;
    }
  }
}
