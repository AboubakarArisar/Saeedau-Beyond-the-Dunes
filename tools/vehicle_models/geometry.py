"""Small mesh-building primitives. Blender +Y is glTF -Z, the game's forward."""
from math import cos, pi, sin, sqrt, tau
import bpy
from mathutils import Vector


def material(name, color, roughness=.43, metal=0, alpha=1, painted=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes['Principled BSDF']
    for key, value in {'Base Color': (*color, 1), 'Roughness': roughness,
                       'Metallic': metal, 'Alpha': alpha}.items():
        shader.inputs[key].default_value = value
    if painted:
        layer = nodes.new('ShaderNodeVertexColor')
        layer.layer_name = 'Paint'
        mat.node_tree.links.new(layer.outputs['Color'], shader.inputs['Base Color'])
    return mat


def pivot(name, point=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = point
    return obj


def signed_power(value, power):
    return (1 if value >= 0 else -1) * abs(value) ** power


class Mesh:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.styles = []

    def add(self, points, faces, mat, color, smooth=False):
        base = len(self.vertices)
        self.vertices.extend(points)
        for face in faces:
            self.faces.append(tuple(base + i for i in face))
            self.styles.append((mat, color, smooth))

    def rings(self, rows, mat, color, caps=True, smooth=True):
        count = len(rows[0])
        faces = []
        for j in range(len(rows) - 1):
            for i in range(count):
                a, b = j * count + i, j * count + (i + 1) % count
                faces.append((a, b, b + count, a + count))
        if caps:
            faces += [tuple(reversed(range(count))), tuple(range((len(rows)-1)*count, len(rows)*count))]
        self.add([point for row in rows for point in row], faces, mat, color, smooth)

    def loft(self, sections, mat, color, count=24, power=.6):
        """Sections along Y, each with (y, center height, half width, half height)."""
        rows = [[(w * signed_power(cos(i*tau/count), power), y,
                  z + h * signed_power(sin(i*tau/count), power))
                 for i in range(count)] for y, z, w, h in sections]
        self.rings(rows, mat, color)

    def block(self, point, size, mat, color):
        x, y, z = point
        w, l, h = (dimension / 2 for dimension in size)
        self.add([(x+a*w,y+b*l,z+c*h) for c in (-1,1) for a,b in ((-1,-1),(1,-1),(1,1),(-1,1))],
                 [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,color)

    def panel(self, outline, offset, mat, color):
        count = len(outline)
        shift = Vector(offset)
        rows = [outline, [tuple(Vector(p)+shift) for p in outline]]
        self.rings(rows, mat, color, smooth=False)

    def tube(self, points, radius, mat, color, sides=10):
        points = [Vector(p) for p in points]
        rows = []
        for i, p in enumerate(points):
            axis = (points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized()
            guide = Vector((0,0,1)) if abs(axis.z)<.91 else Vector((0,1,0))
            u = axis.cross(guide).normalized()
            v = u.cross(axis)
            r = radius[i] if isinstance(radius,(tuple,list)) else radius
            rows.append([tuple(p+r*(cos(k*tau/sides)*u+sin(k*tau/sides)*v)) for k in range(sides)])
        self.rings(rows,mat,color)

    def axial(self, center, profile, mat, color, steps=40, close=False):
        x,y,z = center
        rows = [[(x+offset,y+r*cos(-i*tau/steps),z+r*sin(-i*tau/steps))
                 for i in range(steps)] for offset,r in profile]
        if close:
            rows.append(rows[0])
        self.rings(rows,mat,color,caps=not close)

    def arch(self, x, y, z, radius, width, low, high, mat, color, count=24):
        # A domed, open-ended fender shell with modeled thickness.
        rows = []
        for i in range(count+1):
            a = low+(high-low)*i/count
            rows.append([(x+u*width/2,y+r*cos(a),z+r*sin(a))
                         for u,r in [(-1,radius-.014),(1,radius-.014),(1,radius),(.78,radius+.027),
                                     (0,radius+.043),(-.78,radius+.027),(-1,radius)]])
        self.rings(rows,mat,color)

    def paint(self, outline, mat, color):
        self.add(outline,[tuple(range(len(outline)))],mat,color)

    def build(self, name, parent):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.validate()
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = parent
        slots = list(dict.fromkeys(style[0] for style in self.styles))
        for mat in slots:
            mesh.materials.append(mat)
        colors = mesh.color_attributes.new(name='Paint', type='BYTE_COLOR', domain='CORNER')
        uv = mesh.uv_layers.new(name='UVMap')
        for poly, (mat, color, smooth) in zip(mesh.polygons,self.styles):
            poly.material_index = slots.index(mat)
            poly.use_smooth = smooth and poly.loop_total == 4
            axis = max(range(3),key=lambda i:abs(poly.normal[i]))
            a,b = [i for i in range(3) if i!=axis]
            for loop in poly.loop_indices:
                p = mesh.vertices[mesh.loops[loop].vertex_index].co
                colors.data[loop].color = (*color,1)
                uv.data[loop].uv = (.5+p[a]/16,.5+p[b]/16)
        # Procedural strips and mirrored artwork can arrive with opposite winding.
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        obj.select_set(False)
        return obj


def wheel(mesh, radius, width, rubber, metal, bike=False):
    half = width/2
    dark = (.025,.029,.033)
    rim = (.57,.61,.64) if bike else (.36,.28,.24)
    profile = [(-half*.85,radius*.73),(-half,radius*.86),(-half*.81,radius*.96),
               (-half*.51,radius*.992),(0,radius), (half*.51,radius*.992),
               (half*.81,radius*.96),(half,radius*.86),(half*.85,radius*.73)]
    mesh.axial((0,0,0),profile,rubber,dark,steps=48,close=True)
    bead = radius*.78
    mesh.axial((0,0,0),[(-half*.83,bead*.90),(-half*.84,bead),(half*.84,bead),
                         (half*.83,bead*.9)],metal,rim,steps=40,close=True)
    hub = radius*(.27 if bike else .37)
    mesh.axial((0,0,0),[(-half*1.04,hub*.86),(-half*.88,hub),(half*.88,hub),
                         (half*1.04,hub*.86)],metal,rim,steps=20)
    if bike:
        for j in range(32):
            a = j*tau/32
            k = a+(.28 if j%2 else -.28)
            mesh.tube([((-.64 if j%2 else .64)*half,hub*cos(k),hub*sin(k)),
                       (0,bead*.96*cos(a),bead*.96*sin(a))],.0026,metal,(.56,.59,.61),5)
    else:
        mesh.axial((0,0,0),[(-half*.84,bead*.96),(0,hub*.92),(half*.84,bead*.96)],
                   metal,rim,steps=24)
        for direction in (-1,1):
            for j in range(7):
                a=j*tau/7
                mesh.axial((direction*half*1.02,hub*.77*cos(a),hub*.77*sin(a)),
                           [(-.021,.025),(.024,.025)],metal,(.51,.49,.41),6)
    for j in range(40):
        a = j*tau/40
        for side in (-1,1):
            def point(x, angle, r):
                return (x,r*cos(angle),r*sin(angle))
            mesh.paint([point(side*half*f,a+k,radius*(1.004-f*f*.045)) for f,k in
                        ((.12,-.014),(.81,.039),(.76,.070),(.13,.015))],rubber,(.017,.018,.020))


def coil(mesh, start, end, radius, wire, mat, color, turns=7):
    a,b=Vector(start),Vector(end)
    axis=(b-a).normalized()
    u=axis.cross(Vector((1,0,0))).normalized()
    v=u.cross(axis)
    n=turns*9
    mesh.tube([tuple(a.lerp(b,i/n)+radius*(cos(i*tau/9)*u+sin(i*tau/9)*v))
               for i in range(n+1)],wire,mat,color,6)
