import {chromium,devices,expect} from '@playwright/test';
import {createServer} from 'vite';
import {join} from 'node:path';

const port=Number(process.env.SAEEDAU_TEST_PORT??5173);
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});
const shot=(page,name)=>page.screenshot({path:join(process.env.SAEEDAU_SCREENSHOTS??'artifacts',name)});
let browser;
try {
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const url='http://127.0.0.1:'+port;
  const ready=async page=>{
    const assets=page.waitForResponse(response=>response.url().endsWith('/vehicles/long-chassis.glb')&&response.ok());
    await page.goto(url);await assets;
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(750);
  };
  const desktop=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
  await ready(desktop);
  await expect(desktop.getByRole('heading',{name:'saeedau.'})).toBeVisible();
  await expect(desktop.locator('.panel')).toHaveCount(0);
  await shot(desktop,'fix-title-1366.png');
  await desktop.setViewportSize({width:1920,height:1080});
  await desktop.waitForTimeout(400);
  await shot(desktop,'fix-title-1920.png');
  await desktop.setViewportSize({width:960,height:540});
  await desktop.getByRole('button',{name:'start journey'}).click();
  await desktop.getByRole('button',{name:'Start Free Journey',exact:true}).click();
  await desktop.keyboard.down('w');
  try {await expect.poll(async()=>Number(await desktop.locator('.hud strong').textContent()),{timeout:15000}).toBeGreaterThan(3);}
  finally {await desktop.keyboard.up('w');}
  await desktop.close();

  const mobile=await browser.newPage({...devices['Pixel 7'],deviceScaleFactor:1,reducedMotion:'reduce'});
  await mobile.addInitScript(()=>{
    window.landscapeAttempts=0;
    Object.defineProperty(screen.orientation,'lock',{value:async mode=>{
      if(mode==='landscape')window.landscapeAttempts++;
      throw new DOMException('Test orientation fallback','NotSupportedError');
    }});
    const Audio=window.AudioContext;
    window.AudioContext=class extends Audio {
      constructor(...args){super(...args);window.testGameAudio=this;}
    };
  });
  await ready(mobile);
  const rotate=mobile.getByRole('dialog',{name:'rotate your phone'});
  await expect(rotate).toHaveCount(0);
  await mobile.getByRole('button',{name:'start journey'}).tap();
  await mobile.getByRole('button',{name:'Start Free Journey',exact:true}).tap();
  await expect(rotate).toBeVisible();
  expect(await mobile.evaluate(()=>window.landscapeAttempts)).toBe(1);
  await shot(mobile,'fix-rotate.png');
  await mobile.setViewportSize({width:844,height:390});
  await expect(mobile.getByRole('button',{name:'Accelerate'})).toBeVisible();
  await mobile.waitForTimeout(400);
  await shot(mobile,'fix-mobile-ready.png');
  await expect.poll(()=>mobile.evaluate(()=>window.testGameAudio?.state)).toBe('running');
  const [go,steer]=await Promise.all(['Accelerate','Steer right'].map(async name=>{
    const bounds=await mobile.getByRole('button',{name,exact:true}).boundingBox();
    return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
  }));
  const client=await mobile.context().newCDPSession(mobile);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...go,id:1},{...steer,id:2}]});
  await expect(mobile.locator('[data-held=true]')).toHaveCount(2);
  try {await expect.poll(async()=>Number(await mobile.locator('.hud strong').textContent()),{timeout:15000}).toBeGreaterThan(3);}
  finally {
    await shot(mobile,'mobile-active-controls.png');
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await expect(mobile.locator('[data-held=true]')).toHaveCount(0);
  await shot(mobile,'fix-mobile-driving.png');
  await mobile.getByRole('button',{name:'Pause',exact:true}).tap();
  mobile.once('dialog',dialog=>dialog.accept());
  await mobile.getByRole('button',{name:'Restart',exact:true}).tap();
  await expect(mobile.locator('.hud strong')).toHaveText('0');
  await expect(mobile.locator('.hud-coins')).toHaveAttribute('aria-label','Coins 0');
  const center=async name=>{
    const {x,y,width,height}=await mobile.getByRole('button',{name,exact:true}).boundingBox();
    return {x:x+width/2,y:y+height/2};
  };
  const left=await center('Steer left'), accelerator=await center('Accelerate');
  const brake=await center('Brake or reverse');
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...accelerator,id:1},{...left,id:2}]});
  await expect(mobile.locator('[data-held=true]')).toHaveCount(2);
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{...left,id:2}]});
  await expect(mobile.locator('.touch-throttle')).toHaveAttribute('data-held','true');
  await expect(mobile.locator('.touch-left')).not.toHaveAttribute('data-held','true');
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...brake,id:1},{...left,id:2}]});
  await expect(mobile.locator('[data-held=true]')).toHaveCount(2);
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(mobile.locator('[data-held=true]')).toHaveCount(0);
  await mobile.getByRole('button',{name:'Pause',exact:true}).tap();
  await mobile.getByRole('button',{name:'Resume',exact:true}).tap();
  await mobile.getByRole('button',{name:'Pause',exact:true}).tap();
  mobile.once('dialog',dialog=>dialog.accept());
  await mobile.getByRole('button',{name:'Restart',exact:true}).tap();
  await expect(mobile.locator('.hud strong')).toHaveText('0');
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...accelerator,id:1}]});
  await expect(mobile.locator('.hud-coins')).not.toHaveAttribute('aria-label','Coins 0',{timeout:20000});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.getByRole('button',{name:'Expand'}).tap();
  await expect(mobile.getByRole('button',{name:'My Music'})).toBeVisible();
  await mobile.getByRole('button',{name:'Play music'}).tap();
  await expect.poll(()=>mobile.locator('audio').evaluate(audio=>audio.duration)).toBeGreaterThan(10);
  await mobile.getByRole('slider',{name:'Seek'}).fill('10');
  await expect.poll(()=>mobile.locator('audio').evaluate(audio=>audio.currentTime)).toBeGreaterThanOrEqual(10);
  for(const [width,height] of [[667,375],[740,360],[844,390],[915,412]]){
    await mobile.setViewportSize({width,height});
    const pedal=await mobile.getByRole('button',{name:'Accelerate'}).boundingBox();
    const radio=await mobile.getByRole('complementary',{name:'Thar Radio'}).boundingBox();
    expect(radio.y+radio.height).toBeLessThan(pedal.y);
    expect(pedal.x+pedal.width).toBeLessThan(width);
    expect(pedal.y+pedal.height).toBeLessThan(height);
    expect(await mobile.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    const coin=await mobile.locator('.hud-coins').boundingBox();
    expect(Math.abs(coin.x+coin.width/2-width/2)).toBeLessThan(2);
  }
  await shot(mobile,'mobile-expanded-radio.png');
  await mobile.getByRole('button',{name:'Collapse'}).tap();
  expect(await mobile.locator('audio').evaluate(audio=>audio.paused)).toBe(false);
  await mobile.setViewportSize({width:390,height:844});
  await expect(rotate).toBeVisible();
  await mobile.setViewportSize({width:844,height:390});
  await expect(rotate).toHaveCount(0);
  await expect(mobile.getByRole('button',{name:'Accelerate'})).toBeVisible();
  expect(await mobile.evaluate(()=>document.documentElement.scrollWidth)).toBe(844);
  console.log('Desktop drive, mobile fallback and rotation, simultaneous touch, reset, radio and rotation pause passed.');
} finally {
  try {await browser?.close();} finally {await server.close();}
}
