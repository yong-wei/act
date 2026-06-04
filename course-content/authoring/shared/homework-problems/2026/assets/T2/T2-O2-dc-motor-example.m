pkg load control;

s = tf('s');
G = 1 / (0.35 * s + 1);

t = 0:0.01:2.0;
[y, t_out] = step(G, t);

[mag, phase, w] = bode(G, {0.1, 100});
mag = squeeze(mag);
phase = squeeze(phase);
w = squeeze(w);

pole_value = pole(G);

hf = figure('visible', 'off', 'position', [100, 100, 1200, 720]);

subplot(2, 2, 1);
plot(real(pole_value), imag(pole_value), 'rx', 'markersize', 10, 'linewidth', 2);
hold on;
plot([-5 1], [0 0], 'k:');
plot([0 0], [-2 2], 'k:');
xlim([-5 1]);
ylim([-2 2]);
grid on;
title('Pole Location');
xlabel('Real Axis');
ylabel('Imag Axis');
text(real(pole_value) + 0.15, imag(pole_value) + 0.1, sprintf('p = %.2f', real(pole_value)));

subplot(2, 2, 2);
plot(t_out, y, 'b', 'linewidth', 2);
grid on;
title('Step Response');
xlabel('Time (s)');
ylabel('Normalized Speed');
ylim([0 1.1]);
text(0.9, 0.35, 'Monotone rise, no overshoot');

subplot(2, 2, 3);
semilogx(w, 20 * log10(mag), 'm', 'linewidth', 2);
grid on;
title('Bode Magnitude');
xlabel('\omega (rad/s)');
ylabel('Magnitude (dB)');
hold on;
plot([1 / 0.35, 1 / 0.35], ylim(), 'k--');
text(1 / 0.35 * 1.08, -7, '\omega_c \approx 2.86');

subplot(2, 2, 4);
semilogx(w, phase, 'g', 'linewidth', 2);
grid on;
title('Bode Phase');
xlabel('\omega (rad/s)');
ylabel('Phase (deg)');
hold on;
plot([1 / 0.35, 1 / 0.35], ylim(), 'k--');
text(1 / 0.35 * 1.08, -45, '\omega_c \approx 2.86');

if exist('sgtitle', 'file')
  sgtitle('O2 Example: DC Motor Speed Baseline Model');
elseif exist('suptitle', 'file')
  suptitle('O2 Example: DC Motor Speed Baseline Model');
endif

[script_dir, ~, ~] = fileparts(mfilename('fullpath'));
output_path = fullfile(script_dir, 'T2-O2-dc-motor-example.png');

print(hf, output_path, '-dpng', '-r180');
close(hf);
