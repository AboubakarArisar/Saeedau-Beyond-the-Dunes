export const stops = [
  'Umerkot', 'Chhor', 'Jeelani Mor', 'Tebhri Bhanbhra', 'Dodhar', 'Pataho', 'Saeedau',
] as const;
export const LEG = 1600;
export const LENGTH = LEG * (stops.length - 1);
export const vehicles = {
  jeep: {name:'Long Chassis jeep', acceleration:9, top:32, sand:14, turn:1, radius:.39},
  kekro: {name:'Kekro', acceleration:6.5, top:24, sand:16, turn:.78, radius:.5},
  unique: {name:'Unique 70 motorcycle', acceleration:10, top:26, sand:11, turn:1.22, radius:.33},
};
export type Vehicle = keyof typeof vehicles;
export const road = (distance: number) => 34 * Math.sin(distance / 115) + 19 * Math.sin(distance / 57);
export const grade = (distance: number) => 2.4 * Math.sin(distance / 76) + 5 * Math.sin(distance / 223);
export function ground(lateral: number, distance: number) {
  const blend = Math.min(1, Math.max(0, (Math.abs(lateral-road(distance))-4.4)/24));
  return grade(distance) + blend * blend * (3 + 2.8 * Math.sin(distance/39+lateral/15) + 2.2 * Math.cos(lateral/23-distance/63));
}
export type Drive = { position: number; lateral: number; heading: number; speed: number };
export const start = (): Drive => ({position:12,lateral:road(12),heading:Math.atan((road(13)-road(11))/2),speed:0});
export function advance(car: Drive, dt: number, input: {throttle:boolean; reverse:boolean; steer:number; brake:boolean}, vehicle:Vehicle='jeep') {
  const profile=vehicles[vehicle];
  const loose = Math.abs(car.lateral-road(car.position)) > 4;
  const force = input.brake ? 22 : loose ? 4.5 : 1.65;
  car.speed += (input.brake ? 0 : input.throttle ? profile.acceleration : input.reverse ? -9 : 0) * dt;
  car.speed = Math.sign(car.speed) * Math.max(0, Math.abs(car.speed)-force*dt);
  car.speed = Math.max(-7,Math.min(loose?profile.sand:profile.top,car.speed));
  car.heading += input.steer * Math.min(Math.abs(car.speed)/5,1.25) * Math.sign(car.speed)*dt*profile.turn;
  car.lateral = Math.max(-110,Math.min(110,car.lateral+Math.sin(car.heading)*car.speed*dt));
  car.position = Math.max(0,Math.min(LENGTH,car.position+Math.cos(car.heading)*car.speed*dt));
  if(car.position===LENGTH||car.position===0) {
    const forward=car.speed*Math.cos(car.heading);
    if(car.position===LENGTH?forward>0:forward<0)car.speed=0;
  }
}
