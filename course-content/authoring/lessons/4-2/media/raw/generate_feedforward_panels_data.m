pkg load control;

root_dir = fileparts(mfilename("fullpath"));
data_dir = fullfile(root_dir, "generated-data");
json_path = fullfile(data_dir, "4-2-feedforward-panels-data.json");
samples_csv = fullfile(data_dir, "4-2-root-locus-raw-samples.csv");
poles_csv = fullfile(data_dir, "4-2-open-loop-poles.csv");
zeros_csv = fullfile(data_dir, "4-2-open-loop-zeros.csv");

if exist(data_dir, "dir") ~= 7
  mkdir(data_dir);
endif

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
  out.phase_deg = (unwrap(angle(resp(:)))' * 180 / pi);
endfunction

function trimmed = trim_leading_zeros_local(coeffs)
  idx = find(abs(coeffs) > 1e-12, 1, "first");
  if isempty(idx)
    trimmed = 0;
  else
    trimmed = coeffs(idx:end);
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
  k_values = k_values(:)';
  increment = mean(diff(k_values));
  min_k = k_values(1);
  max_k = k_values(end);

  [num_raw, den_raw] = tfdata(sys, "vector");
  num = trim_leading_zeros_local(num_raw(:)');
  den = trim_leading_zeros_local(den_raw(:)');

  if length(num) < length(den)
    num = [zeros(1, length(den) - length(num)), num];
  endif

  dnum = polyder(num);
  dden = polyder(den);
  brkp = conv(den, dnum) - conv(num, dden);
  real_ax_pts = roots(brkp);
  real_ax_pts = real(real_ax_pts(abs(imag(real_ax_pts)) < 1e-9));
  real_ax_pts(abs(polyval(num, real_ax_pts)) < 1e-9) = [];
  k_break = -polyval(den, real_ax_pts) ./ polyval(num, real_ax_pts);
  k_break = k_break(k_break >= min_k & k_break <= max_k);

  ngain = max(60, fix((max_k - min_k) / increment) + 1);
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
      idx = find(max(dp) > smtol);
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

function write_complex_points_csv(path, points)
  fid = fopen(path, "w");
  fprintf(fid, "re,im\n");
  for ii = 1:length(points)
    fprintf(fid, "%.12f,%.12f\n", real(points(ii)), imag(points(ii)));
  endfor
  fclose(fid);
endfunction

function write_root_samples_csv(path, gains, roots_matrix)
  fid = fopen(path, "w");
  fprintf(fid, "sample_idx,gain,re,im\n");
  for sample_idx = 1:length(gains)
    for row = 1:rows(roots_matrix)
      fprintf(
        fid,
        "%d,%.12f,%.12f,%.12f\n",
        sample_idx,
        gains(sample_idx),
        real(roots_matrix(row, sample_idx)),
        imag(roots_matrix(row, sample_idx))
      );
    endfor
  endfor
  fclose(fid);
endfunction

s = tf("s");
P = 1 / (s * (s + 1));
K = 4;

T_input_no_ff = tf([4], [1, 1, 4]);
T_input_ff = tf([1, 4], [1, 1, 4]);
T_dist_no_ff = tf([1], [1, 1, 4]);
T_dist_ff = tf([0.2], [1, 1, 4]);

t_track = linspace(0, 20, 801);
ramp = t_track;
y_input_no_ff = lsim(T_input_no_ff, ramp, t_track);
y_input_ff = lsim(T_input_ff, ramp, t_track);

t_dist = linspace(0, 20, 801);
disturbance = ones(size(t_dist));
y_dist_no_ff = lsim(T_dist_no_ff, disturbance, t_dist);
y_dist_ff = lsim(T_dist_ff, disturbance, t_dist);

omega = logspace(-2, 2, 600);

[roots_matrix, gains] = build_root_locus_matrix(P, linspace(0, 40, 260));
closed_loop_poles = pole(feedback(K * P, 1));

payload = struct();
payload.root_locus = struct();
payload.root_locus.selected_gain = K;
payload.root_locus.closed_loop_poles = struct("real", real(closed_loop_poles)', "imag", imag(closed_loop_poles)');
payload.root_locus.open_loop_poles = struct("real", real(pole(P))', "imag", imag(pole(P))');
payload.root_locus.open_loop_zeros = struct("real", real(zero(P))', "imag", imag(zero(P))');

payload.input_case = struct();
payload.input_case.title = "按输入补偿前馈：固定反馈策略下有无前馈的四联比较";
payload.input_case.reference = response_to_struct(t_track, ramp);
payload.input_case.no_ff = struct();
payload.input_case.no_ff.label = "无前馈";
payload.input_case.no_ff.time = response_to_struct(t_track, y_input_no_ff);
payload.input_case.no_ff.bode = bode_to_struct(T_input_no_ff, omega);
payload.input_case.ff = struct();
payload.input_case.ff.label = "有输入前馈";
payload.input_case.ff.time = response_to_struct(t_track, y_input_ff);
payload.input_case.ff.bode = bode_to_struct(T_input_ff, omega);

payload.dist_case = struct();
payload.dist_case.title = "按扰动补偿前馈：固定反馈策略下有无前馈的四联比较";
payload.dist_case.disturbance = response_to_struct(t_dist, disturbance);
payload.dist_case.no_ff = struct();
payload.dist_case.no_ff.label = "无前馈";
payload.dist_case.no_ff.time = response_to_struct(t_dist, y_dist_no_ff);
payload.dist_case.no_ff.bode = bode_to_struct(T_dist_no_ff, omega);
payload.dist_case.ff = struct();
payload.dist_case.ff.label = "有扰动前馈";
payload.dist_case.ff.time = response_to_struct(t_dist, y_dist_ff);
payload.dist_case.ff.bode = bode_to_struct(T_dist_ff, omega);

fid = fopen(json_path, "w");
fwrite(fid, jsonencode(payload), "char");
fclose(fid);

write_root_samples_csv(samples_csv, gains, roots_matrix);
write_complex_points_csv(poles_csv, pole(P));
write_complex_points_csv(zeros_csv, zero(P));
