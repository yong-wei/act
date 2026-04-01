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

split_point = -0.04940324;
imag_cross = 0.46263519;

open_loop_poles = [0, -0.1, -2.14375];
poles_A = pole(feedback(K_A * G0, 1));
poles_B = pole(feedback(K_B * G0, 1));
poles_C = pole(feedback(K_C * G0, 1));

% Root-locus samples from Octave/control.  Only data are exported here;
% the PNG rendering is done by Python so this script works in headless environments.
[rldata, ~] = rlocus(G0, 0.01, 0, 35);

fid = fopen([out_dir filesep 'root_locus_points.csv'], 'w');
fprintf(fid, 'branch,re,im\n');
for branch = 1:rows(rldata)
  for idx = 1:columns(rldata)
    fprintf(fid, '%d,%.12f,%.12f\n', branch, real(rldata(branch, idx)), imag(rldata(branch, idx)));
  end
end
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
