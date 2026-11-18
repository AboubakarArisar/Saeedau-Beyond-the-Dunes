import {describe,expect,it} from 'vitest';
import {advance,checkpoints,dampHeading,LENGTH,road,start,stops,vehicles,visit,type Vehicle} from './driving';
import {Colliders,moveThrough} from './collision';

const throttle={throttle:true,reverse:false,steer:0,brake:false};

describe('desert journey',()=>{
  it('sweeps every vehicle through the grid without tunneling through a thin barrier',()=>{
    const grid=new Colliders();
    grid.add({x:0,z:-20,width:6,length:.11,sin:0,cos:1});
    for(const {width,length} of Object.values(vehicles)){
      const vehicle={x:0,z:0,width,length,sin:0,cos:1};
      const result=moveThrough(vehicle,3,-40,[grid]);
      expect(result.dz).toBeGreaterThan(-20+.11+length);
      expect(result.dz).toBeLessThan(-16);
      expect(result.dx).toBeCloseTo(3,2);
      expect(result.impact).toBe(40);
      expect(moveThrough({...vehicle,x:12},0,-40,[grid]).dz).toBe(-40);
    }
  });
  it('damps through the shortest heading arc independent of frame subdivision',()=>{
    const from=Math.PI-.06,to=-Math.PI+.06;
    const once=dampHeading(from,to,.08);
    expect(once).toBeGreaterThan(from);
    expect(dampHeading(dampHeading(from,to,.04),to,.04)).toBeCloseTo(once,10);
  });
  it('holds all vehicles on the spawn tangent without input and steers both ways',()=>{
    for(const vehicle of Object.keys(vehicles) as Vehicle[]){
      const idle=start();
      advance(idle,1,{...throttle,throttle:false},vehicle);
      expect(idle).toEqual(start());
      const left={...idle,speed:10},right={...idle,speed:10};
      advance(left,.04,{...throttle,steer:-1},vehicle);
      advance(right,.04,{...throttle,steer:1},vehicle);
      expect(left.heading).toBeLessThan(idle.heading);
      expect(right.heading).toBeGreaterThan(idle.heading);
    }
  });
  it('starts centered and pointing along the outbound road',()=>{
    const car=start(),distance=car.position;
    expect(car.lateral).toBe(road(distance));
    expect(Math.tan(car.heading)).toBeCloseTo((road(distance+.01)-road(distance-.01))/.02,6);
    advance(car,.1,throttle);
    expect(car.position).toBeGreaterThan(distance);
    expect(car.lateral).toBeCloseTo(road(car.position),3);
  });
  it('covers all seven stops in order',()=>{
    expect(stops).toEqual(['Umerkot','Chhor','Jeelani Mor','Tebhri Bhanbhra','Dodhar','Pataho','Hingorao','Saeedau']);
    expect(checkpoints).toHaveLength(stops.length);
    expect(LENGTH).toBe(7000);
  });
  it('gives each vehicle its own paved and sand speed limits',()=>{
    for(const vehicle of Object.keys(vehicles) as Vehicle[]){
      const car=start();
      for(let step=0;step<3600;step++){
        advance(car,.02,throttle,vehicle);
        car.lateral=road(car.position);
      }
      expect(car.speed).toBe(vehicles[vehicle].top);
      car.lateral=road(car.position)+15;
      advance(car,.016,throttle,vehicle);
      expect(car.speed).toBeLessThan(vehicles[vehicle].top);
      expect(car.speed).toBeGreaterThan(vehicles[vehicle].sand);
      for(let step=0;step<500;step++){
        advance(car,.02,throttle,vehicle);
        car.lateral=road(car.position)+15;
      }
      expect(car.speed).toBe(vehicles[vehicle].sand);
    }
  });
  it('stops at Saeedau and can reverse away',()=>{
    const car={position:LENGTH-.1,lateral:road(LENGTH),heading:0,speed:20};
    advance(car,.016,throttle);
    expect(car.position).toBe(LENGTH);
    expect(car.speed).toBe(0);
    advance(car,.016,{...throttle,throttle:false,reverse:true});
    expect(car.position).toBeLessThan(LENGTH);
  });
  it('requires nearby checkpoints in order and finishes a normal-paced simulated route in six to eight minutes',()=>{
    const car=start();
    let reached=0,seconds=0;
    expect(visit(0,checkpoints[2],road(checkpoints[2]))).toBe(0);
    expect(visit(0,checkpoints[1],road(checkpoints[1])+14)).toBe(0);
    for(;seconds<480&&reached<7;seconds+=.02){
      const look=15,target=Math.atan2(road(car.position+look)-car.lateral,look);
      const steer=Math.max(-1,Math.min(1,(target-car.heading)*4));
      advance(car,.02,{throttle:car.speed<16.8,reverse:false,steer,brake:false});
      expect(Math.abs(car.lateral-road(car.position))).toBeLessThan(4);
      reached=visit(reached,car.position,car.lateral);
    }
    expect(reached).toBe(7);
    expect(seconds).toBeGreaterThanOrEqual(360);
    expect(seconds).toBeLessThan(480);
  });
});
