// 幅角原理模块类型定义

export type InputFormat = 'tf' | 'zpk' | 'expr';

export type ContourType = 'circle' | 'semicircle' | 'rectangle' | 'manual';

export interface ComplexNumber {
  re: number;
  im: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface CanvasTransform {
  x: number;      // 中心点X偏移
  y: number;      // 中心点Y偏移
  scale: number;  // 缩放比例
}

export interface TransferFunctionInput {
  numerator: number[];   // 分子多项式系数（降幂排列）
  denominator: number[];
}

export interface ZeroPoleGainInput {
  zeros: ComplexNumber[];
  poles: ComplexNumber[];
  gain: number;
}

export interface ParsedFunction {
  expression: string;
  zeros: ComplexNumber[];
  poles: ComplexNumber[];
  gain: number;
}

export interface ContourParams {
  type: ContourType;
  radius: number;      // 圆形/半圆半径
  width: number;       // 矩形宽度
  height: number;      // 矩形高度
}

export interface AnalysisResult {
  windingNumber: number;
  zeroPoleBalance: number;
  isStable: boolean;
}

export interface PresetExample {
  id: string;
  label: string;
  format: InputFormat;
  data: TransferFunctionInput | ZeroPoleGainInput | { expression: string };
}

// 画布绘制配置
export interface CanvasConfig {
  gridColor: string;
  axisColor: string;
  zeroColor: string;
  poleColor: string;
  contourColor: string;
  mappedColor: string;
  bgColor: string;
}

// 默认深色主题配置
export const defaultCanvasConfig: CanvasConfig = {
  gridColor: 'rgba(100, 116, 139, 0.3)',   // slate-500/30
  axisColor: 'rgba(226, 232, 240, 0.7)',   // slate-200/70
  zeroColor: '#22c55e',                     // green-500
  poleColor: '#ef4444',                     // red-500
  contourColor: '#3b82f6',                  // blue-500
  mappedColor: '#22c55e',                   // green-500
  bgColor: '#0f172a',                       // slate-900
};
