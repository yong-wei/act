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
w = logspace (-2, 2, 800);
sys = 1 / (0.5 * s + 1);
[mag, phase_deg] = bode (sys, w);
mag_db = 20 * log10 (squeeze (mag));
phase_deg = squeeze (phase_deg);
[re, im] = nyquist (sys, w);
resp = squeeze (re) + 1i * squeeze (im);

fig = figure ('position', [100, 100, 1180, 760], 'color', 'w');

ax1 = axes ('position', [0.08, 0.58, 0.36, 0.30]);
semilogx (ax1, w, mag_db, 'LineWidth', 2.0);
grid (ax1, 'on');
xlim (ax1, [0.01, 100]);
ylim (ax1, [-42, 3]);
title (ax1, '幅频图：低频保留，高频衰减');
ylabel (ax1, 'dB');

ax2 = axes ('position', [0.08, 0.14, 0.36, 0.30]);
semilogx (ax2, w, phase_deg, 'LineWidth', 2.0);
grid (ax2, 'on');
xlim (ax2, [0.01, 100]);
ylim (ax2, [-100, 5]);
title (ax2, '相频图：相位逐步拖后');
xlabel (ax2, '\omega / rad/s');
ylabel (ax2, 'deg');

ax3 = axes ('position', [0.58, 0.18, 0.33, 0.62]);
plot (ax3, real (resp), imag (resp), 'LineWidth', 2.0);
grid (ax3, 'on');
axis (ax3, 'equal');
xlim (ax3, [-0.05, 1.05]);
ylim (ax3, [-0.62, 0.05]);
title (ax3, 'Nyquist 图：把强弱和相位合成轨迹');
xlabel (ax3, 'Re');
ylabel (ax3, 'Im');
hold (ax3, 'on');
plot (ax3, real (resp(1)), imag (resp(1)), 'o', 'MarkerSize', 7, 'LineWidth', 1.2);
plot (ax3, real (resp(end)), imag (resp(end)), 's', 'MarkerSize', 7, 'LineWidth', 1.2);

txt = axes ('position', [0.45, 0.34, 0.10, 0.24], 'visible', 'off');
text (0.02, 0.82, '同一个对象', 'FontSize', 11, 'FontWeight', 'bold');
text (0.02, 0.55, '拆开看：', 'FontSize', 11);
text (0.02, 0.41, '强弱变化 + 相位变化', 'FontSize', 11);
text (0.02, 0.17, '合起来看：', 'FontSize', 11);
text (0.02, 0.03, '复平面轨迹如何移动', 'FontSize', 11);

print (fig, fullfile (outdir, 'fd-08-bode-nyquist-consistency-panel.svg'), '-dsvg');
