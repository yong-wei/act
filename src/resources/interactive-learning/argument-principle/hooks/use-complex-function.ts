import { useState, useCallback } from 'react';
import * as math from 'mathjs';
import type {
  ComplexNumber,
  InputFormat,
  ParsedFunction,
  TransferFunctionInput,
  ZeroPoleGainInput,
} from '../types';

// 解析复数字符串 (如: "1+2i", "-1.5i", "3")
function parseComplexString(str: string): ComplexNumber | null {
  try {
    const trimmed = str.trim();
    if (!trimmed) return null;

    // 使用mathjs解析
    const result = math.complex(trimmed);
    return { re: result.re, im: result.im };
  } catch {
    return null;
  }
}

// 计算多项式的根（使用求根公式或数值方法）
function findPolynomialRoots(coefficients: number[]): ComplexNumber[] {
  if (coefficients.length <= 1) return [];

  try {
    // 使用 mathjs 的 roots 函数来计算多项式的根
    // 需要将系数从降幂转为升幂排列
    const reversedCoeffs = coefficients.slice().reverse();

    // 对于二次多项式使用求根公式
    if (reversedCoeffs.length === 3) {
      const [c, b, a] = reversedCoeffs;
      const discriminant = b * b - 4 * a * c;
      if (discriminant >= 0) {
        const sqrtD = Math.sqrt(discriminant);
        return [
          { re: (-b + sqrtD) / (2 * a), im: 0 },
          { re: (-b - sqrtD) / (2 * a), im: 0 },
        ];
      } else {
        const sqrtD = Math.sqrt(-discriminant);
        return [
          { re: -b / (2 * a), im: sqrtD / (2 * a) },
          { re: -b / (2 * a), im: -sqrtD / (2 * a) },
        ];
      }
    }

    // 对于一次多项式
    if (reversedCoeffs.length === 2) {
      const [c, b] = reversedCoeffs;
      return [{ re: -c / b, im: 0 }];
    }

    // 对于更高阶多项式，使用mathjs
    const polyFunc = (math as Record<string, unknown>).polynomialRoot as (
      ...args: number[]
    ) => (number | math.Complex)[];
    const roots = polyFunc(...reversedCoeffs);
    return roots.map((root) => {
      if (typeof root === 'number') {
        return { re: root, im: 0 };
      }
      const c = root as math.Complex;
      return { re: c.re, im: c.im };
    });
  } catch {
    return [];
  }
}

// 计算复数函数值 F(s)
function evaluateFunction(
  s: ComplexNumber,
  zeros: ComplexNumber[],
  poles: ComplexNumber[],
  gain: number
): ComplexNumber {
  let result = math.complex(gain, 0);

  // 乘以 (s - zero)
  for (const zero of zeros) {
    const diff = math.subtract(
      math.complex(s.re, s.im),
      math.complex(zero.re, zero.im)
    ) as math.Complex;
    result = math.multiply(result, diff) as math.Complex;
  }

  // 除以 (s - pole)
  for (const pole of poles) {
    const diff = math.subtract(
      math.complex(s.re, s.im),
      math.complex(pole.re, pole.im)
    ) as math.Complex;
    result = math.divide(result, diff) as math.Complex;
  }

  return { re: (result as math.Complex).re, im: (result as math.Complex).im };
}

export function useComplexFunction() {
  const [inputFormat, setInputFormat] = useState<InputFormat>('tf');
  const [parsedFunction, setParsedFunction] = useState<ParsedFunction | null>(null);
  const [parseError, setParseError] = useState<string>('');

  // 解析传递函数格式
  const parseTransferFunction = useCallback((input: TransferFunctionInput): ParsedFunction | null => {
    try {
      const { numerator, denominator } = input;

      if (numerator.length === 0 || denominator.length === 0) {
        throw new Error('分子或分母不能为空');
      }

      const zeros = findPolynomialRoots(numerator);
      const poles = findPolynomialRoots(denominator);

      // 计算增益 (首项系数比)
      const gain = numerator[0] / denominator[0];

      // 生成表达式字符串
      const numStr = numerator.map((c, i) => {
        const power = numerator.length - 1 - i;
        if (c === 0) return '';
        const sign = c >= 0 ? (i === 0 ? '' : '+') : '';
        if (power === 0) return `${sign}${c}`;
        if (power === 1) return `${sign}${c === 1 ? '' : c}s`;
        return `${sign}${c === 1 ? '' : c}s^${power}`;
      }).filter(Boolean).join('') || '0';

      const denStr = denominator.map((c, i) => {
        const power = denominator.length - 1 - i;
        if (c === 0) return '';
        const sign = c >= 0 ? (i === 0 ? '' : '+') : '';
        if (power === 0) return `${sign}${c}`;
        if (power === 1) return `${sign}${c === 1 ? '' : c}s`;
        return `${sign}${c === 1 ? '' : c}s^${power}`;
      }).filter(Boolean).join('') || '0';

      return {
        expression: `(${numStr})/(${denStr})`,
        zeros,
        poles,
        gain,
      };
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '解析错误');
      return null;
    }
  }, []);

  // 解析零极点格式
  const parseZeroPoleGain = useCallback((input: ZeroPoleGainInput): ParsedFunction | null => {
    try {
      return {
        expression: `K=${input.gain}, zeros=[${input.zeros.map(z => `${z.re}+${z.im}i`).join(', ')}], poles=[${input.poles.map(p => `${p.re}+${p.im}i`).join(', ')}]`,
        zeros: input.zeros,
        poles: input.poles,
        gain: input.gain,
      };
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '解析错误');
      return null;
    }
  }, []);

  // 解析自然表达式
  const parseExpression = useCallback((expr: string): ParsedFunction | null => {
    try {
      // 简单的表达式解析 - 这里使用mathjs来评估
      // 对于复杂表达式，我们需要提取零点和极点
      const node = math.parse(expr);
      const compiled = node.compile();

      // 尝试在几个点评估来验证表达式
      try {
        compiled.evaluate({ s: math.complex(1, 0) });
      } catch {
        throw new Error('无效的表达式');
      }

      // 对于简单表达式，我们无法直接提取零极点
      // 返回一个空的零极点列表，让用户使用其他格式
      return {
        expression: expr,
        zeros: [],
        poles: [],
        gain: 1,
      };
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '解析错误');
      return null;
    }
  }, []);

  // 解析输入
  const parse = useCallback(
    (format: InputFormat, input: unknown) => {
      setParseError('');

      let result: ParsedFunction | null = null;

      switch (format) {
        case 'tf':
          result = parseTransferFunction(input as TransferFunctionInput);
          break;
        case 'zpk':
          result = parseZeroPoleGain(input as ZeroPoleGainInput);
          break;
        case 'expr':
          result = parseExpression((input as { expression: string }).expression);
          break;
      }

      if (result) {
        setParsedFunction(result);
      }

      return result;
    },
    [parseTransferFunction, parseZeroPoleGain, parseExpression]
  );

  // 计算复数函数值
  const evaluate = useCallback(
    (s: ComplexNumber): ComplexNumber | null => {
      if (!parsedFunction) return null;
      return evaluateFunction(s, parsedFunction.zeros, parsedFunction.poles, parsedFunction.gain);
    },
    [parsedFunction]
  );

  // 解析复数字符串列表
  const parseComplexList = useCallback((str: string): ComplexNumber[] => {
    return str
      .split(',')
      .map((s) => parseComplexString(s.trim()))
      .filter((c): c is ComplexNumber => c !== null);
  }, []);

  // 解析系数列表
  const parseCoefficients = useCallback((str: string): number[] => {
    return str
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));
  }, []);

  return {
    inputFormat,
    setInputFormat,
    parsedFunction,
    parseError,
    parse,
    evaluate,
    parseComplexList,
    parseCoefficients,
  };
}
