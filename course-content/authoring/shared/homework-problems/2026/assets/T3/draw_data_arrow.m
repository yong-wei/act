function h = draw_data_arrow(ax, start_point, end_point, varargin)
%DRAW_DATA_ARROW Draw a straight data-space arrow.
%   h = DRAW_DATA_ARROW(gca, [x1 y1], [x2 y2], ...) draws a straight segment
%   and a filled arrowhead in axes data coordinates. For arrows that represent
%   a curve trend, prefer draw_curve_arrows() so the arrowhead direction comes
%   from the curve data.

  opts.color = [0 0 0];
  opts.linewidth = 1.2;
  opts.linestyle = "-";
  opts.headlength = [];
  opts.headwidth = [];
  opts.drawshaft = true;

  if (mod(length(varargin), 2) != 0)
    error("draw_data_arrow: property arguments must be name/value pairs");
  endif

  for i = 1:2:length(varargin)
    key = lower(varargin{i});
    val = varargin{i + 1};
    switch key
      case {"color", "colour"}
        opts.color = val;
      case {"linewidth", "line_width"}
        opts.linewidth = val;
      case {"linestyle", "line_style"}
        opts.linestyle = val;
      case "headlength"
        opts.headlength = val;
      case "headwidth"
        opts.headwidth = val;
      case "drawshaft"
        opts.drawshaft = val;
      otherwise
        error("draw_data_arrow: unsupported option '%s'", varargin{i});
    endswitch
  endfor

  axes(ax);
  hold on;

  start_point = start_point(:)';
  end_point = end_point(:)';
  if (numel(start_point) < 2 || numel(end_point) < 2)
    error("draw_data_arrow: start_point and end_point must contain x and y");
  endif

  dar = get(ax, "DataAspectRatio");
  if (numel(dar) < 2 || any(dar(1:2) == 0))
    dar = [1 1 1];
  endif
  xlim_now = get(ax, "xlim");
  ylim_now = get(ax, "ylim");
  reference_size = max([diff(xlim_now), diff(ylim_now)]);

  if (isempty(opts.headlength))
    head_length = 0.026 * reference_size;
  else
    head_length = opts.headlength;
  endif
  if (isempty(opts.headwidth))
    head_width = 0.46 * head_length;
  else
    head_width = opts.headwidth;
  endif

  if (opts.drawshaft)
    h_line = plot(ax, [start_point(1), end_point(1)], [start_point(2), end_point(2)], ...
      "color", opts.color, "linewidth", opts.linewidth, "linestyle", opts.linestyle);
  else
    h_line = [];
  endif

  dx = end_point(1) - start_point(1);
  dy = end_point(2) - start_point(2);
  h_head = draw_straight_arrowhead(ax, end_point(1), end_point(2), dx, dy, dar, ...
    head_length, head_width, opts.color);
  h = [h_line; h_head];
endfunction

function h = draw_straight_arrowhead(ax, tip_x, tip_y, dx, dy, dar, head_length, head_width, color)
  direction = [dx / dar(1), dy / dar(2)];
  direction_length = sqrt(sum(direction .^ 2));
  if (direction_length <= 0)
    error("draw_data_arrow: arrow length must be positive");
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
