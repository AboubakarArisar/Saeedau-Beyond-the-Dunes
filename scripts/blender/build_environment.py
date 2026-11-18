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


def settlement():
    for index, plaster in enumerate([(.53,.36,.21),(.55,.49,.37),(.35,.43,.37)]):
        shop = Asset(f'Market{index}',83+index)
        shop.box((0,0,1.16),(5.7,4,2.8),plaster)
        shop.box((0,0,2.58),(5.96,4.22,.23),(.31,.23,.15))
        shop.box((0,-1.83,2.79),(5.72,.33,.45),plaster)
        for door in [-1.39,1.34]:
            for slat in range(16):
                shop.box((door,2.01,.34+slat*.101),(2.22,.045,.096),(.20,.25,.23))
            shop.box((door,2.08,2.15),(2.28,.16,.34),(.22,.29,.26))
        shop.box((0,2.66,.06),(5.75,1.37,.24),(.37,.28,.20))
        for strip in range(14):
            shop.box(((strip-6.5)*.42,2.62,2.03),(.425,1.43,.058),(.53,.24,.13) if strip%2 else (.63,.52,.33))
        for side in [-1,1]:
            shop.tube((side*2.76,3.21,-.12),(side*2.76,3.21,2.02),.052,.046,bark)
        shop.mesh()
    pole = Asset('Utility',92)
    pole.tube((0,0,-.24),(0,0,6.25),.13,.075,(.28,.25,.21),8)
    pole.box((0,0,5.94),(1.28,.10,.11),(.18,.17,.15))
    for side in [-1,1]:
        pole.box((side*.53,0,6.04),(.14,.14,.15),(.32,.28,.19))
    pole.mesh()
    lamp = Asset('Streetlamp',93)
    lamp.tube((0,0,-.25),(0,0,4.7),.088,.052,(.20,.23,.21))
    lamp.tube((0,0,4.7),(.65,0,5.12),.052,.038,(.20,.23,.21))
    lamp.box((.75,0,5.1),(.36,.19,.13),(.56,.55,.41))
    lamp.mesh()
    trough=Asset('Trough',94)
    trough.box((0,0,.04),(2.7,.83,.20),earth)
    for side in [-1,1]:
        trough.box((0,side*.38,.28),(2.77,.15,.55),earth)
        trough.box((side*1.28,0,.28),(.15,.79,.55),earth)
    trough.box((0,0,.24),(2.43,.57,.02),(.16,.25,.24))
    trough.mesh()
    goat=Asset('Goat',95)
    hide=(.63,.51,.37)
    goat.tube((0,-.27,.58),(0,.25,.61),.19,.20,hide,9)
    goat.tube((0,.23,.59),(0,.45,.81),.11,.078,hide)
    goat.tube((0,.42,.81),(0,.62,.76),.092,.051,hide,7)
    for side in [-1,1]:
        for depth in [-.21,.18]:
            goat.tube((side*.106,depth,.54),(side*.12,depth-.04,.035),.047,.022,hide,5)
        goat.tube((side*.05,.47,.84),(side*.086,.37,.98),.025,.007,bark,5)
        goat.tube((side*.05,.47,.79),(side*.15,.46,.74),.032,.009,hide,5)
    goat.tube((0,-.27,.63),(0,-.42,.76),.045,.012,hide,5)
    goat.mesh()
    bike=Asset('ParkedBike',96)
    for depth in [-.59,.59]:
        for radial in range(16):
            a,b=tau*radial/16,tau*(radial+1)/16
            bike.tube((0,depth+.24*cos(a),.26+.24*sin(a)),(0,depth+.24*cos(b),.26+.24*sin(b)),.041,.041,(.045,.041,.033),5)
        for spoke in range(6):
            angle=tau*spoke/6
            bike.tube((0,depth,.26),(0,depth+.22*cos(angle),.26+.22*sin(angle)),.009,.009,(.44,.42,.35),4)
    bike.tube((0,.59,.26),(0,.27,.84),.033,.031,(.47,.45,.38))
    bike.tube((0,-.59,.26),(0,-.15,.64),.042,.035,(.15,.16,.15))
    bike.box((0,.05,.65),(.25,.50,.17),(.48,.09,.046))
    bike.box((0,-.31,.71),(.24,.35,.075),(.042,.037,.034))
    bike.tube((-.23,.27,.91),(.23,.271,.91),.025,.025,(.35,.36,.32))
    bike.mesh()
    jeep=Asset('ParkedJeep',97)
    enamel=(.69,.67,.54)
    trim=(.05,.054,.048)
    jeep.box((0,0,.60),(1.39,3.38,.35),enamel)
    jeep.box((0,.99,.83),(1.39,1.30,.14),enamel)
    jeep.box((0,-.35,1.51),(1.40,.94,.08),enamel)
    jeep.box((0,.06,1.19),(1.34,.07,.53),(.15,.27,.28))
    jeep.box((0,1.69,.72),(1.30,.11,.24),trim)
    for side in [-1,1]:
        jeep.box((side*.70,0,.66),(.035,3.22,.08),(.53,.07,.04))
        jeep.tube((side*.63,-.75,.68),(side*.63,-.75,1.48),.036,.033,trim)
        jeep.tube((side*.63,-.75,1.48),(side*.63,-1.49,1.42),.034,.034,trim)
        jeep.tube((side*.63,-1.49,1.42),(side*.63,-1.49,.65),.034,.04,trim)
        for depth in [-1.02,1.04]:
            jeep.tube((side*.69,depth,.32),(side*.91,depth,.32),.31,.31,trim,14)
            jeep.tube((side*.905,depth,.32),(side*.925,depth,.32),.16,.16,enamel,12)
    jeep.tube((-.63,-1.49,1.42),(.63,-1.49,1.42),.034,.034,trim)
    jeep.mesh()


def export(folder, create):
    bpy.ops.object.select_all(action='DESELECT')
    create()
    target = root / folder / 'kit.glb'
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True)


export('houses', lambda: [house(index) for index in range(3)])
export('vegetation', lambda: [plant(kind, index) for kind in ('Kandi','Khumbat','Karir','Khimp') for index in range(3)])
export('roadside', roadside)
export('settlement', settlement)
