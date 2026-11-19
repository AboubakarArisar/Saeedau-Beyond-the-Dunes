import {describe,expect,it} from 'vitest';
import {tiltAngle,tiltInput} from './mobileSteering';

describe('mobile steering',()=>{
  it('reads the opposite beta axes in both landscape orientations',()=>{
    expect(tiltAngle(22,5,90)).toBeCloseTo(22);
    expect(tiltAngle(-22,5,270)).toBeCloseTo(22);
    expect(tiltAngle(22,5,270)).toBeCloseTo(-22);
    expect(tiltAngle(22,5,0)).toBeCloseTo(5);
  });

  it('keeps neutral motion in the dead zone and clamps sensitive steering',()=>{
    expect(Math.abs(tiltInput(-3,4,2))).toBe(0);
    expect(tiltInput(18,4,1)).toBe(.5);
    expect(tiltInput(-45,4,2)).toBe(-1);
    expect(tiltInput(45,4,2)).toBe(1);
  });
});
