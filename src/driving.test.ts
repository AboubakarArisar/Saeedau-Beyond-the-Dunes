import {describe,expect,it} from 'vitest';
import {advance,dampHeading,LEG,LENGTH,road,start,stops,vehicles,type Vehicle} from './driving';

const throttle={throttle:true,reverse:false,steer:0,brake:false};

describe('desert journey',()=>{
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
    expect(stops).toEqual(['Umerkot','Chhor','Jeelani Mor','Tebhri Bhanbhra','Dodhar','Pataho','Saeedau']);
    expect(LENGTH).toBe(6*LEG);
  });
  it('gives each vehicle its own paved and sand speed limits',()=>{
    for(const vehicle of Object.keys(vehicles) as Vehicle[]){
      const car={...start(),speed:80};
      advance(car,.016,throttle,vehicle);
      expect(car.speed).toBe(vehicles[vehicle].top);
      car.lateral=road(car.position)+15;
      advance(car,.016,throttle,vehicle);
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
});
