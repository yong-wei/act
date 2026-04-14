pkg load control

out_dir = 'course-content/authoring/lessons/3-4/media/raw/generated-data';
if exist(out_dir, 'dir') ~= 7
  mkdir(out_dir);
end

s = tf('s');
G0 = 0.01715 / (s * (s + 0.1) * (s + 2.14375));

K_A = 0.2;
K_B = 0.6064;
K_C = 20;
ship_speed_nmps = 15 / 3600;

split_point = -0.04940324;
imag_cross = 0.46263519;

open_loop_poles = [0, -0.1, -2.14375];
poles_A = pole(feedback(K_A * G0, 1));
poles_B = pole(feedback(K_B * G0, 1));
poles_C = pole(feedback(K_C * G0, 1));

% Root-locus samples from Octave/control.  Only raw samples are exported here;
% branch matching and audit are handled by the lesson root-locus helper.
[rldata, ~] = rlocus(G0, 0.01, 0, 35);

fid = fopen([out_dir filesep 'root_locus_raw_samples.csv'], 'w');
fprintf(fid, 'sample_idx,gain,re,im\n');
for idx = 1:columns(rldata)
  for root_idx = 1:rows(rldata)
    gain_value = (idx - 1) * 0.01;
    fprintf(fid, '%d,%.12f,%.12f,%.12f\n', idx - 1, gain_value, real(rldata(root_idx, idx)), imag(rldata(root_idx, idx)));
  end
end
fclose(fid);

fid = fopen([out_dir filesep 'root_locus_open_loop_poles.csv'], 'w');
fprintf(fid, 're,im\n');
for idx = 1:numel(open_loop_poles)
  fprintf(fid, '%.12f,0.000000000000\n', open_loop_poles(idx));
end
fclose(fid);

fid = fopen([out_dir filesep 'root_locus_open_loop_zeros.csv'], 'w');
fprintf(fid, 're,im\n');
fclose(fid);

fid = fopen([out_dir filesep 'markers.csv'], 'w');
fprintf(fid, 'group,label,re,im\n');
for idx = 1:numel(open_loop_poles)
  fprintf(fid, 'open_loop,P%d,%.12f,0.000000000000\n', idx, open_loop_poles(idx));
end
for idx = 1:numel(poles_A)
  fprintf(fid, 'A,A%d,%.12f,%.12f\n', idx, real(poles_A(idx)), imag(poles_A(idx)));
end
for idx = 1:numel(poles_B)
  fprintf(fid, 'B,B%d,%.12f,%.12f\n', idx, real(poles_B(idx)), imag(poles_B(idx)));
end
for idx = 1:numel(poles_C)
  fprintf(fid, 'C,C%d,%.12f,%.12f\n', idx, real(poles_C(idx)), imag(poles_C(idx)));
end
fprintf(fid, 'split,split,%.12f,0.000000000000\n', split_point);
fprintf(fid, 'cross,cross_pos,0.000000000000,%.12f\n', imag_cross);
fprintf(fid, 'cross,cross_neg,0.000000000000,%.12f\n', -imag_cross);
fclose(fid);

% Generalized root-locus data for local negative feedback coefficient a.
B_poly = [1, 2.24375, 0.214375, 0.01715 * K_B];
A_poly = [3.43, 0.343, 0, 0];
Ge = tf(A_poly, B_poly);

% The default rlocus range in Octave stops too early for this generalized
% root-locus: the two finite branches have not yet converged to the zeros at
% s = 0 and s = -0.1.  We therefore expand the gain range adaptively and
% evaluate closed-loop poles on a mixed linear/logarithmic grid.
zero_targets = [0; -0.1];
gain_tol = 5e-4;
a_max = 1;
while true
  poles_now = pole(feedback(a_max * Ge, 1));
  dist_to_zero = min(abs(poles_now - zero_targets(1)));
  dist_to_neg01 = min(abs(poles_now - zero_targets(2)));
  if dist_to_zero < gain_tol && dist_to_neg01 < gain_tol
    break;
  end
  a_max = a_max * 2;
  if a_max > 1e6
    error('Adaptive gain search did not converge before hitting the safety bound.');
  end
end

if a_max <= 5
  a_grid = linspace(0, a_max, 1200);
else
  a_grid = unique([linspace(0, 5, 400), logspace(log10(5.05), log10(a_max), 1000)]);
end

for idx = 1:numel(a_grid)
  a = a_grid(idx);
  if a == 0
    poles_now = pole(Ge)(:);
  else
    poles_now = pole(feedback(a * Ge, 1))(:);
  end
  if idx == 1
    generalized_open_loop_poles = poles_now;
  end
  if idx == 1
    generalized_open_loop_zeros = zero(Ge)(:);
  end
  if idx == 1
    fid = fopen([out_dir filesep 'generalized_root_locus_raw_samples.csv'], 'w');
    fprintf(fid, 'sample_idx,gain,re,im\n');
  end
  for root_idx = 1:numel(poles_now)
    fprintf(fid, '%d,%.12f,%.12f,%.12f\n', idx - 1, a_grid(idx), real(poles_now(root_idx)), imag(poles_now(root_idx)));
  end
end
fclose(fid);

fid = fopen([out_dir filesep 'generalized_open_loop_poles.csv'], 'w');
fprintf(fid, 're,im\n');
for idx = 1:numel(generalized_open_loop_poles)
  fprintf(fid, '%.12f,%.12f\n', real(generalized_open_loop_poles(idx)), imag(generalized_open_loop_poles(idx)));
end
fclose(fid);

fid = fopen([out_dir filesep 'generalized_open_loop_zeros.csv'], 'w');
fprintf(fid, 're,im\n');
for idx = 1:numel(generalized_open_loop_zeros)
  fprintf(fid, '%.12f,%.12f\n', real(generalized_open_loop_zeros(idx)), imag(generalized_open_loop_zeros(idx)));
end
fclose(fid);

fid = fopen([out_dir filesep 'generalized_gain_schedule.csv'], 'w');
fprintf(fid, 'idx,a\n');
for idx = 1:numel(a_grid)
  fprintf(fid, '%d,%.12f\n', idx, a_grid(idx));
end
fclose(fid);

a_values = [0, 0.2, 0.5, 1.0];
fid = fopen([out_dir filesep 'generalized_markers.csv'], 'w');
fprintf(fid, 'group,label,re,im\n');
for idx = 1:numel(a_values)
  a = a_values(idx);
  if a == 0
    poles = pole(Ge);
  else
    poles = pole(feedback(a * Ge, 1));
  end
  for pidx = 1:numel(poles)
    fprintf(fid, 'a%.1f,a%.1f_%d,%.12f,%.12f\n', a, a, pidx, real(poles(pidx)), imag(poles(pidx)));
  end
end
fclose(fid);

% Step-response comparison at the reference point B.
t = (0:0.5:200)';
T_B = feedback(K_B * G0, 1);
poles_B = pole(T_B);
dominant_pair = poles_B(abs(imag(poles_B)) > 1e-8);
wn2 = abs(prod(-dominant_pair));
den_approx = [1, -sum(dominant_pair), prod(dominant_pair)];
T_approx = tf(real(wn2), real(den_approx));
[step_exact, t_step] = step(T_B, t);
[step_approx, ~] = step(T_approx, t);

fid = fopen([out_dir filesep 'step_compare.csv'], 'w');
fprintf(fid, 't,exact,approx\n');
for idx = 1:numel(t_step)
  fprintf(fid, '%.12f,%.12f,%.12f\n', t_step(idx), step_exact(idx), step_approx(idx));
end
fclose(fid);

% Ramp-response and track data for B and C.
ramp_deg = 6 * t;
K_labels = {'B', 'C'};
K_values = [K_B, K_C];
for idx = 1:numel(K_values)
  K = K_values(idx);
  T = feedback(K * G0, 1);
  heading_deg = lsim(T, ramp_deg, t);
  x_ref = cumtrapz(t, ship_speed_nmps * cosd(ramp_deg));
  y_ref = cumtrapz(t, ship_speed_nmps * sind(ramp_deg));
  x_out = cumtrapz(t, ship_speed_nmps * cosd(heading_deg));
  y_out = cumtrapz(t, ship_speed_nmps * sind(heading_deg));

  fid = fopen([out_dir filesep 'ramp_track_' K_labels{idx} '.csv'], 'w');
  fprintf(fid, 't,ref_deg,out_deg,x_ref_nm,y_ref_nm,x_out_nm,y_out_nm\n');
  for j = 1:numel(t)
    fprintf(
      fid,
      '%.12f,%.12f,%.12f,%.12f,%.12f,%.12f,%.12f\n',
      t(j),
      ramp_deg(j),
      heading_deg(j),
      x_ref(j),
      y_ref(j),
      x_out(j),
      y_out(j)
    );
  end
  fclose(fid);
end

w = logspace(-3, 1, 800);
Ks = [K_A, K_B, K_C];
labels = {'A', 'B', 'C'};

fid = fopen([out_dir filesep 'bode_data.csv'], 'w');
fprintf(fid, 'version,K,w,mag_db,phase_deg\n');

fid_metrics = fopen([out_dir filesep 'frequency_metrics.csv'], 'w');
fprintf(fid_metrics, 'version,K,phase_margin_deg,gain_margin,crossover_rad_s,bandwidth_rad_s,peak_db,peak_rad_s\n');

for idx = 1:numel(Ks)
  K = Ks(idx);
  T = feedback(K * G0, 1);
  L = K * G0;

  [mag, pha] = bode(T, w);
  mag = squeeze(mag);
  pha = squeeze(pha);
  mag_db = 20 * log10(mag);

  for j = 1:numel(w)
    fprintf(fid, '%s,%.12f,%.12f,%.12f,%.12f\n', labels{idx}, K, w(j), mag_db(j), pha(j));
  end

  [gm, pm, ~, wcp] = margin(L);
  bw_idx = find(mag_db <= -3, 1, 'first');
  if isempty(bw_idx)
    bandwidth = NaN;
  else
    bandwidth = w(bw_idx);
  end
  [peak_db, peak_idx] = max(mag_db);
  peak_w = w(peak_idx);

  fprintf(
    fid_metrics,
    '%s,%.12f,%.12f,%.12f,%.12f,%.12f,%.12f,%.12f\n',
    labels{idx},
    K,
    pm,
    gm,
    wcp,
    bandwidth,
    peak_db,
    peak_w
  );
end

fclose(fid);
fclose(fid_metrics);
