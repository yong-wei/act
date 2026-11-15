"""独立对照实际前进速度求解及缓存键变化，核验势梯度复用的数值等价性。"""

import argparse
import json
from pathlib import Path
import time

import capytaine as cpt
import numpy as np

from build_destroyer_pack import sha256, write_json
from cached_gradient_solver import CachedGradientSolver


def relative_error(first, second):
    return float(np.linalg.norm(first-second)/max(np.linalg.norm(first), 1e-30))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    body = cpt.FloatingBody(cpt.mesh_sphere(radius=3, center=(0, 0, -1), resolution=(8, 12)))
    body.keep_immersed_part()
    body.rotation_center = (0, 0, 0)
    body.add_all_rigid_body_dofs()
    problems = [cpt.RadiationProblem(body=body, omega=.8, water_depth=40, forward_speed=2,
        wave_direction=direction, radiating_dof=dof)
        for direction in [0, np.pi/2, np.pi] for dof in body.dofs]
    problems.extend(cpt.DiffractionProblem(body=body, omega=.8, water_depth=40,
        forward_speed=2, wave_direction=direction) for direction in [0, np.pi/2, np.pi])
    reference, cached = cpt.BEMSolver(), CachedGradientSolver()
    started = time.monotonic()
    expected = reference.solve_all(problems, keep_details=True, progress_bar=False)
    reference_seconds = time.monotonic()-started
    started = time.monotonic()
    actual = cached.solve_all(problems, keep_details=True, progress_bar=False)
    cached_seconds = time.monotonic()-started
    key = lambda result: (result.omega, result.wave_direction, type(result).__name__,
        getattr(result, 'radiating_dof', ''))
    errors = []
    for first, second in zip(sorted(expected, key=key), sorted(actual, key=key)):
        if key(first) != key(second):
            raise ValueError('缓存排序改变求解条件')
        forces = relative_error(np.asarray(list(first.forces.values())), np.asarray(list(second.forces.values())))
        sources = relative_error(first.sources, second.sources)
        if max(forces, sources) > 1e-12:
            raise ValueError('实际前进速度载荷或源分布对照失败')
        errors.append({'force_relative_l2': forces, 'source_relative_l2': sources})
    statistics = cached.gradient_cache_statistics.copy()
    if statistics['hits'] != 18 or statistics['evaluations'] != 3:
        raise ValueError('同遭遇波数的七个右端项没有实际复用矩阵')
    points = np.asarray([[1, 1, -2], [3, -2, -4]])
    off_body_error = relative_error(reference.compute_velocity(points, actual[-1]), cached.compute_velocity(points, actual[-1]))
    if off_body_error > 1e-14:
        raise ValueError('离体测点回退路径不一致')
    invalidation = []
    for depth, frequency in [(60, .8), (60, 1.2)]:
        count = cached.gradient_cache_statistics['evaluations']
        problem = cpt.RadiationProblem(body=body, omega=frequency, water_depth=depth,
            forward_speed=2, wave_direction=np.pi, radiating_dof='Heave')
        first, second = reference.solve(problem), cached.solve(problem)
        error = relative_error(np.asarray(list(first.forces.values())), np.asarray(list(second.forces.values())))
        if cached.gradient_cache_statistics['evaluations'] != count+1 or error > 1e-12:
            raise ValueError('水深或频率改变后错误复用势梯度')
        invalidation.append({'water_depth_m': depth, 'omega_rad_s': frequency, 'force_relative_l2': error})
    body.translate_x(.25)
    count = cached.gradient_cache_statistics['evaluations']
    problem = cpt.RadiationProblem(body=body, omega=1.2, water_depth=60,
        forward_speed=2, wave_direction=np.pi, radiating_dof='Heave')
    first, second = reference.solve(problem), cached.solve(problem)
    geometry_error = relative_error(np.asarray(list(first.forces.values())), np.asarray(list(second.forces.values())))
    if cached.gradient_cache_statistics['evaluations'] != count+1 or geometry_error > 1e-12:
        raise ValueError('几何改变后错误复用势梯度')
    report = {'schema': 'act.bem.gradient-cache-validation.v1', 'status': 'passed',
        'generator_sha256': sha256(Path(__file__)),
        'cache_implementation_sha256': sha256(Path(__file__).with_name('cached_gradient_solver.py')),
        'capytaine_version': cpt.__version__, 'faces': body.mesh.nb_faces,
        'forward_speed_mps': 2, 'initial_water_depth_m': 40,
        'problems': len(problems), 'errors': errors, 'off_body_velocity_relative_l2': off_body_error,
        'depth_and_frequency_invalidation': invalidation, 'geometry_invalidation_relative_l2': geometry_error,
        'reference_seconds': reference_seconds, 'cached_seconds': cached_seconds, 'statistics': statistics,
        'scope': 'Exact same Green-function evaluation and source contraction; bounded one-matrix cache. Vessel-grid comparison is recorded separately.'}
    write_json(args.output, report)
    print(json.dumps({'status': 'passed', 'problems': len(problems),
        'maximum_force_relative_l2': max(record['force_relative_l2'] for record in errors), 'statistics': statistics}))


if __name__ == '__main__':
    main()
