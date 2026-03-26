clear; close all; clc;
pkg load control;

set (0, 'defaultfigurevisible', 'off');
set (0, 'defaultaxesfontname', 'PingFang SC');
set (0, 'defaulttextfontname', 'PingFang SC');

[script_dir, ~, ~] = fileparts (mfilename ('fullpath'));
outdir = fullfile (script_dir, '..', 'processed');
if ~exist (outdir, 'dir')
  mkdir (outdir);
end

s = tf ('s');
w = logspace (-1, 2, 900);
wn = 5;
zetas = [0.15, 0.30, 0.50, 0.80];

fig = figure ('position', [100, 100, 980, 760], 'color', 'w');

subplot (2, 1, 1);
hold on;
for k = 1:numel (zetas)
  zeta = zetas(k);
  sys = wn^2 / (s^2 + 2 * zeta * wn * s + wn^2);
  [mag, ~] = bode (sys, w);
  mag_db = 20 * log10 (squeeze (mag));
  semilogx (w, mag_db, 'LineWidth', 1.8);
end
grid on;
xlim ([0.1, 100]);
ylim ([-55, 18]);
ylabel ('幅值 / dB');
title ('不同阻尼比下的二阶振荡环节 Bode 图');
legend ('\zeta = 0.15', '\zeta = 0.30', '\zeta = 0.50', '\zeta = 0.80', 'Location', 'southwest');
text (7.4, 11, '阻尼越小，局部峰起越明显', 'FontSize', 11);

subplot (2, 1, 2);
hold on;
for k = 1:numel (zetas)
  zeta = zetas(k);
  sys = wn^2 / (s^2 + 2 * zeta * wn * s + wn^2);
  [~, phase_deg] = bode (sys, w);
  phase_deg = squeeze (phase_deg);
  semilogx (w, phase_deg, 'LineWidth', 1.8);
end
grid on;
xlim ([0.1, 100]);
ylim ([-210, 10]);
xlabel ('\omega / rad/s');
ylabel ('相位 / deg');
text (0.13, -25, '相位变化也会随阻尼而变得更陡', 'FontSize', 11);

print (fig, fullfile (outdir, 'fd-07-second-order-damping-bode.svg'), '-dsvg');
