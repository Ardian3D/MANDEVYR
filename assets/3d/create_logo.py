"""Rebuild the supplied MANDEVYR mark as three beveled solid meshes.
Run with Blender --background --python assets/3d/create_logo.py.
The traced coordinates follow public/logo-remove-bg.png, not a generated symbol.
"""
import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = 0.27
    return mat

graphite = material('MANDEVYR / Graphite enamel', (0.018, 0.032, 0.047), 0.62)
mint = material('MANDEVYR / Mint enamel', (0.015, 0.52, 0.34), 0.44)

def solid(name, points, mat, depth=0.27):
    # Image coordinates normalized to a 2.8-unit-wide mark; front faces -Y.
    contour = [((x-159)/100, (146-y)/100) for x,y in points]
    n = len(contour)
    vertices = [(x, d, z) for d in (-depth/2, depth/2) for x,z in contour]
    faces = [tuple(range(n-1,-1,-1)), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Precision edge / 3 segments', 'BEVEL')
    bevel.width = 0.018
    bevel.segments = 3
    bevel.affect = 'EDGES'
    obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    obj.select_set(False)
    return obj

solid('01 / Graphite wing', [(21,17),(150,106),(150,131),(121,160),(73,117),(73,239),(21,275)], graphite)
solid('02 / Mint wing', [(297,17),(167,106),(167,132),(194,160),(244,117),(244,239),(297,275)], mint)
solid('03 / Central diamond', [(159,140),(191,173),(159,205),(127,173)], graphite)

# Source reference is packed in the .blend for future editing.
ref = bpy.data.images.load(str(ROOT / 'public/logo-remove-bg.png'))
ref.pack()
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_distance = 5
            area.spaces.active.shading.type = 'MATERIAL'

out = ROOT / 'public/models'
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/3d/mandevyr-logo.blend'))
bpy.ops.export_scene.gltf(filepath=str(out / 'mandevyr-logo.glb'), export_format='GLB', export_apply=True, export_cameras=False, export_lights=False)
print('MANDEVYR logo exported:', out / 'mandevyr-logo.glb')
