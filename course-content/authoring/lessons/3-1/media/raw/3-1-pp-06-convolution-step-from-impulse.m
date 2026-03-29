1;
pkg load control;

set(0, 'defaultaxesfontname', 'Microsoft YaHei');
set(0, 'defaulttextfontname', 'Microsoft YaHei');
s = tf('s');
sys = 12 / ((s + 1) * (s + 2) * (s + 6));
t = 0:0.01:8;
dt = 0.1;
taus = 0:dt:8;
y_limit = [0, 1.05];

[g, t_g] = impulse(sys, t);
[y_exact, t_step] = step(sys, t);
g = squeeze(g);
y_exact = squeeze(y_exact);

y_approx = zeros(size(t));
fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1180, 760]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1180, 760]);
set(fig, 'paperposition', [0, 0, 1180, 760]);

subplot(2, 1, 1);
hold on;
palette = [
  0.02, 0.52, 0.78;
  0.06, 0.46, 0.43;
  0.86, 0.15, 0.15;
  0.92, 0.35, 0.00;
  0.43, 0.32, 0.77;
  0.58, 0.47, 0.20;
  0.16, 0.55, 0.63;
  0.74, 0.29, 0.46;
  0.34, 0.39, 0.48
];

sample_ids = [1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81];

for k = 1:numel(taus)
  delayed = zeros(size(t));
  mask = t >= taus(k);
  delayed(mask) = dt * interp1(t_g, g, t(mask) - taus(k), 'linear', 0);
  y_approx = y_approx + delayed;
  color_id = mod(k - 1, rows(palette)) + 1;
  if any(sample_ids == k)
    plot(t, delayed, 'linewidth', 1.8, 'color', palette(color_id, :));
  endif
endfor

title('抽取更多个延时脉冲响应分量：每一条都来自同一个 g(t)，只是发生时刻不同');
xlabel('时间 t / s');
ylabel('\Delta t g(t-k\Delta t)');
xlim([0, 8]);
grid on;

subplot(2, 1, 2);
hold on;
plot(t_step, y_exact, 'linewidth', 2.6, 'color', [0.02 0.52 0.78]);
plot(t, y_approx, '--', 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
title('卷积数值实验：延时脉冲响应叠加逼近单位阶跃响应');
xlabel('时间 t / s');
ylabel('输出');
legend('精确阶跃响应 y(t)', 'Riemann 叠加近似', 'location', 'southeast');
xlim([0, 8]);
ylim(y_limit);
grid on;

axes('position', [0, 0, 1, 1], 'visible', 'off');
text(0.5, 0.98, '卷积不是抽象符号：许多小的延时脉冲响应连续叠加后，才形成完整阶跃响应', 'horizontalalignment', 'center', 'fontsize', 18, 'fontweight', 'bold');

raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-06-convolution-step-from-impulse.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-06-convolution-step-from-impulse.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
