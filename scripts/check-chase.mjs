import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {join} from 'node:path';

const port=Number(process.env.SAEEDAU_TEST_PORT??5173);
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const button=name=>page.getByRole('button',{name,exact:true});
  const speed=()=>page.locator('.hud strong');
  const shot=name=>page.screenshot({path:join(process.env.SAEEDAU_SCREENSHOTS??'artifacts',`fix-${name}.png`)});
  await page.goto('http://127.0.0.1:'+port);
  await button('Start driving').click();
  await button('Start Free Journey').click();
  await expect(page.locator('.hud-distance')).toContainText('to Chhor');
  await page.waitForTimeout(700);
  await expect(speed()).toHaveText('0');
  await shot('centered-chase');
  await page.setViewportSize({width:1920,height:1080});
  await page.waitForTimeout(350);
  await shot('hud-1920');
  await button('Controls').click();await expect(page.getByText(/WASD or arrows/)).toBeVisible();
  await button('Hide controls').click();
  await page.setViewportSize({width:960,height:540});
  await page.mouse.move(420,290);await page.mouse.down();await page.mouse.move(610,290,{steps:8});await page.mouse.up();
  await shot('camera-orbit');
  await page.waitForTimeout(4000);
  await shot('camera-return');
  await page.keyboard.down('w');
  try{
    await expect.poll(async()=>Number(await speed().textContent()),{timeout:20000}).toBeGreaterThan(22);
    await page.keyboard.down('a');await page.waitForTimeout(270);await page.keyboard.up('a');
    await shot('chase-curve');
    await page.keyboard.down('d');await page.waitForTimeout(270);await page.keyboard.up('d');
  }finally{await page.keyboard.up('w');}
  await page.keyboard.press('r');await expect(speed()).toHaveText('0');
  await page.keyboard.down('s');
  try{await expect.poll(async()=>Number(await speed().textContent()),{timeout:12000}).toBeGreaterThan(3);}
  finally{await page.keyboard.up('s');}
  await page.keyboard.press('r');await expect(speed()).toHaveText('0');
  for(const vehicle of ['Kekro','Unique 70 motorcycle','Long Chassis jeep']){
    await button('Pause').click();page.once('dialog',dialog=>dialog.accept());await button('Main menu').click();
    await button('Start driving').click();await button('Previous vehicle').click();await button('Start Free Journey').click();
    await expect(page.locator('.hud-vehicle')).toHaveText(vehicle);
    await expect(speed()).toHaveText('0');
    await page.keyboard.down('w');
    try{await expect.poll(async()=>Number(await speed().textContent())).toBeGreaterThan(3);}
    finally{await page.keyboard.up('w');}
  }
  expect(errors).toEqual([]);
  console.log('Chase, desktop HUD, orbit return capture, steering, reverse, reset and vehicle switching passed.');
}finally{try{await browser?.close();}finally{await server.close();}}
