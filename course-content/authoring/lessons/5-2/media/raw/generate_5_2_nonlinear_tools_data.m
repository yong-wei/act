pkg load control;

outdir = fullfile(fileparts(mfilename("fullpath")), "..", "processed", "5-2-nonlinear-tools-data");
if exist(outdir, "dir") != 7
  mkdir(outdir);
endif

% 1. Local linearization data: y = tanh(x) around two operating points.
x = linspace(-2.5, 2.5, 501)';
y = tanh(x);
x0_a = 0;
y0_a = tanh(x0_a);
k_a = 1 - tanh(x0_a)^2;
lin_a = y0_a + k_a * (x - x0_a);
x0_b = 1;
y0_b = tanh(x0_b);
k_b = 1 - tanh(x0_b)^2;
lin_b = y0_b + k_b * (x - x0_b);
local_data = [x, y, lin_a, lin_b];
csvwrite(fullfile(outdir, "local_linearization.csv"), local_data);

% 2. Phase-plane data: Van der Pol oscillator as a minimal nonlinear behavior map.
mu = 1.0;
function dx = vdp_rhs(x, mu)
  dx = [x(2); mu * (1 - x(1)^2) * x(2) - x(1)];
endfunction

tspan = linspace(0, 20, 2500)';
initials = [0.2 0.2; 2.5 0; -2 1.5; 0 -2.5];
for i = 1:rows(initials)
  [t, z] = ode45(@(t, x) vdp_rhs(x, mu), tspan, initials(i, :)');
  csvwrite(fullfile(outdir, sprintf("phase_trajectory_%d.csv", i)), [t, z]);
endfor

grid_x = linspace(-3, 3, 25);
grid_v = linspace(-4, 4, 25);
[X, V] = meshgrid(grid_x, grid_v);
DX = V;
DV = mu .* (1 - X .^ 2) .* V - X;
norms = sqrt(DX .^ 2 + DV .^ 2);
norms(norms == 0) = 1;
field_data = [X(:), V(:), DX(:) ./ norms(:), DV(:) ./ norms(:)];
csvwrite(fullfile(outdir, "phase_field.csv"), field_data);

% 3. Describing-function boundary data for saturation and a simple linear part.
% Linear part: G(s) = 9 / (s (s+1) (0.2s+1)).
w = logspace(-2, 2, 900)';
s = 1i * w;
G = 9 ./ (s .* (s + 1) .* (0.2 .* s + 1));
nyquist_data = [w, real(G), imag(G)];
csvwrite(fullfile(outdir, "describing_nyquist.csv"), nyquist_data);

a = 1;
A = linspace(a, 8, 600)';
N = (2 / pi) .* (asin(a ./ A) + (a ./ A) .* sqrt(1 - (a ./ A) .^ 2));
minus_inv_N = -1 ./ N;
desc_data = [A, N, minus_inv_N];
csvwrite(fullfile(outdir, "saturation_describing_function.csv"), desc_data);

% Estimate the negative-real crossing used in the handout text.
candidate_idx = find(real(G) < -0.5);
[~, local_idx] = min(abs(imag(G(candidate_idx))));
idx = candidate_idx(local_idx);
crossing = [w(idx), real(G(idx)), imag(G(idx))];
csvwrite(fullfile(outdir, "nyquist_negative_real_crossing.csv"), crossing);
