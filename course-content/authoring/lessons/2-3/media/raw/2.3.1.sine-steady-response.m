T = 0.8;
omega = 2.4;
t = linspace(0, 8, 2000);

r = sin(omega * t);
mag = 1 / sqrt(1 + (omega * T)^2);
phi = -atan(omega * T);
c = mag * sin(omega * t + phi);

plot(t, r, 'LineWidth', 1.5); hold on;
plot(t, c, 'LineWidth', 2.0);
title('正弦输入与稳态输出');
grid on;
legend('输入', '输出');
