pkg load control;

root_dir = fileparts(mfilename("fullpath"));
output_path = fullfile(root_dir, "3-3-plot-data.json");

function data = complex_matrix_to_struct(matrix)
  data = struct();
  data.real = real(matrix);
  data.imag = imag(matrix);
endfunction

function roots_data = sample_closed_loop_roots(coeffs_fn, values)
  count = numel(values);
  coeffs = coeffs_fn(values(1));
  degree = numel(coeffs) - 1;
  roots_real = zeros(degree, count);
  roots_imag = zeros(degree, count);

  for idx = 1:count
    current_roots = roots(coeffs_fn(values(idx)));
    roots_real(:, idx) = real(current_roots(:));
    roots_imag(:, idx) = imag(current_roots(:));
  endfor

  roots_data = struct();
  roots_data.values = values;
  roots_data.real = roots_real;
  roots_data.imag = roots_imag;
endfunction

% Example 1: G(s)=K/[s(s+1)(s+2)]
main_values = unique([ ...
  0:0.0005:0.8, ...
  0.805:0.005:8.0, ...
  8.02:0.02:40.0 ...
]);
main_roots = sample_closed_loop_roots(@(k) [1, 3, 2, k], main_values);

% Example 1a: G(s)=K/[s(s+2)(s+4)]
example1_values = unique([ ...
  0:0.0005:1.2, ...
  1.205:0.005:10.0, ...
  10.05:0.05:60.0 ...
]);
example1_roots = sample_closed_loop_roots(@(k) [1, 6, 8, k], example1_values);

% Example 3: G(s)=K/[(s+2)(s^2+2s+5)]
example3_values = unique([ ...
  0:0.001:2.0, ...
  2.01:0.01:15.0, ...
  15.05:0.05:60.0 ...
]);
example3_roots = sample_closed_loop_roots(@(k) [1, 4, 9, 10 + k], example3_values);

% Snapshot roots for the dynamics panel
dynamics_values = [0.8, 3.0, 5.5];
dynamics_roots = sample_closed_loop_roots(@(k) [1, 3, 2, k], dynamics_values);

payload = struct();
payload.main_example = struct();
payload.main_example.values = main_roots.values;
payload.main_example.real = main_roots.real;
payload.main_example.imag = main_roots.imag;

payload.example1 = struct();
payload.example1.values = example1_roots.values;
payload.example1.real = example1_roots.real;
payload.example1.imag = example1_roots.imag;

payload.example3 = struct();
payload.example3.values = example3_roots.values;
payload.example3.real = example3_roots.real;
payload.example3.imag = example3_roots.imag;

payload.dynamics_snapshots = dynamics_roots;

fid = fopen(output_path, "w");
if fid < 0
  error("Cannot open output file: %s", output_path);
endif

fputs(fid, jsonencode(payload));
fclose(fid);

printf("Wrote %s\n", output_path);
