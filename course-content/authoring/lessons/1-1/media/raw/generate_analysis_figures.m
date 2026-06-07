pkg load control;
graphics_toolkit("qt");

% Octave 绘图统一基线：中文字体、白底、线宽和 tex 公式解释。
font_name = "Noto Sans CJK SC";
default_line_width = 2.0;
default_axes_font_size = 11;
set(0, "defaultaxesfontname", font_name);
set(0, "defaulttextfontname", font_name);
set(0, "defaultaxesfontweight", "normal");
set(0, "defaulttextfontweight", "normal");
set(0, "defaultlinelinewidth", default_line_width);
set(0, "defaulttextinterpreter", "tex");
set(0, "defaultaxesTickLabelInterpreter", "tex");

% 所有正式图片写入 processed，数值证据写入 raw/generated-data。
processed_dir = fullfile(pwd(), "course-content/authoring/lessons/1-1/media/processed");
data_dir = fullfile(pwd(), "course-content/authoring/lessons/1-1/media/raw/generated-data");
if (!exist(processed_dir, "dir")) mkdir(processed_dir); endif
if (!exist(data_dir, "dir")) mkdir(data_dir); endif

function setup_figure(width, height)
  % 统一设置导出画布，避免交互窗口尺寸影响 PNG 结果。
  set(gcf, "visible", "off");
  set(gcf, "color", "w");
  set(gcf, "paperunits", "inches");
  set(gcf, "papersize", [width, height]);
  set(gcf, "paperposition", [0, 0, width, height]);
endfunction

function style_axes()
  % 统一单坐标轴网格、字体和曲线线宽。
  grid on;
  box off;
  set(gca, "fontname", "Noto Sans CJK SC");
  set(gca, "fontsize", 11);
  lines = findobj(gca, "type", "line");
  for i = 1:numel(lines)
    set(lines(i), "linewidth", 2.0);
  endfor
endfunction

function style_all_axes()
  % 统一 Bode/margin 这类多坐标轴图的字体、网格和线宽。
  axes_handles = findall(gcf, "type", "axes");
  for ax = axes_handles'
    if (strcmp(get(ax, "tag"), "legend")) continue; endif
    axes(ax);
    grid on;
    box off;
    set(ax, "fontname", "Noto Sans CJK SC");
    set(ax, "fontsize", 11);
    lines = findobj(ax, "type", "line");
    for i = 1:numel(lines)
      set(lines(i), "linewidth", 2.0);
    endfor
  endfor
endfunction

function remove_legends()
  % 单曲线图不保留 legend，避免多余图例干扰阅读。
  legends = findall(gcf, "tag", "legend");
  for i = 1:numel(legends)
    delete(legends(i));
  endfor
endfunction

function localize_bode_axes()
  % Octave 的 bode/margin 默认英文轴名；这里只做中文轴名替换。
  axes_handles = findall(gcf, "type", "axes");
  for ax = axes_handles'
    if (strcmp(get(ax, "tag"), "legend")) continue; endif
    yl = get(get(ax, "ylabel"), "string");
    xl = get(get(ax, "xlabel"), "string");
    if (ischar(yl) && !isempty(strfind(yl, "Magnitude")))
      set(get(ax, "ylabel"), "string", "幅值 / dB");
      set(get(ax, "xlabel"), "string", "");
    elseif (ischar(yl) && !isempty(strfind(yl, "Phase")))
      set(get(ax, "ylabel"), "string", "相位 / deg");
      set(get(ax, "xlabel"), "string", "频率 / rad/s");
    endif
    if (ischar(xl) && !isempty(strfind(xl, "Frequency")))
      set(get(ax, "xlabel"), "string", "频率 / rad/s");
    endif
  endfor
endfunction

function plot_bode_magnitude_pair(sys1, sys2, label1, label2)
  % 用 bode() 获取原生频响数据，再在三联图中绘制稳定的幅频对比子图。
  w = logspace(-1, 2, 240);
  [mag1, ph1, wout] = bode(sys1, w);
  [mag2, ph2, wout] = bode(sys2, w);
  mag1db = 20 * log10(squeeze(mag1));
  mag2db = 20 * log10(squeeze(mag2));
  semilogx(wout, mag1db, "linewidth", 2.0); hold on;
  semilogx(wout, mag2db, "linewidth", 2.0);
  grid on; box off;
  set(gca, "fontsize", 11);
  xlabel("频率 / rad/s"); ylabel("幅值 / dB");
  legend(label1, label2, "location", "southwest");
endfunction

function use_triptych_axis(index)
  % 手动布置三联图坐标轴，让每个绘图区接近方形并减少两侧空白。
  positions = [
    0.065, 0.18, 0.245, 0.70;
    0.380, 0.18, 0.245, 0.70;
    0.695, 0.18, 0.245, 0.70
  ];
  axes("position", positions(index, :));
endfunction

function plot_step_pair_from_data(sys1, sys2, label1, label2, legend_location)
  % 用 step() 获取时域响应数据，再在三联图中绘制校正前后对比。
  if (nargin < 5) legend_location = "northwest"; endif
  [y1, t1] = step(sys1, 8);
  [y2, t2] = step(sys2, 8);
  plot(t1, y1, "linewidth", 2.0); hold on;
  plot(t2, y2, "linewidth", 2.0);
  grid on; box off;
  set(gca, "fontsize", 11);
  xlabel("时间 / s"); ylabel("输出");
  ylim([0, max([1.2; min(max(y1), 4); min(max(y2), 4)])]);
  legend(label1, label2, "location", legend_location);
  pbaspect([1 1 1]);
endfunction

function roots = root_locus_data(sys, max_k)
  % 使用 control 包 rlocus() 生成根轨迹数据；必要时显式放大增益范围。
  if (nargin < 2)
    roots = rlocus(sys);
  else
    roots = rlocus(sys, max_k / 240, 0, max_k);
  endif
endfunction

function plot_root_locus_with_markers(sys, before_poles, after_poles, max_k)
  % 用 rlocus() 获取根轨迹数据，并叠加校正前后极点标记。
  if (nargin < 4)
    roots = root_locus_data(sys);
  else
    roots = root_locus_data(sys, max_k);
  endif
  hold on;
  h_locus = [];
  for i = 1:rows(roots)
    h = plot(real(roots(i, :)), imag(roots(i, :)), "b-", "linewidth", 2.0);
    if (isempty(h_locus)) h_locus = h; endif
  endfor
  h_before = plot(real(before_poles), imag(before_poles), "rx", "markersize", 8, "linewidth", 1.8);
  h_after = plot(real(after_poles), imag(after_poles), "o", "markersize", 7, "linewidth", 1.8, "color", [0.80,0.30,0.12], "markerfacecolor", [0.80,0.30,0.12]);
  grid on; box off;
  set(gca, "fontsize", 11);
  xlabel("实轴"); ylabel("虚轴");
  legend([h_locus(1), h_before(1), h_after(1)], "根轨迹", "开环极点", "校正后极点", "location", "northeast");
  pbaspect([1 1 1]);
endfunction

function plot_root_locus_basic(sys, max_k)
  % 单独根轨迹图：显式绑定图例，避免线型和开环极点错配。
  if (nargin < 2)
    roots = root_locus_data(sys);
  else
    roots = root_locus_data(sys, max_k);
  endif
  hold on;
  h_locus = [];
  for i = 1:rows(roots)
    h = plot(real(roots(i, :)), imag(roots(i, :)), "b-", "linewidth", 2.0);
    if (isempty(h_locus)) h_locus = h; endif
  endfor
  h_pole = plot(real(pole(sys)), imag(pole(sys)), "rx", "markersize", 8, "linewidth", 1.8);
  grid on; box off;
  set(gca, "fontsize", 11);
  xlabel("实轴"); ylabel("虚轴");
  legend([h_locus(1), h_pole(1)], "根轨迹", "开环极点", "location", "northeast");
  pbaspect([1 1 1]);
endfunction

function save_figure(path, export_font_size)
  % 同时导出 PNG 与同名矢量 PDF；Markdown 使用 PNG，正式 PDF 优先嵌入矢量 PDF。
  if (nargin < 2)
    export_font_size = 11;
  endif
  text_handles = findall(gcf, "type", "text");
  for tx = text_handles'
    set(tx, "fontname", "Noto Sans CJK SC");
    set(tx, "fontweight", "normal");
    set(tx, "fontsize", export_font_size);
  endfor
  axes_handles = findall(gcf, "type", "axes");
  for ax = axes_handles'
    set(ax, "fontname", "Noto Sans CJK SC");
    set(ax, "fontsize", export_font_size);
    title_handle = get(ax, "title");
    if (!isempty(title_handle))
      set(title_handle, "string", "");
    endif
  endfor
  [path_dir, path_name, path_ext] = fileparts(path);
  if (isempty(path_ext))
    png_path = fullfile(path_dir, [path_name ".png"]);
    pdf_path = fullfile(path_dir, [path_name ".pdf"]);
  else
    png_path = path;
    pdf_path = fullfile(path_dir, [path_name ".pdf"]);
  endif
  print(gcf, png_path, "-dpng", "-r220");
  print(gcf, pdf_path, "-dpdf", "-painters");
  close(gcf);
endfunction

% 基础示例：一阶惯性环节；完整示例：积分+惯性对象。
G_first = tf(1, [0.5 1]);
G = tf(1, [1 2 0]);
Gc05 = feedback(0.5 * G, 1);
Gc2 = feedback(2 * G, 1);
Gc5 = feedback(5 * G, 1);

% 1. First-order step response: G(s)=1/(0.5s+1)
figure(1); setup_figure(8, 4.6);
step(G_first, 4);
style_axes();
xlabel("时间 t / s"); ylabel("输出 y(t)");
hold on;
plot([0.5 0.5], [0 0.632], "--", "linewidth", 1.2, "color", [0.45,0.45,0.45]);
text(0.58, 0.58, "\\tau=0.5s", "fontsize", 11);
save_figure(fullfile(processed_dir, "1-1-step-response-first-order.png"), 17);

% 2. Root locus overview for the current first-order model
figure(2); setup_figure(7.5, 5.2);
plot_root_locus_basic(G_first, 1.5);
xlim([-5, -1]); ylim([-2, 2]);
save_figure(fullfile(processed_dir, "1-1-root-locus-example.png"), 17);

% 3. First-order Bode
figure(3); setup_figure(8.3, 6.0);
bode(G_first);
style_all_axes();
remove_legends();
localize_bode_axes();
save_figure(fullfile(processed_dir, "1-1-bode-example.png"));

% 4. Before/after correction comparison: time, root locus, frequency
figure(4); setup_figure(10.8, 3.8);
G_first_cl = feedback(2 * G_first, 1);
use_triptych_axis(1);
plot_step_pair_from_data(G_first, G_first_cl, "校正前：G(s)", "校正后：K_p=2 闭环", "south");
use_triptych_axis(2);
p0 = pole(G_first); p2 = pole(G_first_cl);
plot_root_locus_with_markers(G_first, p0, p2, 3);
xlim([-7, 0.5]); ylim([-3.75, 3.75]);
use_triptych_axis(3);
plot_bode_magnitude_pair(G_first, 2 * G_first, "校正前：G(s)", "校正后：2G(s)");
pbaspect([1 1 1]);
save_figure(fullfile(processed_dir, "1-1-gain-comparison.png"));

% 5. Open-loop step: G(s)=1/(s(s+2))
figure(5); setup_figure(8, 4.6);
step(G, 8);
style_axes();
xlabel("时间 t / s"); ylabel("输出 y(t)");
save_figure(fullfile(processed_dir, "1-1-example-openloop-step.png"), 17);

% 6. Root locus for the full example
figure(6); setup_figure(7.5, 5.2);
plot_root_locus_basic(G);
save_figure(fullfile(processed_dir, "1-1-example-root-locus.png"), 17);

% 7. Bode/margin for G(s)=1/(s(s+2))
figure(7); setup_figure(8.3, 6.0);
margin(G);
style_all_axes();
remove_legends();
localize_bode_axes();
save_figure(fullfile(processed_dir, "1-1-example-bode.png"));

% 8. Diagnosis/correction triptych for the worked example
figure(8); setup_figure(10.8, 3.8);
use_triptych_axis(1);
plot_step_pair_from_data(G, Gc2, "校正前：开环", "校正后：K_p=2 闭环");
use_triptych_axis(2);
p0 = pole(G); p2 = pole(Gc2);
plot_root_locus_with_markers(G, p0, p2);
use_triptych_axis(3);
plot_bode_magnitude_pair(G, 2 * G, "校正前：G(s)", "校正后：2G(s)");
pbaspect([1 1 1]);
save_figure(fullfile(processed_dir, "1-1-example-correction-triptych.png"));

% Save reproducible numeric evidence for the reviewed claims.
[y2, t2] = step(Gc2, 10);
[y5, t5] = step(Gc5, 10);
overshoot_kp2 = (max(y2) - dcgain(Gc2)) / dcgain(Gc2) * 100;
overshoot_kp5 = (max(y5) - dcgain(Gc5)) / dcgain(Gc5) * 100;
open_loop_stable = isstable(G);
closed_loop_poles_kp2 = pole(Gc2);
closed_loop_poles_kp5 = pole(Gc5);
evidence_path = fullfile(data_dir, "1-1-analysis-data.txt");
fid = fopen(evidence_path, "w");
fprintf(fid, "overshoot_kp2_percent=%.4f\n", overshoot_kp2);
fprintf(fid, "overshoot_kp5_percent=%.4f\n", overshoot_kp5);
fprintf(fid, "open_loop_stable=%d\n", open_loop_stable);
fprintf(fid, "closed_loop_poles_kp2=%s\n", mat2str(closed_loop_poles_kp2));
fprintf(fid, "closed_loop_poles_kp5=%s\n", mat2str(closed_loop_poles_kp5));
fclose(fid);
