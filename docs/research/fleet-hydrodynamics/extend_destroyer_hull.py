"""保留055 v3湿面和离线工况，扩展源几何水线上方船体。"""

import argparse
import copy
import json
import shutil
from pathlib import Path

import capytaine as cpt
import numpy as np
import trimesh

from build_destroyer_pack import hull_mesh, sha256, waterplane, write_json, write_nemoh


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous-pack', type=Path, required=True)
    parser.add_argument('--full-source-sections', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    previous = args.previous_pack
    geometry = json.loads((previous/'geometry.json').read_text())
    profile = json.loads(args.full_source_sections.read_text())
    wet = cpt.load_mesh(str(previous/'hull.dat'),file_format='nemoh')
    polygon, *_ = waterplane(wet)
    source_x, source_z = np.asarray(profile['x_m']), np.asarray(profile['z_m'])
    widths = np.asarray(profile['half_breadth_m'])
    shape = geometry['wet_surface_definition']
    scale = np.asarray(shape['source_scale_factors'])
    origin = shape['source_center_of_buoyancy_x_m']
    waterline_x = np.unique(polygon[:,0])
    x = waterline_x
    z = np.r_[0.0,np.linspace(0.0,source_z[-1]*scale[2],17)[1:]]
    power = shape['fullness_power']
    sampled = np.asarray([np.interp(z/scale[2],source_z,
        [np.interp((station+origin)/scale[0],source_x,widths[:,index]) for index in range(len(source_z))])
        for station in x])*scale[1]
    for index, station in enumerate(x):
        vertices = polygon[abs(polygon[:,0]-station)<1e-8,1]
        actual_width = abs(vertices).max() if len(vertices) else 0.0
        # 水线严格承接既有湿面，正高度使用同一幂变换后的源轮廓。
        sampled[index,0] = geometry['beam_m']/2*(2*actual_width/geometry['beam_m'])**(1/power)
    upper = hull_mesh(power,x,z,sampled,beam_m=geometry['beam_m'],close_top=True)
    upper_faces = upper.faces[:, :3]
    upper_faces = upper_faces[~np.all(abs(upper.vertices[upper_faces,2])<1e-10,axis=1)]
    closed = trimesh.util.concatenate([
        trimesh.Trimesh(wet.vertices,wet.faces[:,:3],process=False),
        trimesh.Trimesh(upper.vertices,upper_faces,process=False),
    ])
    closed.merge_vertices(digits_vertex=9)
    closed.remove_unreferenced_vertices()
    if not closed.is_watertight or not closed.is_winding_consistent or closed.volume <= 0:
        edges, counts = np.unique(np.sort(closed.edges,axis=1),axis=0,return_counts=True)
        raise ValueError(f'水线承接后的完整船体未闭合 {closed.vertices[edges[counts!=2][:5]].tolist()}')
    kg, draft = geometry['kg_keel_up_m'], geometry['draft_m']
    body = closed.vertices.copy()
    body[:,1] *= -1
    body[:,2] = kg-draft-body[:,2]
    geometry['nonlinear_hydrostatics'] = {
        'vertices_body_m':body.tolist(),'triangles':closed.faces.tolist(),
        'cg_waterline_height_m':kg-draft,
    }
    geometry['equilibrium_pitch_rad'] = 0.0
    args.output.mkdir(parents=True,exist_ok=True)
    for name in ['actuators.json','maneuvering.json','source-sections.json','hull.dat','lid.dat','envelope-validation.json']:
        shutil.copy2(previous/name,args.output/name)
    shutil.copy2(args.full_source_sections,args.output/'full-source-sections.json')
    write_json(args.output/'geometry.json',geometry)
    provenance = json.loads((previous/'provenance.json').read_text())
    provenance['previous_parameter_version'] = 'research-nominal-v3'
    provenance['previous_geometry_sha256'] = sha256(previous/'geometry.json')
    provenance['generator_sha256'] = sha256(Path(__file__))
    provenance['full_source_sections_sha256'] = sha256(args.full_source_sections)
    provenance['geometry_derivation'] = 'unchanged verified v3 wet surface, source-derived freeboard loft joined on the same waterline'
    provenance['freeboard_longitudinal_scope_m'] = [float(x[0]),float(x[-1])]
    provenance['not_ready'].append('bow/stern dry-overhang immersion outside the retained wet-surface longitudinal extent')
    provenance['entries'].append({'parameter':'geometry.nonlinear_hydrostatics','unit':'m and triangle connectivity',
        'grade':'T','source_sha256':sha256(args.full_source_sections),'vertex_count':len(body),
        'triangle_count':len(closed.faces),'uncertainty':'not_quantified'})
    write_json(args.output/'provenance.json',provenance)
    write_nemoh(args.output/'full-hull.dat',closed.vertices, np.column_stack([closed.faces,closed.faces[:,-1]]))
    validation = copy.deepcopy(json.loads((previous/'validation.json').read_text()))
    validation.update({'full_hull_watertight':True,'full_hull_winding_consistent':True,
        'wet_surface_unchanged':sha256(args.output/'hull.dat')==sha256(previous/'hull.dat'),
        'full_hull_triangles':len(closed.faces),'nonlinear_restoring':'pending native verification'})
    write_json(args.output/'validation.json',validation)
    files = ['geometry.json','actuators.json','maneuvering.json','provenance.json','hull.dat','lid.dat',
             'source-sections.json','full-source-sections.json','envelope-validation.json','full-hull.dat','validation.json']
    write_json(args.output/'manifest.json',{'schema':'act.model-pack.manifest.v2','vessel':'destroyer-055',
        'model_version':'research-nominal-v4','model_fidelity':'research-nominal',
        'files_sha256':{name:sha256(args.output/name) for name in files}})
    print(json.dumps(validation))


if __name__=='__main__':
    main()
