pkg load control;

root = fileparts(fileparts(fileparts(fileparts(fileparts(fileparts(fileparts(mfilename("fullpath"))))))));
data_dir = fullfile(root, "course-content", "authoring", "lessons", "4-2", "media", "raw", "generated-data");
if exist(data_dir, "dir") != 7
  mkdir(data_dir);
endif

function write_matrix(path, header, data)
  fid = fopen(path, "w");
  fprintf(fid, "%s\n", header);
  fclose(fid);
  dlmwrite(path, data, "-append", "delimiter", ",", "precision", "%.10g");
endfunction

function value = final_value(y)
  tail_start = max(1, rows(y) - 20);
  value = mean(y(tail_start:end));
endfunction

function os = overshoot_percent(y, target)
  if abs(target) < 1e-9
    os = 0;
  else
    os = max(0, (max(y) - target) / abs(target) * 100);
  endif
endfunction

function ts = settling_time(t, y, target, band)
  tol = band * max(1, abs(target));
  ts = NaN;
  for k = 1:rows(t)
    if all(abs(y(k:end) - target) <= tol)
      ts = t(k);
      return;
    endif
  endfor
endfunction

function peak = max_abs_signal(y)
  peak = max(abs(y));
endfunction

function [wc, pm] = margin_pair(L)
  [gm, pm_raw, wg, wc_raw] = margin(L);
  wc = wc_raw;
  pm = pm_raw;
  if isempty(wc) || !isfinite(wc)
    wc = NaN;
  endif
  if isempty(pm) || !isfinite(pm)
    pm = NaN;
  endif
endfunction

function bode_rows = bode_table(sys, w)
  [mag, phase] = bode(sys, w);
  mag = squeeze(mag);
  phase = squeeze(phase);
  bode_rows = [w(:), 20 * log10(mag(:)), phase(:)];
endfunction

function vec = row_vector(value)
  vec = value(:).';
endfunction

function out = pad_left(vec, n)
  vec = row_vector(vec);
  out = [zeros(1, n - length(vec)), vec];
endfunction

function [num, den] = tf_vectors(sys)
  [num, den] = tfdata(minreal(sys), "v");
  num = row_vector(num);
  den = row_vector(den);
endfunction

function write_points(path, points)
  fid = fopen(path, "w");
  fprintf(fid, "re,im\n");
  for k = 1:length(points)
    fprintf(fid, "%.12g,%.12g\n", real(points(k)), imag(points(k)));
  endfor
  fclose(fid);
endfunction

function write_root_locus(prefix, sys)
  [num, den] = tf_vectors(sys);
  rl_data = rlocus(sys);
  fid = fopen([prefix, "-rl-samples.csv"], "w");
  fprintf(fid, "sample_idx,gain,re,im\n");
  for k = 1:columns(rl_data)
    for r = 1:rows(rl_data)
      root_now = rl_data(r, k);
      fprintf(fid, "%d,%.12g,%.12g,%.12g\n", k, k - 1, real(root_now), imag(root_now));
    endfor
  endfor
  fclose(fid);
  write_points([prefix, "-rl-poles.csv"], roots(den));
  write_points([prefix, "-rl-zeros.csv"], roots(num));
endfunction

function [t, y] = step_table(sys, t)
  [y_raw, t_raw] = step(sys, t);
  t = t_raw(:);
  y = squeeze(y_raw)(:);
endfunction

function write_example_pair(data_dir, lesson_id, G, C_before, C_after, time_before, time_after, bode_before, bode_after, t, w)
  [tb, yb] = step_table(time_before, t);
  [ta, ya] = step_table(time_after, t);
  write_matrix(fullfile(data_dir, [lesson_id, "-time.csv"]), "t,before,after", [tb(:), yb(:), ya(:)]);
  b_before = bode_table(bode_before, w);
  b_after = bode_table(bode_after, w);
  write_matrix(fullfile(data_dir, [lesson_id, "-bode.csv"]), "w,mag_before,phase_before,mag_after,phase_after", ...
    [w(:), b_before(:, 2), b_before(:, 3), b_after(:, 2), b_after(:, 3)]);
  write_root_locus(fullfile(data_dir, [lesson_id, "-before"]), C_before * G);
  write_root_locus(fullfile(data_dir, [lesson_id, "-after"]), C_after * G);
endfunction

function write_example_time_bode(data_dir, lesson_id, time_before, time_after, bode_before, bode_after, t, w)
  [tb, yb] = step_table(time_before, t);
  [ta, ya] = step_table(time_after, t);
  write_matrix(fullfile(data_dir, [lesson_id, "-time.csv"]), "t,before,after", [tb(:), yb(:), ya(:)]);
  b_before = bode_table(bode_before, w);
  b_after = bode_table(bode_after, w);
  write_matrix(fullfile(data_dir, [lesson_id, "-bode.csv"]), "w,mag_before,phase_before,mag_after,phase_after", ...
    [w(:), b_before(:, 2), b_before(:, 3), b_after(:, 2), b_after(:, 3)]);
endfunction

s = tf("s");
w = logspace(-3, 2, 520);

controllers = {
  "PI", (1 + 1 / (8 * s));
  "PD", (1 + (0.8 * s) / (1 + 0.08 * s));
  "PID", (1 + 1 / (8 * s) + (0.8 * s) / (1 + 0.08 * s));
  "lead", ((4 * s + 1) / (0.8 * s + 1));
  "lag", (3 * (20 * s + 1) / (60 * s + 1));
  "lead_lag", ((4 * s + 1) / (0.8 * s + 1)) * (2 * (25 * s + 1) / (50 * s + 1))
};

freq_data = [w(:)];
phase_data = [w(:)];
for k = 1:rows(controllers)
  C = controllers{k, 2};
  [mag, phase] = bode(C, w);
  freq_data = [freq_data, 20 * log10(squeeze(mag)(:))];
  phase_data = [phase_data, squeeze(phase)(:)];
endfor
write_matrix(fullfile(data_dir, "4-2-controller-frequency-magnitude.csv"), "w,PI,PD,PID,lead,lag,lead_lag", freq_data);
write_matrix(fullfile(data_dir, "4-2-controller-frequency-phase.csv"), "w,PI,PD,PID,lead,lag,lead_lag", phase_data);

% 5.x worked-example comparison data.
w_ex = logspace(-3, 2, 420);

G1 = 1 / (s + 1);
C1_before = tf(1, 1);
wc_pi_example = 1.0;
wz_pi_example = wc_pi_example / 4;
Ti_pi_example = 1 / wz_pi_example;
Kp_pi_example = 1 / ((1 / sqrt(1 + wc_pi_example^2)) * sqrt(1 + (1 / (wc_pi_example * Ti_pi_example))^2));
C1_after = Kp_pi_example * (1 + 1 / (Ti_pi_example * s));
write_example_pair(data_dir, "4-2-example-5-1", G1, C1_before, C1_after, feedback(C1_before * G1, 1), feedback(C1_after * G1, 1), C1_before * G1, C1_after * G1, linspace(0, 45, 600), w_ex);

T2_obj = tan(65 * pi / 180) / 2;
K2_obj = 0.25 * 2 * sqrt(1 + (2 * T2_obj)^2);
G2 = K2_obj / (s * (T2_obj * s + 1));
C2_before = tf(1, 1);
C2_after = 1.95 * (1.025 * s + 1) / (0.244 * s + 1);
write_example_pair(data_dir, "4-2-example-5-2", G2, C2_before, C2_after, feedback(C2_before * G2, 1), feedback(C2_after * G2, 1), C2_before * G2, C2_after * G2, linspace(0, 24, 520), w_ex);

G3 = 9 / (s + 1);
C3_before = tf(1, 1);
C3_after = 2.5 * (10 * s + 1) / (25 * s + 1);
write_example_pair(data_dir, "4-2-example-5-3", G3, C3_before, C3_after, feedback(C3_before * G3, 1), feedback(C3_after * G3, 1), C3_before * G3, C3_after * G3, linspace(0, 55, 560), w_ex);

a4 = (8 / ((pi / 2)^2) + sqrt((8 / ((pi / 2)^2))^2 - 4 * (pi / 2)^2)) / 2;
b4 = (8 / ((pi / 2)^2) - sqrt((8 / ((pi / 2)^2))^2 - 4 * (pi / 2)^2)) / 2;
G4 = 1 / (s * (s + a4) * (s + b4));
C4_before = 4 * tf(1, 1);
C4_after = 4.8 * (1 + 1 / (2 * s) + 0.5 * s);
write_example_pair(data_dir, "4-2-example-5-4", G4, C4_before, C4_after, feedback(C4_before * G4, 1), feedback(C4_after * G4, 1), C4_before * G4, C4_after * G4, linspace(0, 28, 600), w_ex);

t_zn = linspace(0, 24, 720);
[tz, y_k2] = step_table(feedback(2 * G4, 1), t_zn);
[tz, y_k5] = step_table(feedback(5 * G4, 1), t_zn);
[tz, y_k8] = step_table(feedback(8 * G4, 1), t_zn);
[tz, y_pid] = step_table(feedback(C4_after * G4, 1), t_zn);
write_matrix(fullfile(data_dir, "4-2-example-5-4-zn-steps.csv"), "t,k2,k5,k8,pid", [tz(:), y_k2(:), y_k5(:), y_k8(:), y_pid(:)]);

G5 = 1 / (s + 1);
Gd5 = 0.4 / (s + 1);
C5_feedback = tf(1, 1);
F5_before = 0;
F5_after = -0.32;
T5_before = (G5 * F5_before + Gd5) / (1 + C5_feedback * G5);
T5_after = (G5 * F5_after + Gd5) / (1 + C5_feedback * G5);
write_example_time_bode(data_dir, "4-2-example-5-5", T5_before, T5_after, T5_before, T5_after, linspace(0, 32, 420), w_ex);

G_ship = 0.01715 / (s * (s + 0.1) * (s + 2.14375));
C_base = 2.25;

beta_lag = 2.5;
wz_lag = 0.012;
T_lag = 1 / wz_lag;
C_lag = C_base * beta_lag * (T_lag * s + 1) / (beta_lag * T_lag * s + 1);

wc_pi = 0.075;
wz_pi = wc_pi / 8;
Ti_pi = 1 / wz_pi;
[mag_g_pi, phase_g_pi] = bode(G_ship, wc_pi);
mag_pi_shape = sqrt(1 + (1 / (wc_pi * Ti_pi))^2);
Kp_pi = 1 / (squeeze(mag_g_pi) * mag_pi_shape);
C_pi = Kp_pi * (1 + 1 / (Ti_pi * s));

wc_lead = 0.13;
pm_target = 55;
[mag_g_lead, phase_g_lead] = bode(G_ship, wc_lead);
phi_need = -180 + pm_target - squeeze(phase_g_lead);
phi_max = min(max(phi_need + 8, 8), 55);
alpha = (1 - sin(phi_max * pi / 180)) / (1 + sin(phi_max * pi / 180));
T_lead = 1 / (wc_lead * sqrt(alpha));
Kc_lead = sqrt(alpha) / squeeze(mag_g_lead);
C_lead = Kc_lead * (T_lead * s + 1) / (alpha * T_lead * s + 1);

wc_ll = 0.11;
[mag_g_ll, phase_g_ll] = bode(G_ship, wc_ll);
phi_need_ll = -180 + 55 - squeeze(phase_g_ll);
phi_max_ll = min(max(phi_need_ll + 8, 8), 50);
alpha_ll = (1 - sin(phi_max_ll * pi / 180)) / (1 + sin(phi_max_ll * pi / 180));
T_lead_ll = 1 / (wc_ll * sqrt(alpha_ll));
Kc_lead_ll = sqrt(alpha_ll) / squeeze(mag_g_ll);
beta_ll = 1.8;
wz_lag_ll = wc_ll / 12;
T_lag_ll = 1 / wz_lag_ll;
C_lead_lag = Kc_lead_ll * (T_lead_ll * s + 1) / (alpha_ll * T_lead_ll * s + 1) * ...
  beta_ll * (T_lag_ll * s + 1) / (beta_ll * T_lag_ll * s + 1);

ship_cases = {
  "base", C_base;
  "lag", C_lag;
  "pi", C_pi;
  "lead", C_lead;
  "lead_lag", C_lead_lag
};

t = linspace(0, 180, 900);
t_dist = linspace(0, 260, 1000);
w_ship = logspace(-3, 1, 520);
step_out = [t(:)];
dist_out = [t_dist(:)];
loop_mag = [w_ship(:)];
loop_phase = [w_ship(:)];
sense_mag = [w_ship(:)];
metrics = [];

for k = 1:rows(ship_cases)
  name = ship_cases{k, 1};
  C = ship_cases{k, 2};
  L = C * G_ship;
  Tref = feedback(L, 1);
  Tdist = feedback(G_ship, C);
  S = feedback(1, L);
  Uref = feedback(C, G_ship);

  [ts, ys] = step_table(Tref, t);
  [td, yd] = step_table(Tdist, t_dist);
  step_out = [step_out, ys];
  dist_out = [dist_out, yd];
  b_loop = bode_table(L, w_ship);
  b_sense = bode_table(S, w_ship);
  loop_mag = [loop_mag, b_loop(:, 2)];
  loop_phase = [loop_phase, b_loop(:, 3)];
  sense_mag = [sense_mag, b_sense(:, 2)];

  [wc_case, pm_case] = margin_pair(L);
  target = final_value(ys);
  os = overshoot_percent(ys, target);
  settle = settling_time(ts, ys, target, 0.02);
  final_error = abs(1 - target);
  dist_peak = max_abs_signal(yd);
  low_s = abs(freqresp(S, 0.01));
  [tu, yu] = step_table(Uref, t);
  u_peak = max_abs_signal(yu);
  metrics = [metrics; k, wc_case, pm_case, os, settle, final_error, dist_peak, low_s, u_peak];
endfor

write_matrix(fullfile(data_dir, "4-2-ship-controller-step.csv"), "t,base,lag,pi,lead,lead_lag", step_out);
write_matrix(fullfile(data_dir, "4-2-ship-controller-disturbance.csv"), "t,base,lag,pi,lead,lead_lag", dist_out);
write_matrix(fullfile(data_dir, "4-2-ship-controller-loop-mag.csv"), "w,base,lag,pi,lead,lead_lag", loop_mag);
write_matrix(fullfile(data_dir, "4-2-ship-controller-loop-phase.csv"), "w,base,lag,pi,lead,lead_lag", loop_phase);
write_matrix(fullfile(data_dir, "4-2-ship-controller-sensitivity-mag.csv"), "w,base,lag,pi,lead,lead_lag", sense_mag);
write_matrix(fullfile(data_dir, "4-2-ship-controller-metrics.csv"), "case_id,wc,pm,overshoot,settling_time,final_error,disturbance_peak,low_sensitivity,u_peak", metrics);

fid = fopen(fullfile(data_dir, "4-2-ship-controller-parameters.csv"), "w");
fprintf(fid, "name,param,value\n");
fprintf(fid, "lag,beta,%.8g\n", beta_lag);
fprintf(fid, "lag,wz,%.8g\n", wz_lag);
fprintf(fid, "lag,wp,%.8g\n", wz_lag / beta_lag);
fprintf(fid, "pi,Kp,%.8g\n", Kp_pi);
fprintf(fid, "pi,Ti,%.8g\n", Ti_pi);
fprintf(fid, "lead,Kc,%.8g\n", Kc_lead);
fprintf(fid, "lead,alpha,%.8g\n", alpha);
fprintf(fid, "lead,T,%.8g\n", T_lead);
fprintf(fid, "lead_lag,Kc,%.8g\n", Kc_lead_ll);
fprintf(fid, "lead_lag,alpha,%.8g\n", alpha_ll);
fprintf(fid, "lead_lag,Tlead,%.8g\n", T_lead_ll);
fprintf(fid, "lead_lag,beta,%.8g\n", beta_ll);
fprintf(fid, "lead_lag,wz_lag,%.8g\n", wz_lag_ll);
fprintf(fid, "lead_lag,wp_lag,%.8g\n", wz_lag_ll / beta_ll);
fclose(fid);
