pkg load control

s = tf('s');

% 示例对象：小型直流电机转速控制的简化模型。
G_base = 1/(0.35*s + 1);
G_migrated = 1/(0.75*s + 1);

% O5 首轮方案与 O6 修正版方案。
C_o5 = 1.2 + 0.8/s;
C_o6 = 1.1 + 0.45/s;

T_o5_base = feedback(C_o5 * G_base, 1);
T_o5_migrated = feedback(C_o5 * G_migrated, 1);
T_o6_final = feedback(C_o6 * G_migrated, 1);

t = 0:0.01:10;
[y_base, t_base] = step(T_o5_base, t);
[y_migrated, t_migrated] = step(T_o5_migrated, t);
[y_final, t_final] = step(T_o6_final, t);

figure('visible', 'off');
plot(t_base, y_base, 'k--', 'linewidth', 1.4);
hold on;
plot(t_migrated, y_migrated, 'r-', 'linewidth', 1.4);
plot(t_final, y_final, 'b-', 'linewidth', 1.6);
grid on;
xlabel('Time / s');
ylabel('Normalized speed');
title('O7 final validation example');
legend('O5 original baseline', 'Migrated without revision', 'O7 final revised scheme', 'location', 'southeast');
print('-dpng', 'O7-final-validation.png');
