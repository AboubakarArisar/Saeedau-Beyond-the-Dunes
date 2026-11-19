"""Build the helmeted Unique 70 rider and its editable Blender source."""
from math import cos, pi, sin, sqrt, tau
from pathlib import Path
import sys
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
sys.path.insert(0,str(HERE))
sys.dont_write_bytecode=True
from geometry import Mesh, material, pivot, signed_power

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
fabric=material('Clothing and gear',(1,1,1),.7,painted=True)
shell=material('Helmet shell and visor',(1,1,1),.29,.25,painted=True)
shirt=(.095,.24,.29)
seam=(.12,.30,.35)
trouser=(.47,.405,.32)
sole=(.038,.031,.025)
shoe=(.102,.064,.038)
glove=(.073,.068,.058)
root=pivot('Unique rider')


def form(mesh,sections,paint,color,power=.72,segments=20):
    """Vertical fitted sections: height, center X/Y, oval half-width/depth."""
    rows=[]
    for z,x,y,w,d in sections:
        rows.append([(x+w*signed_power(cos(i*tau/segments),power),
                      y+d*signed_power(sin(i*tau/segments),power),z)
                     for i in range(segments)])
    mesh.rings(rows,paint,color)


lower=Mesh()
form(lower,[(.79,0,-.391,.124,.101),(.83,0,-.375,.155,.12),
            (.935,0,-.36,.148,.1),(.974,0,-.345,.136,.085)],fabric,trouser)
for side in (-1,1):
    x=side
    lower.tube([(x*.091,-.39,.875),(x*.129,-.271,.814),(x*.155,-.13,.712),
                (x*.154,.015,.604),(x*.162,-.042,.52),(x*.156,-.15,.408)],
               [.087,.08,.071,.061,.054,.043],fabric,trouser,16)
    lower.tube([(x*.167,-.13,.454),(x*.163,-.15,.408)],.044,fabric,(.39,.33,.26),14)
    form(lower,[(.355,x*.176,-.12,.052,.107),(.375,x*.176,-.106,.052,.109),
                (.417,x*.163,-.125,.042,.082),(.454,x*.16,-.15,.039,.052)],
         fabric,shoe,.43,16)
    form(lower,[(.351,x*.176,-.115,.052,.109),(.369,x*.176,-.115,.055,.111)],
         fabric,sole,.49,16)
lower.build('Seated shalwar and shoes',root)

body=pivot('RiderBody',(0,-.35,.866),root)
torso=Mesh()
form(torso,[(-.043,0,-.027,.145,.10),(.027,0,0,.151,.104),
            (.11,0,.012,.133,.091),(.215,0,.042,.134,.087),
            (.305,0,.076,.16,.089),(.381,0,.107,.162,.082),
            (.411,0,.12,.129,.065),(.438,0,.13,.067,.049)],fabric,shirt,.69)
form(torso,[(.421,0,.125,.053,.046),(.457,0,.132,.053,.044)],fabric,seam)
torso.tube([(0,.182,.423),(0,.187,.371),(0,.168,.30),(0,.145,.224)],.006,fabric,seam,7)
for z,y in [(.38,.19),(.342,.188),(.303,.176)]:
    torso.tube([(0,y-.002,z),(0,y+.004,z)],.008,fabric,(.17,.36,.39),8)
torso.build('Sateen kameez',body)

head=pivot('RiderHead',(0,.129,.445),body)
helmet=Mesh()
form(helmet,[(-.019,0,0,.039,.038),(.044,0,.009,.046,.043)],fabric,(.32,.19,.12))
form(helmet,[(.017,0,.009,.069,.078),(.048,0,.007,.098,.103),(.118,0,-.012,.106,.113),
             (.178,0,-.019,.087,.094),(.219,0,-.024,.052,.063),(.233,0,-.024,.012,.016)],
     shell,(.058,.079,.087),.84,28)
visor=[]
for z,width,depth in [(.08,.09,.109),(.127,.102,.116),(.17,.087,.101)]:
    visor.append([(width*sin(a),-.009+depth*cos(a),z+.021*(1-cos(a)))
                  for a in [-1.23+i*2.46/20 for i in range(21)]])
helmet.rings(visor,shell,(.13,.258,.305),caps=False)
for side in (-1,1):
    helmet.tube([(side*.079,.058,.057),(side*.102,.028,.078),(side*.101,-.002,.109)],.006,
                fabric,(.31,.42,.43),8)
helmet.build('Full-face helmet with tinted visor',head)

for label in ['L','R']:
    upper=pivot('RiderUpper'+label,parent=root)
    lower=pivot('RiderFore'+label,parent=root)
    hand=pivot('RiderHand'+label,parent=root)
    upper_mesh=Mesh()
    form(upper_mesh,[(-.039,0,0,.031,.039),(-.012,0,0,.062,.064),(.068,0,0,.062,.064),
                     (.165,0,0,.050,.057),(.245,0,0,.047,.049),(.28,0,0,.044,.046)],
         fabric,shirt,segments=16)
    upper_mesh.build('Fitted upper sleeve '+label,upper)
    fore=Mesh()
    form(fore,[(-.035,0,0,.04,.041),(.026,0,0,.047,.047),(.10,0,0,.049,.042),
               (.20,0,0,.034,.031),(.253,0,0,.031,.03),(.265,0,0,.03,.029)],fabric,shirt,segments=16)
    form(fore,[(.239,0,0,.032,.033),(.265,0,0,.032,.031)],fabric,seam,segments=16)
    fore.build('Tapered lower sleeve '+label,lower)
    palm=Mesh()
    form(palm,[(-.029,0,0,.027,.026),(-.008,0,0,.039,.032),(.024,0,0,.038,.034),
               (.046,0,-.008,.027,.029)],fabric,glove,segments=16)
    palm.tube([(-.019,.025,.008),(-.029,.037,-.009),(-.021,.036,-.025)],.012,fabric,glove,8)
    palm.build('Gloved hand '+label,hand)
    # Bake the neutral pose so the editable source opens ready to inspect.
    side=-1 if label=='L' else 1
    shoulder=Vector((side*.145,-.186,1.191))
    grip=Vector((side*.3,.347,.915))
    axis=grip-shoulder
    reach=axis.length
    axis.normalize()
    length=max(.64,reach+.011)
    a,b=length*.52,length*.48
    projection=(a*a-b*b+reach*reach)/(2*reach)
    bend=Vector((side*.55,0,-1))
    bend=(bend-axis*bend.dot(axis)).normalized()
    elbow=shoulder+axis*projection+bend*sqrt(max(0,a*a-projection*projection))
    for node,start,end,rest in [(upper,shoulder,elbow,.28),(lower,elbow,grip,.265)]:
        direction=end-start
        node.location=start
        node.rotation_mode='QUATERNION'
        node.rotation_quaternion=Vector((0,0,1)).rotation_difference(direction.normalized())
        node.scale.z=direction.length/rest
    hand.location=grip
    hand.rotation_euler.x=pi/2

bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-src/vehicles/unique70-rider.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/vehicles/unique70-rider.glb'),export_format='GLB',
                         export_animations=False,export_yup=True)
