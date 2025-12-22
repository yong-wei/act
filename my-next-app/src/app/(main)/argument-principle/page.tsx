'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { parse, complex, polynomialRoot, evaluate, type Complex, type MathNode } from 'mathjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

// Helper types for canvas transformations
type Transform = {
  x: number;
  y: number;
  scale: number;
};

type Point = {
  x: number;
  y: number;
};

export default function ArgumentPrinciplePage() {
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const mappedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [inputFormat, setInputFormat] = useState('tf');
  const [numerator, setNumerator] = useState('1, 0, -1');
  const [denominator, setDenominator] = useState('1, 1');
  const [zerosInput, setZerosInput] = useState('1, -1');
  const [polesInput, setPolesInput] = useState('-1');
  const [gainInput, setGainInput] = useState('1');
  const [expression, setExpression] = useState('(s^2-1)/(s+1)');
  const [contourType, setContourType] = useState('circle');
  const [contourRadius, setContourRadius] = useState(2);
  const [contourWidth, setContourWidth] = useState(2);
  const [contourHeight, setContourHeight] = useState(2);
  const [parsingResult, setParsingResult] = useState('<p>等待输入函数...</p>');
  const [mappingResult, setMappingResult] = useState('<p>等待绘制包围线...</p>');
  const [showInfo, setShowInfo] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ message: string; isError: boolean } | null>(null);

  // Internal state for parsed function and contour points
  const currentFunction = useRef<string | null>(null);
  const zeros = useRef<Complex[]>([]);
  const poles = useRef<Complex[]>([]);
  const gain = useRef<number>(1);
  const worldContourPoints = useRef<Point[]>([]);
  const contourPoints = useRef<Point[]>([]); // Canvas coordinates
  const mappedPoints = useRef<Point[]>([]);

  const transform = useRef({
    source: { x: 0, y: 0, scale: 1 },
    mapped: { x: 0, y: 0, scale: 1 },
  });

  const showToast = useCallback((message: string, isError: boolean = false) => {
    setToastMessage({ message, isError });
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Helper to transform world coordinates to canvas coordinates
  const transformPoint = useCallback((point: Point, currentTransform: Transform): Point => {
    return {
      x: currentTransform.x + point.x * currentTransform.scale,
      y: currentTransform.y - point.y * currentTransform.scale, // Y-axis inverted
    };
  }, []);

  // Helper to draw grid
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, currentTransform: Transform) => {
    ctx.save();
    const scale = currentTransform.scale;
    const centerX = currentTransform.x;
    const centerY = currentTransform.y;

    const visibleWidth = canvas.width / scale;
    const visibleHeight = canvas.height / scale;

    const startX = -centerX / scale;
    const startY = (centerY - canvas.height) / scale;
    const endX = startX + visibleWidth;
    const endY = startY + visibleHeight;

    const getGridSize = (t: Transform, c: HTMLCanvasElement) => {
      const vw = c.width / t.scale;
      const vh = c.height / t.scale;
      const targetGridCount = 7;
      let gs = Math.max(vw, vh) / targetGridCount;
      const power = Math.floor(Math.log10(gs));
      const base = Math.pow(10, power);
      const fraction = gs / base;
      if (fraction < 1.5) gs = base;
      else if (fraction < 3.5) gs = 2 * base;
      else if (fraction < 7.5) gs = 5 * base;
      else gs = 10 * base;
      return gs;
    };

    const gridSize = getGridSize(currentTransform, canvas);

    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;

    let x = Math.ceil(startX / gridSize) * gridSize;
    while (x <= endX) {
      const canvasX = centerX + x * scale;
      if (canvasX >= 0 && canvasX <= canvas.width) {
        ctx.beginPath();
        ctx.moveTo(canvasX, 0);
        ctx.lineTo(canvasX, canvas.height);
        ctx.stroke();
      }
      x += gridSize;
    }

    let y = Math.ceil(startY / gridSize) * gridSize;
    while (y <= endY) {
      const canvasY = centerY - y * scale;
      if (canvasY >= 0 && canvasY <= canvas.height) {
        ctx.beginPath();
        ctx.moveTo(0, canvasY);
        ctx.lineTo(0, canvasY);
        ctx.lineTo(canvas.width, canvasY);
        ctx.stroke();
      }
      y += gridSize;
    }
    ctx.restore();
  }, []);

  // Helper to draw axes
  const drawAxes = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, currentTransform: Transform) => {
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#000';

    const centerX = currentTransform.x;
    const centerY = currentTransform.y;

    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, canvas.height);
    ctx.stroke();

    const arrowSize = 8;
    ctx.beginPath();
    ctx.moveTo(canvas.width - arrowSize, centerY - arrowSize / 2);
    ctx.lineTo(canvas.width, centerY);
    ctx.lineTo(canvas.width - arrowSize, centerY + arrowSize / 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(centerX - arrowSize / 2, arrowSize);
    ctx.lineTo(centerX, 0);
    ctx.lineTo(centerX + arrowSize / 2, arrowSize);
    ctx.fill();
    ctx.restore();

    // Draw ticks
    const gridSize = (function getGridSize(t: Transform, c: HTMLCanvasElement) {
      const vw = c.width / t.scale;
      const vh = c.height / t.scale;
      const targetGridCount = 7;
      let gs = Math.max(vw, vh) / targetGridCount;
      const power = Math.floor(Math.log10(gs));
      const base = Math.pow(10, power);
      const fraction = gs / base;
      if (fraction < 1.5) gs = base;
      else if (fraction < 3.5) gs = 2 * base;
      else if (fraction < 7.5) gs = 5 * base;
      else gs = 10 * base;
      return gs;
    })(currentTransform, canvas);

    const tickInterval = gridSize;

    ctx.fillStyle = '#000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const visibleWidth = canvas.width / currentTransform.scale;
    const visibleHeight = canvas.height / currentTransform.scale;
    const startX = -centerX / currentTransform.scale;
    const startY = (centerY - canvas.height) / currentTransform.scale;
    const endX = startX + visibleWidth;
    const endY = startY + visibleHeight;

    let x = Math.ceil(startX / tickInterval) * tickInterval;
    while (x <= endX) {
      const canvasX = centerX + x * currentTransform.scale;
      if (canvasX > 20 && canvasX < canvas.width - 20) {
        ctx.beginPath();
        ctx.moveTo(canvasX, centerY - 3);
        ctx.lineTo(canvasX, centerY + 3);
        ctx.stroke();
        ctx.fillText(x.toFixed(1), canvasX, centerY + 5);
      }
      x += tickInterval;
    }

    let y = Math.ceil(startY / tickInterval) * tickInterval;
    while (y <= endY) {
      const canvasY = centerY - y * currentTransform.scale;
      if (canvasY > 20 && canvasY < canvas.height - 20) {
        ctx.beginPath();
        ctx.moveTo(centerX - 3, canvasY);
        ctx.lineTo(centerX + 3, canvasY);
        ctx.stroke();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(y.toFixed(1), centerX - 5, canvasY);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
      }
      y += tickInterval;
    }
  }, []);

  // Helper to draw poles and zeros
  const drawPolesAndZeros = useCallback((ctx: CanvasRenderingContext2D, currentTransform: Transform) => {
    ctx.fillStyle = 'rgba(0, 200, 0, 0.7)';
    zeros.current.forEach(z => {
      const point = transformPoint({ x: z.re, y: z.im }, currentTransform);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(200, 0, 0, 0.7)';
    ctx.lineWidth = 2;
    poles.current.forEach(p => {
      const point = transformPoint({ x: p.re, y: p.im }, currentTransform);
      ctx.beginPath();
      ctx.moveTo(point.x - 5, point.y - 5);
      ctx.lineTo(point.x + 5, point.y + 5);
      ctx.moveTo(point.x + 5, point.y - 5);
      ctx.lineTo(point.x - 5, point.y + 5);
      ctx.stroke();
    });
  }, [transformPoint]);

  // Function to draw the source plane
  const drawSourcePlane = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas, transform.current.source);
    drawAxes(ctx, canvas, transform.current.source);
    drawPolesAndZeros(ctx, transform.current.source);

    // Draw contour
    if (contourPoints.current.length > 1) {
      ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(contourPoints.current[0].x, contourPoints.current[0].y);
      for (let i = 1; i < contourPoints.current.length; i++) {
        ctx.lineTo(contourPoints.current[i].x, contourPoints.current[i].y);
      }
      ctx.stroke();
    }
  }, [drawGrid, drawAxes, drawPolesAndZeros]);

  // Function to draw the mapped plane
  const drawMappedPlane = useCallback(() => {
    const canvas = mappedCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas, transform.current.mapped);
    drawAxes(ctx, canvas, transform.current.mapped);

    // Draw mapped path
    if (mappedPoints.current.length > 1) {
      ctx.strokeStyle = 'rgba(0, 128, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const firstPoint = transformPoint(mappedPoints.current[0], transform.current.mapped);
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (let i = 1; i < mappedPoints.current.length; i++) {
        const point = transformPoint(mappedPoints.current[i], transform.current.mapped);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }
  }, [drawGrid, drawAxes, transformPoint]);

  // Parse complex number string (simplified for now)
  const parseComplex = useCallback((str: string): Complex => {
    try {
      return complex(str);
    } catch (e) {
      console.warn(`Could not parse complex number: ${str}`, e);
      return complex(0, 0);
    }
  }, []);

  // Find roots of a polynomial (using mathjs)
  const findRoots = useCallback((coefs: number[]): Complex[] => {
    try {
      // Filter out leading zeros
      let effectiveCoefs = [...coefs];
      while (effectiveCoefs.length > 0 && Math.abs(effectiveCoefs[0]) < 1e-10) {
        effectiveCoefs.shift();
      }

      if (effectiveCoefs.length === 0) return [];
      if (effectiveCoefs.length === 1) return [];

      const roots = polynomialRoot(effectiveCoefs);
      return roots.map(r => complex(r));
    } catch (e) {
      console.error("Error finding roots:", e);
      return [];
    }
  }, []);

  // Convert polynomial coefficients to expression string
  const polynomialToExpression = useCallback((numCoefs: number[], denCoefs: number[]): string => {
    const buildPoly = (c: number[]) => {
      if (c.length === 0) return "0";
      let expr = "";
      for (let i = 0; i < c.length; i++) {
        const power = c.length - 1 - i;
        if (c[i] === 0) continue;
        if (expr !== "") expr += (c[i] > 0 ? " + " : " - ");
        else if (c[i] < 0) expr += "-";

        const absCoef = Math.abs(c[i]);
        if (power === 0) expr += absCoef;
        else if (power === 1) expr += (absCoef === 1 ? "" : absCoef) + "s";
        else expr += (absCoef === 1 ? "" : absCoef) + `s^${power}`;
      }
      return expr || "0";
    };

    const numExpr = buildPoly(numCoefs);
    const denExpr = buildPoly(denCoefs);

    if (denExpr === "1" || denExpr === "0") return numExpr; // Handle division by 1 or 0
    return `(${numExpr})/(${denExpr})`;
  }, []);

  // Parse zeros, poles, and gain from expression string
  const parseZerosAndPolesFromExpression = useCallback((expr: string) => {
    let parsedZeros: Complex[] = [];
    let parsedPoles: Complex[] = [];
    let parsedGain: number = 1;

    try {
      const node = parse(expr);

      // Simplified logic: assumes expression is a rational function
      // More robust parsing would involve symbolic manipulation to find roots
      if (node.type === 'OperatorNode' && node.op === '/') {
        const numeratorNode = node.args[0];
        const denominatorNode = node.args[1];

        // Attempt to get coefficients for roots
        const numCoefs = getPolynomialCoefficients(numeratorNode);
        const denCoefs = getPolynomialCoefficients(denominatorNode);

        parsedZeros = findRoots(numCoefs);
        parsedPoles = findRoots(denCoefs);

        const numLeading = numCoefs.length > 0 ? numCoefs[0] : 1;
        const denLeading = denCoefs.length > 0 ? denCoefs[0] : 1;
        parsedGain = numLeading / denLeading;

      } else {
        // If not a fraction, assume it's just a numerator
        const coefs = getPolynomialCoefficients(node);
        parsedZeros = findRoots(coefs);
        parsedGain = coefs.length > 0 ? coefs[0] : 1;
      }
    } catch (e) {
      console.error("Error parsing expression for roots:", e);
      showToast("表达式解析失败，无法提取零极点。", true);
    }
    return { zeros: parsedZeros, poles: parsedPoles, gain: parsedGain };
  }, [findRoots, showToast]);

  // Helper to get polynomial coefficients from a math.js node
  const getPolynomialCoefficients = useCallback((node: MathNode): number[] => {
    // This is a simplified implementation. A full implementation would require
    // more robust symbolic manipulation to convert any expression to polynomial coefficients.
    // For now, it handles simple polynomial forms.
    try {
      const simplified = node.simplify();
      const s = complex(1, 0); // Substitute s=1 to get a value, not ideal for coefficients
      // A proper way would be to expand and collect terms based on 's' powers.
      // This is a placeholder and might not work for all complex expressions.
      // For a robust solution, consider a dedicated symbolic algebra library or more complex parsing.

      // Attempt to extract coefficients for simple cases like (s+a)(s+b) or s^n + ...
      // This part is highly dependent on the structure of the expression.
      // For the given examples, direct evaluation at specific points might work for simple polynomials.

      // Fallback: if it's a simple constant or 's'
      if (simplified.type === 'ConstantNode') return [simplified.value];
      if (simplified.type === 'SymbolNode' && simplified.name === 's') return [1, 0];

      // For more complex polynomials, a direct coefficient extraction from a parsed tree is hard.
      // A common workaround for simple cases is to evaluate at multiple points and solve linear equations,
      // or to use a library that can convert to polynomial form.

      // For the purpose of this demo, we'll assume simple polynomial structures
      // and might need to manually parse them or rely on `math.polynomialRoot` directly
      // if the expression can be converted to coefficients.

      // Example: (s^2-1) -> [1, 0, -1]
      // This requires a more advanced symbolic parser than basic mathjs `parse` provides for coefficient extraction.
      // For now, return a dummy or throw an error if not a simple case.
      console.warn("getPolynomialCoefficients: Complex expression, returning dummy coefficients.");
      return []; // Placeholder

    } catch (e) {
      console.error("Error getting polynomial coefficients:", e);
      return [];
    }
  }, []);

  // Update parsing result display
  const updateParsingResult = useCallback(() => {
    let html = '<p><strong>函数解析结果:</strong></p>';
    if (zeros.current.length > 0) {
      html += `<p>零点: ${zeros.current.map(z => `${z.re.toFixed(2)}${z.im >= 0 ? '+' : ''}${z.im.toFixed(2)}i`).join(', ')}</p>`;
    } else {
      html += '<p>零点: 无</p>';
    }
    if (poles.current.length > 0) {
      html += `<p>极点: ${poles.current.map(p => `${p.re.toFixed(2)}${p.im >= 0 ? '+' : ''}${p.im.toFixed(2)}i`).join(', ')}</p>`;
    } else {
      html += '<p>极点: 无</p>';
    }
    html += `<p>增益: ${gain.current.toFixed(2)}</p>`;
    setParsingResult(html);
  }, []);

  // Update mapping result display
  const updateMappingResult = useCallback(() => {
    let html = '<p><strong>映射分析:</strong></p>';
    if (mappedPoints.current.length > 1) {
      const windingNumber = calculateWindingNumber();
      html += `<p>绕原点圈数: ${windingNumber}</p>`;
      html += `<p>零点数量 - 极点数量 ≈ ${windingNumber}</p>`;
    } else {
      html += '<p>请先绘制包围线</p>';
    }
    setMappingResult(html);
  }, []);

  // Calculate winding number
  const calculateWindingNumber = useCallback((): number => {
    if (mappedPoints.current.length < 2) return 0;

    let totalAngle = 0;
    let prevAngle = Math.atan2(mappedPoints.current[0].y, mappedPoints.current[0].x);

    for (let i = 1; i < mappedPoints.current.length; i++) {
      const currentAngle = Math.atan2(mappedPoints.current[i].y, mappedPoints.current[i].x);
      let delta = currentAngle - prevAngle;

      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;

      totalAngle += delta;
      prevAngle = currentAngle;
    }
    return Math.round(totalAngle / (2 * Math.PI));
  }, []);

  // Parse function based on input format
  const parseFunction = useCallback(() => {
    try {
      let numCoefs: number[] = [];
      let denCoefs: number[] = [];

      if (inputFormat === 'tf') {
        numCoefs = numerator.split(',').map(s => parseFloat(s.trim()));
        denCoefs = denominator.split(',').map(s => parseFloat(s.trim()));
        if (numCoefs.some(isNaN) || denCoefs.some(isNaN)) {
          throw new Error("请输入有效的多项式系数");
        }
        currentFunction.current = polynomialToExpression(numCoefs, denCoefs);
      } else if (inputFormat === 'zpk') {
        zeros.current = zerosInput.split(',').map(s => parseComplex(s.trim()));
        poles.current = polesInput.split(',').map(s => parseComplex(s.trim()));
        gain.current = parseFloat(gainInput);
        if (isNaN(gain.current)) {
          throw new Error("请输入有效的增益值");
        }
        // This zpkToExpression needs to be implemented or adapted from original JS
        // For now, setting currentFunction to a placeholder
        currentFunction.current = `(${zeros.current.map(z => `(s-${z.re.toFixed(2)})`).join('*')}) / (${poles.current.map(p => `(s-${p.re.toFixed(2)})`).join('*')})`;
      } else if (inputFormat === 'expr') {
        currentFunction.current = expression || '1';
        const { zeros: exprZeros, poles: exprPoles, gain: exprGain } = parseZerosAndPolesFromExpression(currentFunction.current);
        zeros.current = exprZeros;
        poles.current = exprPoles;
        gain.current = exprGain;
      }

      // Calculate view bounds and adjust transform
      const allPoints = [...zeros.current, ...poles.current];
      const calculateViewBounds = (points: Complex[]) => {
        if (points.length === 0) return { minX: -2, maxX: 2, minY: -2, maxY: 2 };
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(p => {
          minX = Math.min(minX, p.re);
          maxX = Math.max(maxX, p.re);
          minY = Math.min(minY, p.im);
          maxY = Math.max(maxY, p.im);
        });
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const paddingX = rangeX * 0.5;
        const paddingY = rangeY * 0.5;
        return { minX: minX - paddingX, maxX: maxX + paddingX, minY: minY - paddingY, maxY: maxY + paddingY };
      };

      const bounds = calculateViewBounds(allPoints);
      const sourceCanvas = sourceCanvasRef.current;
      if (sourceCanvas) {
        const canvasWidth = sourceCanvas.width;
        const canvasHeight = sourceCanvas.height;
        const scaleX = canvasWidth / (bounds.maxX - bounds.minX);
        const scaleY = canvasHeight / (bounds.maxY - bounds.minY);
        const scale = Math.min(scaleX, scaleY) * 0.9;

        transform.current.source.scale = scale;
        transform.current.source.x = canvasWidth / 2 - (bounds.minX + bounds.maxX) / 2 * scale;
        transform.current.source.y = canvasHeight / 2 + (bounds.minY + bounds.maxY) / 2 * scale;

        transform.current.mapped.scale = scale;
        transform.current.mapped.x = mappedCanvasRef.current ? mappedCanvasRef.current.width / 2 : 0;
        transform.current.mapped.y = mappedCanvasRef.current ? mappedCanvasRef.current.height / 2 : 0;
      }

      updateParsingResult();
      drawSourcePlane();
      showToast("函数解析成功");
    } catch (e: any) {
      console.error("Parsing error:", e);
      showToast("错误: " + e.message, true);
    }
  }, [inputFormat, numerator, denominator, zerosInput, polesInput, gainInput, expression, polynomialToExpression, parseComplex, parseZerosAndPolesFromExpression, updateParsingResult, drawSourcePlane, showToast]);

  // Draw contour based on type
  const drawContour = useCallback(() => {
    worldContourPoints.current = [];
    const steps = 100;

    if (contourType === 'circle') {
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * 2 * Math.PI;
        worldContourPoints.current.push({
          x: contourRadius * Math.cos(theta),
          y: contourRadius * Math.sin(theta),
        });
      }
    } else if (contourType === 'semicircle') {
      // Simplified semicircle for now, without complex imaginary axis handling
      for (let i = 0; i <= steps / 2; i++) {
        const theta = Math.PI - (i / (steps / 2)) * Math.PI;
        worldContourPoints.current.push({
          x: contourRadius * Math.cos(theta),
          y: contourRadius * Math.sin(theta),
        });
      }
      worldContourPoints.current.push({ x: -contourRadius, y: 0 });
      worldContourPoints.current.push({ x: contourRadius, y: 0 });
    } else if (contourType === 'rectangle') {
      const halfWidth = contourWidth / 2;
      const halfHeight = contourHeight / 2;
      // Top side
      for (let i = 0; i <= steps / 4; i++) worldContourPoints.current.push({ x: -halfWidth + (i / (steps / 4)) * contourWidth, y: halfHeight });
      // Right side
      for (let i = 0; i <= steps / 4; i++) worldContourPoints.current.push({ x: halfWidth, y: halfHeight - (i / (steps / 4)) * contourHeight });
      // Bottom side
      for (let i = 0; i <= steps / 4; i++) worldContourPoints.current.push({ x: halfWidth - (i / (steps / 4)) * contourWidth, y: -halfHeight });
      // Left side
      for (let i = 0; i <= steps / 4; i++) worldContourPoints.current.push({ x: -halfWidth, y: -halfHeight + (i / (steps / 4)) * contourHeight });
    }

    updateContourPoints();
    drawSourcePlane();
    mapContour();
  }, [contourType, contourRadius, contourWidth, contourHeight, drawSourcePlane]);

  // Update contour points (canvas coordinates)
  const updateContourPoints = useCallback(() => {
    contourPoints.current = worldContourPoints.current.map(p =>
      transformPoint(p, transform.current.source)
    );
  }, [transformPoint]);

  // Map contour to mapped plane
  const mapContour = useCallback(() => {
    if (!currentFunction.current || worldContourPoints.current.length < 2) return;
    mappedPoints.current = [];

    worldContourPoints.current.forEach(point => {
      const s = complex(point.x, point.y);
      try {
        const scope = { s: s };
        const result = evaluate(currentFunction.current as string, scope);
        if (result && typeof result === 'object' && 're' in result && 'im' in result) {
          mappedPoints.current.push({ x: result.re, y: result.im });
        } else {
          console.warn("Invalid result from math.evaluate:", result);
          mappedPoints.current.push({ x: Infinity, y: Infinity });
        }
      } catch (e) {
        console.error("Mapping calculation error:", e);
        mappedPoints.current.push({ x: Infinity, y: Infinity });
      }
    });

    // Adjust mapped view
    const adjustMappedView = () => {
      if (mappedPoints.current.length === 0) return;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      mappedPoints.current.forEach(p => {
        if (isFinite(p.x) && isFinite(p.y)) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      });

      if (!isFinite(minX)) { minX = -2; maxX = 2; minY = -2; maxY = 2; }

      const rangeX = maxX - minX;
      const rangeY = maxY - minY;
      const paddingX = rangeX * 0.2;
      const paddingY = rangeY * 0.2;

      const bounds = {
        minX: minX - paddingX,
        maxX: maxX + paddingX,
        minY: minY - paddingY,
        maxY: maxY + paddingY,
      };

      const canvas = mappedCanvasRef.current;
      if (canvas) {
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const scaleX = canvasWidth / (bounds.maxX - bounds.minX);
        const scaleY = canvasHeight / (bounds.maxY - bounds.minY);
        const scale = Math.min(scaleX, scaleY) * 0.9;

        transform.current.mapped.scale = scale;
        transform.current.mapped.x = canvasWidth / 2 - (bounds.minX + bounds.maxX) / 2 * scale;
        transform.current.mapped.y = canvasHeight / 2 + (bounds.minY + bounds.maxY) / 2 * scale;
      }
    };

    adjustMappedView();
    updateMappingResult();
    drawMappedPlane();
  }, [updateMappingResult, drawMappedPlane]);

  // Canvas initialization and event listeners
  useEffect(() => {
    const sourceCanvas = sourceCanvasRef.current;
    const mappedCanvas = mappedCanvasRef.current;
    if (!sourceCanvas || !mappedCanvas) return;

    const setupCanvas = (canvas: HTMLCanvasElement, initialTransform: Transform) => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initialTransform.x = canvas.width / 2;
      initialTransform.y = canvas.height / 2;
    };

    setupCanvas(sourceCanvas, transform.current.source);
    setupCanvas(mappedCanvas, transform.current.mapped);

    // Mouse events for drawing and panning
    let isDrawing = false;
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && contourType === 'manual') {
        isDrawing = true;
        worldContourPoints.current = [];
        const rect = sourceCanvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - transform.current.source.x) / transform.current.source.scale;
        const worldY = (transform.current.source.y - (e.clientY - rect.top)) / transform.current.source.scale;
        worldContourPoints.current.push({ x: worldX, y: worldY });
        updateContourPoints();
        drawSourcePlane();
      } else if (e.button === 2) { // Right-click for panning
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDrawing) {
        const rect = sourceCanvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - transform.current.source.x) / transform.current.source.scale;
        const worldY = (transform.current.source.y - (e.clientY - rect.top)) / transform.current.source.scale;
        worldContourPoints.current.push({ x: worldX, y: worldY });
        updateContourPoints();
        drawSourcePlane();
      } else if (isPanning) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const targetTransform = e.target === sourceCanvas ? transform.current.source : transform.current.mapped;
        targetTransform.x += dx;
        targetTransform.y += dy;
        lastX = e.clientX;
        lastY = e.clientY;
        drawSourcePlane();
        drawMappedPlane();
      }
    };

    const handleMouseUp = () => {
      if (isDrawing) {
        isDrawing = false;
        if (worldContourPoints.current.length > 0) {
          worldContourPoints.current.push(worldContourPoints.current[0]); // Close the loop
          updateContourPoints();
        }
        drawSourcePlane();
        mapContour();
      }
      isPanning = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const targetTransform = e.target === sourceCanvas ? transform.current.source : transform.current.mapped;

      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - targetTransform.x) / targetTransform.scale;
      const worldY = (targetTransform.y - mouseY) / targetTransform.scale;

      targetTransform.scale *= delta;
      targetTransform.x = mouseX - worldX * targetTransform.scale;
      targetTransform.y = mouseY + worldY * targetTransform.scale;

      updateContourPoints(); // Update contour points on source plane zoom
      drawSourcePlane();
      drawMappedPlane();
    };

    sourceCanvas.addEventListener('mousedown', handleMouseDown);
    sourceCanvas.addEventListener('mousemove', handleMouseMove);
    sourceCanvas.addEventListener('mouseup', handleMouseUp);
    sourceCanvas.addEventListener('wheel', handleWheel);
    sourceCanvas.addEventListener('contextmenu', (e) => { e.preventDefault(); handleMouseDown(e); });

    mappedCanvas.addEventListener('wheel', handleWheel);
    mappedCanvas.addEventListener('contextmenu', (e) => { e.preventDefault(); handleMouseDown(e); });

    // Initial draw
    parseFunction();

    return () => {
      sourceCanvas.removeEventListener('mousedown', handleMouseDown);
      sourceCanvas.removeEventListener('mousemove', handleMouseMove);
      sourceCanvas.removeEventListener('mouseup', handleMouseUp);
      sourceCanvas.removeEventListener('wheel', handleWheel);
      sourceCanvas.removeEventListener('contextmenu', (e) => { e.preventDefault(); handleMouseDown(e); });

      mappedCanvas.removeEventListener('wheel', handleWheel);
      mappedCanvas.removeEventListener('contextmenu', (e) => { e.preventDefault(); handleMouseDown(e); });
    };
  }, [contourType, parseFunction, drawSourcePlane, drawMappedPlane, updateContourPoints, mapContour, transformPoint]);

  // Effect to re-draw when contour parameters change (for auto contours)
  useEffect(() => {
    if (contourType !== 'manual') {
      drawContour();
    }
  }, [contourType, contourRadius, contourWidth, contourHeight, drawContour]);

  return (
    <div className="container mx-auto p-5 bg-ap-bg text-ap-text">
      <div className="text-center mb-5">
        <h1 className="text-3xl font-bold text-ap-text">幅角原理双平面可视化工具</h1>
        <p className="text-ap-text">F(s)平面与F(F(s))映射平面同步分析</p>
      </div>

      {/* Function Input Section */}
      <div className="bg-ap-panel p-4 rounded-lg shadow-md mb-5">
        <h3 className="text-lg font-semibold text-ap-primary mb-4">函数输入</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col min-w-[200px]">
            <label htmlFor="input-format" className="font-bold text-sm mb-1">输入格式</label>
            <Select value={inputFormat} onValueChange={setInputFormat}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择格式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tf">传递函数 (多项式系数)</SelectItem>
                <SelectItem value="zpk">零点-极点-增益</SelectItem>
                <SelectItem value="expr">自然表达式</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {inputFormat === 'tf' && (
            <div className="flex flex-col min-w-[200px]">
              <label htmlFor="numerator" className="font-bold text-sm mb-1">分子多项式系数 (降幂)</label>
              <Input id="numerator" value={numerator} onChange={e => setNumerator(e.target.value)} placeholder="例如: 1, 0, -1" />
              <label htmlFor="denominator" className="font-bold text-sm mb-1 mt-2">分母多项式系数 (降幂)</label>
              <Input id="denominator" value={denominator} onChange={e => setDenominator(e.target.value)} placeholder="例如: 1, 1" />
            </div>
          )}

          {inputFormat === 'zpk' && (
            <div className="flex flex-col min-w-[200px]">
              <label htmlFor="zeros" className="font-bold text-sm mb-1">零点位置</label>
              <Input id="zeros" value={zerosInput} onChange={e => setZerosInput(e.target.value)} placeholder="例如: 1, -1" />
              <label htmlFor="poles" className="font-bold text-sm mb-1 mt-2">极点位置</label>
              <Input id="poles" value={polesInput} onChange={e => setPolesInput(e.target.value)} placeholder="例如: -1" />
              <label htmlFor="gain" className="font-bold text-sm mb-1 mt-2">增益</label>
              <Input id="gain" value={gainInput} onChange={e => setGainInput(e.target.value)} placeholder="例如: 1" />
            </div>
          )}

          {inputFormat === 'expr' && (
            <div className="flex flex-col min-w-[200px]">
              <label htmlFor="expression" className="font-bold text-sm mb-1">函数表达式 (变量为s)</label>
              <Input id="expression" value={expression} onChange={e => setExpression(e.target.value)} placeholder="例如: (s^2-1)/(s+1)" />
            </div>
          )}
        </div>
      </div>

      {/* Contour Settings Section */}
      <div className="bg-ap-panel p-4 rounded-lg shadow-md mb-5">
        <h3 className="text-lg font-semibold text-ap-primary mb-4">包围线设置</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col min-w-[200px]">
            <label htmlFor="contour-type" className="font-bold text-sm mb-1">包围曲线类型</label>
            <Select value={contourType} onValueChange={setContourType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="circle">圆形包络</SelectItem>
                <SelectItem value="semicircle">半圆延直线包络</SelectItem>
                <SelectItem value="rectangle">矩形包络</SelectItem>
                <SelectItem value="manual">手动绘制</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(contourType === 'circle' || contourType === 'semicircle') && (
            <div className="flex flex-col min-w-[200px]">
              <label htmlFor="contour-radius" className="font-bold text-sm mb-1">包围曲线半径</label>
              <div className="flex items-center gap-2">
                <Slider defaultValue={[contourRadius]} min={0.1} max={5} step={0.1} onValueChange={(val) => setContourRadius(val[0])} className="flex-1" />
                <span className="w-10 text-right text-sm">{contourRadius.toFixed(1)}</span>
              </div>
            </div>
          )}

          {contourType === 'rectangle' && (
            <>
              <div className="flex flex-col min-w-[200px]">
                <label htmlFor="contour-width" className="font-bold text-sm mb-1">矩形宽度</label>
                <div className="flex items-center gap-2">
                  <Slider defaultValue={[contourWidth]} min={0.1} max={5} step={0.1} onValueChange={(val) => setContourWidth(val[0])} className="flex-1" />
                  <span className="w-10 text-right text-sm">{contourWidth.toFixed(1)}</span>
                </div>
              </div>
              <div className="flex flex-col min-w-[200px]">
                <label htmlFor="contour-height" className="font-bold text-sm mb-1">矩形高度</label>
                <div className="flex items-center gap-2">
                  <Slider defaultValue={[contourHeight]} min={0.1} max={5} step={0.1} onValueChange={(val) => setContourHeight(val[0])} className="flex-1" />
                  <span className="w-10 text-right text-sm">{contourHeight.toFixed(1)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Control Buttons Section */}
      <div className="bg-ap-panel p-4 rounded-lg shadow-md mb-5">
        <h3 className="text-lg font-semibold text-ap-primary mb-4">控制</h3>
        <div className="flex gap-3 flex-wrap">
          <Button onClick={drawContour} className="bg-ap-primary hover:bg-blue-700">绘制/重绘</Button>
          <Button onClick={() => { worldContourPoints.current = []; contourPoints.current = []; mappedPoints.current = []; drawSourcePlane(); drawMappedPlane(); updateMappingResult(); }} className="bg-ap-secondary hover:bg-green-600">清除包围线</Button>
          <Button onClick={parseFunction} className="bg-ap-primary hover:bg-blue-700">刷新函数</Button>
          <Button onClick={() => alert("保存图像功能待实现") /* saveImage */} className="bg-ap-primary hover:bg-blue-700">保存图像</Button>
        </div>
      </div>

      {/* Example Buttons */}
      <div className="flex gap-3 flex-wrap items-center mb-5">
        <p className="font-bold">预设示例: </p>
        <Button variant="outline" className="bg-gray-100 hover:bg-gray-200 text-sm" onClick={() => { setInputFormat('expr'); setExpression('(s-1)/(s+2)'); parseFunction(); }}>F(s) = (s-1)/(s+2)</Button>
        <Button variant="outline" className="bg-gray-100 hover:bg-gray-200 text-sm" onClick={() => { setInputFormat('zpk'); setZerosInput('i, -i'); setPolesInput('-1+i, -1-i'); setGainInput('1'); parseFunction(); }}>F(s) = (s^2+1)/(s^2+2s+2)</Button>
        <Button variant="outline" className="bg-gray-100 hover:bg-gray-200 text-sm" onClick={() => { setInputFormat('tf'); setNumerator('1, 2, 1'); setDenominator('1, -2, 2'); parseFunction(); }}>F(s) = (s+1)^2/(s^2-2s+2)</Button>
      </div>

      {/* Canvas Container */}
      <div className="flex flex-col md:flex-row gap-5 mb-5">
        <div className="flex-1 relative bg-ap-panel rounded-lg shadow-md overflow-hidden">
          <div className="absolute top-2 left-2 font-bold bg-white/80 px-2 py-1 rounded text-sm">F(s) 平面 (源平面)</div>
          <div className="absolute bottom-2 left-2 text-xs bg-white/80 px-2 py-1 rounded">左键绘制路径 / 滚轮缩放 / 右键拖动</div>
          <canvas ref={sourceCanvasRef} width={500} height={500} className="w-full h-[500px] block"></canvas>
        </div>

        <div className="flex-1 relative bg-ap-panel rounded-lg shadow-md overflow-hidden">
          <div className="absolute top-2 left-2 font-bold bg-white/80 px-2 py-1 rounded text-sm">F(F(s)) 平面 (映射平面)</div>
          <div className="absolute bottom-2 left-2 text-xs bg-white/80 px-2 py-1 rounded">滚轮缩放 / 右键拖动</div>
          <canvas ref={mappedCanvasRef} width={500} height={500} className="w-full h-[500px] block"></canvas>
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-ap-panel p-4 rounded-lg shadow-md mt-5">
        <h3 className="text-lg font-semibold cursor-pointer flex justify-between items-center" onClick={() => setShowInfo(!showInfo)}>
          解析结果 <span>{showInfo ? '▲' : '▼'}</span>
        </h3>
        <div className={`overflow-hidden transition-all duration-300 ${showInfo ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div id="parsing-result" dangerouslySetInnerHTML={{ __html: parsingResult }}></div>
          <div id="mapping-result" dangerouslySetInnerHTML={{ __html: mappingResult }}></div>
        </div>
      </div>

      {toastMessage && (
        <div className={`fixed bottom-5 right-5 px-4 py-2 rounded text-white z-[1000] ${toastMessage.isError ? 'bg-ap-error' : 'bg-ap-secondary'}`}>
          {toastMessage.message}
        </div>
      )}
    </div>
  );
}
