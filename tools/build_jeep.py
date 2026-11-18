import bpy
from math import cos, pi, sin
from pathlib import Path

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=.45, metallic=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return result


ivory = material('Warm ivory enamel', (.84, .78, .63), .3)
cream = material('Painted steel wheels', (.73, .68, .54), .45, .15)
red = material('Crimson vinyl', (.54, .028, .016))
gold = material('Ochre vinyl', (.5, .26, .05))
rubber = material('All-terrain rubber', (.022, .021, .018), .89)
steel = material('Powder-coated steel', (.035, .037, .038), .46, .3)
chrome = material('Brushed metal', (.46, .48, .47), .32, .62)
seat = material('Charcoal vinyl seats', (.065, .059, .051), .8)
amber = material('Amber lenses', (.95, .23, .022), .26)
lens = material('Headlight lenses', (.78, .77, .65), .23, .18)
glass = material('Lightly tinted windshield', (.24, .40, .44), .15)
glass.diffuse_color = (.24, .40, .44, .34)
glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = .34


def finish(obj, name, paint, bevel=0):
    obj.name = name
    obj.data.materials.append(paint)
    if bevel:
        modifier = obj.modifiers.new('Pressed steel edge', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 2
        normals = obj.modifiers.new('Panel normals', 'WEIGHTED_NORMAL')
        normals.keep_sharp = True
    return obj


def block(name, location, size, paint, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, paint, bevel)


def panel(name, profile, inner, outer, paint, bevel=.012):
    count = len(profile)
    vertices = [(width, depth, height) for width in (inner, outer) for depth, height in profile]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(index, (index + 1) % count, (index + 1) % count + count, index + count)
              for index in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, paint, bevel)


def cylinder(name, location, radius, depth, axis, paint, sides=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.rotation_euler = (pi / 2, 0, 0) if axis == 'y' else (0, pi / 2, 0)
    return finish(obj, name, paint)


def rail(name, points, radius, paint):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(paint)


block('Ladder chassis', (0, 0, .52), (1.24, 3.82, .25), steel)
block('Cab floor and bed', (0, -.17, .70), (1.49, 3.26, .13), ivory)
block('Raised bonnet', (0, 1.37, 1.21), (1.49, 1.33, .15), ivory, .045)
block('Bonnet center pressing', (0, 1.39, 1.284), (.98, .93, .045), ivory, .018)
block('Rear tailgate', (0, -1.99, .87), (1.52, .13, .41), ivory)
block('Tailgate inset', (0, -2.06, .89), (1.24, .018, .22), ivory, .009)
block('Tailgate handle', (0, -2.074, 1.006), (.25, .035, .042), steel)
block('Front valance', (0, 1.99, .96), (1.51, .12, .48), ivory)
block('Slotted grille recess', (0, 2.059, 1.017), (.91, .047, .26), steel)
for index in range(-6, 7):
    block('Grille fin', (index * .066, 2.087, 1.017), (.019, .026, .212), chrome, .005)
for end in (-1, 1):
    block('Wraparound bumper', (0, end * 2.06, .58), (1.75, .24, .19), steel, .04)

for side in (-1, 1):
    inner, outer = sorted((side * .70, side * .78))
    for axle, limits, upper in [(-1.31, (-2.03, -.64), 1.10), (1.30, (.66, 2.02), 1.20)]:
        arch = [(axle + .46 * cos(angle * pi / 12), .52 + .43 * sin(angle * pi / 12))
                for angle in range(13)]
        profile = [(limits[0], .59), (limits[0], upper), (limits[1], upper),
                   (limits[1], .59), *arch]
        panel('Pressed wheel-arch quarter', profile, inner, outer, ivory)
        rail('Wheel arch trim', [(side*.79, depth, height) for depth, height in arch], .019, steel)
    panel('Cab door', [(-.64,.59),(-.64,1.22),(.66,1.22),(.66,.59)], inner, outer, ivory)
    block('Rocker and side step', (side*.79, .01, .58), (.19, 1.29, .09), steel)
    block('Door handle', (side*.797, -.44, 1.13), (.035,.16,.043), chrome, .009)
    for profile, paint in [
        ([(-2,1.064),(-1.3,1.07),(-.53,1.19),(.64,1.08),(1.68,1.14),(.59,1.03),(-.55,1.10),(-1.32,1.035)],red),
        ([(-1.9,1.047),(-1.32,1.031),(-.30,1.075),(.67,1.033),(.23,.982),(-.49,1.035)],gold),
    ]:
        inset, outset = sorted((side*.781, side*.785))
        panel('Swept side graphic', profile, inset, outset, paint, 0)
    cylinder('Round headlight bezel', (side*.593,2.067,1.04), .123,.056,'y',steel)
    cylinder('Round fluted headlight', (side*.593,2.098,1.04), .102,.032,'y',lens)
    block('Fender marker', (side*.786,1.77,1.102), (.027,.117,.058), amber, .009)
    block('Rear combination lamp', (side*.60,-2.068,.79), (.24,.048,.137), red, .012)
    block('Rear indicator', (side*.66,-2.096,.80), (.105,.013,.105), amber, .006)
    rail('Cab door window frame', [(side*.724,-.58,1.18),(side*.724,-.58,1.89),
                                 (side*.708,.37,1.89),(side*.738,.70,1.21)], .037, ivory)
    rail('Bed cage side', [(side*.71,-.68,.96),(side*.71,-.68,1.83),
                          (side*.71,-1.86,1.75),(side*.71,-1.86,1.02)],.035,steel)
    rail('Bed diagonal', [(side*.71,-.71,1.78),(side*.71,-1.75,1.11)],.024,steel)
    block('Side mirror', (side*.865,.55,1.45), (.18,.075,.13), steel)
    block('Mirror glass', (side*.865,.505,1.45), (.146,.012,.096), chrome)
    block('Front seat cushion', (side*.36,.05,.91), (.48,.47,.15), seat, .065)
    back = block('Front seat back', (side*.36,-.21,1.20), (.45,.15,.54), seat, .06)
    back.rotation_euler.x = -.13
    block('Headrest', (side*.36,-.24,1.54), (.23,.15,.17), seat, .045)

rail('Rear cage crossbar', [(-.71,-1.86,1.75),(.71,-1.86,1.75)],.035,steel)
rail('Windshield upper channel', [(-.71,.37,1.89),(.71,.37,1.89)],.035,ivory)
block('Cab roof', (0,-.092,1.915), (1.52,1.10,.089), ivory,.038)
windshield = block('Windshield', (0,.521,1.562), (1.39,.027,.722), glass,.004)
windshield.rotation_euler.x = .46
block('Dashboard', (0,.57,1.22), (1.40,.24,.14), steel)
block('Rear bench cushion', (0,-1.43,.92), (1.30,.47,.14), seat, .055)
block('Rear bench back', (0,-1.70,1.16), (1.30,.15,.48), seat, .05)
for index in range(7):
    block('Bed floor rib', ((index-3)*.18,-1.03,.781), (.033,1.18,.023), steel, .004)

for side in (-1, 1):
    for axle in (-1.31, 1.30):
        center = (side*.81, axle, .39)
        pivot = bpy.data.objects.new(f'Wheel_{side}_{axle}', None)
        bpy.context.collection.objects.link(pivot)
        pivot.location = center
        components = [cylinder('Rounded tire carcass', center, .382, .25, 'x', rubber, 40),
                      cylinder('Cream steel rim', (side*.948,axle,.39), .237,.03,'x',cream,32),
                      cylinder('Recessed wheel hub', (side*.968,axle,.39), .081,.037,'x',steel)]
        for index in range(8):
            angle = index*pi/4
            components.append(cylinder('Wheel vent', (side*.968,axle+.158*cos(angle),.39+.158*sin(angle)),.034,.014,'x',steel,12))
        for index in range(28):
            angle = index*2*pi/28
            lug = block('Tread block', (center[0],axle+.374*cos(angle),.39+.374*sin(angle)),(.248,.058,.037),rubber,.006)
            lug.rotation_euler.x = angle - pi / 2
            components.append(lug)
        bpy.context.view_layer.update()
        for component in components:
            component.parent = pivot
            component.matrix_parent_inverse = pivot.matrix_world.inverted()

groups = {}
for obj in list(bpy.context.scene.objects):
    if obj.type in {'MESH', 'CURVE'}:
        groups.setdefault((obj.parent, obj.active_material.name), []).append(obj)
for (_, name), objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.convert(target='MESH')
    if len(objects) > 1:
        bpy.ops.object.join()
    bpy.context.object.name = name

target = Path(__file__).resolve().parents[1] / 'public' / 'vehicles' / 'long-chassis.glb'
target.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', export_apply=True)
