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
w = logspace (-1, 2, 700);

names = {'比例环节', '积分环节', '微分环节', '一阶惯性', '二阶振荡'};
formulas = {'K = 2', '1 / s', 's', '1 / (0.5s + 1)', '25 / (s^2 + 2s + 25)'};
cues = {'水平平移', '持续下降', '持续上升', '先平后降', '局部峰起'};

fig = figure ('position', [100, 100, 1500, 620], 'color', 'w');
for k = 1:5
  if k == 1
    sys = tf ([2], [1]);
  elseif k == 2
    sys = tf ([1], [1, 0]);
  elseif k == 3
    sys = tf ([1, 0], [1]);
  elseif k == 4
    sys = tf ([1], [0.5, 1]);
  else
    sys = tf ([25], [1, 2, 25]);
  end
  [mag, phase_deg] = bode (sys, w);
  mag_db = 20 * log10 (squeeze (mag));
  phase_deg = squeeze (phase_deg);

  subplot (2, 5, k);
  semilogx (w, mag_db, 'LineWidth', 1.8);
  grid on;
  xlim ([0.1, 100]);
  ylim ([-45, 45]);
  title ({names{k}, formulas{k}}, 'FontWeight', 'bold');
  text (0.13, -37, cues{k}, 'FontSize', 10);
  if k == 1
    ylabel ('幅值 / dB');
  end

  subplot (2, 5, k + 5);
  semilogx (w, phase_deg, 'LineWidth', 1.8);
  grid on;
  xlim ([0.1, 100]);
  ylim ([-210, 120]);
  xlabel ('\omega / rad/s');
  if k == 1
    ylabel ('相位 / deg');
  end
end

print (fig, fullfile (outdir, 'fd-03-typical-elements-bode-comparison.svg'), '-dsvg');
