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

function out = root_locus_to_struct(sys, k_values)
  [num, den] = tfdata(sys, "vector");
  num = num(:)';
  den = den(:)';
  if length(num) < length(den)
    num = [zeros(1, length(den) - length(num)), num];
  elseif length(den) < length(num)
    den = [zeros(1, length(num) - length(den)), den];
  endif

  root_count = length(den) - 1;
  roots_matrix = zeros(root_count, length(k_values));
  for idx = 1:length(k_values)
    coeffs = den + k_values(idx) * num;
    roots_matrix(:, idx) = roots(coeffs);
  endfor

  out = struct();
  out.k = k_values(:)';
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

function out = case_payload(id, title, task_tag, plant, k_ref, omega, t_step, k_values, feasible_region, root_xlim, root_ylim)
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
  entry.bode = bode_to_struct(loop, omega);
  entry.margins = margins_to_struct(loop);
  entry.step = response_to_struct(step_t, step_y);
  entry.step_metrics = step_metrics(closed, t_step, 0.02);
  entry.feasible_region = feasible_region;
  entry.root_xlim = root_xlim;
  entry.root_ylim = root_ylim;
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
  [-0.8, 0.8]
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
  [-60, 5],
  [-45, 45]
);

fid = fopen(out_file, "w");
if fid < 0
  error("Cannot open output file: %s", out_file);
endif
fputs(fid, jsonencode(payload));
fclose(fid);
