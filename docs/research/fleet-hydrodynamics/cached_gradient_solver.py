"""复用同一冻结BEM问题的势梯度矩阵，保留Capytaine原求解和载荷代数。"""

import hashlib
import json
import time

import capytaine as cpt
from capytaine.tools.lists_of_points import _normalize_points
import numpy as np


class CachedGradientSolver(cpt.BEMSolver):
    def __init__(self, **kwargs):
        if cpt.__version__ != '2.2.1':
            raise ValueError('势梯度缓存仅核验过Capytaine 2.2.1')
        super().__init__(**kwargs)
        self._gradient_key = None
        self._gradient = None
        self.gradient_cache_statistics = {'hits': 0, 'evaluations': 0,
            'maximum_retained_bytes': 0, 'green_function_seconds': 0.0}

    def solve_all(self, problems, **kwargs):
        # 基类按船体/固有频率稳定排序，同频率内按实际遭遇波数复用矩阵。
        ordered = sorted(problems, key=lambda problem: (
            problem.body.name, problem.free_surface, problem.water_depth, problem.omega,
            problem.forward_speed, problem.rho, problem.g, problem.encounter_wavenumber))
        return super().solve_all(ordered, **kwargs)

    def _compute_potential_gradient(self, points, result):
        points, shape = _normalize_points(points, keep_mesh=True)
        mesh = result.body.mesh_including_lid
        if points is not mesh or result.sources is None:
            return super()._compute_potential_gradient(points, result)
        digest = hashlib.sha256()
        for values in [mesh.vertices, mesh.faces, mesh.faces_centers, mesh.faces_normals]:
            digest.update(np.ascontiguousarray(values).tobytes())
        key = (digest.digest(), result.free_surface, result.water_depth, result.encounter_wavenumber,
            id(self.green_function), json.dumps(self.green_function.exportable_settings, sort_keys=True, default=str))
        if key == self._gradient_key:
            self.gradient_cache_statistics['hits'] += 1
        else:
            # 单项缓存先释放旧矩阵，前进速度的多个遭遇波数不会累积常驻内存。
            self._gradient, self._gradient_key = None, None
            started = time.monotonic()
            _, gradient = self.green_function.evaluate(points, mesh, result.free_surface,
                result.water_depth, result.encounter_wavenumber, early_dot_product=False)
            if not np.isfinite(gradient).all():
                raise ValueError('实际势梯度矩阵包含非有限值')
            self._gradient, self._gradient_key = gradient, key
            statistics = self.gradient_cache_statistics
            statistics['evaluations'] += 1
            statistics['green_function_seconds'] += time.monotonic()-started
            statistics['maximum_retained_bytes'] = max(statistics['maximum_retained_bytes'], gradient.nbytes)
        velocities = np.einsum('ijk,j->ik', self._gradient, result.sources)
        return velocities.reshape((*shape, 3))
