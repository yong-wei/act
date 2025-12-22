// model-config.js
const ModelConfig = {
    // 电动机速度调节（2阶系统）
    motor: {
        order: 2,
        stateFunc: (x, u) => {
            // dx/dt = A*x + B*u
            return [
                x[1],
                -25*x[1] - 100*x[0] + 100*u
            ];
        },
        controlType: 'PID',
        Ts: 0.05  // 采样时间100ms
    },

    // 船舶航向调节（非线性模型）
    ship: {
        order: 3,
        stateFunc: (x, u) => {
            // 非线性船舶操纵方程
            const m = 600;    // 质量 (kg)
            const Iz = 1200;  // 转动惯量
            const Xu = -20;   // 水动力导数
            
            const psi = x[2]; // 航向角
            return [
                (u[0]*Math.cos(psi) - u[1]*Math.sin(psi)) / m,
                (u[0]*Math.sin(psi) + u[1]*Math.cos(psi)) / m,
                (u[2] + Xu*x[2]*Math.abs(x[2])) / Iz
            ];
        },
        controlType: 'PID',
        Ts: 0.1
    },

    // 其他模型配置结构类似...
};
