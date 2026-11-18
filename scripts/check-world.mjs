import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

const server=await createServer({
  server:{host:'127.0.0.1',port:5173,strictPort:true},
  plugins:[{name:'world-verification-positions',enforce:'pre',transform(code,id){
    if(!id.replaceAll('\\','/').endsWith('/src/scene.ts'))return;
    return code.replace('let reached=0,furthest=0;',`let reached=0,furthest=0;
      const requestedShot=new URLSearchParams(location.search);
      if(requestedShot.has('worldShot')){
        car.position=Number(requestedShot.get('worldShot'));
        car.lateral=road(car.position);
        car.heading=Math.atan2(road(car.position+.01)-road(car.position-.01),.02);
        reached=Number(requestedShot.get('visited')||0);
        furthest=car.position;
      }`);
  }}],
});
let browser;
try {
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1120,height:630},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const base='http://127.0.0.1:5173';
  const button=name=>page.getByRole('button',{name,exact:true});
  await page.goto(base);
  await button('start journey').click();
  await page.keyboard.down('w');
  try{
    await expect.poll(async()=>Number(await page.locator('.hud strong').textContent()),{timeout:18000}).toBeGreaterThan(15);
  }finally{await page.keyboard.up('w');}
  await page.keyboard.down('Space');
  try{await expect(page.locator('.hud strong')).toHaveText('0',{timeout:12000});}
  finally{await page.keyboard.up('Space');}
  await button('Expand').click();await expect(button('My Music')).toBeVisible();await button('Collapse').click();

  const metrics=await page.evaluate(async()=>{
    const {advance,start,road,LENGTH,visit,vehicles,checkpoints,stops}=await import('/src/driving.ts');
    const throttle={throttle:true,brake:false,reverse:false,steer:0};
    const acceleration=Object.fromEntries(Object.keys(vehicles).map(vehicle=>{
      const car=start(), times={};
      for(let step=1;step<=3500;step++){
        advance(car,.02,throttle,vehicle);
        car.lateral=road(car.position);
        for(const threshold of [60,100,110])if(car.speed*3.6>=threshold&&times[threshold]===undefined)times[threshold]=step*.02;
      }
      return [vehicle,{top:car.speed*3.6,seconds:times}];
    }));
    const car=start(),arrivals=[stops[0]];
    let reached=0,seconds=0,maxOffset=0;
    for(;seconds<480&&reached<stops.length-1;seconds+=.02){
      const look=15,target=Math.atan2(road(car.position+look)-car.lateral,look);
      const steer=Math.max(-1,Math.min(1,(target-car.heading)*4));
      advance(car,.02,{...throttle,throttle:car.speed<16.8,steer});
      maxOffset=Math.max(maxOffset,Math.abs(car.lateral-road(car.position)));
      const next=visit(reached,car.position,car.lateral);
      if(reached!==next)arrivals.push(stops[next]);
      reached=next;
    }
    return {length:LENGTH,checkpoints,acceleration,seconds,maxOffset,arrivals};
  });
  expect(metrics.arrivals).toEqual(['Umerkot','Chhor','Jeelani Mor','Tebhri Bhanbhra','Dodhar','Pataho','Hingorao','Saeedau']);
  expect(metrics.seconds).toBeGreaterThan(360);
  expect(metrics.seconds).toBeLessThan(480);
  expect(metrics.acceleration.jeep.top).toBeGreaterThan(120);
  expect(metrics.acceleration.kekro.top).toBeGreaterThan(100);
  expect(metrics.acceleration.unique.top).toBeLessThan(100);
  console.log(JSON.stringify(metrics));

  const views=[
    ['umerkot',18,0],['chhor',805,0],['jeelani-mor',1665,1],['tebhri-bhanbhra',2616,2],
    ['dodhar',3665,3],['open-thar',4140,4],['pataho',4715,4],['hingorao',5865,5],['saeedau',6999,6],
  ];
  const requestedViews=new Set(process.argv.slice(2));
  const captures=requestedViews.size?views.filter(([name])=>requestedViews.has(name)):views;
  if(!captures.length)throw new Error('No matching capture locations');
  for(const [name,distance,visited] of captures){
    const kit=page.waitForResponse(response=>response.url().endsWith('/settlement/kit.glb')&&response.ok());
    await page.goto(`${base}/?worldShot=${distance}&visited=${visited}`);
    await button('start journey').click();
    await kit;
    if(name==='saeedau')await expect(page.getByRole('status')).toContainText('Welcome to Saeedau');
    else if(name!=='umerkot')await expect(page.locator('.checkpoint-toast')).toHaveCount(0,{timeout:8000});
    await page.waitForTimeout(540);
    await page.screenshot({path:`artifacts/world-${name}.png`});
  }
  const frameRate=await page.evaluate(()=>new Promise(resolve=>{
    let frames=0,start=performance.now();
    const tick=now=>{frames++;if(now-start>=2000)resolve(frames*1000/(now-start));else requestAnimationFrame(tick);};
    requestAnimationFrame(tick);
  }));
  expect(errors).toEqual([]);
  console.log('Edge SwiftShader at 1120×630, '+captures.at(-1)[0]+' FPS:',frameRate.toFixed(1));
}finally{try{await browser?.close();}finally{await server.close();}}
