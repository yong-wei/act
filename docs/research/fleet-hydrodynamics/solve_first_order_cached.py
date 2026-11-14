"""在冻结的一阶生产器外启用已核验的单矩阵势梯度缓存。"""

import json
from pathlib import Path
import sys
from types import SimpleNamespace

import capytaine as cpt

from build_destroyer_pack import sha256, write_json
from cached_gradient_solver import CachedGradientSolver
import solve_first_order_controlled as controlled


def main():
    output = Path(sys.argv[sys.argv.index('--output')+1])
    sources = [Path(__file__), Path(__file__).with_name('cached_gradient_solver.py'),
        Path(controlled.__file__)]
    identities = {source.name: sha256(source) for source in sources}
    solvers = []

    def factory(**kwargs):
        solver = CachedGradientSolver(**kwargs)
        solvers.append(solver)
        return solver

    controlled.cpt = SimpleNamespace(**vars(cpt))
    controlled.cpt.BEMSolver = factory
    try:
        controlled.main()
    finally:
        if any(sha256(source) != identities[source.name] for source in sources):
            raise ValueError('缓存求解期间生产器发生漂移')
        path = output/'linear-solver-validation.json'
        if path.exists():
            report = json.loads(path.read_text())
            report['gradient_cache'] = {'producer_sha256': identities,
                'maximum_retained_matrices': 1,
                'solver_instances': [solver.gradient_cache_statistics for solver in solvers]}
            write_json(path, report)
            provenance_path = output/'provenance.json'
            if provenance_path.exists():
                provenance = json.loads(provenance_path.read_text())
                provenance['controlled_solver']['validation_sha256'] = sha256(path)
                provenance['controlled_solver']['gradient_cache_producer_sha256'] = identities
                write_json(provenance_path, provenance)


if __name__ == '__main__':
    main()
