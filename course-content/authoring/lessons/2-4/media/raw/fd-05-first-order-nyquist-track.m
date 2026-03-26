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
w = logspace (-3, 2, 1000);
sys = 1 / (0.5 * s + 1);
[re, im] = nyquist (sys, w);
resp = squeeze (re) + 1i * squeeze (im);

fig = figure ('position', [100, 100, 840, 700], 'color', 'w');
plot (real (resp), imag (resp), 'LineWidth', 2.0);
grid on;
axis equal;
xlim ([-0.05, 1.05]);
ylim ([-0.62, 0.05]);
xlabel ('Re');
ylabel ('Im');
title ('一阶惯性环节的 Nyquist 轨迹');
hold on;

plot (real (resp(1)), imag (resp(1)), 'o', 'MarkerSize', 7, 'LineWidth', 1.2);
plot (real (resp(end)), imag (resp(end)), 's', 'MarkerSize', 7, 'LineWidth', 1.2);

idx = 220;
dx = real (resp(idx + 8)) - real (resp(idx));
dy = imag (resp(idx + 8)) - imag (resp(idx));
quiver (real (resp(idx)), imag (resp(idx)), dx, dy, 0, 'MaxHeadSize', 0.9, 'LineWidth', 1.2);

text (real (resp(1)) - 0.03, imag (resp(1)) - 0.045, '低频起点', 'FontSize', 11);
text (0.08, -0.06, '频率增大方向', 'FontSize', 11);
text (0.08, -0.55, '高频收向原点', 'FontSize', 11);

print (fig, fullfile (outdir, 'fd-05-first-order-nyquist-track.svg'), '-dsvg');
