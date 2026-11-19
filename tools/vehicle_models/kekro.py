"""Thar GMC-derived 6×6 conversion, with an open, locally decorated cargo bed."""
from math import cos, pi, sin, tau
import bpy
from geometry import Mesh, pivot, wheel


def model(m):
    paint, steel, rubber, glass = (m[k] for k in ('paint','metal','rubber','glass'))
    navy=(.015,.052,.20)
    blue=(.025,.19,.61)
    teal=(.015,.32,.29)
    red=(.63,.037,.022)
    amber=(.95,.48,.04)
    cream=(.9,.73,.39)
    dark=(.045,.056,.058)
    bright=(.53,.49,.39)
    root=pivot('Kekro')
    body=Mesh()
    for x in (-.43,.43):
        body.block((x,-.06,.65),(.15,5.22,.19),steel,dark)
    for y in (-2.47,-1.58,-.51,.79,1.85):
        body.block((0,y,.65),(1.72,.12,.16),steel,dark)
    body.tube([(0,-1.97,.54),(0,-.95,.54),(0,.44,.68),(0,1.44,.53)],.083,steel,dark)
    for y in (1.68,-.99,-1.95):
        body.tube([(-.91,y,.53),(.91,y,.53)],.067,steel,dark)
        body.axial((0,y,.53),[(-.19,.12),(-.12,.18),(.12,.18),(.19,.12)],steel,dark,16)
        for side in (-1,1):
            x=side*.63
            for layer in range(4):
                reach=.48-layer*.065
                h=.022*layer
                body.tube([(x,y-reach,.63-h),(x,y-reach*.5,.55-h),(x,y,.515-h),
                           (x,y+reach*.5,.55-h),(x,y+reach,.63-h)],.017,steel,bright,5)
            body.tube([(side*.68,y,.53),(side*.54,y-.20,.84)],.044,steel,bright)
    body.loft([(1.09,1.22,.63,.25),(1.22,1.24,.57,.31),(1.81,1.20,.51,.29),
               (2.21,1.16,.455,.27),(2.28,1.14,.405,.24)],paint,teal,power=.53)
    body.loft([(-.48,1.27,.81,.34),(-.38,1.26,.91,.39),(.53,1.26,.94,.39),
               (.85,1.24,.87,.37),(1.13,1.27,.73,.30)],paint,blue,power=.24)
    body.loft([(-.53,2.21,.78,.06),(-.39,2.23,.91,.12),(.49,2.22,.92,.12),
               (.81,2.16,.84,.08)],paint,teal,power=.37)
    body.panel([(-.86,-.48,1.51),(.86,-.48,1.51),(.82,-.48,2.20),(-.82,-.48,2.20)],
               (0,.074,0),paint,blue)
    body.loft([(-.38,1.62,.72,.14),(-.25,1.58,.70,.13),(.04,1.48,.70,.11)],
              rubber,(.05,.05,.049),power=.48)
    body.loft([(.76,1.52,.72,.095),(.88,1.52,.70,.098),(.97,1.50,.65,.075)],rubber,dark,power=.35)
    dash=[(.32+.14*cos(i*tau/24),.68+.064*sin(i*tau/24),1.69+.11*sin(i*tau/24)) for i in range(24)]
    body.tube([*dash,dash[0]],.014,rubber,dark,8)
    body.tube([(.32,.77,1.52),(.32,.685,1.684)],.021,steel,dark,10)
    body.block((0,-1.51,.93),(2.07,2.91,.16),paint,navy)
    for i in range(13):
        body.block((-.91+i*.151,-1.52,1.028),(.146,2.79,.031),paint,
                   (.27+i%3*.023,.135+i%3*.013,.057))
    for side in (-1,1):
        x=side*.91
        # Separate swept fenders clear the open wheel wells, with running boards behind.
        body.arch(side*.88,1.68,.51,.595,.63,-.47,3.29,paint,teal)
        body.arch(side*.91,-1.47,.51,1.05,.49,.47,2.67,paint,navy)
        # Rear splashguards follow each wheel rather than bridging the tandem tires.
        for y in (-.99,-1.95):
            body.arch(side*.92,y,.51,.565,.45,.10,3.05,paint,navy)
        body.block((side*.97,.21,.88),(.39,1.07,.08),steel,dark)
        body.block((side*.98,.34,.80),(.27,.29,.045),steel,bright)
        body.block((side*.69,-.37,.72),(.42,.63,.30),paint,navy)
        # Side glass and door skin sit on top of the rounded cab.
        door=[(x,.72,1.93),(side*.95,.28,1.98),(side*.95,-.25,1.94),
              (side*.95,-.29,1.17),(side*.95,.63,1.16),(x,.75,1.39)]
        body.panel(door,(side*.012,0,0),paint,teal)
        win=[(side*.937,.71,1.73),(side*.963,.52,2.048),(side*.969,-.22,2.045),
             (side*.969,-.24,1.74)]
        body.tube([*win,win[0]],.024,paint,navy,8)
        body.paint(win,glass,(.05,.14,.20))
        body.tube([(side*.90,-.40,1.57),(side*.87,-.40,2.23)],.048,paint,blue,8)
        body.tube([(side*.89,.72,1.58),(side*.846,.72,2.18)],.041,paint,blue,8)
        body.tube([(side*.974,-.12,1.61),(side*.985,-.11,1.62),(side*.984,.015,1.62)],
                  .016,steel,bright)
        body.tube([(side*.88,.72,1.7),(side*1.10,.92,1.85),(side*1.13,.92,2.06)],
                  .018,steel,dark)
        body.block((side*1.14,.922,2.03),(.19,.063,.23),paint,navy)
        body.block((side*1.14,.885,2.03),(.14,.014,.18),steel,bright)
        body.tube([(side*.48,1.25,.78),(side*.62,.72,.66),(side*.84,.17,.61),
                   (side*.85,-.45,.61)],.061,steel,dark)
        # Framed cargo boards, rails, and inset painted fields.
        body.block((side*1.04,-1.52,1.42),(.078,2.86,.79),paint,red)
        for j in range(5):
            y=-2.63+j*.56
            body.block((side*1.088,y,1.42),(.025,.49,.65),paint,amber)
            body.block((side*1.105,y,1.42),(.014,.435,.58),paint,blue if j%2==0 else teal)
            side_motif(body,side*1.117,y,1.42,paint,(cream,red,amber))
        for h in (1.025,1.81,1.97):
            body.tube([(side*1.08,-2.94,h),(side*1.08,-.10,h)],.032,paint,cream,8)
        for y in (-2.93,-2.11,-1.25,-.11):
            body.tube([(side*1.072,y,1.04),(side*1.08,y,2.025)],.029,paint,navy,8)
        body.tube([(side*.93,-2.96,.98),(side*.91,-3.02,.63)],.029,steel,bright,8)
        body.block((side*.81,-2.964,.99),(.23,.066,.13),steel,dark)
        body.block((side*.81,-3.004,.99),(.16,.019,.085),paint,red)
    # Rear gate and split, raked windshield.
    body.block((0,-2.935,1.43),(2.10,.09,.78),paint,teal)
    for x in (-.67,0,.67):
        body.block((x,-2.986,1.43),(.6,.018,.61),paint,blue)
        face_motif(body,x,-3.002,1.43,.24,paint,(cream,red,amber),-1)
    for side in (-1,1):
        x=side*.421
        border=[(x-.388,1.121,1.594),(x+.388,1.121,1.594),
                (x+.360,.845,2.136),(x-.360,.845,2.136)]
        body.tube([*border,border[0]],.025,paint,cream,8)
        body.paint(border,glass,(.05,.16,.23))
        body.tube([(x+.09,1.143,1.62),(x-.12,1.046,1.81)],.012,steel,dark,6)
    body.panel([(-.83,1.132,1.575),(.83,1.132,1.575),(.68,1.163,1.48),(-.68,1.163,1.48)],
               (0,-.038,0),paint,navy)
    for j in range(-8,9):
        x=j*.088
        body.paint([(x,1.147,1.521),(x+.043,1.139,1.555),(x+.078,1.147,1.521),
                    (x+.043,1.156,1.491)],paint,amber if j%2 else red)
    body.block((0,2.28,1.135),(1.01,.11,.67),paint,navy)
    body.block((0,2.347,1.135),(.84,.027,.55),steel,dark)
    for j in range(13):
        x=(j-6)*.061
        body.tube([(x,2.376,.89),(x,2.38,1.40)],.012,steel,bright,6)
    for side in (-1,1):
        body.tube([(side*.73,2.13,1.15),(side*.73,2.29,1.15)],.133,steel,bright,24)
        body.tube([(side*.73,2.289,1.15),(side*.73,2.312,1.15)],.109,paint,(.84,.83,.63),24)
        body.tube([(side*.97,2.104,1.06),(side*.97,2.154,1.06)],.052,paint,amber,14)
    body.loft([(2.27,.72,1.11,.135),(2.40,.72,1.16,.147),(2.51,.73,1.14,.132)],
              paint,navy,power=.28)
    for j in range(10):
        x=(j-4.5)*.213
        face_motif(body,x,2.516,.73,.104,paint,(cream,red,amber))
        for offset in (-.045,.045):
            end=.48+(j%3)*.027
            body.tube([(x+offset,2.45,.60),(x+offset*.82,2.43,end)],.008,steel,bright,5)
            body.tube([(x+offset*.82,2.43,end),(x+offset*.82,2.43,end-.03)],.015,paint,amber,7)
    # Arched truck-art crown. Original patterns, no text or logos copied from the photo.
    arch=[(-1.01,.68,2.18),(1.01,.68,2.18),(1.01,.68,2.50)]
    arch += [(1.01*cos(i*pi/32),.68,2.50+.68*sin(i*pi/32)) for i in range(1,33)]
    body.panel(arch,(0,-.086,0),paint,red)
    inset=[(x*.947,.684,2.55+(z-2.55)*.89) for x,_,z in arch]
    body.paint(inset,paint,blue)
    body.tube([*arch,arch[0]],.024,paint,amber,7)
    for x,z,r in [(-.59,2.49,.229),(0,2.72,.333),(.59,2.49,.229),(0,2.30,.112)]:
        face_motif(body,x,.691,z,r,paint,(cream,red,amber))
    for side in (-1,1):
        body.tube([(side*.97,.61,2.45),(side*.91,.22,2.68),(side*.88,-.49,2.59)],.024,paint,navy)
    body.build('Cab, cargo bed, trim and chassis',root)
    tread=Mesh()
    wheel(tread,.51,.35,rubber,steel)
    wheel_mesh=None
    for axle,y in enumerate((1.68,-.99,-1.95)):
        for side,label in ((-1,'L'),(1,'R')):
            steer=pivot('Steer_'+label,(side*.92,y,.51),root) if axle==0 else root
            spin=pivot(f'Wheel_{label}_{axle}',(0,0,0) if axle==0 else (side*.92,y,.51),steer)
            if wheel_mesh is None:
                wheel_mesh=tread.build('Tire, rim and hardware',spin)
            else:
                copy=wheel_mesh.copy()
                bpy.context.collection.objects.link(copy)
                copy.parent=spin
    return root


def motif(mesh, map_point, radius, mat, colors):
    cream,red,amber=colors
    for r,color in [(radius,cream),(radius*.89,red),(radius*.72,(.018,.31,.32))]:
        mesh.paint([map_point(r*cos(i*tau/24),r*sin(i*tau/24)) for i in range(24)],mat,color)
        map_point = raised(map_point)
    points=[]
    for i in range(64):
        a=i*tau/64
        r=radius*(.39+.24*cos(8*a))
        points.append(map_point(r*cos(a),r*sin(a)))
    mesh.paint(points,mat,amber)
    map_point=raised(map_point)
    mesh.paint([map_point(.19*radius*cos(i*tau/12),.19*radius*sin(i*tau/12)) for i in range(12)],mat,cream)


def raised(mapping):
    # Keep each paint layer just above its backing surface.
    def layer(a,b,internal=False):
        x,y,z,dx,dy=mapping(a,b,True)
        point=(x+dx*.002,y+dy*.002,z)
        return (*point,dx,dy) if internal else point
    return layer


def face_motif(mesh,x,y,z,r,mat,colors,direction=1):
    motif(mesh,lambda a,b,internal=False:(x+a,y,z+b,0,direction) if internal else
          (x+a,y,z+b),r,mat,colors)


def side_motif(mesh,x,y,z,mat,colors):
    direction=1 if x>0 else -1
    motif(mesh,lambda a,b,internal=False:(x,y+a,z+b,direction,0) if internal else
          (x,y+a,z+b),.208,mat,colors)
