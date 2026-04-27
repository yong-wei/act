pkg load control

output_dir = fullfile(fileparts(mfilename('fullpath')), 'assets');
if ~exist(output_dir, 'dir')
  mkdir(output_dir);
end

set(groot, "defaultAxesFontName", "Times");
set(groot, "defaultTextFontName", "Times");

% 1) 标准二阶系统阶跃响应（欠阻尼）
wn = 4;
zeta = 0.3;
sys_step = tf(wn^2, [1, 2*zeta*wn, wn^2]);
[y, t] = step(sys_step, linspace(0, 8, 1200)');

tr = (pi - acos(zeta)) / (wn * sqrt(1 - zeta^2));
wd = wn * sqrt(1 - zeta^2);
tp = pi / wd;
ts = 4 / (zeta * wn);
mp = exp(-pi * zeta / sqrt(1 - zeta^2)) * 100;
[~, idx] = max(y);

figure('visible', 'off');
plot(t, y, 'LineWidth', 1.6, 'Color', [0.12, 0.35, 0.75]);
hold on;
grid on;
xlabel('时间 $t\,(s)$', 'Interpreter', 'latex');
ylabel('输出 $c(t)/c(\infty)$', 'Interpreter', 'latex');
title('欠阻尼二阶系统阶跃响应', 'Interpreter', 'latex');
xline(tr, '--', '$t_r$', 'Interpreter', 'latex', 'LabelVerticalAlignment', 'middle', 'Color', [0 0 0]);
xline(tp, '--', '$t_p$', 'Interpreter', 'latex', 'LabelVerticalAlignment', 'middle', 'Color', [0.85 0.33 0.10]);
xline(ts, '--', '$t_s$', 'Interpreter', 'latex', 'LabelVerticalAlignment', 'middle', 'Color', [0.20, 0.60, 0.20]);
plot([0, max(t)], [1, 1], 'k--', 'LineWidth', 1.2);
y_lim = ylim();
plot([0, max(t)], [1.02, 1.02], 'k:');
plot([0, max(t)], [0.98, 0.98], 'k:');
text(0.1 * max(t), 1 + 0.015, '$\\pm 2\\%$', 'Interpreter', 'latex', 'Color', 'k', 'FontSize', 10);
ylim([min(0, 1.1 * min(y)), 1.2 * max(1, y_lim(2))]);
text(tp, y(idx), sprintf('$M_p=%.1f\\%%$', mp), 'Interpreter', 'latex', ...
  'FontSize', 9, 'HorizontalAlignment', 'left', 'VerticalAlignment', 'top');
text(0.2 * max(t), 1.05, '$\leftarrow 1\pm2\%$ 带', 'Interpreter', 'latex', 'FontSize', 8, 'Color', [0.2, 0.2, 0.2]);
set(gca, 'FontName', 'Times New Roman', 'FontSize', 9);
print(fullfile(output_dir, 'step_response.png'), '-dpng', '-r300');
print(fullfile(output_dir, 'step_response.pdf'), '-dpdf', '-bestfit');
close;

% 2) 根轨迹示例
sys_rl = tf(1, [1, 9, 26, 24]);  % 1/(s(s+2)(s+3)(s+4))
figure('visible', 'off');
rlocus(sys_rl);
grid on;
title('二阶以上开环系统根轨迹示例');
xlabel('Re\{s\}');
ylabel('Im\{s\}');
set(gca, 'FontName', 'Times New Roman', 'FontSize', 9);
print(fullfile(output_dir, 'root_locus.png'), '-dpng', '-r300');
print(fullfile(output_dir, 'root_locus.pdf'), '-dpdf', '-bestfit');
close;

% 3) Bode 幅频/相频
sys_bode = tf([100], [1, 2, 25]); % 二阶振荡环节
figure('visible', 'off');
bode(sys_bode, {0.2, 200});
grid on;
set(findall(gcf, 'Type', 'axes'), 'FontName', 'Times New Roman', 'FontSize', 8);
set(gcf, 'Color', [1, 1, 1]);
print(fullfile(output_dir, 'bode_plot.png'), '-dpng', '-r300');
print(fullfile(output_dir, 'bode_plot.pdf'), '-dpdf', '-bestfit');
close;

% 4) Nyquist 曲线
sys_ny = tf([1], [1, 1, 4, 0]); % 1/(s(s^2+4s+1))
figure('visible', 'off');
nyquist(sys_ny);
grid on;
set(gca, 'FontName', 'Times New Roman', 'FontSize', 9);
hold on;
plot(-1, 0, 'rx', 'MarkerSize', 9, 'LineWidth', 1.5);
xlabel('Re\{L(j\omega)\}');
ylabel('Im\{L(j\omega)\}');
title('Nyquist 曲线示例');
print(fullfile(output_dir, 'nyquist_plot.png'), '-dpng', '-r300');
print(fullfile(output_dir, 'nyquist_plot.pdf'), '-dpdf', '-bestfit');
close;

fprintf('Generated figures in: %s\n', output_dir);
