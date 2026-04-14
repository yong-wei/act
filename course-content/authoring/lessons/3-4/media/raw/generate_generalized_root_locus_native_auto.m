pkg load control

out_path = 'course-content/authoring/lessons/3-4/media/processed/3-4-generalized-root-locus-octave-auto.png';
data_path = 'course-content/authoring/lessons/3-4/media/raw/generated-data/generalized_root_locus_points_auto.csv';

K_B = 0.6064;
B_poly = [1, 2.24375, 0.214375, 0.01715 * K_B];
A_poly = [3.43, 0.343, 0, 0];
Ge = tf(A_poly, B_poly);

[rldata, kdata] = rlocus(Ge);

fig = figure('visible', 'off');
set(fig, 'color', 'white', 'position', [100, 100, 980, 560]);
rlocus(Ge);
grid on;
xlabel('Re(s)');
ylabel('Im(s)');
title('Octave native rlocus (auto gain range)');
print(fig, out_path, '-dpng', '-r220');
close(fig);

fid = fopen(data_path, 'w');
fprintf(fid, 'branch,re,im\n');
for branch = 1:rows(rldata)
  for idx = 1:columns(rldata)
    fprintf(fid, '%d,%.12f,%.12f\n', branch, real(rldata(branch, idx)), imag(rldata(branch, idx)));
  end
end
fclose(fid);

printf('rows=%d cols=%d\\n', rows(rldata), columns(rldata));
printf('k rows=%d cols=%d\\n', rows(kdata), columns(kdata));
for branch = 1:rows(rldata)
  printf(
    'branch %d start=%f%+fi end=%f%+fi\\n',
    branch,
    real(rldata(branch, 1)),
    imag(rldata(branch, 1)),
    real(rldata(branch, end)),
    imag(rldata(branch, end))
  );
end
