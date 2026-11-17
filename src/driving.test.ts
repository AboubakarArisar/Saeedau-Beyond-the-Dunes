import {describe,expect,it} from 'vitest';
import {advance,LEG,LENGTH,road,start,stops,vehicles,type Vehicle} from './driving';

const throttle={throttle:true,reverse:false,steer:0,brake:false};

describe('desert journey',()=>{
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
