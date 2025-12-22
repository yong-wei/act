import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const PidSimulator = () => {
  const [kp, setKp] = useState(1);
  const [ki, setKi] = useState(0.5);
  const [kd, setKd] = useState(0.1);
  const [setpoint, setSetpoint] = useState(1);
  const [systemType, setSystemType] = useState('second-order');
  
  // Parameters for different systems
  const [tau, setTau] = useState(1);
  const [zeta, setZeta] = useState(0.5);
  const [delay, setDelay] = useState(0.5);
  const [gain, setGain] = useState(1);


  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart>();

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
                label: 'System Response',
                data: [],
                borderColor: 'rgba(75, 192, 192, 1)',
                tension: 0.1,
              },
              {
                label: 'Setpoint',
                data: [],
                borderColor: 'rgba(255, 99, 132, 1)',
                borderDash: [5, 5],
              },
            ],
          },
        });
      }
    }
  }, []);

  const runSimulation = () => {
    if (!chartInstance.current) return;

    let y = 0, y_prev = 0, y_prev2 = 0;
    let integral = 0, error_prev = 0;
    const dt = 0.1;
    const simulationTime = 20;
    const steps = simulationTime / dt;

    const responseData = [];
    const setpointData = [];
    const labels = [];

    for (let i = 0; i <= steps; i++) {
      const t = i * dt;
      const error = setpoint - y;
      integral += error * dt;
      const derivative = (error - error_prev) / dt;
      const output = kp * error + ki * integral + kd * derivative;

      // System dynamics based on selected type
      switch (systemType) {
        case 'foptd':
          // First-order plus time-delay
          // This is a simplified approximation of time delay
          const delayed_output = i * dt > delay ? output : 0;
          y = (tau * y_prev + gain * delayed_output * dt) / (tau + dt);
          break;
        case 'integrating':
          y += gain * output * dt;
          break;
        case 'unstable':
          y = (tau * y_prev + gain * output * dt) / (tau - dt);
          break;
        case 'second-order':
        default:
          const y_dot = y_prev2;
          const y_ddot = (gain * output - 2 * zeta * tau * y_dot - y) / (tau * tau);
          y += y_dot * dt;
          y_prev2 += y_ddot * dt;
          break;
      }
      
      y_prev = y;
      error_prev = error;

      responseData.push(y);
      setpointData.push(setpoint);
      labels.push(t.toFixed(1));
    }

    chartInstance.current.data.labels = labels;
    chartInstance.current.data.datasets[0].data = responseData;
    chartInstance.current.data.datasets[1].data = setpointData;
    chartInstance.current.update();
  };

  const renderSystemParams = () => {
    switch (systemType) {
      case 'foptd':
        return (
          <>
            <div><label>Gain (K): <input type="number" value={gain} onChange={e => setGain(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
            <div><label>Time Constant (τ): <input type="number" value={tau} onChange={e => setTau(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
            <div><label>Time Delay (θ): <input type="number" value={delay} onChange={e => setDelay(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
          </>
        );
      case 'integrating':
        return (
          <div><label>Gain (K): <input type="number" value={gain} onChange={e => setGain(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
        );
      case 'unstable':
        return (
          <>
            <div><label>Gain (K): <input type="number" value={gain} onChange={e => setGain(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
            <div><label>Time Constant (τ): <input type="number" value={tau} onChange={e => setTau(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
          </>
        );
      case 'second-order':
      default:
        return (
          <>
            <div><label>Time Constant (τ): <input type="number" value={tau} onChange={e => setTau(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
            <div><label>Damping Ratio (ζ): <input type="number" value={zeta} onChange={e => setZeta(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
          </>
        );
    }
  }

  return (
    <div className="p-5">
      <h1 className="text-2xl text-center mb-5">PID Simulator</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="md:col-span-1 bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-bold mb-3">PID Parameters</h2>
          <div className="space-y-2">
            <div><label>Kp: <input type="number" value={kp} onChange={e => setKp(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
            <div><label>Ki: <input type="number" value={ki} onChange={e => setKi(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
            <div><label>Kd: <input type="number" value={kd} onChange={e => setKd(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
            <div><label>Setpoint: <input type="number" value={setpoint} onChange={e => setSetpoint(parseFloat(e.target.value))} step="0.1" className="w-20" /></label></div>
          </div>

          <h2 className="text-lg font-bold mt-5 mb-3">System Parameters</h2>
          <div>
            <label>System Type: 
              <select value={systemType} onChange={e => setSystemType(e.target.value)} className="ml-2">
                <option value="second-order">Second-order System</option>
                <option value="foptd">First-order plus time-delay</option>
                <option value="integrating">Integrating Process</option>
                <option value="unstable">Unstable System</option>
              </select>
            </label>
          </div>
          <div className="space-y-2 mt-2">
            {renderSystemParams()}
          </div>

          <button onClick={runSimulation} className="mt-5 bg-blue-500 text-white px-4 py-2 rounded">Run Simulation</button>
        </div>
        <div className="md:col-span-3">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  );
};

export default PidSimulator;

