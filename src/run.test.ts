import {describe,expect,it} from 'vitest';
import {road,start} from './driving';
import {checkpoint,discover,newRun,places,raceTime,record,recordKey,score,stageTime,tick} from './run';

describe('game modes and leaderboard',()=>{
  it('starts after the race countdown and keeps the best adjusted time',()=>{
    const run=newRun('race');
    expect(tick(run,3)).toBe(false);
    tick(run,300);
    run.impacts=2;run.crashes=1;run.offRoad=10;
    for(let leg=1;leg<=7;leg++)checkpoint(run,leg);
    expect(run.outcome).toBe('finished');
    expect(raceTime(run)).toBe(316);
    const key=recordKey('race','kekro','monsoon');
    const saved=JSON.parse(JSON.stringify(record({},key,run)));
    run.seconds+=100;
    expect(record(saved,key,run)[key]).toEqual(saved[key]);
  });

  it('awards time at sequential challenge checkpoints and ends when it runs out',()=>{
    const run=newRun('challenge');
    checkpoint(run,2);
    expect(run.leg).toBe(0);
    tick(run,stageTime(0)-8);
    checkpoint(run,1);
    expect(run.remaining).toBe(stageTime(1)+8);
    expect(tick(run,run.remaining)).toBe(false);
    expect(run.outcome).toBe('timeout');
    expect(score(run).breakdown.Penalties).toBe(-125);
  });

  it('awards unique discoveries once and lets explorers carry on at Saeedau',()=>{
    const run=newRun('explorer');
    const car=start();
    for(const place of places.slice(0,5)){
      car.position=place.distance;car.lateral=road(place.distance)+place.offset;
      discover(run,car);discover(run,car);
    }
    for(let leg=1;leg<=7;leg++)checkpoint(run,leg);
    expect(run.outcome).toBeNull();
    expect(score(run).breakdown.Discoveries).toBe(750);
    expect(score(run).breakdown['Explorer objective']).toBe(300);
  });

  it('leaves Free Journey open after Saeedau for the optional homecoming',()=>{
    const run=newRun('journey');
    expect(tick(run,500)).toBe(true);
    for(let leg=1;leg<=7;leg++)checkpoint(run,leg);
    expect(run.outcome).toBeNull();
    run.outcome='finished';
    expect(score(run).breakdown.Completion).toBe(400);
  });
});
