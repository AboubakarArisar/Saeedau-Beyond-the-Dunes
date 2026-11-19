import {describe,expect,it} from 'vitest';
import {Group} from 'three';
import {Colliders,moveThrough} from './collision';
import {advance,checkpoints,LENGTH,paved,vehicles,villageLimit,type Vehicle} from './driving';
import {followJourney,journeyLocations,journeyProgress,planJourney} from './customJourney';
import {buildVillage} from './villageScene';

describe('Custom Journey',()=>{
  const trips=[
    ['Hingorao','Saeedau'],['Saeedau','Hingorao'],['Umerkot','Chhor'],
    ['Chhor','Dodhar'],['Umerkot','Saeedau'],['Hospital','School'],
    ['Saeedau','Markan Faqeer House'],['Markan Faqeer House','Saeedau Junction'],
    ['Siddique Faqeer Goth','Hospital'],
  ];
  it.each(trips)('follows the road from %s to %s and requires ordered arrival',(from,to)=>{
    const route=planJourney({from,to})!;
    const back=planJourney({from:to,to:from})!;
    expect(route.length).toBeCloseTo(back.length,8);
    expect(route.points).toEqual([...back.points].reverse());
    const {spawn,points}=route;
    const first=points[1];
    expect(Math.sin(spawn.heading)*(first.lateral-spawn.lateral)+
      Math.cos(spawn.heading)*(first.position-spawn.position)).toBeGreaterThan(0);
    const last=points.at(-1)!;
    const progress=journeyProgress(route);
    if(route.length>12){
      expect(followJourney(route,progress,spawn,{...spawn,...last})).toBe(false);
      expect(progress.gate).toBe(1);
    }
    const trip=journeyProgress(route);
    for(let gate=1;gate<points.length;gate++){
      const arrived=followJourney(route,trip,points[gate-1],{...spawn,...points[gate]});
      if(arrived)expect(Math.hypot(last.lateral-points[gate].lateral,last.position-points[gate].position)).toBeLessThanOrEqual(3);
    }
    expect(trip.remaining).toBe(0);
    expect(trip.driven).toBeCloseTo(route.length);
  });

  it.each(['jeep','kekro','unique'] as const)('drives from Saeedau to Markan Faqeer House using %s physics',(vehicle:Vehicle)=>{
    const route=planJourney({from:'Saeedau',to:'Markan Faqeer House'})!;
    const car={...route.spawn},trip=journeyProgress(route),dt=1/75;
    const profile=vehicles[vehicle];
    const colliders=new Colliders(),geometry=new Group();
    buildVillage(geometry,colliders,()=>{},'#555555',.8);
    try{
      for(let step=0;step<9000;step++){
        const before={...car};
        const next=route.points[trip.gate];
        const angle=Math.atan2(next.lateral-car.lateral,next.position-car.position)-car.heading;
        const error=Math.atan2(Math.sin(angle),Math.cos(angle));
        const pace=Math.abs(error)>.35?4.2:7;
        advance(car,dt,{throttle:car.speed<pace,brake:car.speed>pace+.15,
          reverse:false,steer:Math.max(-1,Math.min(1,error*3))},vehicle,1,villageLimit);
        const sin=Math.sin(car.heading),cos=Math.cos(car.heading);
        const movement=moveThrough({x:before.lateral+sin*profile.center,z:-before.position-cos*profile.center,
          width:profile.width,length:profile.length,sin:-sin,cos},
          car.lateral-before.lateral,before.position-car.position,[colliders]);
        car.lateral=before.lateral+movement.dx;car.position=before.position-movement.dz;
        if(followJourney(route,trip,before,car))break;
      }
      expect(trip.remaining,JSON.stringify({vehicle,car,trip})).toBe(0);
    }finally{disposeVillage(geometry);}
  });

  it('rejects identical or unknown stops and uses connected village approaches',()=>{
    for(const from of journeyLocations)expect(planJourney({from,to:from})).toBeUndefined();
    expect(planJourney({from:'Unknown',to:'Saeedau'})).toBeUndefined();
    const route=planJourney({from:'School',to:'Markan Faqeer House'})!;
    expect(route.points.flatMap(point=>point.name??[])).toEqual([
      'School','Hospital','Saeedau Junction','Siddique Faqeer Goth','Markan Faqeer House',
    ]);
    const colliders=new Colliders(),geometry=new Group();
    buildVillage(geometry,colliders,()=>{},'#555555',.8);
    try{
      for(const from of journeyLocations){
        const {spawn}=planJourney({from,to:from==='Chhor'?'Saeedau':'Chhor'})!;
        if(spawn.position<=LENGTH)expect(paved(spawn.lateral,spawn.position)).toBe(true);
        for(const profile of Object.values(vehicles)){
          const x=spawn.lateral+Math.sin(spawn.heading)*profile.center;
          const d=spawn.position+Math.cos(spawn.heading)*profile.center;
          expect(colliders.obstructs(x,-d,Math.hypot(profile.width,profile.length)),from).toBe(false);
        }
      }
    }finally{disposeVillage(geometry);}
    expect(planJourney({from:'Hingorao',to:'Saeedau'})?.spawn.position).toBe(checkpoints[6]);
  });
});

function disposeVillage(group:Group){
  group.traverse(object=>{
    if('geometry' in object&&'material' in object){
      const {geometry,material}=object as import('three').Mesh;
      geometry.dispose();
      for(const entry of Array.isArray(material)?material:[material])entry.dispose();
    }
  });
}