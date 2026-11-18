import {chromium,devices,expect} from '@playwright/test';
import {createServer} from 'vite';

const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true}});
let browser;
try {
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const url='http://127.0.0.1:5173';
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
  await desktop.screenshot({path:'artifacts/fix-title-1366.png'});
  await desktop.setViewportSize({width:1920,height:1080});
  await desktop.waitForTimeout(400);
  await desktop.screenshot({path:'artifacts/fix-title-1920.png'});
  await desktop.setViewportSize({width:960,height:540});
  await desktop.getByRole('button',{name:'start journey'}).click();
  await desktop.keyboard.down('w');
  try {await expect.poll(async()=>Number(await desktop.locator('.hud strong').textContent()),{timeout:15000}).toBeGreaterThan(3);}
  finally {await desktop.keyboard.up('w');}
  await desktop.close();

  const mobile=await browser.newPage({...devices['Pixel 7'],deviceScaleFactor:1,reducedMotion:'reduce'});
  await mobile.addInitScript(()=>{
    const Audio=window.AudioContext;
    window.AudioContext=class extends Audio {
      constructor(...args){super(...args);window.testGameAudio=this;}
    };
  });
  await ready(mobile);
  const rotate=mobile.getByRole('dialog',{name:'rotate your phone.'});
  await expect(rotate).toHaveCount(0);
  await mobile.getByRole('button',{name:'start journey'}).tap();
  await expect(rotate).toBeVisible();
  await mobile.screenshot({path:'artifacts/fix-rotate.png'});
  await mobile.getByRole('button',{name:'Continue in portrait'}).tap();
  await expect(rotate).toHaveCount(0);
  await mobile.setViewportSize({width:844,height:390});
  await expect(mobile.getByRole('button',{name:'Accelerate'})).toBeVisible();
  await mobile.waitForTimeout(400);
  await mobile.screenshot({path:'artifacts/fix-mobile-ready.png'});
  await expect.poll(()=>mobile.evaluate(()=>window.testGameAudio?.state)).toBe('running');
  const [go,steer]=await Promise.all(['Accelerate','Steer right'].map(async name=>{
    const bounds=await mobile.getByRole('button',{name,exact:true}).boundingBox();
    return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
  }));
  const client=await mobile.context().newCDPSession(mobile);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...go,id:1},{...steer,id:2}]});
  await expect(mobile.locator('[data-held=true]')).toHaveCount(2);
  try {await expect.poll(async()=>Number(await mobile.locator('.hud strong').textContent()),{timeout:15000}).toBeGreaterThan(3);}
  finally {await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  await expect(mobile.locator('[data-held=true]')).toHaveCount(0);
  await mobile.screenshot({path:'artifacts/fix-mobile-driving.png'});
  await mobile.getByRole('button',{name:'Reset'}).tap();
  await expect(mobile.locator('.hud strong')).toHaveText('0');
  await mobile.getByRole('button',{name:'Expand'}).tap();
  await expect(mobile.getByRole('button',{name:'My Music'})).toBeVisible();
  await mobile.getByRole('button',{name:'Collapse'}).tap();
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
