function handles = draw_curve_arrows(ax, x, y, varargin)
%DRAW_CURVE_ARROWS Plot a 2-D curve with data-attached trend arrowheads.
%   DRAW_CURVE_ARROWS(gca, x, y, ...) plots the curve and places filled
%   arrowheads on the curve using the local data-segment tangent. This follows
%   the arrowPlot idea: the curve data is the source of truth; arrowheads are
%   positioned by visual arc length and rotated from the curve tangent, not
%   hand-placed as annotation overlays.
%
%   Options:
%     "number"        number of arrowheads, default 1
%     "positions"     normalized visual arc-length positions in (0, 1)
%     "color"         curve and arrow color, default black
%     "linewidth"     curve line width, default 1.2
%     "linestyle"     curve line style, default "-"
%     "scale"         arrowhead scale multiplier, default 1
%     "size"          reference plot size in data units; default axes span
%     "headlength"    explicit arrowhead length in visual data units
%     "headwidth"     explicit arrowhead width in visual data units
%     "trimratio"     terminal curve rollback as a fraction of headlength, default 0.5

  opts.number = 1;
  opts.positions = [];
  opts.color = [0 0 0];
  opts.linewidth = 1.2;
  opts.linestyle = "-";
  opts.scale = 1;
  opts.size = [];
  opts.headlength = [];
  opts.headwidth = [];
  opts.trimratio = 0.5;

  if (mod(length(varargin), 2) != 0)
    error("draw_curve_arrows: property arguments must be name/value pairs");
  endif

  for i = 1:2:length(varargin)
    key = lower(varargin{i});
    val = varargin{i + 1};
    switch key
      case "number"
        opts.number = val;
      case "positions"
        opts.positions = val;
      case {"color", "colour"}
        opts.color = val;
      case {"linewidth", "line_width"}
        opts.linewidth = val;
      case {"linestyle", "line_style"}
        opts.linestyle = val;
      case "scale"
        opts.scale = val;
      case "size"
        opts.size = val;
      case "headlength"
        opts.headlength = val;
      case "headwidth"
        opts.headwidth = val;
      case {"trimratio", "terminaltrimratio", "terminal_trim_ratio"}
        opts.trimratio = val;
      otherwise
        error("draw_curve_arrows: unsupported option '%s'", varargin{i});
    endswitch
  endfor

  axes(ax);
  hold on;

  x = x(:)';
  y = y(:)';
  valid = isfinite(x) & isfinite(y);
  valid_idx = find(valid);
  if (numel(valid_idx) < 2)
    error("draw_curve_arrows: at least two finite curve points are required");
  endif

  handles = [];
  breaks = [0, find(diff(valid_idx) > 1), numel(valid_idx)];
  for run_idx = 1:(numel(breaks) - 1)
    run = valid_idx((breaks(run_idx) + 1):breaks(run_idx + 1));
    if (numel(run) < 2)
      continue;
    endif
    run_handles = draw_curve_arrow_run(ax, x(run), y(run), opts);
    handles = [handles; run_handles];
  endfor

  if (isempty(handles))
    error("draw_curve_arrows: at least one finite segment with two points is required");
  endif
endfunction

function handles = draw_curve_arrow_run(ax, x, y, opts)
  dar = get(ax, "DataAspectRatio");
  if (numel(dar) < 2 || any(dar(1:2) == 0))
    dar = [1 1 1];
  endif

  xlim_now = get(ax, "xlim");
  ylim_now = get(ax, "ylim");
  if (isempty(opts.size))
    reference_size = max([diff(xlim_now), diff(ylim_now)]);
  else
    reference_size = opts.size;
  endif

  x_visual = x / dar(1);
  y_visual = y / dar(2);
  segment_lengths = sqrt(diff(x_visual).^2 + diff(y_visual).^2);
  total_length = sum(segment_lengths);
  if (total_length <= 0)
    error("draw_curve_arrows: curve length must be positive");
  endif

  if (isempty(opts.positions))
    if (opts.number == 1)
      positions = 1.0;
    else
      positions = linspace(0.25, 1.0, opts.number);
    endif
  else
    positions = opts.positions;
  endif
  positions = min(max(positions, 1e-6), 1.0);

  if (isempty(opts.headlength))
    head_length = 0.026 * opts.scale * reference_size;
  else
    head_length = opts.headlength;
  endif
  if (isempty(opts.headwidth))
    head_width = 0.46 * head_length;
  else
    head_width = opts.headwidth;
  endif

  plot_x = x;
  plot_y = y;
  terminal_positions = positions(abs(positions - 1.0) < 1e-9);
  if (!isempty(terminal_positions))
    trim_distance = max(0, opts.trimratio) * head_length;
    trim_s = max(0, total_length - trim_distance);
    [trim_x, trim_y, trim_idx] = interpolate_curve_point(x, y, segment_lengths, trim_s);
    plot_x = [x(1:trim_idx), trim_x];
    plot_y = [y(1:trim_idx), trim_y];
  endif

  h_curve = plot(plot_x, plot_y, "color", opts.color, "linewidth", opts.linewidth, ...
    "linestyle", opts.linestyle);

  handles = h_curve;
  for pos = positions
    target_s = pos * total_length;
    [tip_x, tip_y, seg_idx] = interpolate_curve_point(x, y, segment_lengths, target_s);
    dx = x(seg_idx + 1) - x(seg_idx);
    dy = y(seg_idx + 1) - y(seg_idx);
    h_head = draw_curve_arrowhead(ax, tip_x, tip_y, dx, dy, dar, ...
      head_length, head_width, opts.color);
    handles = [handles; h_head];
  endfor
endfunction

function [px, py, idx] = interpolate_curve_point(x, y, segment_lengths, target_s)
  cumulative = [0, cumsum(segment_lengths)];
  total_length = cumulative(end);
  target_s = min(max(target_s, 0), total_length);

  idx = find(cumulative <= target_s, 1, "last");
  if (idx >= numel(x))
    idx = numel(x) - 1;
    px = x(end);
    py = y(end);
    return;
  endif

  seg_len = segment_lengths(idx);
  if (seg_len <= 0)
    t = 0;
  else
    t = (target_s - cumulative(idx)) / seg_len;
  endif

  px = x(idx) + t * (x(idx + 1) - x(idx));
  py = y(idx) + t * (y(idx + 1) - y(idx));
endfunction

function h = draw_curve_arrowhead(ax, tip_x, tip_y, dx, dy, dar, head_length, head_width, color)
  direction = [dx / dar(1), dy / dar(2)];
  direction_length = sqrt(sum(direction .^ 2));
  if (direction_length <= 0)
    h = [];
    return;
  endif

  unit_direction = direction / direction_length;
  unit_normal = [-unit_direction(2), unit_direction(1)];

  tip = [tip_x / dar(1), tip_y / dar(2)];
  base = tip - head_length * unit_direction;
  left = base + 0.5 * head_width * unit_normal;
  right = base - 0.5 * head_width * unit_normal;
  tail = tip - 0.56 * head_length * unit_direction;

  x_head = [tip(1), left(1), tail(1), right(1)] * dar(1);
  y_head = [tip(2), left(2), tail(2), right(2)] * dar(2);
  h = patch(ax, x_head, y_head, color, "edgecolor", color, "linewidth", 0.8);
endfunction
