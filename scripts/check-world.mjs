import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {join} from 'node:path';

const server=await createServer({
  server:{host:'127.0.0.1',port:5173,strictPort:true},
  plugins:[{name:'world-verification-positions',enforce:'pre',transform(code,id){
    if(!id.replaceAll('\\','/').endsWith('/src/scene.ts'))return;
    return code.replace('car=start();run=newRun(options.mode);',`car=start();run=newRun(options.mode);
      const requestedShot=new URLSearchParams(location.search);
      if(requestedShot.has('worldShot')){
        car.position=Number(requestedShot.get('worldShot'));
        car.lateral=road(car.position);
        car.heading=Math.atan2(road(car.position+.01)-road(car.position-.01),.02);
        if(requestedShot.has('offset'))car.lateral+=Number(requestedShot.get('offset'));
        if(requestedShot.has('heading'))car.heading=Number(requestedShot.get('heading'));
        run.leg=Number(requestedShot.get('visited')||0);
        run.progress=car.position;
      }
      if(requestedShot.has('timeout'))run.remaining=.3;`)
      .replace('lastReport=now;',`lastReport=now;
        if(location.search.includes('solid=1'))host.dataset.verification=JSON.stringify({car,impacts:run.impacts});`);
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
  const shot=name=>page.screenshot({path:join(process.env.SAEEDAU_SCREENSHOTS??'artifacts','v15-'+name+'.png')});
  await page.goto(base);
  await button('Start driving').click();
  await shot('modes');
  await button('Garage').click();
  await button('Previous vehicle').click();await shot('garage');
  await button('Next vehicle').click();await button('Back').click();
  for(const label of ['Winter','Monsoon','Dry','Summer']){
    await button(label).click();
    await expect(button(label)).toHaveAttribute('aria-pressed','true');
    await shot(label.toLowerCase());
  }
  await button('Start Free Journey').click();
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
    ['dodhar',3665,3],['open-thar',4140,4],['pataho',4715,4],['hingorao',5865,5],['saeedau',6969,6],
  ];
  const requestedViews=new Set(process.argv.slice(2));
  const captures=requestedViews.size?views.filter(([name])=>requestedViews.has(name)):views;
  if(!captures.length)throw new Error('No matching capture locations');
  for(const [name,distance,visited] of captures){
    const kit=page.waitForResponse(response=>response.url().endsWith('/settlement/kit.glb')&&response.ok());
    await page.goto(`${base}/?worldShot=${distance}&visited=${visited}`);
    await button('Start driving').click();
    await button('Start Free Journey').click();
    await kit;
    await page.waitForTimeout(540);
    await shot(name);
  }
  const frameRate=await page.evaluate(()=>new Promise(resolve=>{
    let frames=0,start=performance.now();
    const tick=now=>{frames++;if(now-start>=2000)resolve(frames*1000/(now-start));else requestAnimationFrame(tick);};
    requestAnimationFrame(tick);
  }));
  for(const mode of ['Free Journey','Speed Racing','Checkpoint Challenge','Desert Explorer']){
    const query=mode==='Checkpoint Challenge'?'timeout=1':mode==='Desert Explorer'?'worldShot=31':'worldShot=6999&visited=6';
    await page.goto(base+'/?'+query);
    await button('Start driving').click();
    await page.getByRole('group',{name:'Game mode'}).getByRole('button',{name:new RegExp(mode)}).click();
    if(mode==='Speed Racing'){
      await page.evaluate(()=>{
        const observer=new MutationObserver(mutations=>{
          if(mutations.some(mutation=>[...mutation.addedNodes].some(node=>node instanceof Element&&
            (node.matches('.race-countdown')||node.querySelector('.race-countdown'))))){
            document.body.dataset.raceCountdown='seen';observer.disconnect();
          }
        });
        observer.observe(document.body,{childList:true,subtree:true});
      });
    }
    await button('Start '+mode).click();
    if(mode==='Desert Explorer'){await button('Pause').click();await button('Finish expedition').click();}
    if(mode==='Free Journey'){
      await expect(page.locator('.hud-route')).toContainText('Arrived in Saeedau');
      await button('Pause').click();await button('Finish journey').click();
    }
    await expect(page.locator('.results-panel h1')).toHaveText(mode==='Checkpoint Challenge'?'Time expired':mode==='Desert Explorer'?'Expedition complete':'Welcome to Saeedau',{timeout:18000});
    if(mode==='Free Journey')await shot('arrival');
    if(mode==='Speed Racing'){
      await expect(page.locator('body')).toHaveAttribute('data-race-countdown','seen');
      const saved=()=>page.evaluate(()=>localStorage.getItem('saeedau.records'));
      const before=await saved();
      expect(JSON.parse(before)['race.jeep.summer'].time).toBeGreaterThan(0);
      await page.reload();
      expect(await saved()).toBe(before);
    }
  }
  await button('Main menu').click();await button('Credits').click();
  await expect(button('Back to Menu')).toBeVisible();await button('Back to Menu').click();
  const obstacles=[
    {distance:3731,offset:20,heading:-Math.PI/2},
    {distance:1680,offset:2,heading:Math.PI/2},
  ];
  for(const obstacle of obstacles){
    const setup=new URLSearchParams({worldShot:obstacle.distance,offset:obstacle.offset,heading:obstacle.heading,solid:1});
    const kit=page.waitForResponse(response=>response.url().endsWith('/houses/kit.glb')&&response.ok());
    await page.goto(base+'/?'+setup);await kit;
    await button('Start driving').click();await button('Start Free Journey').click();
    const state=async()=>JSON.parse(await page.locator('.world').getAttribute('data-verification')??'null');
    await page.keyboard.down('w');
    try{
      await expect.poll(async()=>(await state())?.impacts??0,{timeout:25000}).toBeGreaterThan(0);
      const atImpact=(await state()).car.lateral;
      await page.waitForTimeout(900);
      expect(Math.abs((await state()).car.lateral-atImpact)).toBeLessThan(.3);
    }finally{await page.keyboard.up('w');}
  }
  expect(errors).toEqual([]);
  console.log('Edge SwiftShader at 1120×630, '+captures.at(-1)[0]+' FPS:',frameRate.toFixed(1));
}finally{try{await browser?.close();}finally{await server.close();}}
