'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Chart from 'chart.js/auto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

// Icons (assuming these are available or will be added)
import {
  Gauge, Ship, Anchor, Compass, Factory, Waves, Settings, Play, Pause, RefreshCcw, 
  Info, AlertTriangle, CheckCircle, X, Plus, Minus, Upload, Download, Link as LinkIcon,
  Key, Lock, Unlock, Tag, Eye, Heart, ThumbsUp, ThumbsDown, Volume2, VolumeX, Maximize,
  Minimize, Grid, LayoutDashboard, List, Monitor, PieChart, Rss, Share2, Terminal, Type,
  User, Wifi, Send, Paperclip, Edit, Bookmark, Gem, Layers, Globe, Cpu, Scale, DollarSign,
  MapPin, BookOpen, FlaskConical, Trophy, BarChart2, Users, Clock, CloudFog, TreePalm,
  Bot, ScrollText, TrendingUp, Thermometer, CloudLightning, Wind, Droplet, Target, Shield,
  Zap, Award, Activity, Database, FileText, PlayCircle, ZapOff
} from 'lucide-react';

type ModelType = 'motor' | 'ship' | 'usv' | 'dps' | 'dredger' | 'fin';

export default function PidSimulatorPage() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [selectedModel, setSelectedModel] = useState<ModelType>('motor');
  const [stepSize, setStepSize] = useState(50);
  const [timeScale, setTimeScale] = useState(1);
  const [kp, setKp] = useState(1.0);
  const [ki, setKi] = useState(0.0);
  const [kd, setKd] = useState(0.0);
  const [reference, setReference] = useState(1.0);
  const [modelDescription, setModelDescription] = useState('');

  const getModelParameters = useCallback((model: ModelType) => {
    switch (model) {
      case 'motor':
        return { description: '电动机速度调节：模拟直流电机速度控制，目标是快速稳定地达到设定转速。' };
      case 'ship':
        return { description: '船舶航向调节：模拟船舶在风浪干扰下保持航向，目标是减小航向偏差。' };
      case 'usv':
        return { description: '水下无人艇：模拟水下无人艇的深度或姿态控制，目标是精确悬停或按轨迹运动。' };
      case 'dps':
        return { description: '船舶动力定位：模拟船舶在复杂海况下保持定点位置，目标是高精度定位。' };
      case 'dredger':
        return { description: '挖泥船动力分配：模拟挖泥船在作业时保持稳定姿态和位置，优化动力分配。' };
      case 'fin':
        return { description: '减摇鳍调节：模拟船舶减摇鳍系统，目标是抑制船舶横摇，提高舒适性。' };
      default:
        return { description: '选择一个模型开始仿真。' };
    }
  }, []);

  useEffect(() => {
    setModelDescription(getModelParameters(selectedModel).description);
  }, [selectedModel, getModelParameters]);

  useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        if (chartInstance.current) {
          chartInstance.current.destroy();
        }
        chartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: [],
            datasets: [
              {
                label: '系统响应',
                data: [],
                borderColor: '#4299e1',
                tension: 0.1,
                pointRadius: 0,
              },
              {
                label: '设定值',
                data: [],
                borderColor: '#48bb78',
                borderDash: [5, 5],
                pointRadius: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                title: { display: true, text: '时间 (s)' },
              },
              y: {
                title: { display: true, text: '输出' },
              },
            },
            animation: false,
          },
        });
      }
    }
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, []);

  const runSimulation = useCallback(() => {
    if (!chartInstance.current) return;

    let y = 0; // Current system output
    let integral = 0; // Integral of error
    let prevError = 0; // Previous error for derivative
    let prevY = 0; // Previous output for some models

    const dt = stepSize / 1000; // Convert ms to seconds
    const simulationDuration = 20; // seconds
    const numSteps = simulationDuration / dt;

    const responseData: number[] = [];
    const setpointData: number[] = [];
    const labels: string[] = [];

    for (let i = 0; i <= numSteps; i++) {
      const t = i * dt;
      const error = reference - y;

      integral += error * dt;
      const derivative = (error - prevError) / dt;

      const pidOutput = kp * error + ki * integral + kd * derivative;

      // Simplified model dynamics (replace with actual transfer functions if needed)
      switch (selectedModel) {
        case 'motor':
          // Simple first-order system: dy/dt = (K*u - y) / T
          // y(k+1) = y(k) + dt * (K*u(k) - y(k)) / T
          // Let K=1, T=0.5 for motor example
          const motorTimeConstant = 0.5;
          y = y + dt * (1 * pidOutput - y) / motorTimeConstant;
          break;
        case 'ship':
          // Simplified second-order system for heading control
          // J*d^2(psi)/dt^2 + D*d(psi)/dt = K*delta (rudder angle)
          // Let J=1, D=0.1, K=0.5
          const shipMass = 1;
          const shipDamping = 0.1;
          const shipGain = 0.5;
          const acceleration = (shipGain * pidOutput - shipDamping * (y - prevY) / dt) / shipMass;
          y = y + (y - prevY) + acceleration * dt * dt; // Simple integration
          break;
        case 'usv':
          // Integrating process for depth control: dy/dt = K*u
          // Let K=0.1
          const usvGain = 0.1;
          y = y + usvGain * pidOutput * dt;
          break;
        case 'dps':
          // More complex, often involves multiple PID loops or adaptive control
          // For simplicity, treat as a slower second-order system
          const dpsTimeConstant = 2;
          const dpsDamping = 0.8;
          const dpsGain = 1;
          const dpsAcceleration = (dpsGain * pidOutput - 2 * dpsDamping * dpsTimeConstant * (y - prevY) / dt - y) / (dpsTimeConstant * dpsTimeConstant);
          y = y + (y - prevY) + dpsAcceleration * dt * dt;
          break;
        case 'dredger':
          // Similar to DPS, but with more disturbances
          const dredgerTimeConstant = 1.5;
          const dredgerDamping = 0.7;
          const dredgerGain = 0.8;
          const dredgerAcceleration = (dredgerGain * pidOutput - 2 * dredgerDamping * dredgerTimeConstant * (y - prevY) / dt - y) / (dredgerTimeConstant * dredgerTimeConstant);
          y = y + (y - prevY) + dredgerAcceleration * dt * dt;
          break;
        case 'fin':
          // Oscillatory system with damping
          const finTimeConstant = 0.3;
          const finDamping = 0.1;
          const finGain = 0.2;
          const finAcceleration = (finGain * pidOutput - 2 * finDamping * finTimeConstant * (y - prevY) / dt - y) / (finTimeConstant * finTimeConstant);
          y = y + (y - prevY) + finAcceleration * dt * dt;
          break;
        default:
          // Default to a simple second-order system if no model is selected
          const defaultTau = 1;
          const defaultZeta = 0.5;
          const defaultGain = 1;
          const defaultAcceleration = (defaultGain * pidOutput - 2 * defaultZeta * defaultTau * (y - prevY) / dt - y) / (defaultTau * defaultTau);
          y = y + (y - prevY) + defaultAcceleration * dt * dt;
          break;
      }

      prevError = error;
      prevY = y;

      responseData.push(y);
      setpointData.push(reference);
      labels.push(t.toFixed(1));
    }

    chartInstance.current.data.labels = labels;
    chartInstance.current.data.datasets[0].data = responseData;
    chartInstance.current.data.datasets[1].data = setpointData;
    chartInstance.current.update();
  }, [kp, ki, kd, reference, selectedModel, stepSize]);

  return (
    <div className="container mx-auto p-5 bg-pid-bg text-gray-800">
      <h1 className="text-2xl text-center mb-5">PID 调参模拟器</h1>

      {/* Model Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-5">
        <Button 
          className={`py-3 px-4 rounded transition-colors ${selectedModel === 'motor' ? 'bg-pid-model-btn-active shadow-md text-white' : 'bg-pid-model-btn hover:bg-pid-model-btn-hover text-white'}`}
          onClick={() => setSelectedModel('motor')}
        >电动机速度调节</Button>
        <Button 
          className={`py-3 px-4 rounded transition-colors ${selectedModel === 'ship' ? 'bg-pid-model-btn-active shadow-md text-white' : 'bg-pid-model-btn hover:bg-pid-model-btn-hover text-white'}`}
          onClick={() => setSelectedModel('ship')}
        >船舶航向调节</Button>
        <Button 
          className={`py-3 px-4 rounded transition-colors ${selectedModel === 'usv' ? 'bg-pid-model-btn-active shadow-md text-white' : 'bg-pid-model-btn hover:bg-pid-model-btn-hover text-white'}`}
          onClick={() => setSelectedModel('usv')}
        >水下无人艇</Button>
        <Button 
          className={`py-3 px-4 rounded transition-colors ${selectedModel === 'dps' ? 'bg-pid-model-btn-active shadow-md text-white' : 'bg-pid-model-btn hover:bg-pid-model-btn-hover text-white'}`}
          onClick={() => setSelectedModel('dps')}
        >船舶动力定位</Button>
        <Button 
          className={`py-3 px-4 rounded transition-colors ${selectedModel === 'dredger' ? 'bg-pid-model-btn-active shadow-md text-white' : 'bg-pid-model-btn hover:bg-pid-model-btn-hover text-white'}`}
          onClick={() => setSelectedModel('dredger')}
        >挖泥船动力分配</Button>
        <Button 
          className={`py-3 px-4 rounded transition-colors ${selectedModel === 'fin' ? 'bg-pid-model-btn-active shadow-md text-white' : 'bg-pid-model-btn hover:bg-pid-model-btn-hover text-white'}`}
          onClick={() => setSelectedModel('fin')}
        >减摇鳍调节</Button>
      </div>

      {/* Main Display Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 h-[500px] mb-5">
        <div className="md:col-span-1 bg-pid-panel-bg rounded-lg shadow-md p-5 flex items-center justify-center">
          <div className="w-full h-full bg-pid-placeholder-bg text-pid-placeholder-text flex items-center justify-center rounded-md">
            三维模型待加载
          </div>
        </div>
        <div className="md:col-span-2 bg-pid-panel-bg rounded-lg shadow-md p-5 flex flex-col">
          <canvas ref={chartRef} className="w-full h-full"></canvas>
          <div className="mt-2 text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: modelDescription }}></div>
        </div>
      </div>

      {/* Parameter Control Area */}
      <div className="bg-pid-panel-bg p-5 rounded-lg shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <label className="flex items-center gap-2">
            仿真步长 (ms):
            <Input type="number" value={stepSize} onChange={e => setStepSize(parseFloat(e.target.value))} className="w-24 p-1 border border-pid-input-border rounded" />
          </label>
          <label className="flex items-center gap-2">
            时间加速比:
            <Input type="number" value={timeScale} onChange={e => setTimeScale(parseFloat(e.target.value))} step="0.1" className="w-24 p-1 border border-pid-input-border rounded" />
          </label>
          <label className="flex items-center gap-2">
            Kp:
            <Input type="number" value={kp} onChange={e => setKp(parseFloat(e.target.value))} step="0.1" className="w-24 p-1 border border-pid-input-border rounded" />
          </label>
          <label className="flex items-center gap-2">
            Ki:
            <Input type="number" value={ki} onChange={e => setKi(parseFloat(e.target.value))} step="0.01" className="w-24 p-1 border border-pid-input-border rounded" />
          </label>
          <label className="flex items-center gap-2">
            Kd:
            <Input type="number" value={kd} onChange={e => setKd(parseFloat(e.target.value))} step="0.01" className="w-24 p-1 border border-pid-input-border rounded" />
          </label>
          <label className="flex items-center gap-2">
            设定值:
            <Input type="number" value={reference} onChange={e => setReference(parseFloat(e.target.value))} step="0.1" className="w-24 p-1 border border-pid-input-border rounded" />
          </label>
        </div>
        <Button onClick={runSimulation} className="mt-4 bg-pid-model-btn-active text-white px-6 py-3 rounded text-lg block mx-auto">
          启动仿真
        </Button>
      </div>
    </div>
  );
}
