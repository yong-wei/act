// ======================== 主程序 ========================
// 配置 Chart.js 全局参数
Chart.defaults.font.family = 'Arial, sans-serif';

// 系统配置参数
const Config = {
    maxDataPoints: 200,     // 图表最大数据点数
    refreshInterval: 50     // 界面刷新间隔(ms)
};

// ==================== 模型配置库 ====================
const ModelLibrary = {
    // 直流电机速度控制 (2阶)
    motor: {
        order: 2,
        stateFunc: (x, u) => [
            x[1], 
            -15*x[1] - 200*x[0] + 800*u
        ],
        Ts: 0.02,
        pidConfig: { Kp: 1.2, Ki: 8, Kd: 0.02 }
    },

    // 船舶航向控制 (非线性3阶)
    ship: {
        order: 3,
        stateFunc: (x, u) => {
            const [psi, r, delta] = x; // 航向角、转艏率、舵角
            const T = 20;    // 时间常数
            const K = 0.8;   // 增益
            return [
                r,
                (K*u - r - 0.2*r*Math.abs(r)) / T,
                5*(u - delta)  // 舵机动力学
            ];
        },
        Ts: 0.1,
        pidConfig: { Kp: 2.5, Ki: 0.1, Kd: 1.2 }
    },

    // 温度控制系统 (1阶滞后)
    thermal: {
        order: 1,
        stateFunc: (x, u) => [
            (-x[0] + 0.8*u)/30  // τ=30s
        ],
        Ts: 0.5,
        pidConfig: { Kp: 5, Ki: 0.2, Kd: 0 }
    },

    // 液压位置伺服 (带弹性负载)
    hydraulic: {
        order: 2,
        stateFunc: (x, u) => [
            x[1],
            -25*x[1] - 1200*x[0] + 1500*u
        ], 
        Ts: 0.01,
        pidConfig: { Kp: 1.8, Ki: 15, Kd: 0.05 }
    },

    // UAV高度控制 (非线性)
    uav: {
        order: 3,
        stateFunc: (x, u) => {
            const [h, v, throttle] = x;
            const g = 9.81;
            const k = 0.1;
            return [
                v,
                throttle*g - k*v*v - g, // 考虑空气阻力平方项
                10*(u - throttle)      // 发动机动态
            ];
        },
        Ts: 0.05,
        pidConfig: { Kp: 0.8, Ki: 0.3, Kd: 0.5 }
    },

    // 机械臂关节控制 (柔性关节)
    robot: {
        order: 4,
        stateFunc: (x, u) => {
            const [theta1, omega1, theta2, omega2] = x;
            const J1 = 0.5, J2 = 0.2;  // 惯量
            const k = 150;             // 刚度系数
            const b = 0.8;             // 阻尼
            return [
                omega1,
                (k*(theta2 - theta1) - b*omega1 + u)/J1,
                omega2,
                (-k*(theta2 - theta1))/J2
            ];
        }, 
        Ts: 0.02,
        pidConfig: { Kp: 80, Ki: 20, Kd: 0.8 }
    }
};

// ============== 离散仿真引擎 ==============
class DiscreteSimulator {
    constructor(model) {
        this.model = model;
        this.reset();
    }

    reset() {
        this.x = new Array(this.model.order).fill(0);
        this.time = 0;
        this.reference = 0;
        this.pid = { ...this.model.pidConfig, integral: 0, prevError: 0 };
    }

    setReference(target) {
        this.reference = target;
    }

    // 离散PID计算 (带抗积分饱和)
    computePID(feedback) {
        const { Kp, Ki, Kd, integral, prevError } = this.pid;
        const error = this.reference - feedback;
        
        const P = Kp * error;
        let I = integral + Ki * error * this.model.Ts;
        const D = Kd * (error - prevError) / this.model.Ts;

        // 抗积分饱和
        I = Math.max(Math.min(I, 2), -2); // ±2限制

        this.pid.integral = I;
        this.pid.prevError = error;

        return P + I + D;
    }

    // 使用四阶Runge-Kutta进行离散化
    step(u) {
        const f = (x, u) => this.model.stateFunc(x, u);
        const h = this.model.Ts;

        const k1 = f(this.x, u);
        const k2 = f(this.x.map((xi, i) => xi + h/2*k1[i]), u);
        const k3 = f(this.x.map((xi, i) => xi + h/2*k2[i]), u);
        const k4 = f(this.x.map((xi, i) => xi + h*k3[i]), u);

        this.x = this.x.map((xi, i) => 
            xi + h/6*(k1[i] + 2*k2[i] + 2*k3[i] + k4[i])
        );
        this.time += h;

        return [...this.x];
    }

    // 执行闭环控制
    executeStep() {
        const feedback = this.x[0]; // 假设第一个状态为输出
        const u = this.computePID(feedback);
        this.step(u);
        return { time: this.time, output: feedback };
    }
}

// ============== 图表服务 ==============
class ChartService {
    constructor() {
        this.chart = null;
        this.data = {
            datasets: [{
                label: '系统响应',
                borderColor: '#3182CE',
                borderWidth: 1.5,
                pointRadius: 0,
                data: []
            }]
        };
        this.options = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    type: 'linear',
                    title: { display: true, text: '时间 (s)', color: '#4A5568' }, 
                    grid: { color: '#E2E8F0' },
                    ticks: { color: '#718096' }
                },
                y: {
                    title: { display: true, text: '输出值', color: '#4A5568' },
                    grid: { color: '#E2E8F0' },
                    ticks: { color: '#718096' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                    backgroundColor: '#2D3748',
                    titleColor: '#F7FAFC',
                    bodyColor: '#E2E8F0'
                }
            }
        };
    }

    initialize() {
        const ctx = document.getElementById('responseChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: this.data,
            options: this.options
        });
    }

    updateData(newPoints) {
        this.data.datasets[0].data = newPoints;
        this.chart.update();
    }
}

// ============== 主控模块 ==============
class AppController {
    constructor() {
        this.simulator = null;
        this.chartService = new ChartService();
        this.dataHistory = [];
        this.isSimulating = false;
        this.currentModel = null;
    }

    initialize() {
        this.chartService.initialize();
        this.bindUIEvents();
    }

    bindUIEvents() {
        // 模型切换
        document.querySelectorAll('.model-btn').forEach(btn => {
            btn.addEventListener('click', () => this.loadModel(btn.dataset.model));
        });

        // PID参数更新
        ['Kp', 'Ki', 'Kd'].forEach(param => {
            document.getElementById(param).addEventListener('input', e => {
                if(this.simulator) {
                    this.simulator.pid[param] = parseFloat(e.target.value);
                }
            });
        });

        // 参考输入更新
        document.getElementById('reference').addEventListener('change', e => {
            if(this.simulator) {
                this.simulator.setReference(parseFloat(e.target.value));
            }
        });

        // 主控制按钮
        document.getElementById('controlBtn').addEventListener('click', () => {
            this.isSimulating = !this.isSimulating;
            document.getElementById('controlBtn').textContent = 
                this.isSimulating ? '停止仿真' : '启动仿真';
            this.simulator?.reset();
            if(this.isSimulating) requestAnimationFrame(this.simLoop.bind(this));
        });
    }

    loadModel(modelKey) {
        this.currentModel = ModelLibrary[modelKey];
        this.simulator = new DiscreteSimulator(this.currentModel);
        this.simulator.setReference(1.0); // 初始参考值
        
        // 更新UI参数值
        const { Kp, Ki, Kd } = this.currentModel.pidConfig;
        document.getElementById('Kp').value = Kp;
        document.getElementById('Ki').value = Ki;
        document.getElementById('Kd').value = Kd;

        // 设置初始型号说明
        document.getElementById('modelDesc').textContent = 
            `${modelKey.toUpperCase()} 系统 | 采样周期 ${this.currentModel.Ts}s`;
    }

    simLoop() {
        if(!this.isSimulating) return;

        // 执行仿真步骤
        const point = this.simulator.executeStep();
        this.dataHistory.push({ x: point.time, y: point.output });

        // 控制数据点数量
        if(this.dataHistory.length > Config.maxDataPoints) {
            this.dataHistory.splice(0, this.dataHistory.length - Config.maxDataPoints);
        }

        // 更新图表
        if(Date.now() % Config.refreshInterval === 0) { 
            this.chartService.updateData([...this.dataHistory]);
        }

        requestAnimationFrame(this.simLoop.bind(this));
    }
}

// ============== 启动程序 ==============
document.addEventListener('DOMContentLoaded', () => {
    const app = new AppController();
    app.initialize();
    app.loadModel('motor'); // 默认加载电机模型
});
