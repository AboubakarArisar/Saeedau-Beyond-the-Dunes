import {describe,expect,it} from 'vitest';
import {coinValue,coinsBetween,collectCoins} from './coins';
import {Colliders,moveThrough} from './collision';
import {checkpoints,road,ROAD_WIDTH,vehicles,type Vehicle} from './driving';
import {railFootprint,railSections} from './guardrails';
import {checkpoint,newRun,record,score} from './run';

const fleet=Object.keys(vehicles) as Vehicle[];

describe('roadside guardrails',()=>{
  it('follows the curved grade, leaves shoulders, and connects adjacent bays',()=>{
    const right=railSections(2944,3032).filter(section=>section.stretch.side===1);
    expect(right.length).toBeGreaterThan(10);
    expect(new Set(right.map(section=>railFootprint(section).sin.toFixed(3))).size).toBeGreaterThan(10);
    expect(right.at(-1)!.b.y).not.toBeCloseTo(right[0].a.y,1);
    right.forEach((section,index)=>{
      expect(section.a.lateral-road(section.begin)).toBeGreaterThan(ROAD_WIDTH/2+1.8);
      if(index)expect(section.a).toEqual(right[index-1].b);
    });
    expect(railSections(35,120)).toHaveLength(0);
  });

  it.each(fleet)('stops a high-speed lateral sweep for %s', vehicle=>{
    const distance=1680,x=road(distance),profile=vehicles[vehicle],grid=new Colliders();
    for(const section of railSections(1634,1690))grid.add(railFootprint(section));
    const movement=moveThrough({x:x+profile.center,z:-distance,width:profile.width,length:profile.length,sin:-1,cos:0},20,0,[grid]);
    expect(movement.impact).toBeGreaterThan(12);
    expect(x+movement.dx).toBeLessThan(x+7.4);
  });
});

describe('roadside coins',()=>{
  it.each(fleet)('collects a swept coin once and resets with a new run for %s',vehicle=>{
    const item=[...coinsBetween(32,32)][0],collected=new Set<number>();
    const from={lateral:item.lateral,position:25},to={lateral:item.lateral,position:36,heading:0};
    const run=newRun('journey');
    const pickup=()=>{run.coins++;};
    collectCoins(collected,new Set(),from,to,vehicle,pickup);
    collectCoins(collected,new Set(),to,{...from,heading:0},vehicle,pickup);
    expect([...collected]).toEqual([item.id]);
    expect(score(run).total).toBe(coinValue);
    collected.clear();
    const restarted=newRun('journey');
    collectCoins(collected,new Set([item.id]),from,to,vehicle,()=>{restarted.coins++;});
    expect(restarted.coins).toBe(0);
    collectCoins(collected,new Set(),from,to,vehicle,()=>{restarted.coins++;});
    expect(restarted.coins).toBe(1);
  });

  it('adds coins to the score and completed-run records independently of checkpoint order',()=>{
    const run=newRun('challenge');
    run.coins=4;
    checkpoint(run,2);
    expect(checkpoints[run.leg]).toBe(0);
    expect(score(run).breakdown.Coins).toBe(4*coinValue);
    const records=record({challenge:{score:90}},'challenge',run);
    expect(records.challenge).toMatchObject({score:90,coins:4});
    expect(record(records,'challenge',newRun('challenge')).challenge.coins).toBe(4);
  });
});
