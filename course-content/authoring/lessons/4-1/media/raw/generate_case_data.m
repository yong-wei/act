pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "4-1-case-data.json");

if exist(out_dir, "dir") ~= 7
  mkdir(out_dir);
endif

function out = complex_vector_to_struct(values)
  values = values(:);
  out = struct();
  out.real = real(values)';
  out.imag = imag(values)';
endfunction

function out = response_to_struct(t, y)
  out = struct();
  out.t = t(:)';
  out.y = y(:)';
endfunction

function out = bode_to_struct(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  out = struct();
  out.w = omega(:)';
  out.mag_db = (20 * log10(abs(resp(:))))';
  out.phase_deg = (unwrap(arg(resp(:)))' * 180 / pi);
endfunction

function p = trim_leading_zeros_local(p)
  idx = find(abs(p) > 1e-12, 1, "first");
  if isempty(idx)
    p = 0;
  else
    p = p(idx:end);
  endif
endfunction

function roots_out = sort_complex_roots_local(roots_in)
  roots_in = roots_in(:);
  real_mask = abs(imag(roots_in)) < 1e-12;
  real_roots = sort(roots_in(real_mask));
  complex_roots = sort(roots_in(! real_mask));
  roots_out = [real_roots; complex_roots];
endfunction

function rlpol = sort_roots_local(rlpol, tolx, toly)
  if rows(rlpol) == 1
    return;
  endif

  dp = diff(rlpol.').';
  drp = max(real(dp));
  dip = max(imag(dp));
  idx = find(drp > tolx | dip > toly);

  if isempty(idx)
    return;
  endif

  [np, ng] = size(rlpol);
  for jj = idx
    vals = rlpol(:, [jj, jj + 1]);
    jdx = (jj + 1):ng;
    for ii = 1:(rows(rlpol) - 1)
      rdx = ii:np;
      dval = abs(rlpol(rdx, jj + 1) - rlpol(ii, jj));
      [~, rel_idx] = min(dval);
      sidx = rel_idx + ii - 1;
      if sidx != ii
        c1 = norm(diff(vals.'));
        tmp = vals(ii, 2);
        vals(ii, 2) = vals(sidx, 2);
        vals(sidx, 2) = tmp;
        c2 = norm(diff(vals.'));
        if c1 > c2
          tmp = rlpol(ii, jdx);
          rlpol(ii, jdx) = rlpol(sidx, jdx);
          rlpol(sidx, jdx) = tmp;
          vals = rlpol(:, [jj, jj + 1]);
        endif
      endif
    endfor
  endfor
endfunction

function [roots_matrix, gains_out] = build_root_locus_matrix(sys, k_values)
  if isempty(k_values)
    [~, ~, rlpol, gvec] = rlocus(sys);
    roots_matrix = rlpol;
    gains_out = gvec(:)';
    return;
  endif

  k_values = k_values(:)';
  if length(k_values) < 2
    error("build_root_locus_matrix requires at least two k samples");
  endif

  increment = mean(diff(k_values));
  min_k = k_values(1);
  max_k = k_values(end);

  [num_raw, den_raw] = tfdata(sys, "vector");
  num = trim_leading_zeros_local(num_raw(:)');
  den = trim_leading_zeros_local(den_raw(:)');

  if length(den) < 2
    error("root_locus_to_struct requires a system with at least one pole");
  endif

  if length(num) < length(den)
    num = [zeros(1, length(den) - length(num)), num];
  elseif length(num) > length(den)
    error("root_locus_to_struct currently expects a proper transfer function");
  endif

  dnum = polyder(num);
  dden = polyder(den);
  brkp = conv(den, dnum) - conv(num, dden);
  real_ax_pts = roots(brkp);
  real_ax_pts = real(real_ax_pts(abs(imag(real_ax_pts)) < 1e-9));
  real_ax_pts(abs(polyval(num, real_ax_pts)) < 1e-9) = [];
  k_break = -polyval(den, real_ax_pts) ./ polyval(num, real_ax_pts);
  k_break = k_break(k_break >= min_k & k_break <= max_k);

  ngain = max(30, fix((max_k - min_k) / increment) + 1);
  gvec = linspace(min_k, max_k, ngain);
  if ! isempty(k_break)
    gvec = sort(unique([gvec, reshape(k_break, 1, [])]));
  endif

  nroots = length(den) - 1;
  rlpol = zeros(nroots, length(gvec));
  for ii = 1:length(gvec)
    rlpol(:, ii) = sort_complex_roots_local(roots(den + gvec(ii) * num));
  endfor

  smtolx = min(0.01 * (max(max(real(rlpol))) - min(min(real(rlpol)))), 1.5);
  smtoly = min(0.01 * (max(max(imag(rlpol))) - min(min(imag(rlpol)))), 1.5);
  smtol = max([smtolx, smtoly, 1e-6]);

  rlpol = sort_roots_local(rlpol, smtolx, smtoly);

  done = false;
  while ! done && length(gvec) < 1000
    done = true;
    dp = abs(diff(rlpol.')).';
    if columns(dp) == 0
      break;
    endif

    if nroots == 1
      idx = find(dp > smtol);
    else
      maxdp = max(dp);
      idx = find(maxdp > smtol);
    endif

    newg = [];
    for ii = 1:length(idx)
      i1 = idx(ii);
      i2 = i1 + 1;
      if max(abs(rlpol(:, i2) - rlpol(:, i1))) > smtol
        candidates = linspace(gvec(i1), gvec(i2), 5);
        newg = [newg, candidates(2:4)];
        done = false;
      endif
    endfor

    if ! done
      newg = unique(newg);
      fresh = [];
      for ii = 1:length(newg)
        if ! any(abs(gvec - newg(ii)) < 1e-12)
          fresh(end + 1) = newg(ii);
        endif
      endfor

      if isempty(fresh)
        break;
      endif

      extra = zeros(nroots, length(fresh));
      for ii = 1:length(fresh)
        extra(:, ii) = sort_complex_roots_local(roots(den + fresh(ii) * num));
      endfor

      gvec = [gvec, fresh];
      rlpol = [rlpol, extra];
      [gvec, order] = sort(gvec);
      rlpol = rlpol(:, order);
      rlpol = sort_roots_local(rlpol, smtolx, smtoly);
    endif
  endwhile

  keep = find(gvec >= min_k - 1e-12 & gvec <= max_k + 1e-12);
  roots_matrix = rlpol(:, keep);
  gains_out = gvec(keep);
endfunction

function out = root_locus_to_struct(sys, k_values)
  [roots_matrix, gains_out] = build_root_locus_matrix(sys, k_values);

  out = struct();
  out.k = gains_out(:)';
  out.real = real(roots_matrix);
  out.imag = imag(roots_matrix);
endfunction

function out = margins_to_struct(sys)
  [gm, pm, wg, wc] = margin(sys);
  out = struct();
  out.gm = gm;
  out.gm_db = 20 * log10(gm);
  out.pm = pm;
  out.wg = wg;
  out.wc = wc;
endfunction

function metrics = step_metrics(sys, t, tol)
  [y, t_out] = step(sys, t);
  y = y(:);
  t_out = t_out(:);
  final_value = y(end);
  overshoot = max(0, (max(y) - final_value) / max(abs(final_value), 1e-12) * 100);
  [~, peak_idx] = max(y);

  idx10 = find(y >= 0.1 * final_value, 1, "first");
  idx90 = find(y >= 0.9 * final_value, 1, "first");
  if isempty(idx10) || isempty(idx90)
    rise_time = NaN;
  else
    rise_time = t_out(idx90) - t_out(idx10);
  endif

  out_of_band = find(abs(y - final_value) > tol * max(abs(final_value), 1e-12));
  if isempty(out_of_band)
    settling_time = t_out(1);
  else
    last_out = out_of_band(end);
    if last_out < length(t_out)
      settling_time = t_out(last_out + 1);
    else
      settling_time = t_out(end);
    endif
  endif

  metrics = struct();
  metrics.overshoot = overshoot;
  metrics.peak_time = t_out(peak_idx);
  metrics.settling_time = settling_time;
  metrics.rise_time = rise_time;
  metrics.final_value = final_value;
endfunction

function zeta = overshoot_to_zeta(mp_ratio)
  zeta = -log(mp_ratio) / sqrt(pi^2 + (log(mp_ratio))^2);
endfunction

function out = feasible_region_to_struct(mp_ratio, settling_time)
  out = struct();
  out.zeta_min = overshoot_to_zeta(mp_ratio);
  out.sigma_min = 4 / settling_time;
  out.mp_ratio = mp_ratio;
  out.settling_time = settling_time;
endfunction

function out = case_payload(id, title, task_tag, plant, k_ref, omega, t_step, k_values, feasible_region, root_xlim, root_ylim, root_note_anchor, root_legend_loc)
  loop = k_ref * plant;
  closed = feedback(loop, 1);
  [step_y, step_t] = step(closed, t_step);

  entry = struct();
  entry.id = id;
  entry.title = title;
  entry.task_tag = task_tag;
  entry.k_ref = k_ref;
  entry.plant_tex = evalc("disp(tf(plant))");
  entry.loop_tex = evalc("disp(tf(loop))");
  entry.open_loop_poles = complex_vector_to_struct(pole(plant));
  entry.open_loop_zeros = complex_vector_to_struct(zero(plant));
  entry.closed_loop_poles = complex_vector_to_struct(pole(closed));
  entry.root_locus = root_locus_to_struct(plant, k_values);
  entry.root_locus_full = root_locus_to_struct(plant, []);
  entry.bode = bode_to_struct(loop, omega);
  entry.margins = margins_to_struct(loop);
  entry.step = response_to_struct(step_t, step_y);
  entry.step_metrics = step_metrics(closed, t_step, 0.02);
  entry.feasible_region = feasible_region;
  entry.root_xlim = root_xlim;
  entry.root_ylim = root_ylim;
  entry.root_note_anchor = root_note_anchor;
  entry.root_legend_loc = root_legend_loc;
  out = entry;
endfunction

s = tf("s");

P_ship = 0.01715 / (s * (s + 0.1) * (s + 2.14375));
omega_ship = logspace(-3, 1, 1200);
t_ship = linspace(0, 160, 2200);
k_ship = linspace(0, 12, 320);
feasible_ship = feasible_region_to_struct(0.15, 45);

P_platform = 2960 * ((s / 15) + 1) / (s * ((s / 3) + 1) * (((1.7 * s + 1) * (0.005 * s + 1) * (0.001 * s + 1)) + 100));
omega_platform = logspace(-1, 4, 1600);
t_platform = linspace(0, 2.0, 2200);
k_platform = linspace(0, 24, 360);
feasible_platform = feasible_region_to_struct(0.10, 0.2);

payload = struct();
payload.lesson_id = "4-1";
payload.cases = struct();

payload.cases.ship_heading = case_payload(
  "ship_heading",
  "案例A：客船航向控制",
  "舒适与储备优先",
  P_ship,
  2.25,
  omega_ship,
  t_ship,
  k_ship,
  feasible_ship,
  [-3.2, 0.4],
  [-0.8, 0.8],
  "upper_right",
  "upper left"
);

payload.cases.platform_pitch = case_payload(
  "platform_pitch",
  "案例B：船载稳定平台",
  "速度与带宽优先",
  P_platform,
  5.0,
  omega_platform,
  t_platform,
  k_platform,
  feasible_platform,
  [-140, 5],
  [-80, 80],
  "upper_right",
  "upper left"
);

fid = fopen(out_file, "w");
if fid < 0
  error("Cannot open output file: %s", out_file);
endif
fputs(fid, jsonencode(payload));
fclose(fid);
