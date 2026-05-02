from __future__ import annotations

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
HANDOUT_PATH = ROOT / 'authoring' / 'lessons' / '3-7' / 'design' / '3-7-handout.md'
MULTIMEDIA_PATH = ROOT / 'authoring' / 'lessons' / '3-7' / 'design' / '3-7-multimedia.md'
PLOT_DATA_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '3-7' / 'media' / 'raw' / 'generate_design_data.m'
PLOT_RENDER_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '3-7' / 'media' / 'raw' / 'render_figures.py'
EXAMPLE2_TEX_PATH = ROOT / 'authoring' / 'lessons' / '3-7' / 'media' / 'raw' / '3-7-example2-structure.tex'
COVER_COMIC_PROMPT_PATH = ROOT / 'authoring' / 'lessons' / '3-7' / 'media' / 'raw' / '3-7-cover-comic-prompt.md'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def test_input_channel_closed_loop_transfer_function_uses_total_output_symbol():
    handout = read(HANDOUT_PATH)

    assert r'\Phi_r(s)=\frac{C(s)}{R(s)}' in handout
    assert r'\Phi_r(s)=\frac{C_r(s)}{R(s)}' not in handout


def test_error_transfer_functions_use_comparator_error_definition():
    handout = read(HANDOUT_PATH)

    assert r'E(s)=R(s)-B(s)=R(s)-H(s)C(s)' in handout
    assert r'\frac{E_r(s)}{R(s)}=\frac{1}{1+G_c(s)G_p(s)H(s)}' in handout
    assert r'\frac{E_d(s)}{D(s)}=-\frac{G_p(s)H(s)}{1+G_c(s)G_p(s)H(s)}' in handout
    assert '单位反馈，才可简写成 $E(s)=R(s)-C(s)$' in handout


def test_handout_explicitly_explains_shared_characteristic_denominator():
    handout = read(HANDOUT_PATH)

    assert '四类传递函数的分母完全相同' in handout
    assert '梅森公式中的特征式' in handout
    assert '改变的是分子部分' in handout


def test_handout_adds_type_and_static_error_coefficient_tables_before_error_table():
    handout = read(HANDOUT_PATH)

    assert '其中 $v$ 是开环传递函数 $G(s)H(s)$ 在原点处的极点个数' in handout
    assert '\\begin{center}\n表 2. 各型别系统的静态误差系数\n\\end{center}' in handout
    assert '\\begin{center}\n表 3. 各型别系统对典型输入的稳态误差\n\\end{center}' in handout
    assert '这个表格只适用于闭环稳定的单回路标准负反馈系统' in handout
    assert '终值定理给出稳态误差的通用求解路径' in handout
    assert '静态误差系数法只适用于单回路标准负反馈系统' in handout


def test_figures_drop_manual_numbering_and_example2_uses_midchannel_disturbance():
    handout = read(HANDOUT_PATH)

    assert '![图 3-7-' not in handout
    assert '![给定通道与扰动通道的统一闭环结构]' in handout
    assert '![例题 2 的双输入结构图]' in handout
    assert r'G_1(s)=\frac{5}{s+5}' in handout
    assert r'G_2(s)=\frac{2}{s+2}' in handout
    assert '扰动作用在执行器之后、被控对象之前' in handout
    assert '例如伺服电机已经给出阀位指令，但管路压力波动在对象入口处额外推了一下系统' in handout


def test_three_subplots_explain_pi_lag_lead_break_frequencies():
    handout = read(HANDOUT_PATH)

    assert r'PI、滞后、超前三种补偿的对数频率特性示意如图~\ref{fig:3-7-lowfreq} 所示。' in handout
    assert '先下折，再被零点拉平' in handout
    assert '先下折，再回到原斜率' in handout
    assert '先上折，再回到原斜率' in handout
    assert '![PI、滞后与超前的零极点和转折频率对比]' in handout


def test_time_domain_design_section_explains_error_metrics_and_feasible_region_steps():
    handout = read(HANDOUT_PATH)

    assert '这里首次在非阶跃给定下讨论“时域性能指标”，观察对象要从输出 $y(t)$ 切换为误差 $e(t)$。' in handout
    assert '先由稳态误差指标判断纯增益法是否在结构上可行' in handout
    assert r'M_p=e^{-\pi\zeta/\sqrt{1-\zeta^2}}\le 0.2' in handout
    assert r't_s(2\%)\approx \frac{4}{\sigma}\le 12' in handout
    assert '具体步骤如下：' not in handout
    assert '步骤 1：由超调量指标求阻尼比下界' not in handout


def test_handout_uses_cross_references_instead_of_manual_figure_numbers():
    handout = read(HANDOUT_PATH)

    assert '#fig:3-7-lowfreq' in handout
    assert '#fig:3-7-pi-time' in handout
    assert '#fig:3-7-lag-time' in handout
    assert '#fig:3-7-pi-frequency' in handout
    assert '#fig:3-7-pi-pd' in handout
    assert '图 3-7-2' not in handout
    assert '图 3-7-3' not in handout
    assert '图 3-7-4' not in handout
    assert '图 3-7-5' not in handout
    assert r'图~\ref{fig:3-7-pi-time}' in handout
    assert r'图~\ref{fig:3-7-lag-time}' in handout
    assert r'图~\ref{fig:3-7-pi-frequency}' in handout
    assert r'图~\ref{fig:3-7-pi-pd}' in handout


def test_appendix_embeds_octave_code_instead_of_local_script_links():
    handout = read(HANDOUT_PATH)

    appendix = handout.split('## 附录 B：本讲用到的复现脚本', 1)[1]
    assert '不再在讲义中展开长脚本代码' in appendix
    assert 'MATLAB/Octave' in appendix
    assert '```matlab' not in appendix
    assert '../media/raw/' not in appendix


def test_example2_structure_injects_disturbance_from_above():
    tex = read(EXAMPLE2_TEX_PATH)

    assert r'\node[above=' in tex
    assert r'\draw[signal] (d) -- (sum2);' in tex
    assert r'\node[below=' not in tex


def test_plot_script_uses_larger_2x2_layouts_and_square_root_locus_panels():
    plot_data = read(PLOT_DATA_SCRIPT_PATH)
    plot_render = read(PLOT_RENDER_SCRIPT_PATH)

    assert 'generated-data' in plot_data
    assert '3-7-design-data.json' in plot_data
    assert 'jsonencode' in plot_data
    assert "matplotlib.use('Agg')" in plot_render
    assert '3-7-design-data.json' in plot_render
    assert 'fig.add_gridspec(2, 2' in plot_render
    assert 'style_root_axis' in plot_render
    assert 'style_bode_axes' in plot_render


def test_plot_script_removes_manual_figure_numbers_stars_and_cross_frequency_wording():
    plot_render = read(PLOT_RENDER_SCRIPT_PATH)

    assert '图 3-7-6 摘要' not in plot_render
    assert '交叉频率' not in plot_render
    assert plot_render.count("marker='*'") == 0
    assert "set_aspect('equal'" not in plot_render
    assert 'fig.add_gridspec(1, 2' in plot_render


def test_plot_script_runs_without_gnuplot_multiplot_text_errors():
    result = subprocess.run(
        ['octave', '-qf', str(PLOT_DATA_SCRIPT_PATH)],
        capture_output=True,
        text=True,
        check=False,
    )

    render_result = subprocess.run(
        ['python3', str(PLOT_RENDER_SCRIPT_PATH)],
        capture_output=True,
        text=True,
        check=False,
    )

    combined_output = f'{result.stdout}\n{result.stderr}\n{render_result.stdout}\n{render_result.stderr}'
    assert result.returncode == 0
    assert render_result.returncode == 0
    assert 'invalid command' not in combined_output
    assert 'unexpected or unrecognized token' not in combined_output
    assert "Reading from '-' inside a multiplot not supported" not in combined_output


def test_multimedia_plan_mentions_root_locus_and_pi_pd_comparison_assets():
    multimedia = read(MULTIMEDIA_PATH)

    assert '例题 2 中间扰动结构图' in multimedia
    assert 'PI、滞后、超前三子图' in multimedia
    assert '纯增益与 PI 的根轨迹/时域对比' in multimedia
    assert '滞后校正根轨迹与时域验证' in multimedia
    assert 'PI 与 PD 性能对比' in multimedia


def test_cover_comic_prompt_uses_required_doraemon_multi_panel_format():
    prompt = read(COVER_COMIC_PROMPT_PATH)

    assert '请以哆啦A梦中的人物为原型。创作四格漫画，需要使用箭头标注格子的阅读顺序。' in prompt
    assert '每一格是独立画面，共用同一页排版' in prompt
    assert '格与格之间要有清晰边框或留白分隔' in prompt
    assert '第1格：' in prompt
    assert '第2格：' in prompt
    assert '第3格：' in prompt
    assert '第4格：' in prompt
    assert '不使用任何现成动画或漫画 IP 角色' not in prompt
