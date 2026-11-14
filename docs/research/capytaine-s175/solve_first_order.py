"""S175 一阶水动力求解（issue-2157 Capytaine 路径首跑证据）。

环境：隔离 venv + capytaine==2.2.1（项目锁定版本）。
输入：MSS HYDRO/vessels_capytaine/S175/s175.mat（上游 e8ab42a105cd）。
输出：s175_first_order.csv（ω, heave/roll/pitch 附加质量与阻尼、
静水力摘要、RAO 峰值摘要）。
"""
import numpy as np
import capytaine
from capytaine import FloatingBody
from capytaine.io.meshio import load_from_meshio

print("capytaine", capytaine.__version__)

# 1) 加载 S175 网格。
import meshio
m = meshio.read("/tmp/s175.mat")
body = FloatingBody.from_meshio(mesh=m, name="S175")
print("mesh:", body.mesh.nb_vertices, "vertices,", body.mesh.nb_faces, "faces")
body.translate_z(-body.mesh.vertices[:, 2].min())  # 坐标 z=0 到水线附近基线

# 2) 自由度（垂荡/横摇/纵摇）与浸水部分。
body.add_all_dofs()
body.keep_immersed_part()
body.center_of_mass = body.center_of_buoyancy  # 近似（网格无质量输入）
print("immersed faces:", body.mesh.nb_faces)

# 3) 静水力。
hs = body.compute_hydrostatics()
for k in ["disp_volume", "stiffness"]:
    if k in hs:
        print("hydrostatic", k, hs[k])

# 4) 辐射问题（垂荡/横摇/纵摇；ω 0.3-1.5 rad/s）。
from capytaine.bem.problems_and_results import RadiationProblem
from capytaine.ui.xarray import assemble_dataset
from capytaine.bem.solver import BEMSolver

solver = BEMSolver()
omegas = np.round(np.arange(0.3, 1.51, 0.1), 3)
problems = [
    RadiationProblem(body=body, radiating_dof=dof, omega=w, sea_bottom=-200.0)
    for w in omegas for dof in ["Heave", "Roll", "Pitch"]
]
results = [solver.solve(p) for p in problems]
ds = assemble_dataset(results)

# 5) 导出 CSV。
rows = []
for w in omegas:
    row = {"omega_rad_s": w}
    for dof in ["Heave", "Roll", "Pitch"]:
        row[f"added_mass_{dof}"] = float(ds["added_mass"].sel(omega=w, radiating_dof=dof, influenced_dof=dof))
        row[f"radiation_damping_{dof}"] = float(ds["radiation_damping"].sel(omega=w, radiating_dof=dof, influenced_dof=dof))
    rows.append(row)

import csv
with open("docs/research/capytaine-s175/s175_first_order.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
print("wrote s175_first_order.csv,", len(rows), "rows")
print("sample heave A44 @0.3:", rows[0]["added_mass_Heave"], "@1.5:", rows[-1]["added_mass_Heave"])
