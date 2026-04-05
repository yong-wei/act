root_dir = fileparts(mfilename("fullpath"));

printf("3-8 图像流程已切换为两段式：\n");
printf("1. octave -qf %s\n", fullfile(root_dir, "generate_design_data.m"));
printf("2. python3 %s\n", fullfile(root_dir, "render_figures.py"));
printf("当前脚本仅保留为兼容入口，将先导出 JSON 数据。\n");

run(fullfile(root_dir, "generate_design_data.m"));
