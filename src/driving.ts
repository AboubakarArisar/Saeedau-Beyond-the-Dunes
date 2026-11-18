export const stops = [
  'Umerkot', 'Chhor', 'Jeelani Mor', 'Tebhri Bhanbhra', 'Dodhar', 'Pataho', 'Hingorao', 'Saeedau',
] as const;
export const checkpoints=[0,850,1700,2650,3700,4750,5900,7000] as const;
export const LENGTH = checkpoints[7];
export function visit(last:number,position:number,lateral:number){
  const next=checkpoints[last+1];
  return next!==undefined&&Math.abs(position-next)<=(next===LENGTH?2:18)&&Math.abs(lateral-road(position))<=13?last+1:last;
}
export const development=(distance:number)=>Math.max(0,Math.min(1,(3000-distance)/2100));
export const junction=checkpoints[2];
export const vehicles = {
  jeep: {name:'Long Chassis jeep', acceleration:5.1, top:35, sand:15, turn:1, braking:8, radius:.39},
  kekro: {name:'Kekro', acceleration:3.5, top:29, sand:14, turn:.78, braking:6, radius:.5},
  unique: {name:'Unique 70 motorcycle', acceleration:4.7, top:24, sand:11, turn:1.18, braking:7, radius:.33},
};
export type Vehicle = keyof typeof vehicles;
export const chaseProfiles={
  jeep:{distance:6.9,height:3.35,target:1.22,min:4.8},
  kekro:{distance:8.4,height:4.05,target:1.52,min:5.7},
  unique:{distance:5.8,height:2.75,target:.94,min:3.7},
};
export function dampHeading(current:number,target:number,dt:number){
  const difference=target-current;
  return current+Math.atan2(Math.sin(difference),Math.cos(difference))*(-Math.expm1(-6*dt));
}
export const road = (distance: number) => 34 * Math.sin(distance / 115) + 19 * Math.sin(distance / 57);
export const grade = (distance: number) => 2.4 * Math.sin(distance / 76) + 5 * Math.sin(distance / 223);
export function ground(lateral: number, distance: number) {
  const blend = Math.min(1, Math.max(0, (Math.abs(lateral-road(distance))-7)/34));
  const dune = .5 + .5 * Math.sin(distance / 94 + lateral / 34 + .6 * Math.cos(distance / 59));
  const open=1-development(distance);
  return grade(distance) + blend * blend * (.45 + (2.1+4.6*open) * dune ** 2 + (1+open*.9) * Math.cos(lateral/23-distance/63));
}
export type Drive = { position: number; lateral: number; heading: number; speed: number };
export const start = (): Drive => {
  const position = 18;
  return {position,lateral:road(position),heading:Math.atan((34/115)*Math.cos(position/115)+(19/57)*Math.cos(position/57)),speed:0};
};
export function advance(car: Drive, dt: number, input: {throttle:boolean; reverse:boolean; steer:number; brake:boolean}, vehicle:Vehicle='jeep') {
  const profile=vehicles[vehicle];
  const loose = Math.abs(car.lateral-road(car.position)) > 4;
  const speed=Math.abs(car.speed),ratio=Math.min(1,speed/profile.top);
  const approach=(target:number,rate:number)=>car.speed+=Math.sign(target-car.speed)*Math.min(Math.abs(target-car.speed),rate*dt);
  if(input.brake)approach(0,profile.braking*1.35);
  else if(input.reverse&&!input.throttle)approach(-6,car.speed>0?profile.braking:2.7);
  else if(input.throttle){
    const limit=loose?profile.sand:profile.top;
    const pull=profile.acceleration*(1-.57*ratio)-.32-.60*ratio*ratio-(loose?.7:0);
    approach(limit,car.speed>limit?3.2:Math.max(.18,pull));
  }else approach(0,(loose?1.45:.48)+.88*ratio*ratio);
  const turn=Math.min(Math.abs(car.speed)/4,1)/(1+(Math.abs(car.speed)/8.5)**1.65);
  car.heading += input.steer * turn * Math.sign(car.speed)*dt*profile.turn;
  car.lateral = Math.max(-110,Math.min(110,car.lateral+Math.sin(car.heading)*car.speed*dt));
  car.position = Math.max(0,Math.min(LENGTH,car.position+Math.cos(car.heading)*car.speed*dt));
  if(car.position===LENGTH||car.position===0) {
    const forward=car.speed*Math.cos(car.heading);
    if(car.position===LENGTH?forward>0:forward<0)car.speed=0;
  }
}
