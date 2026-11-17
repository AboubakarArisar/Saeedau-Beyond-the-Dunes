import bpy
from math import cos, sin, tau
from mathutils import Vector
from pathlib import Path
from random import Random

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
root = Path(__file__).resolve().parents[2] / 'public' / 'assets'
paint = bpy.data.materials.new('Weathered earth and foliage')
paint.use_nodes = True
nodes = paint.node_tree.nodes
color = nodes.new('ShaderNodeVertexColor')
color.layer_name = 'Tint'
paint.node_tree.links.new(color.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
nodes.get('Principled BSDF').inputs['Roughness'].default_value = .94


class Asset:
    def __init__(self, name, seed):
        self.name, self.rng = name, Random(seed)
        self.points, self.faces, self.colors = [], [], []

    def face(self, points, tint, scatter=.1):
        index = len(self.points)
        self.points.extend(points)
        self.faces.append(range(index, index + len(points)))
        shade = self.rng.uniform(1-scatter, 1+scatter)
        self.colors.append(tuple(value*shade for value in tint) + (1,))

    def tube(self, start, end, lower, upper, tint, sides=6):
        start, end = Vector(start), Vector(end)
        axis = (end-start).normalized()
        right = axis.cross(Vector((0, 1, 0))).normalized()
        across = axis.cross(right)
        radial = [right*cos(tau*i/sides)+across*sin(tau*i/sides) for i in range(sides)]
        for i in range(sides):
            a, b = radial[i], radial[(i+1)%sides]
            self.face((start+a*lower,start+b*lower,end+b*upper,end+a*upper), tint)

    def box(self, center, size, tint):
        x,y,z = center
        w,d,h = (part/2 for part in size)
        corners = [(x+i*w,y+j*d,z+k*h) for k in [-1,1] for j in [-1,1] for i in [-1,1]]
        for face in [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]:
            self.face([corners[i] for i in face], tint)

    def mesh(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.points, [], self.faces)
        mesh.update()
        tint = mesh.color_attributes.new(name='Tint', type='FLOAT_COLOR', domain='CORNER')
        for polygon, shade in zip(mesh.polygons,self.colors):
            for index in polygon.loop_indices:
                tint.data[index].color = shade
        obj = bpy.data.objects.new(self.name,mesh)
        obj.data.materials.append(paint)
        bpy.context.collection.objects.link(obj)
        obj.select_set(True)


earth = (.43,.265,.135)
straw = (.26,.224,.153)
bark = (.142,.089,.049)


def house(seed):
    asset = Asset(f'Chounra{seed}', seed)
    radius = 1.58 + seed*.14
    wall = 1.55 + .09*seed
    angles = [tau*i/40 for i in range(40)]
    for i, angle in enumerate(angles):
        next_angle = angles[(i+1)%40]
        point = lambda a,r,z: (r*cos(a),r*sin(a),z)
        door = 8 <= i <= 11
        asset.face([point(angle,radius,-.55 if not door else 1.17),
                    point(next_angle,radius,-.55 if not door else 1.17),
                    point(next_angle,radius,wall),point(angle,radius,wall)],earth,.055)
    asset.box((0,radius*.72,.58),(.75,.09,1.16),(.059,.038,.024))
    asset.box((0,radius+.23,-.04),(1.12,.68,.18),earth)
    for row in range(10):
        lower, upper = row/10, (row+1)/10
        for i in range(84):
            alpha,beta = tau*i/84,tau*(i+1)/84
            def roof(angle, height):
                ring = (radius+.36)*(1-height)**1.25+.035
                fringe = .034*(1-height)*sin(angle*59)
                return (ring*cos(angle),ring*sin(angle),wall-.12+height*(1.83+.13*seed)+fringe)
            seam = lower + .023
            asset.face([roof(alpha,lower),roof(beta,lower),
                        roof(beta,seam),roof(alpha,seam)],(.20,.169,.114),.17)
            asset.face([roof(alpha,seam),roof(beta,seam),
                        roof(beta,upper),roof(alpha,upper)],straw,.17)
    asset.mesh()


def plant(kind, seed):
    asset = Asset(f'{kind}{seed}', seed*997+len(kind)*41)
    rng = asset.rng
    tree = kind in ('Kandi','Khumbat')
    origin = Vector((0,0,-.15))
    fork = Vector((.11+seed*.1,-.19,1.2 if tree else .12))
    if tree:
        elbow = Vector((-.13,.08,.63))
        asset.tube(origin,elbow,.24,.16,bark)
        asset.tube(elbow,fork,.16,.135,bark)
    else:
        asset.tube(origin,fork,.036,.021,bark)
    for branch in range(8 if tree else 28):
        angle = branch*2.399 + rng.uniform(-.35,.35)
        spread = rng.uniform(.8,1.8) if tree else rng.uniform(.19,.70)
        height = rng.uniform(1.1,2.8) if tree else rng.uniform(.4,1.24)
        tip = fork+Vector((cos(angle)*spread,sin(angle)*spread,height))
        elbow = fork+(tip-fork)*.55+Vector((0,0,.23 if tree else .06))
        green = (.19,.24,.082) if kind=='Karir' else (.22,.28,.102)
        tint = bark if tree else green
        width = .09 if tree else .018
        asset.tube(fork,elbow,width,width*.61,tint)
        asset.tube(elbow,tip,width*.61,width*.13,tint,5)
        for index in range(5 if tree else 2):
            end = tip+Vector((rng.uniform(-.69,.69),rng.uniform(-.69,.69),rng.uniform(-.3,.44)))*(1 if tree else .48)
            asset.tube(elbow.lerp(tip,(index+1)/6),end,width*.31,.004,tint,4)
            if not tree:
                continue
            for leaf in range(23 if kind=='Kandi' else 15):
                center = end+Vector((rng.uniform(-.44,.44),rng.uniform(-.44,.44),rng.uniform(-.22,.22)))
                angle = rng.uniform(0,tau)
                size = rng.uniform(.078,.22)
                side = Vector((cos(angle)*size,sin(angle)*size,0))
                lift = Vector((-sin(angle)*size*.3,cos(angle)*size*.3,size*.62))
                asset.face([center-side,center-side*.4+lift*.48,center+side*.48+lift*.37,
                            center+side,center+side*.28-lift*.48,center-side*.45-lift*.37],green,.34)
    asset.mesh()


def roadside():
    wall = Asset('Wall', 71)
    for i in range(7):
        wall.box((0,i*.52-1.56,.14),(.43,.56,.83+wall.rng.uniform(-.09,.12)),earth)
    wall.mesh()
    stall = Asset('TeaStall', 86)
    stall.box((0,0,.84),(3.65,2.4,2.77),earth)
    stall.box((0,1.22,1.47),(2.51,.09,1.08),(.075,.054,.036))
    stall.box((0,1.52,.95),(2.83,.76,.11),(.27,.18,.09))
    for i in range(13):
        stall.box(((i-6)*.33,1.28,2.29),(.335,2.25,.08),(.31,.32,.28))
    for side in [-1,1]:
        stall.tube((side*1.91,2.26,-.2),(side*1.91,2.26,2.31),.07,.052,bark)
    for i in range(4):
        stall.box(((i-1.5)*.46,1.39,1.063),(.105,.12,.115),(.51,.28,.088))
    stall.mesh()
    bed = Asset('Charpai', 88)
    for x in [-.83,.83]:
        for y in [-.38,.38]:
            bed.tube((x,y,-.06),(x,y,.47),.056,.058,bark)
    for i in range(36):
        bed.box(((i-17.5)*.047,0,.42),(.029,.79,.028),(.42,.30,.16))
    for y in [-.40,.40]:
        bed.box((0,y,.42),(1.82,.079,.07),bark)
    bed.mesh()
    pot = Asset('ClayPot', 61)
    tint = (.49,.201,.096)
    for (low,base),(high,top) in zip([(0,.14),(.15,.26),(.36,.28),(.49,.14),(.54,.16)],
                                    [(.15,.26),(.36,.28),(.49,.14),(.54,.16),(.58,.15)]):
        pot.tube((0,0,low),(0,0,high),base,top,tint,16)
    pot.tube((0,0,.58),(0,0,.50),.127,.113,(.13,.063,.031),16)
    pot.mesh()


def export(folder, create):
    bpy.ops.object.select_all(action='DESELECT')
    create()
    target = root / folder / 'kit.glb'
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True)


export('houses', lambda: [house(index) for index in range(3)])
export('vegetation', lambda: [plant(kind, index) for kind in ('Kandi','Khumbat','Karir','Khimp') for index in range(3)])
export('roadside', roadside)
