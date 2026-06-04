pkg load control;

s = tf('s');
G = 1 / (0.35 * s + 1);
Kp = 2.5;
d0 = 0.4;

% Closed-loop poles for the proportional baseline.
plant_pole = pole(G);
closed_loop_tf = feedback(Kp * G, 1);
closed_loop_pole = pole(closed_loop_tf);

% Use the simple first-order closed-loop form directly.
tau = 0.35 / (1 + Kp);
t = 0:0.01:4.0;
r = ones(size(t));

y_nominal_ss = Kp / (1 + Kp);
y_load_ss = (Kp - d0) / (1 + Kp);

y_nominal = y_nominal_ss * (1 - exp(-t / tau));
y_load = y_load_ss * (1 - exp(-t / tau));

e_nominal = r - y_nominal;
e_load = r - y_load;

hf = figure('visible', 'off', 'position', [100, 100, 1280, 760]);

subplot(2, 2, 1);
plot(t, r, 'k--', 'linewidth', 1.4);
hold on;
plot(t, y_nominal, 'b', 'linewidth', 2);
plot(t, y_load, 'r', 'linewidth', 2);
grid on;
xlim([0 4]);
ylim([0 1.05]);
title('Step response comparison');
xlabel('Time (s)');
ylabel('Normalized speed');
legend({'Reference', 'No load', 'Constant load'}, 'location', 'southeast');
text(1.05, 0.88, sprintf('No-load final value: %.3f', y_nominal_ss));
text(1.05, 0.80, sprintf('Load final value: %.3f', y_load_ss));

subplot(2, 2, 2);
plot(t, e_nominal, 'b', 'linewidth', 2);
hold on;
plot(t, e_load, 'r', 'linewidth', 2);
plot([t(1), t(end)], [0, 0], 'k--', 'linewidth', 1.2);
grid on;
xlim([0 4]);
ylim([0 0.55]);
title('Error trajectories');
xlabel('Time (s)');
ylabel('Reference - output');
legend({'No load', 'Constant load', 'Zero line'}, 'location', 'southeast');
text(1.45, 0.50, 'The load case keeps a visible gap');
text(1.45, 0.44, 'The bias does not disappear by itself');

subplot(2, 2, 3);
plot(real(plant_pole), imag(plant_pole), 'bx', 'markersize', 10, 'linewidth', 2);
hold on;
plot(real(closed_loop_pole), imag(closed_loop_pole), 'ro', 'markersize', 9, 'linewidth', 2);
plot([-14 2], [0 0], 'k:', 'linewidth', 1.2);
plot([0 0], [-1 1], 'k:', 'linewidth', 1.2);
grid on;
xlim([-14 2]);
ylim([-1 1]);
title('Pole locations');
xlabel('Real axis');
ylabel('Imag axis');
legend({'Plant pole', 'Closed-loop pole'}, 'location', 'southwest');
text(-12.8, 0.55, 'Both poles are on the left half-plane');
text(-12.8, 0.34, 'The baseline stays stable');

subplot(2, 2, 4);
bar_data = [y_nominal_ss, y_load_ss; 1 - y_nominal_ss, 1 - y_load_ss];
hbar = bar(bar_data, 'grouped');
grid on;
xlim([0.5 2.5]);
ylim([0 1]);
set(gca, 'xtick', 1:2, 'xticklabel', {'Output final value', 'Final bias'});
title('Steady-state comparison');
ylabel('Normalized value');
legend(hbar, {'No load', 'Constant load'}, 'location', 'northeast');
text(0.85, 0.92, sprintf('%.3f', y_nominal_ss));
text(1.15, 0.78, sprintf('%.3f', y_load_ss));
text(1.85, 0.43, sprintf('%.3f', 1 - y_nominal_ss));
text(2.15, 0.56, sprintf('%.3f', 1 - y_load_ss));
text(0.92, 0.12, 'Output final value');
text(1.92, 0.12, 'Bias remains');

if exist('sgtitle', 'file')
  sgtitle('O3 steady-state mechanism example: small DC motor speed diagnosis');
elseif exist('suptitle', 'file')
  suptitle('O3 steady-state mechanism example: small DC motor speed diagnosis');
endif

[script_dir, ~, ~] = fileparts(mfilename('fullpath'));
output_path = fullfile(script_dir, 'T3-O3-dc-motor-diagnosis.png');
print(hf, output_path, '-dpng', '-r180');
close(hf);
