"""复用冻结一阶生产器，以受控迭代求解或显式镜面对称加速实际BEM。"""

import argparse
import importlib.util
import json
from pathlib import Path
import sys
import time
from types import SimpleNamespace

import capytaine as cpt
from capytaine.bem.engines import BasicMatrixEngine
from capytaine.matrices.block import BlockMatrix
import numpy as np
from scipy.sparse.linalg import LinearOperator, gmres

from build_destroyer_pack import sha256, write_json


def diagonal(matrix):
    if isinstance(matrix, np.ndarray):
        return matrix.diagonal()
    if isinstance(matrix, BlockMatrix):
        return np.concatenate([diagonal(matrix.all_blocks[index, index])
                               for index in range(matrix.nb_blocks[0])])
    raise ValueError('迭代预条件器遇到未知矩阵类型')


def main():
    parser = argparse.ArgumentParser(description=__doc__, add_help=False)
    parser.add_argument('--linear-solver', choices=['lu_decomposition', 'gmres'], default='gmres')
    parser.add_argument('--symmetry-proof', type=Path)
    options, original_arguments = parser.parse_known_args()
    output_index = original_arguments.index('--output')
    output = Path(original_arguments[output_index+1])
    if output.exists():
        raise ValueError('每次受控求解须使用新的输出目录')
    generator_sha = sha256(Path(__file__))
    base_path = Path(__file__).parent.parent/'capytaine-s175/solve_first_order.py'
    base_sha = sha256(base_path)
    specification = importlib.util.spec_from_file_location('frozen_first_order', base_path)
    source = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(source)
    source.cpt = SimpleNamespace(**vars(cpt))
    records = []
    mesh_records = []
    if options.symmetry_proof:
        proof = json.loads(options.symmetry_proof.read_text())
        if proof['status'] != 'passed':
            raise ValueError('镜面对称加速需要已通过的同源曲面证明')
        expected = {proof['output_mesh_sha256'], proof['output_lid_sha256']}
        original_loader = cpt.load_mesh

        def load_symmetric_mesh(file, **kwargs):
            mesh = original_loader(file, **kwargs)
            if sha256(Path(file)) not in expected:
                raise ValueError('实际网格与曲面对称证明不一致')
            mesh.heal_mesh()
            mirrored = cpt.ReflectionSymmetricMesh(mesh.clipped(cpt.xOz_Plane), cpt.xOz_Plane)
            volume_error = abs(mirrored.volume-mesh.volume)/max(abs(mesh.volume), 1.0)
            area_error = abs(mirrored.faces_areas.sum()/mesh.faces_areas.sum()-1)
            if volume_error > 1e-9 or area_error > 1e-9:
                raise ValueError('结构化对称网格改变排水体积或面积')
            mesh_records.append({'input_sha256': sha256(Path(file)), 'full_faces': mesh.nb_faces,
                'relative_volume_error': volume_error, 'relative_area_error': area_error})
            return mirrored

        source.cpt.load_mesh = load_symmetric_mesh

    def solve(matrix, forcing):
        started = time.monotonic()
        norm = float(np.linalg.norm(forcing))
        count = 0

        def iteration(_):
            nonlocal count
            count += 1

        if norm == 0:
            solution, status = np.zeros_like(forcing), 0
        else:
            values = diagonal(matrix)
            if np.any(abs(values) < 1e-14):
                raise ValueError('Jacobi预条件对角无效')
            preconditioner = LinearOperator(matrix.shape, matvec=lambda vector: vector/values, dtype=forcing.dtype)
            solution, status = gmres(matrix, forcing, M=preconditioner, rtol=1e-10, atol=1e-12,
                restart=80, maxiter=500, callback=iteration, callback_type='pr_norm')
        residual = float(np.linalg.norm(matrix@solution-forcing)/max(norm, 1e-30))
        records.append({'size': matrix.shape[0], 'matrix_type': type(matrix).__name__,
            'iterations': count, 'relative_residual': residual, 'seconds': time.monotonic()-started})
        if status != 0 or not np.isfinite(solution).all() or residual > 1e-8:
            raise ValueError(f'受控GMRES未收敛 status={status} residual={residual}')
        return solution

    def solver_factory():
        engine = BasicMatrixEngine(linear_solver=solve if options.linear_solver == 'gmres' else 'lu_decomposition')
        engine.exportable_settings['linear_solver'] = options.linear_solver
        return cpt.BEMSolver(engine=engine)

    source.cpt.BEMSolver = solver_factory
    sys.argv = [str(base_path), *original_arguments]
    started = time.monotonic()
    exit_code = 0
    try:
        source.main()
    except SystemExit as error:
        exit_code = error.code
    finally:
        if base_sha != sha256(base_path) or generator_sha != sha256(Path(__file__)):
            raise ValueError('求解期间生产器发生漂移')
        report = {'schema': 'act.controlled-first-order-solver.v1',
            'generator_sha256': generator_sha, 'base_generator_sha256': base_sha,
            'linear_solver': options.linear_solver, 'gmres_relative_tolerance': 1e-10,
            'maximum_accepted_relative_residual': 1e-8, 'restart': 80, 'maximum_restart_cycles': 500,
            'preconditioner': 'Jacobi', 'elapsed_seconds': time.monotonic()-started,
            'symmetry_proof_sha256': sha256(options.symmetry_proof) if options.symmetry_proof else None,
            'symmetry_meshes': mesh_records, 'linear_solves': records}
        output.mkdir(parents=True, exist_ok=True)
        write_json(output/'linear-solver-validation.json', report)
        provenance_path = output/'provenance.json'
        if provenance_path.exists():
            provenance = json.loads(provenance_path.read_text())
            provenance['controlled_solver'] = {'linear_solver': options.linear_solver,
                'generator_sha256': generator_sha, 'validation_sha256': sha256(output/'linear-solver-validation.json')}
            write_json(provenance_path, provenance)
    raise SystemExit(exit_code)


if __name__ == '__main__':
    main()
