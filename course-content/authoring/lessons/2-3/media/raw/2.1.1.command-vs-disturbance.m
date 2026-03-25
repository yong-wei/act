T = 1.2;
omega_low = 0.45;
omega_high = 3.8;
t = linspace(0, 20, 3000);

r_low = sin(omega_low * t);
r_high = 0.9 * sin(omega_high * t);

mag_low = 1 / sqrt(1 + (omega_low * T)^2);
phi_low = -atan(omega_low * T);
mag_high = 1 / sqrt(1 + (omega_high * T)^2);
phi_high = -atan(omega_high * T);

c_low = mag_low * sin(omega_low * t + phi_low);
c_high = 0.9 * mag_high * sin(omega_high * t + phi_high);

subplot(2,1,1);
plot(t, r_low, 'LineWidth', 1.4); hold on;
plot(t, c_low, 'LineWidth', 1.8);
title('低频：输入与输出');
grid on;
legend('输入', '输出');

subplot(2,1,2);
plot(t, r_high, 'LineWidth', 1.4); hold on;
plot(t, c_high, 'LineWidth', 1.8);
title('高频：输入与输出');
grid on;
legend('输入', '输出');
