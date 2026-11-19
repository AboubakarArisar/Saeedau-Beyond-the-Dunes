import {chromium,devices,expect} from '@playwright/test';
import {preview} from 'vite';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

let version=1,missing=true;
const port=Number(process.env.SAEEDAU_PWA_PORT??5182);
const worker=await readFile('dist/sw.js','utf8');
const server=await preview({preview:{host:'127.0.0.1',port,strictPort:true},plugins:[{
  name:'offline-verification',
  configurePreviewServer(server){
    server.middlewares.use((request,response,next)=>{
      if(request.url==='/sw.js'){
        response.setHeader('Content-Type','text/javascript');
        response.setHeader('Cache-Control','no-store');
        response.end(version===1?worker:worker.replace(/"version":"[^"]+"/,'"version":"test-update"'));
      }else if(request.url?.startsWith('/index.html?offline=')){
        response.writeHead(307,{Location:'/'}).end();
      }else if(missing&&request.url?.startsWith('/vehicles/unique70-rider.glb?offline=')){
        response.statusCode=503;response.end('Simulated interruption');
      }else next();
    });
  },
}]});
let browser;
const url='http://127.0.0.1:'+port;
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const shot=(page,name)=>page.screenshot({path:join(process.env.SAEEDAU_SCREENSHOTS??'artifacts',name+'.png')});
try{
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=document-user-activation-required']});
  const context=await browser.newContext({viewport:{width:1120,height:630},reducedMotion:'reduce'});
  const page=await context.newPage();
  context.on('console',message=>{if(message.text().includes('Offline operation failed'))console.log(message.text());});
  const issues=[];
  page.on('pageerror',error=>issues.push(error.message));
  await page.goto(url);
  await expect(page.getByRole('heading',{name:'Saeedau',exact:true})).toBeVisible();
  await shot(page,'v2-main-menu');
  const manifest=await (await page.request.get(url+'/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('landscape');
  for(const {src,sizes} of [...manifest.icons,{src:'/icons/apple-touch-icon.png',sizes:'180x180'}]){
    const response=await page.request.get(url+src);
    expect(response.ok()).toBe(true);
    const image=await response.body();
    expect([image.readUInt32BE(16),image.readUInt32BE(20)].join('x')).toBe(sizes);
  }
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  const devtools=await context.newCDPSession(page);
  const installability=await devtools.send('Page.getInstallabilityErrors');
  expect(installability.installabilityErrors.filter(error=>error.errorId!=='in-incognito')).toEqual([]);
  await expect(button(page,'Download for offline play')).toBeVisible();
  if(!await button(page,'Install game').isVisible()){
    await page.evaluate(()=>{
      const event=new Event('beforeinstallprompt',{cancelable:true});
      Object.assign(event,{prompt:async()=>{},userChoice:Promise.resolve({outcome:'dismissed'})});
      window.dispatchEvent(event);
    });
  }
  await expect(button(page,'Install game')).toBeVisible();
  await shot(page,'v2-install');
  await button(page,'Download for offline play').click();
  await expect(page.getByText(/Download interrupted/)).toBeVisible({timeout:30000});
  missing=false;
  await button(page,'Download for offline play').click();
  await expect(page.getByText('Ready to play offline',{exact:true})).toBeVisible({timeout:60000});
  await shot(page,'v2-offline-ready');
  await page.evaluate(async()=>{
    const key=(await caches.keys()).find(name=>name.startsWith('saeedau-game-'));
    await (await caches.open(key)).delete('/vehicles/unique70-rider.glb');
  });
  await button(page,'Check offline files').click();
  await expect(page.getByText('Ready to play offline',{exact:true})).toHaveCount(0);
  await button(page,'Download for offline play').click();
  await expect(page.getByText('Ready to play offline',{exact:true})).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Ready to play offline',{exact:true})).toBeVisible();
  await button(page,'Garage').click();
  for(const model of ['long-chassis.glb','unique70.glb','kekro.glb']){
    await expect.poll(()=>page.evaluate(async file=>(await fetch('/vehicles/'+file)).ok,model)).toBe(true);
  }
  await expect(page.getByRole('heading',{name:'Long Chassis',exact:true})).toBeVisible();
  await button(page,'Next vehicle').click();
  await expect(page.getByRole('heading',{name:'Unique 70',exact:true})).toBeVisible();
  await expect(page.getByText('Loading vehicle…')).toHaveCount(0);
  await shot(page,'v2-garage');
  await button(page,'Next vehicle').click();
  await expect(page.getByRole('heading',{name:'Kekro',exact:true})).toBeVisible();
  await expect(page.getByText('Loading vehicle…')).toHaveCount(0);
  await button(page,'Back').click();
  await button(page,'Start driving').click();
  await expect(page.getByRole('group',{name:'Game mode'}).getByRole('button')).toHaveCount(5);
  await shot(page,'v2-mode-selection');
  await page.getByRole('button',{name:/Desert Explorer Discover/}).click();
  await button(page,'Start Desert Explorer').click();
  const audio=page.locator('audio');
  await expect.poll(()=>audio.evaluate(node=>node.paused)).toBe(false);
  await page.keyboard.down('w');
  try{await expect.poll(async()=>Number(await page.locator('.hud-speed strong').textContent())).toBeGreaterThan(3);}
  finally{await page.keyboard.up('w');}
  await shot(page,'v2-desktop-driving');
  await button(page,'Expand').click();
  for(let index=0;index<3;index++){
    await expect.poll(()=>audio.evaluate(node=>node.duration)).toBeGreaterThan(20);
    await expect.poll(()=>audio.evaluate(node=>node.paused)).toBe(false);
    const previous=await audio.evaluate(node=>node.currentSrc);
    if(index<2){
      await button(page,'Next').click();
      await expect.poll(()=>audio.evaluate(node=>node.currentSrc)).not.toBe(previous);
    }
  }
  await button(page,'Pause music').click();
  await page.getByRole('slider',{name:'Seek'}).fill('12');
  await expect.poll(()=>audio.evaluate(node=>node.currentTime)).toBeCloseTo(12,1);
  await shot(page,'v2-expanded-radio');
  await button(page,'Pause').click();
  await button(page,'Finish expedition').click();
  await expect(page.locator('.results-panel')).toBeVisible();
  await button(page,'Main menu').click();
  await context.setOffline(false);
  await button(page,'Settings').click();
  await page.getByLabel('Graphics quality').selectOption('medium');
  await button(page,'Back').click();
  version++;
  await page.evaluate(async()=>{await (await navigator.serviceWorker.ready).update();});
  await expect(button(page,'Update available')).toBeVisible({timeout:20000});
  await Promise.all([page.waitForEvent('load'),button(page,'Update available').click()]);
  await expect(page.getByText('Ready to play offline',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>caches.keys())).toEqual(['saeedau-game-test-update']);
  await button(page,'Settings').click();
  await expect(page.getByLabel('Graphics quality')).toHaveValue('medium');
  expect(issues).toEqual([]);
  await context.close();

  const mobile=await browser.newPage({...devices['Pixel 7'],deviceScaleFactor:1,reducedMotion:'reduce'});
  await mobile.addInitScript(()=>{
    let permitted=false;
    DeviceOrientationEvent.requestPermission=async()=>permitted?'granted':'denied';
    window.allowTilt=()=>{permitted=true;};
    const query=window.matchMedia.bind(window);
    window.matchMedia=value=>value==='(display-mode: standalone)'?{matches:true}:query(value);
  });
  await mobile.goto(url);
  await expect(button(mobile,'Install game')).toHaveCount(0);
  await button(mobile,'Settings').tap();
  const method=mobile.getByLabel('Steering method');
  await method.selectOption('tilt');
  await expect(mobile.getByText('Tilt unavailable. Steering buttons are active.')).toBeVisible();
  await mobile.evaluate(()=>window.allowTilt());
  await button(mobile,'Enable tilt').tap();
  await expect(mobile.getByText('Waiting for motion data…')).toBeVisible();
  await mobile.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:12,gamma:4})));
  await expect(button(mobile,'Calibrate')).toBeEnabled();
  await button(mobile,'Calibrate').tap();
  await shot(mobile,'v2-tilt-settings');
  await method.selectOption('wheel');
  await button(mobile,'Back').tap();
  await button(mobile,'Start driving').tap();
  await button(mobile,'Start Free Journey').tap();
  await expect(mobile.getByRole('dialog',{name:'Rotate your phone'})).toBeVisible();
  await shot(mobile,'v2-rotation');
  await mobile.setViewportSize({width:844,height:390});
  const wheel=button(mobile,'Steering wheel');
  await expect(wheel).toBeVisible();
  const w=await wheel.boundingBox(),pedal=await button(mobile,'Accelerate').boundingBox();
  const client=await mobile.context().newCDPSession(mobile);
  const first={x:w.x+w.width/2,y:w.y+8,id:1},gas={x:pedal.x+pedal.width/2,y:pedal.y+pedal.height/2,id:2};
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first,gas]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:w.x+w.width-8,y:w.y+w.height/2,id:1},gas]});
  await expect(wheel).toHaveAttribute('data-held','true');
  await expect(button(mobile,'Accelerate')).toHaveAttribute('data-held','true');
  await shot(mobile,'v2-mobile-driving');
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(wheel).toHaveAttribute('data-held','false');
  await expect(button(mobile,'Accelerate')).not.toHaveAttribute('data-held','true');
  console.log('Production manifest, icons, interrupted download, recovery, offline reload/assets/audio/results, update, saved settings, tilt permissions and wheel input passed.');
}finally{
  try{await browser?.close();}finally{await new Promise(resolve=>server.httpServer.close(resolve));}
}
