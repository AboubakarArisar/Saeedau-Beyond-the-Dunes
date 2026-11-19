"""Run with Blender in background mode, passing a vehicle and a render directory."""
import argparse
from importlib import import_module
from pathlib import Path
import sys
from mathutils import Vector
import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.dont_write_bytecode = True
from geometry import material


def render_views(folder, vehicle, bounds):
    folder.mkdir(parents=True,exist_ok=True)
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=10
    scene.cycles.use_denoising=True
    scene.render.resolution_x=800
    scene.render.resolution_y=580
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.world=scene.world or bpy.data.worlds.new('Studio atmosphere')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.38,.47,.64,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.48
    scene.view_settings.view_transform='AgX'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008))
    bpy.context.object.data.materials.append(material('Studio warm grey',(.155,.145,.13),.68))

    minimum, maximum=bounds
    center=(minimum+maximum)/2
    extent=max(maximum-minimum)
    for point,energy,size,color in [
        ((-.7,1.2,1.9),980,1.7,(1,.83,.67)),
        ((1.3,1.0,1.3),750,1.4,(.80,.88,1)),
        ((-.8,-1.2,1.4),1100,1.5,(1,.92,.82)),
    ]:
        bpy.ops.object.light_add(type='AREA',location=tuple(center+Vector(point)*extent*.8))
        light=bpy.context.object
        light.data.energy=energy*(extent/4)**2
        light.data.shape='DISK'
        light.data.size=size*extent/3
        light.data.color=color
        light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()

    bpy.ops.object.camera_add()
    camera=bpy.context.object
    scene.camera=camera
    camera.data.type='ORTHO'
    for name,direction in {
        'front':(0,1,.14),'rear':(0,-1,.17),'left':(-1,0,.12),'right':(1,0,.12),
        'three-quarter':(-.78,1,.43),
    }.items():
        camera.location=center+Vector(direction).normalized()*extent*2.6
        camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=extent*(1.03 if name in ('front','rear') else 1.24)
        scene.render.filepath=str(folder/f'{vehicle}-{name}.png')
        bpy.ops.render.render(write_still=True)


parser=argparse.ArgumentParser()
parser.add_argument('vehicle',choices=['kekro','unique70'])
parser.add_argument('--renders',type=Path)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
palette={
    'paint':material('Enamel and painted trim',(1,1,1),.39,.10,painted=True),
    'metal':material('Machined and polished metal',(1,1,1),.33,.65,painted=True),
    'rubber':material('Rubber and vinyl',(1,1,1),.79,painted=True),
    'glass':material('Tinted glass',(.075,.21,.27),.19,.18,.82),
}
root=import_module(args.vehicle).model(palette)
bpy.context.view_layer.update()
parts=[obj for obj in root.children_recursive if obj.type=='MESH']
points=[obj.matrix_world@Vector(point) for obj in parts for point in obj.bound_box]
bounds=tuple(Vector(tuple(func(v[i] for v in points) for i in range(3))) for func in (min,max))
assert abs(bounds[0].z)<.003,f'Tire contact patch must be at ground level: {bounds[0]}'
assert all(obj.data.uv_layers for obj in parts)
wheels=[obj for obj in root.children_recursive if obj.name.startswith('Wheel_')]
assert len(wheels)==(6 if args.vehicle=='kekro' else 2)
print(f'{args.vehicle} bounds {tuple(bounds[0])} to {tuple(bounds[1])}',flush=True)
bpy.context.view_layer.objects.active=root
root.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-src/vehicles'/f'{args.vehicle}.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/vehicles'/f'{args.vehicle}.glb'),
                         export_format='GLB',export_animations=False,export_yup=True)
if args.renders:
    render_views(args.renders,args.vehicle,bounds)
