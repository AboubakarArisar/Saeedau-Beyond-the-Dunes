"""Red 70 cc commuter with independently rigged fork and spoked wheels."""
from math import cos, pi, sin
import bpy
from geometry import Mesh, coil, pivot, wheel


def model(m):
    paint,metal,rubber,glass=(m[k] for k in ('paint','metal','rubber','glass'))
    black=(.033,.035,.039)
    vinyl=(.023,.025,.028)
    chrome=(.70,.74,.76)
    alloy=(.50,.53,.55)
    iron=(.136,.145,.15)
    red=(.55,.018,.024)
    amber=(.92,.275,.018)
    white=(.88,.88,.77)
    front_y,rear_y,r=.633,-.576,.304
    root=pivot('Unique 70')
    chassis=Mesh()
    # Pressed backbone and tubular cradle, open around the horizontal engine.
    chassis.loft([(-.72,.637,.069,.034),(-.54,.645,.084,.035),(-.15,.66,.086,.046),
                  (.27,.71,.069,.05),(.42,.771,.039,.083)],paint,black,count=16,power=.63)
    for s in (-1,1):
        chassis.tube([(s*.083,-.56,.643),(s*.091,-.30,.649),(s*.079,-.139,.437),
                      (s*.066,-.012,.361),(s*.047,.27,.388),(s*.039,.406,.728)],.022,paint,black,10)
        chassis.tube([(s*.079,-.14,.378),(s*.091,rear_y,.306)],.033,paint,black,10)
        a=(s*.111,rear_y+.026,.339)
        b=(s*.106,-.323,.638)
        chassis.tube([a,b],.015,metal,chrome)
        chassis.tube([a,lerp(a,b,.37)],.025,metal,alloy)
        coil(chassis,lerp(a,b,.27),lerp(a,b,.91),.027,.0055,metal,chrome)
        chassis.tube([(s*.091,-.14,.353),(s*.203,-.14,.353)],.017,metal,iron,10)
        chassis.tube([(s*.133,-.14,.353),(s*.214,-.14,.353)],.023,rubber,vinyl,12)
        chassis.tube([(s*.082,-.37,.38),(s*.177,-.37,.38)],.014,metal,chrome,8)
        chassis.tube([(s*.135,-.37,.38),(s*.184,-.37,.38)],.019,rubber,black,10)

    # Sculpted tank. Section radii swell near the steering head and taper into the saddle.
    sections=[
        (-.263,.701,.042,.039),(-.224,.722,.070,.058),(-.125,.749,.092,.076),
        (0,.779,.102,.091),(.122,.798,.113,.099),(.241,.805,.108,.098),
        (.322,.793,.089,.088),(.376,.764,.060,.063),(.393,.749,.039,.045),
    ]
    chassis.loft(sections,paint,red,count=36,power=.66)
    for side in (-1,1):
        stripe(chassis,sections,side,-.188,.335,-.51,.16,paint,(.125,.025,.031))
        stripe(chassis,sections,side,-.169,.327,-.32,.052,paint,(.81,.67,.37))
        stripe(chassis,sections,side,-.139,.30,-.205,.037,paint,(.84,.85,.78))
        stripe(chassis,sections,side,-.108,.271,-.39,.036,paint,(.14,.29,.42))
    chassis.tube([(0,.112,.888),(0,.112,.91)],.036,metal,chrome,22)

    # Long padded saddle with low roll at the nose, piping and passenger grab rail.
    chassis.loft([(-.805,.765,.092,.035),(-.778,.771,.129,.052),(-.69,.77,.135,.057),
                  (-.43,.759,.124,.052),(-.285,.746,.106,.045),(-.165,.73,.071,.038)],
                 rubber,vinyl,count=28,power=.51)
    for side in (-1,1):
        chassis.tube([(side*.091,-.806,.743),(side*.133,-.757,.735),(side*.126,-.50,.726),
                      (side*.103,-.286,.719),(side*.069,-.172,.706)],.0036,paint,(.235,.24,.238),6)
    chassis.tube([(-.104,-.595,.692),(-.132,-.747,.696),(-.122,-.814,.735),
                  (-.096,-.837,.81),(.096,-.837,.81),(.122,-.814,.735),
                  (.132,-.747,.696),(.104,-.595,.692)],.013,metal,chrome,12)
    chassis.loft([(-.485,.596,.069,.026),(-.455,.584,.093,.059),(-.32,.554,.109,.094),
                  (-.186,.544,.101,.099),(-.11,.577,.077,.063)],
                 paint,(.285,.019,.024),count=20,power=.53)
    for side in (-1,1):
        x=side*.107
        chassis.paint([(x,-.33,.61),(x,-.211,.626),(x,-.235,.601),
                       (x,-.359,.575)],paint,(.75,.64,.40))
        chassis.paint([(x+side*.001,-.307,.586),(x+side*.001,-.213,.605),
                       (x+side*.001,-.243,.583),(x+side*.001,-.336,.56)],paint,(.67,.72,.75))
    # Shaped crankcase, machined inspection covers and forward-facing fin stack.
    chassis.loft([(-.175,.36,.054,.031),(-.143,.368,.093,.064),(-.071,.38,.112,.091),
                  (.012,.39,.112,.089),(.081,.41,.083,.071),(.108,.429,.061,.048)],
                 metal,alloy,count=28,power=.69)
    for s in (-1,1):
        x=s*.108
        chassis.axial((x,-.033,.386),[(-.008,.075),(-.002,.079),(.002,.079),(.008,.075)],
                       metal,(.66,.68,.69),28)
        chassis.axial((s*.119,-.034,.387),[(-.004,.035),(.004,.034)],metal,chrome,24)
        for i in range(5):
            a=i*2*pi/5
            chassis.axial((s*.122,-.033+.058*cos(a),.386+.058*sin(a)),[(-.007,.005),(.007,.005)],
                           metal,iron,6)
    for i in range(10):
        y=.064+i*.014
        z=.418+i*.0040
        radius=.059+(i/10)*.013
        chassis.loft([(y-.003,z,radius*.98,radius*.78),(y+.003,z,radius,radius*.80)],
                     metal,iron,count=16,power=.49)
    chassis.loft([(.193,.459,.065,.053),(.228,.464,.077,.066),(.255,.461,.067,.057),
                  (.27,.452,.053,.040)],metal,alloy,count=20,power=.47)
    chassis.tube([(0,.214,.51),(0,.238,.559),(-.02,.239,.571)],.012,metal,chrome,8)
    chassis.tube([(0,.239,.567),(-.03,.211,.59),(-.052,.111,.622)],.007,rubber,vinyl,6)
    chassis.tube([(-.015,.079,.486),(-.016,.036,.548),(-.017,-.048,.581)],.024,metal,alloy)
    chassis.tube([(.057,.23,.431),(.082,.26,.366),(.116,.205,.291),
                  (.138,.101,.258),(.143,-.151,.248),(.147,-.347,.241)],
                 .0165,metal,chrome,16)
    exhaust=Mesh()
    exhaust.loft([(-.825,.267,.029,.023),(-.805,.266,.036,.029),(-.588,.254,.041,.035),
                  (-.404,.246,.037,.029),(-.337,.246,.021,.019)],
                 metal,chrome,count=26,power=.91)
    exhaust.tube([(0,-.833,.266),(0,-.830,.266)],.017,rubber,vinyl,16)
    exhaust.build('Tapered chrome muffler',root).location.x=.146
    chain=[(-.111,-.649,.324),(-.111,-.609,.371),(-.111,-.14,.396),
           (-.111,-.115,.326),(-.111,-.59,.28)]
    chassis.panel(chain,(-.027,0,0),paint,black)
    chassis.tube([(-.081,-.167,.335),(-.109,-.314,.196),(-.128,-.437,.16)],
                 .011,metal,iron,8)
    chassis.tube([(.102,-.088,.393),(.165,-.096,.325),(.174,-.163,.317)],
                 .01,metal,chrome,8)
    chassis.tube([(-.137,-.124,.348),(-.148,-.023,.337),(-.175,-.019,.337)],
                 .007,metal,chrome,8)
    chassis.arch(0,rear_y,r,.338,.142,1.02,3.68,metal,chrome)
    chassis.panel([(-.052,-.886,.435),(.052,-.886,.435),(.044,-.928,.293),(-.044,-.928,.293)],
                  (0,.012,0),rubber,black)
    chassis.loft([(-.929,.566,.068,.029),(-.914,.57,.078,.044),(-.876,.57,.073,.047)],paint,red,18,.43)
    chassis.loft([(-.876,.57,.077,.049),(-.845,.566,.072,.047)],paint,black,18,.46)
    for side in (-1,1):
        chassis.tube([(side*.055,-.797,.562),(side*.146,-.812,.561)],.013,rubber,black,8)
        chassis.tube([(side*.147,-.816,.56),(side*.147,-.842,.56)],.028,paint,amber,14)
    chassis.build('Frame, tank, saddle and powertrain',root)

    axis=(0,.398,.799)
    handle=pivot('Steer_Front',axis,root)
    front=Mesh()
    for side in (-1,1):
        x=side*.068
        front.tube([(x,front_y,r),(x,.552,.495),(x,.482,.655)],.022,metal,alloy,14)
        front.tube([(x,.526,.556),(x,.472,.692),(x,.405,.813)],.013,metal,chrome,12)
        front.tube([(x,.490,.674),(x,.468,.708)],.018,rubber,black,10)
    front.tube([(-.084,.428,.765),(.084,.428,.765)],.019,metal,iron,10)
    front.arch(0,front_y,r,.331,.101,-.33,2.54,metal,chrome,count=30)
    front.tube([(-.048,.599,.625),(-.069,.602,.563)],.007,metal,iron,8)
    front.tube([(.048,.599,.625),(.069,.602,.563)],.007,metal,iron,8)
    front.loft([(.41,.815,.083,.058),(.464,.822,.086,.056),(.506,.82,.084,.056)],paint,black,20,.35)
    front.loft([(.498,.821,.086,.056),(.516,.821,.084,.054)],metal,chrome,20,.35)
    front.loft([(.517,.821,.076,.046),(.522,.821,.074,.044)],paint,white,20,.35)
    for side in (-1,1):
        front.tube([(side*.014,.414,.829),(side*.086,.408,.853),(side*.167,.374,.912),
                    (side*.243,.353,.92),(side*.329,.343,.913)],.012,metal,chrome)
        front.tube([(side*.257,.350,.917),(side*.347,.341,.911)],.019,rubber,black,12)
        front.tube([(side*.229,.363,.905),(side*.285,.413,.904),(side*.347,.418,.893)],.005,metal,chrome,8)
        front.tube([(side*.219,.368,.921),(side*.231,.372,1.032),(side*.281,.387,1.119)],.008,metal,chrome,8)
        mirror=Mesh()
        mirror.loft([(.365,1.127,.042,.027),(.373,1.127,.047,.030),(.404,1.131,.043,.029)],
                    paint,black,20,.52)
        mirror.loft([(.363,1.127,.041,.024),(.364,1.127,.043,.026)],metal,(.36,.42,.45),20,.52)
        mirror.build('Mirror housing and reflector',handle).location=(side*.282,-axis[1],-axis[2])
        front.tube([(side*.071,.459,.766),(side*.159,.476,.769)],.012,paint,black,10)
        front.tube([(side*.159,.485,.771),(side*.159,.510,.771)],.026,paint,amber,16)
    front.loft([(.382,.909,.064,.036),(.421,.903,.07,.04),(.456,.894,.063,.036)],paint,black,20,.44)
    front.panel([(-.052,.387,.937),(.052,.387,.937),(.047,.447,.929),(-.047,.447,.929)],
                (0,0,.002),glass,(.09,.16,.18))
    for tick in range(9):
        x=(tick-4)*.009
        front.paint([(x,.399,.939),(x+.0015,.399,.939),(x+.001,.407,.938),(x,.407,.938)],
                    paint,white)
    front.tube([(.229,.364,.901),(.16,.445,.80),(.105,.41,.75),(.062,.354,.65)],.005,rubber,black,7)
    front.build('Steering head, forks, front fender and controls',handle).location=(0,-axis[1],-axis[2])
    # Tire spin remains local X, even when the entire front rig yaws.
    wheels=Mesh()
    wheel(wheels,r,.070,rubber,metal,bike=True)
    rear=pivot('Wheel_Rear',(0,rear_y,r),root)
    first=wheels.build('Spoked wheel and tread',rear)
    spin=pivot('Wheel_Front',(0,front_y-axis[1],r-axis[2]),handle)
    duplicate=first.copy()
    bpy.context.collection.objects.link(duplicate)
    duplicate.parent=spin
    return root


def lerp(a,b,t):
    return tuple(x+(y-x)*t for x,y in zip(a,b))


def stripe(mesh,sections,side,start,end,level,width,mat,color):
    def point(y,t):
        for a,b in zip(sections,sections[1:]):
            if a[0]<=y<=b[0]:
                _,z,w,h=lerp(a,b,(y-a[0])/(b[0]-a[0]))
                return (side*(w*(1-abs(t)**(2/.66))**(.66/2)+.0028),y,z+h*t)
        raise ValueError(y)
    samples=16
    edges=[point(start+(end-start)*i/samples,level+.47*(i/samples)**1.35+
                 direction*width*(.14+.86*sin(pi*i/samples))) for direction in (-1,1) for i in range(samples+1)]
    faces=[(i,i+1,i+samples+2,i+samples+1) for i in range(samples)]
    mesh.add(edges,faces,mat,color,smooth=True)
