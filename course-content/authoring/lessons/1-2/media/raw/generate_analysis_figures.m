% Unit 1-2 analysis figures.
% Generates reproducible PNG/PDF assets for the handout.

clear all; close all; clc;

try
  pkg load control;
catch
  warning("control package not available; current figures use analytical data only");
end_try_catch

available_toolkits = available_graphics_toolkits();
if any(strcmp(available_toolkits, "qt"))
  graphics_toolkit("qt");
endif

processed_dir = fullfile(fileparts(fileparts(mfilename("fullpath"))), "processed");
if exist(processed_dir, "dir") ~= 7
  mkdir(processed_dir);
endif

font_name = "Noto Sans CJK SC";
lw = 2.0;

function style_axes(font_name, fs)
  set(gca, "fontname", font_name, "fontsize", fs, "linewidth", 1.0);
  grid on; box off;
endfunction

function save_fig(stem, processed_dir)
  png_path = fullfile(processed_dir, [stem ".png"]);
  svg_path = fullfile(processed_dir, [stem ".svg"]);
  pdf_path = fullfile(processed_dir, [stem ".pdf"]);
  print(gcf, png_path, "-dpng", "-r260");
  print(gcf, svg_path, "-dsvg");
  [status, output] = system(sprintf('rsvg-convert -f pdf -o "%s" "%s"', pdf_path, svg_path));
  if status != 0
    error("failed to convert SVG to PDF for %s: %s", stem, output);
  endif
endfunction

% Figure 1-2-3: direct ODE solution response.
t = linspace(0, 5, 600);
theta = 2.5 .* t - 1.25 + 1.25 .* exp(-2 .* t);
figure("visible", "off", "position", [100, 100, 760, 520]);
plot(t, theta, "linewidth", lw, "color", [0.05, 0.30, 0.58]);
hold on;
plot(t, 2.5 .* t - 1.25, "--", "linewidth", 1.4, "color", [0.55, 0.55, 0.55]);
xlabel("时间 t / s", "fontname", font_name, "fontsize", 17);
ylabel("航向角 \\theta(t)", "fontname", font_name, "fontsize", 17);
legend({"直接求解响应", "长期线性增长趋势"}, "location", "southeast", "fontname", font_name, "fontsize", 13);
style_axes(font_name, 16);
text(2.95, 8.1, "持续增长，不收敛", "fontname", font_name, "fontsize", 15);
save_fig("1-2-fig-03-direct-solve-response", processed_dir);

% Figure 1-2-8 and 1-2-9: magnitude and phase surfaces for G(s)=5/(s(s+2)).
sigma = linspace(-4, 1, 180);
omega = linspace(-3.5, 3.5, 180);
[Sg, Om] = meshgrid(sigma, omega);
s = Sg + 1i .* Om;
G = 5 ./ (s .* (s + 2));
mag = log10(abs(G));
mag(mag > 2.0) = 2.0;
phase = imag(G) ./ abs(G);

figure("visible", "off", "position", [100, 100, 820, 620]);
surf(Sg, Om, mag, "edgecolor", "none");
colormap("viridis");
view([38, 34]);
xlabel("\\sigma", "fontname", font_name, "fontsize", 16);
ylabel("j\\omega", "fontname", font_name, "fontsize", 16);
zlabel("log_{10}|G(s)|", "fontname", font_name, "fontsize", 16);
style_axes(font_name, 14);
hold on;
plot3(0, 0, 2.18, "marker", "x", "linestyle", "none", "color", [1, 0, 0], "markersize", 12, "linewidth", 2.0);
plot3(-2, 0, 2.18, "marker", "x", "linestyle", "none", "color", [1, 0, 0], "markersize", 12, "linewidth", 2.0);
text(0.18, 0.35, 2.22, "s=0", "fontname", font_name, "fontsize", 13);
text(-3.12, -0.65, 2.24, "s=-B/J", "fontname", font_name, "fontsize", 13);
save_fig("1-2-fig-08-magnitude-surface", processed_dir);

figure("visible", "off", "position", [100, 100, 820, 620]);
surf(Sg, Om, phase, "edgecolor", "none");
colormap("turbo");
view([38, 34]);
xlabel("\\sigma", "fontname", font_name, "fontsize", 16);
ylabel("j\\omega", "fontname", font_name, "fontsize", 16);
zlabel("sin(相位)", "fontname", font_name, "fontsize", 16);
style_axes(font_name, 14);
hold on;
plot3(0, 0, 0, "marker", "x", "linestyle", "none", "color", [1, 0, 0], "markersize", 12, "linewidth", 2.0);
plot3(-2, 0, 0, "marker", "x", "linestyle", "none", "color", [1, 0, 0], "markersize", 12, "linewidth", 2.0);
save_fig("1-2-fig-09-phase-surface", processed_dir);

% Figure 1-2-10: s-plane behavior map.
figure("visible", "off", "position", [100, 100, 820, 560]);
hold on;
patch([-5 0 0 -5], [-3 -3 3 3], [0.88 0.94 1.00], "edgecolor", "none");
patch([0 2 2 0], [-3 -3 3 3], [1.00 0.91 0.91], "edgecolor", "none");
plot([0 0], [-3 3], "k-", "linewidth", 2.0);
plot([-5 2], [0 0], "k-", "linewidth", 1.0);
plot([-4.2 -1.0 -0.6 0.7 0.4], [0.0 1.8 -1.1 1.2 -2.0], "ko", "markersize", 7, "markerfacecolor", [0.1 0.1 0.1]);
text(-4.6, 2.45, "稳定区", "fontname", font_name, "fontsize", 16, "color", [0.0 0.25 0.55]);
text(0.55, 2.45, "不稳定区", "fontname", font_name, "fontsize", 16, "color", [0.65 0.05 0.05]);
text(0.08, -2.65, "稳定边界", "fontname", font_name, "fontsize", 15);
text(-4.7, 0.35, "单调走廊", "fontname", font_name, "fontsize", 14);
text(-3.7, 2.0, "振荡走廊", "fontname", font_name, "fontsize", 14);
text(-4.05, -0.35, "快收敛", "fontname", font_name, "fontsize", 13);
text(-0.95, 2.1, "边摆边收", "fontname", font_name, "fontsize", 13);
text(0.85, 1.5, "发散", "fontname", font_name, "fontsize", 13);
xlim([-5, 2]); ylim([-3, 3]);
xlabel("\\sigma（实部）", "fontname", font_name, "fontsize", 17);
ylabel("j\\omega（虚部）", "fontname", font_name, "fontsize", 17);
style_axes(font_name, 16);
axis equal;
save_fig("1-2-fig-10-s-plane-map", processed_dir);

% Figure 1-2-11: pole locations and response shapes.
t = linspace(0, 8, 600);
pole_sets = {
  [-1.4], "左半平面实极点", exp(-1.4 .* t);
  [-0.45 + 1.7i, -0.45 - 1.7i], "左半平面共轭极点", exp(-0.45 .* t) .* cos(1.7 .* t);
  [0 + 1.4i, 0 - 1.4i], "虚轴共轭极点", cos(1.4 .* t);
  [0.25 + 1.2i, 0.25 - 1.2i], "右半平面共轭极点", exp(0.25 .* t) .* cos(1.2 .* t);
};
figure("visible", "off", "position", [100, 100, 1180, 620]);
for k = 1:4
  poles = pole_sets{k, 1};
  label = pole_sets{k, 2};
  y = pole_sets{k, 3};
  subplot(2, 4, k);
  hold on;
  plot([-2.2, 0.8], [0, 0], "k-", "linewidth", 0.9);
  plot([0, 0], [-2.2, 2.2], "k-", "linewidth", 1.3);
  plot(real(poles), imag(poles), "rx", "markersize", 10, "linewidth", 2.0);
  xlim([-2.2, 0.8]); ylim([-2.2, 2.2]);
  axis square;
  set(gca, "xtick", [-2, -1, 0], "ytick", [-2, 0, 2]);
  xlabel("\\sigma", "fontname", font_name, "fontsize", 13);
  ylabel("j\\omega", "fontname", font_name, "fontsize", 13);
  title(label, "fontname", font_name, "fontsize", 14, "fontweight", "normal");
  style_axes(font_name, 12);

  subplot(2, 4, 4 + k);
  plot(t, y, "linewidth", lw, "color", [0.05, 0.30, 0.58]);
  xlabel("时间 t", "fontname", font_name, "fontsize", 13);
  ylabel("响应形态", "fontname", font_name, "fontsize", 13);
  set(gca, "xtick", [0, 4, 8]);
  style_axes(font_name, 12);
  if k == 4
    ylim([-5, 5]);
  endif
endfor
save_fig("1-2-fig-11-poles-responses", processed_dir);
