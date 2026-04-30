output_dir = fullfile(fileparts(mfilename('fullpath')), 'assets');
if ~exist(output_dir, 'dir')
  mkdir(output_dir);
end

set(groot, "defaultAxesFontName", "Times");
set(groot, "defaultTextFontName", "Times");
set(groot, "defaultLineLineWidth", 1.4);

blue = [0.05, 0.33, 0.75];
dark = [0.05, 0.05, 0.05];
gray = [0.55, 0.55, 0.55];
red = [0.85, 0.10, 0.10];

function save_sheet_plot(path_base)
  set(gcf, 'Color', [1 1 1]);
  set(gca, 'FontName', 'Times New Roman', 'FontSize', 8, 'LineWidth', 0.8);
  set(gcf, 'PaperPositionMode', 'auto');
  print([path_base ".png"], '-dpng', '-r360');
  print([path_base ".pdf"], '-dpdf', '-bestfit');
end

zeta = 0.32;
wn = 3.0;
wd = wn * sqrt(1 - zeta^2);
t = linspace(0, 5.8, 900);
phi = atan(sqrt(1 - zeta^2) / zeta);
y = 1 - exp(-zeta * wn * t) ./ sqrt(1 - zeta^2) .* sin(wd * t + phi);
tr = (pi - acos(zeta)) / wd;
tp = pi / wd;
ts = 4 / (zeta * wn);
[yp, ip] = max(y);

figure('visible', 'off', 'position', [100, 100, 760, 360]);
plot(t, y, 'Color', blue); hold on;
plot([0, max(t)], [1, 1], 'k-', 'LineWidth', 0.8);
plot([0, max(t)], [1.02, 1.02], 'k--', 'LineWidth', 0.7);
plot([0, max(t)], [0.98, 0.98], 'k--', 'LineWidth', 0.7);
plot([tr tr], [0 1.02], '--', 'Color', gray, 'LineWidth', 0.8);
plot([tp tp], [0 yp], '--', 'Color', gray, 'LineWidth', 0.8);
plot([ts ts], [0 1.02], '--', 'Color', gray, 'LineWidth', 0.8);
plot(tp, yp, 'o', 'MarkerSize', 4, 'MarkerFaceColor', blue, 'MarkerEdgeColor', blue);
text(tr, -0.08, '$t_r$', 'Interpreter', 'latex', 'HorizontalAlignment', 'center');
text(tp, -0.08, '$t_p$', 'Interpreter', 'latex', 'HorizontalAlignment', 'center');
text(ts, -0.08, '$t_s$', 'Interpreter', 'latex', 'HorizontalAlignment', 'center');
text(tp + 0.15, yp - 0.02, '$M_p$', 'Interpreter', 'latex', 'Color', dark);
text(max(t) * 0.82, 1.045, '$\pm2\%$', 'Interpreter', 'latex');
xlabel('$t$', 'Interpreter', 'latex');
ylabel('$c(t)/c(\infty)$', 'Interpreter', 'latex');
set(gca, 'Position', [0.075 0.17 0.895 0.74]);
xlim([0, max(t)]);
ylim([-0.12, 1.45]);
box off;
grid off;
save_sheet_plot(fullfile(output_dir, 'step_response'));
close;

figure('visible', 'off', 'position', [100, 100, 760, 360]);
hold on;
x = linspace(-5.5, -0.35, 260);
ybranch = 1.55 * sqrt(max(0, (x + 5.5) .* (-0.35 - x))) / 2.55;
plot(x, ybranch, 'Color', blue);
plot(x, -ybranch, 'Color', blue);
plot([-2.9, -2.9], [-2.0, 2.0], '--', 'Color', gray, 'LineWidth', 0.7);
plot([-5.0, -0.8], [0, 1.65], '--', 'Color', gray, 'LineWidth', 0.7);
plot([-5.0, -0.8], [0, -1.65], '--', 'Color', gray, 'LineWidth', 0.7);
plot([-5, -3.2, -1.3], [0, 0, 0], 'x', 'Color', red, 'MarkerSize', 8, 'LineWidth', 1.2);
plot(-0.35, 0, 'o', 'Color', blue, 'MarkerSize', 7, 'LineWidth', 1.2);
quiver(-4.7, 0.18, 0.55, 0.28, 0, 'Color', blue, 'MaxHeadSize', 0.8);
quiver(-4.7, -0.18, 0.55, -0.28, 0, 'Color', blue, 'MaxHeadSize', 0.8);
text(-3.05, -1.82, '$\sigma_a$', 'Interpreter', 'latex');
text(-1.8, 1.2, '$\theta_a$', 'Interpreter', 'latex');
xlabel('Re');
ylabel('Im');
set(gca, 'Position', [0.075 0.13 0.89 0.80]);
xlim([-5.8, 0.8]);
ylim([-2.0, 2.0]);
axis equal;
box off;
grid off;
save_sheet_plot(fullfile(output_dir, 'root_locus'));
close;

w = logspace(-1, 2, 360);
wb = 1;
mag = -20 * log10(sqrt(1 + (w / wb).^2));
phase = -atan(w / wb) * 180 / pi;
figure('visible', 'off', 'position', [100, 100, 760, 420]);
subplot(2, 1, 1);
semilogx(w, mag, 'Color', blue); hold on;
plot([min(w), max(w)], [0, 0], 'k:', 'LineWidth', 0.7);
plot([wb, wb], [-42, 4], '--', 'Color', gray, 'LineWidth', 0.7);
text(wb * 1.08, -34, '$\omega_b$', 'Interpreter', 'latex');
ylabel('$|G(j\omega)|$ dB', 'Interpreter', 'latex');
set(gca, 'Position', [0.095 0.57 0.87 0.36]);
xlim([min(w), max(w)]);
ylim([-42, 5]);
box off; grid off;
subplot(2, 1, 2);
semilogx(w, phase, 'Color', blue); hold on;
plot([min(w), max(w)], [0, 0], 'k:', 'LineWidth', 0.7);
plot([min(w), max(w)], [-90, -90], 'k:', 'LineWidth', 0.7);
plot([wb, wb], [-95, 5], '--', 'Color', gray, 'LineWidth', 0.7);
xlabel('$\omega$ (log)', 'Interpreter', 'latex');
ylabel('$\angle G(j\omega)$', 'Interpreter', 'latex');
set(gca, 'Position', [0.095 0.14 0.87 0.35]);
xlim([min(w), max(w)]);
ylim([-100, 8]);
box off; grid off;
save_sheet_plot(fullfile(output_dir, 'bode_plot'));
close;

theta = linspace(-1.35*pi, 1.35*pi, 520);
xn = -0.15 + 0.72 * cos(theta) ./ (1 + 0.18 * cos(theta));
yn = 0.92 * sin(theta) .* (0.88 + 0.12 * cos(theta));
figure('visible', 'off', 'position', [100, 100, 520, 420]);
plot(xn, yn, 'Color', blue); hold on;
plot(-1, 0, 'x', 'Color', red, 'MarkerSize', 9, 'LineWidth', 1.3);
plot([min(xn)-0.25, max(xn)+0.25], [0, 0], 'k-', 'LineWidth', 0.7);
plot([0, 0], [min(yn)-0.2, max(yn)+0.2], 'k-', 'LineWidth', 0.7);
quiver(xn(80), yn(80), xn(92)-xn(80), yn(92)-yn(80), 0, 'Color', blue, 'MaxHeadSize', 0.9);
text(-1.08, -0.14, '$-1$', 'Interpreter', 'latex');
text(max(xn)+0.1, 0.05, 'Re', 'FontSize', 8);
text(0.05, max(yn)+0.08, 'Im', 'FontSize', 8);
set(gca, 'Position', [0.04 0.08 0.92 0.86]);
xlim([-1.25, 0.85]);
ylim([-1.15, 1.15]);
axis equal;
axis off;
save_sheet_plot(fullfile(output_dir, 'nyquist_plot'));
close;

fprintf('Generated compact cheat-sheet figures in: %s\n', output_dir);
