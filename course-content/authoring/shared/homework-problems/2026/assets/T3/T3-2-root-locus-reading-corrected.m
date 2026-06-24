graphics_toolkit("qt");

font_name = "Noto Sans CJK SC";
set(0, "defaultaxesfontname", font_name);
set(0, "defaulttextfontname", font_name);
set(0, "defaultaxesfontweight", "normal");
set(0, "defaulttextfontweight", "normal");
set(0, "defaultlinelinewidth", 2.0);
set(0, "defaulttextinterpreter", "tex");

script_dir = fileparts(mfilename("fullpath"));
addpath(script_dir);
out_png = fullfile(script_dir, "T3-2-root-locus-reading-20260623-160841.png");
out_pdf = fullfile(script_dir, "T3-2-root-locus-reading-20260623-160841.pdf");

figure(1, "visible", "off");
clf;
set(gcf, "color", "w");
set(gcf, "paperunits", "inches");
set(gcf, "papersize", [9.4, 6.3]);
set(gcf, "paperposition", [0, 0, 9.4, 6.3]);

hold on;
grid on;
box off;

x_limits = [-10.6, 4.0];
y_limits = [-6.1, 6.1];
axis([x_limits, y_limits]);
axis equal;
set(gca, "fontname", font_name, "fontsize", 14);
set(gca, "position", [0.10, 0.15, 0.84, 0.77]);
set(gca, "xtick", -10:1:4);
set(gca, "ytick", -6:1:6);

plot([x_limits(1), x_limits(2)], [0, 0], "-", "color", [0.12, 0.16, 0.22], "linewidth", 1.1);
plot([0, 0], [y_limits(1), y_limits(2)], "-", "color", [0.12, 0.16, 0.22], "linewidth", 1.1);

fill([0, x_limits(2), x_limits(2), 0], [y_limits(1), y_limits(1), y_limits(2), y_limits(2)], ...
  [1.00, 0.88, 0.88], "edgecolor", "none", "facealpha", 0.65);

blue = [0.15, 0.39, 0.92];
red = [0.86, 0.15, 0.15];
orange = [0.95, 0.45, 0.10];
dark = [0.07, 0.09, 0.13];
muted = [0.42, 0.48, 0.56];

% True root-locus data for G0(s)=1/[s(s+2)(s+6)]:
% closed-loop characteristic equation s^3 + 8s^2 + 12s + K_r = 0.
k_values = unique([linspace(0, 5.0490424755, 180), linspace(5.0490424755, 96, 340), linspace(96, 260, 260)]);
branch_roots = zeros(3, numel(k_values));
branch_roots(:, 1) = sort(roots([1, 8, 12, k_values(1)]));
perms3 = perms(1:3);
for idx = 2:numel(k_values)
  current_roots = roots([1, 8, 12, k_values(idx)]);
  previous_roots = branch_roots(:, idx - 1);
  best_order = perms3(1, :);
  best_cost = Inf;
  for pidx = 1:rows(perms3)
    ordered = current_roots(perms3(pidx, :));
    cost = sum(abs(ordered(:) - previous_roots(:)));
    if (cost < best_cost)
      best_cost = cost;
      best_order = perms3(pidx, :);
    endif
  endfor
  branch_roots(:, idx) = current_roots(best_order);
endfor

for b = 1:3
  x_branch = real(branch_roots(b, :));
  y_branch = imag(branch_roots(b, :));
  real_mask = abs(y_branch) < 1e-5;
  for segment_kind = 1:2
    if (segment_kind == 1)
      segment_mask = real_mask;
      segment_color = blue;
      arrow_position = 1.0;
      arrow_scale = 1.22;
    else
      segment_mask = !real_mask;
      segment_color = red;
      arrow_position = 1.0;
      arrow_scale = 1.22;
    endif

    idx = find(segment_mask & isfinite(x_branch) & isfinite(y_branch));
    if (numel(idx) < 2)
      continue;
    endif

    breaks = [0, find(diff(idx) > 1), numel(idx)];
    for run_idx = 1:(numel(breaks) - 1)
      run = idx((breaks(run_idx) + 1):breaks(run_idx + 1));
      if (numel(run) < 2)
        continue;
      endif
      if (segment_kind == 2 && run(1) > 1)
        previous_idx = run(1) - 1;
        if (abs(y_branch(previous_idx)) < 1e-5)
          run = [previous_idx, run];
        endif
      endif
      run_arrow_position = arrow_position;
      if (segment_kind == 1 && x_branch(run(end)) > -6.0)
        run_arrow_position = 0.82;
      endif
      draw_curve_arrows(gca(), x_branch(run), y_branch(run), ...
        "positions", run_arrow_position, "color", segment_color, "linewidth", 2.6, ...
        "scale", arrow_scale);
    endfor
  endfor
endfor

% Open-loop poles.
open_poles = [0, -2, -6];
for i = 1:numel(open_poles)
  px = open_poles(i);
  plot(px, 0, "x", "color", dark, "markersize", 12, "linewidth", 2.2);
  text(px, -0.28, sprintf("%g", px), "horizontalalignment", "center", ...
    "verticalalignment", "top", "fontsize", 13, "color", dark);
endfor

% Exact closed-loop reading points from the problem stem.
points = [
  -0.9028, 0.00;
  -6.0806, 0.00;
  -0.1902, 0.00;
  -1.7292, 0.00;
  -0.8861, 0.4223;
  -0.8861, -0.4223;
  -0.1337, 3.1487;
  -0.1337, -3.1487;
  0.00, 3.4641;
  0.00, -3.4641
];
plot(points(:, 1), points(:, 2), "o", "color", orange, ...
  "markerfacecolor", orange, "markersize", 7.0, "linewidth", 1.2);

text(-2.55, -0.82, "分离点", "fontsize", 11, "color", dark);
text(-2.55, -1.12, "K_r≈5.05", "fontsize", 11, "color", dark);
text(-3.05, 1.18, "K_r=2", "fontsize", 11, "color", dark);
text(-3.05, 0.88, "s≈-6.081,-1.729,-0.190", "fontsize", 11, "color", dark);
text(-2.70, 2.95, "80%工作增益点", "fontsize", 11, "color", dark);
text(-2.70, 2.65, "K_r=76.8 共轭根", "fontsize", 11, "color", dark);
text(0.92, 3.42, "K_r=96", "fontsize", 11, "color", dark);
text(0.92, 3.12, "虚轴共轭根 ±j3.464", "fontsize", 11, "color", dark);

text(-4.1, 0.28, "无根轨迹区间", "fontsize", 12, "color", muted, ...
  "horizontalalignment", "center");
plot([-5.85, -2.15], [0, 0], ":", "color", [0.65, 0.70, 0.77], "linewidth", 1.2);
text(2.55, 5.55, "不稳定侧", "fontsize", 12, "color", [0.60, 0.11, 0.11], ...
  "horizontalalignment", "center");

xlabel("实轴", "fontsize", 14, "fontname", font_name);
ylabel("虚轴", "fontsize", 14, "fontname", font_name);

print(gcf, out_png, "-dpng", "-r220");
print(gcf, out_pdf, "-dpdf");
close(gcf);

printf("%s\n", out_png);
