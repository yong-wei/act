function point = data_to_annotation_point(ax, x, y)
%DATA_TO_ANNOTATION_POINT Convert axes data coordinates to figure-normalized coordinates.
%   point = DATA_TO_ANNOTATION_POINT(ax, x, y) returns [x y] in normalized
%   figure units, suitable for annotation("arrow", ...). This keeps arrow
%   endpoints attached to plotted data instead of relying on quiver's
%   data-space arrowheads.

  drawnow();

  ax_pos = get(ax, "position");
  xlim_now = get(ax, "xlim");
  ylim_now = get(ax, "ylim");
  xdir = get(ax, "xdir");
  ydir = get(ax, "ydir");

  x_unit = (x - xlim_now(1)) / (xlim_now(2) - xlim_now(1));
  y_unit = (y - ylim_now(1)) / (ylim_now(2) - ylim_now(1));

  if (strcmp(xdir, "reverse"))
    x_unit = 1 - x_unit;
  endif
  if (strcmp(ydir, "reverse"))
    y_unit = 1 - y_unit;
  endif

  point = [
    ax_pos(1) + x_unit * ax_pos(3), ...
    ax_pos(2) + y_unit * ax_pos(4)
  ];
endfunction
