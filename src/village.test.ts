import {describe,expect,it} from 'vitest';
import {Group} from 'three';
import {cameraTravel,Colliders,moveThrough} from './collision';
import {advance,LENGTH,paved,road,vehicles,villageLimit,villageOrigin,visit,type Vehicle} from './driving';
import {checkpoint,discover,discoveries,homecomingTarget,newRun,score} from './run';
import {villageHomes,villageJunction,villagePlaces,villageRoadDistance,villageRoads} from './village';
import {buildVillage} from './villageScene';

const base=LENGTH+villageJunction;
const roads=villageRoads.map(road=>road.points.filter((_,index)=>index%4===0||index===road.points.length-1));
const lane=(x:number,d:number)=>[villageOrigin+x,base+d] as const;

describe('Saeedau expansion',()=>{
  it('keeps the two branch directions, track connection and eight-home cluster',()=>{
    const [hospital,goth,track]=villageRoads;
    expect(hospital.points[0]).toEqual(goth.points[0]);
    expect(hospital.points.at(-1)![0]).toBeLessThan(0);
    expect(goth.points.at(-1)![0]).toBeGreaterThan(0);
    expect(villageRoadDistance(...track.points[0],true)).toBeLessThan(0);
    expect(villageRoadDistance(...track.points.at(-1)!,true)).toBeGreaterThan(0);
    expect(villageHomes).toHaveLength(8);
    expect(villageHomes.filter(home=>'markan' in home)).toHaveLength(1);
    expect(villagePlaces[2].x).toBeLessThan(villagePlaces[1].x);
    expect(villagePlaces[3].d).toBeGreaterThan(villagePlaces[1].d);
  });

  it.each(Object.keys(vehicles) as Vehicle[])('can drive the complete village route in the %s',vehicle=>{
    const colliders=new Colliders(),group=new Group();
    buildVillage(group,colliders,(x,d,_,_lines,width,angle=0)=>{
      for(const side of [-1,1]){
        const across=side*width*.37;
        colliders.add({x:villageOrigin+x+across*Math.cos(angle)-.13*Math.sin(angle),
          z:-(base+d)-across*Math.sin(angle)-.13*Math.cos(angle),
          width:.065,length:.065,sin:0,cos:1});
      }
    },'#55514b',.94);
    const run=newRun('explorer');run.leg=6;
    const car={lateral:road(LENGTH-24),position:LENGTH-24,heading:0,speed:0};
    const profile=vehicles[vehicle];
    const wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
    const route=[
      ...Array.from({length:17},(_,index)=>LENGTH-22+index*5).map(d=>[road(d),d] as const),
      ...roads[0].slice(2).map(([x,d])=>lane(x,d)),
      lane(-140,90),lane(-147,86),lane(-151,80),lane(-154,73),lane(-154,94),lane(-156,116),
      lane(-153,101),lane(-154,93),lane(-149,88),lane(-140,90),
      ...[...roads[0]].reverse().map(([x,d])=>lane(x,d)),
      ...roads[1].slice(1).map(([x,d])=>lane(x,d)),
      ...roads[2].slice(1,-1).map(([x,d])=>lane(x,d)),
      lane(99,108),lane(103,113),lane(105,120),
    ];
    try{
      for(const [index,[x,d]] of route.entries()){
        const startAngle=Math.atan2(x-car.lateral,d-car.position);
        const reverse=Math.abs(wrap(startAngle-car.heading))>Math.PI*.53;
        let reached=false;
        for(let step=0;step<420;step++){
          if(Math.hypot(x-car.lateral,d-car.position)<3){reached=true;break;}
          const direction=Math.atan2(x-car.lateral,d-car.position)+(reverse?Math.PI:0);
          const error=wrap(direction-car.heading);
          const steer=Math.max(-1,Math.min(1,error*2.5))*(reverse?-1:1);
          const targetSpeed=Math.abs(error)>.60?2.2:4.8;
          const {lateral,position}=car;
          advance(car,.035,{throttle:!reverse&&car.speed<targetSpeed,reverse:reverse&&car.speed>-targetSpeed,
            brake:Math.abs(car.speed)>targetSpeed+.5,steer},
            vehicle,1,run.leg===7?villageLimit:LENGTH);
          const sin=Math.sin(car.heading),cos=Math.cos(car.heading);
          const move=moveThrough({x:lateral+sin*profile.center,z:-position-cos*profile.center,
            width:profile.width,length:profile.length,sin:-sin,cos},car.lateral-lateral,position-car.position,[colliders]);
          car.lateral=lateral+move.dx;car.position=position-move.dz;
          if(move.impact>.001)car.speed*=.6;
          checkpoint(run,visit(run.leg,car.position,car.lateral));
          discover(run,car);
        }
        expect(reached,`Target ${index} at ${x-villageOrigin}, ${d-base}; car ${car.lateral-villageOrigin}, ${car.position-base}`).toBe(true);
      }
      expect(run.leg).toBe(7);
      expect(discoveries(run.discoveries).slice(-6).map(place=>place.name)).toEqual(villagePlaces.map(place=>place.name));
      expect(paved(...lane(102,105))).toBe(false);
      expect(cameraTravel(villageOrigin+105,-(base+123),18,0,[colliders])).toBeLessThan(1);
    }finally{
      group.traverse(item=>{if('geometry' in item&&'material' in item){
        const mesh=item as import('three').Mesh<import('three').BufferGeometry,import('three').Material>;
        mesh.geometry.dispose();mesh.material.dispose();
      }});
    }
  });

  it('advances the optional homecoming and scores each explorer discovery only once',()=>{
    const journey=newRun('journey'),explorer=newRun('explorer');
    journey.leg=7;
    for(const index of [0,4,5]){
      const place=villagePlaces[index];
      expect(homecomingTarget(journey)).toBe(place.name);
      const [lateral,position]=lane(place.x,place.d);
      const car={lateral,position,speed:0,heading:0};
      discover(journey,car);discover(explorer,car);discover(explorer,car);
    }
    expect(journey.villageStage).toBe(3);
    expect(journey.outcome).toBeNull();
    expect(score(explorer).breakdown.Discoveries).toBe(450);
    for(const mode of ['race','challenge'] as const){
      const run=newRun(mode);run.leg=6;checkpoint(run,7);
      expect(run.outcome).toBe('finished');
    }
  });
});
