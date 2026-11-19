import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {join} from 'node:path';

const port=Number(process.env.SAEEDAU_TEST_PORT??5173);
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});
function wave(frequency,seconds=6){
  const length=8000*seconds, result=Buffer.alloc(44+length*2);
  result.write('RIFF');result.writeUInt32LE(result.length-8,4);result.write('WAVEfmt ',8);
  result.writeUInt32LE(16,16);result.writeUInt16LE(1,20);result.writeUInt16LE(1,22);
  result.writeUInt32LE(8000,24);result.writeUInt32LE(16000,28);result.writeUInt16LE(2,32);result.writeUInt16LE(16,34);
  result.write('data',36);result.writeUInt32LE(length*2,40);
  for(let sample=0;sample<length;sample++)result.writeInt16LE(Math.round(250*Math.sin(sample*frequency*Math.PI/4000)),44+sample*2);
  return result;
}

async function checkSoundtrack(browser,url){
  const page=await browser.newPage({viewport:{width:960,height:540}});
  const outside=[];
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(url+'/'))outside.push(request.url());});
  const button=name=>page.getByRole('button',{name,exact:true});
  const audio=page.locator('audio');
  const radio=page.getByRole('complementary',{name:'Thar Radio'});
  const title=radio.locator('.radio-title');
  const first='Test track A · Test artist A',second='Test track B · Test artist B';
  let attempt=0;
  await page.route('**/audio/thar-radio/manifest.json',route=>++attempt===1?
    route.fulfill({status:503}):route.fulfill({json:[
      {title:'Test track A',artist:'Test artist A',file:'first.wav'},
      {title:'Test track B',artist:'Test artist B',file:'second.wav'},
      {title:'Broken test track',artist:'Test artist B',file:'broken.wav'},
    ]}));
  await page.route('**/audio/thar-radio/*.wav',route=>{
    const file=new URL(route.request().url()).pathname.split('/').at(-1);
    return file==='broken.wav'?route.fulfill({status:404}):
      route.fulfill({contentType:'audio/wav',body:wave(file==='first.wav'?220:330,18)});
  });
  try{
    await page.goto(url);
    await button('Start driving').click();await button('Start Free Journey').click();await button('Expand').click();
    await expect(radio.getByRole('status')).toContainText('Could not load the Thar soundtrack');
    await button('Retry soundtrack').click();
    await expect(button(first)).toBeVisible();
    await expect(title).toHaveText(first);
    await expect(button('Pause music')).toBeVisible();
    await button('Pause music').click();
    await expect.poll(()=>audio.evaluate(element=>element.paused)).toBe(true);
    await button('Play music').click();
    await expect.poll(()=>audio.evaluate(element=>element.duration)).toBe(18);
    await expect.poll(()=>audio.evaluate(element=>element.paused)).toBe(false);
    await audio.evaluate(element=>{element.playbackRate=8;});
    await expect(title).toHaveText(second,{timeout:10000});
    await button('Previous').click();await expect(title).toHaveText(first);
    await button('Next').click();await expect(title).toHaveText(second);
    await page.getByLabel('Repeat').selectOption('one');
    await expect.poll(()=>audio.evaluate(element=>element.duration)).toBe(18);
    await audio.evaluate(element=>new Promise((resolve,reject)=>{
      const listener=new AbortController();
      const timeout=setTimeout(()=>{listener.abort();reject(new Error('Track did not end'));},12000);
      element.addEventListener('ended',()=>{clearTimeout(timeout);element.playbackRate=1;resolve();},
        {once:true,signal:listener.signal});
      element.playbackRate=8;
    }));
    await expect.poll(()=>audio.evaluate(element=>!element.paused&&element.currentTime<element.duration-.2)).toBe(true);
    await expect(title).toHaveText(second);
    await button('Shuffle').click();await button('Next').click();
    await expect(title).not.toHaveText(second);
    await button('Shuffle').click();
    await button('Broken test track · Test artist B').click();
    await expect(radio.getByRole('status')).toContainText(/soundtrack track/);
    await button(first).click();await expect(button('Pause music')).toBeVisible();
    await page.getByRole('slider',{name:'Music volume'}).fill('0.4');
    await expect.poll(()=>audio.evaluate(element=>element.volume)).toBeCloseTo(.3);
    await button('Mute radio').click();
    await expect.poll(()=>audio.evaluate(element=>element.volume)).toBe(0);
    await button('Mute radio').click();
    await expect.poll(()=>audio.evaluate(element=>element.volume)).toBeCloseTo(.3);
    await button('Collapse').click();
    await expect.poll(()=>audio.evaluate(element=>element.paused)).toBe(false);
    await button('Expand').click();await button('My Music').click();
    await expect(audio).not.toHaveAttribute('src');
    await expect.poll(()=>audio.evaluate(element=>element.paused)).toBe(true);
    expect(outside).toEqual([]);
    console.log('Built-in radio playback, playlist controls, same-origin requests, error recovery and cleanup passed using test audio.');
  } finally {await page.close();}
}

let browser;
try {
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const url='http://127.0.0.1:'+port;
  await checkSoundtrack(browser,url);
  const bundled=await browser.newPage({viewport:{width:1120,height:720}});
  await bundled.route('**/*',route=>route.request().url().startsWith(url+'/')?route.continue():route.abort());
  const manifest=await (await bundled.request.get(url+'/audio/thar-radio/manifest.json')).json();
  expect(manifest).toHaveLength(3);
  const bundledButton=name=>bundled.getByRole('button',{name,exact:true});
  const bundledAudio=bundled.locator('audio');
  const bundledState=()=>bundledAudio.evaluate(audio=>({file:decodeURIComponent(new URL(audio.src).pathname.split('/').at(-1)),
    time:audio.currentTime,duration:audio.duration,paused:audio.paused}));
  await bundled.goto(url);
  await bundledButton('Start driving').click();await bundledButton('Start Free Journey').click();await bundledButton('Expand').click();
  await expect(bundled.locator('.radio-queue li')).toHaveCount(3);
  await expect(bundledAudio).toHaveCount(1);
  await expect(bundledButton('Pause music')).toBeVisible();
  for(const [index,track] of manifest.entries()){
    if(index)await bundledButton('Next').click();
    await expect(bundled.locator('.radio-title')).toHaveText(track.title+' · '+track.artist);
    await expect.poll(async()=>{
      const state=await bundledState();
      return state.file===track.file&&!state.paused&&state.duration>0?state.time:0;
    }).toBeGreaterThan(.1);
  }
  await bundledButton('Previous').click();
  await expect.poll(async()=>(await bundledState()).file).toBe(manifest[1].file);
  const beforeMenus=(await bundledState()).time;
  await bundledButton('Pause').click();
  bundled.once('dialog',dialog=>dialog.accept());await bundledButton('Return to menu').click();
  await bundledButton('Garage').click();
  await expect.poll(async()=>(await bundledState()).time).toBeGreaterThan(beforeMenus);
  expect(await bundledState()).toMatchObject({file:manifest[1].file,paused:false});
  await bundledButton('Back').click();await bundledButton('Start driving').click();
  await bundledButton('Start Free Journey').click();
  await expect(bundledButton('Pause music')).toBeVisible();
  expect(await bundledState()).toMatchObject({file:manifest[1].file,paused:false});
  await bundled.close();
  console.log('All three packaged MP3s play with external requests blocked and survive Garage and menu transitions.');
  const page=await browser.newPage({viewport:{width:1120,height:720}});
  const faults=[];page.on('pageerror',error=>faults.push(error.message));
  const button=name=>page.getByRole('button',{name,exact:true});
  const shot=name=>page.screenshot({path:join(process.env.SAEEDAU_SCREENSHOTS??'artifacts',name)});
  const media=()=>page.locator('audio').evaluate(audio=>({paused:audio.paused,time:audio.currentTime,volume:audio.volume}));
  await page.goto(url);
  await button('Start driving').click();await button('Start Free Journey').click();await button('Expand').click();
  await button('My Music').click();
  const input=page.locator('input[type=file]');
  await input.setInputFiles([{name:'Dune-one.wav',mimeType:'audio/wav',buffer:wave(220)},{name:'Dune-two.wav',mimeType:'audio/wav',buffer:wave(330)}]);
  expect((await media()).paused).toBe(true);
  await button('Dune-one').click();
  await expect(button('Pause music')).toBeVisible();
  await expect.poll(async()=>(await media()).time).toBeGreaterThan(0);
  await page.getByRole('slider',{name:'Seek'}).fill('2.2');
  await expect.poll(async()=>(await media()).time).toBeGreaterThan(2);
  await button('Next').click();await expect(button('Dune-two')).toHaveAttribute('aria-current','true');
  await button('Previous').click();await expect(button('Dune-one')).toHaveAttribute('aria-current','true');
  await button('Shuffle').click();await page.getByLabel('Repeat').selectOption('one');
  await button('Next').click();await expect(button('Dune-two')).toHaveAttribute('aria-current','true');
  await page.getByRole('slider',{name:'Seek'}).fill('5.8');
  await expect.poll(async()=>(await media()).time).toBeLessThan(2);
  await page.getByRole('slider',{name:'Music volume'}).fill('0.4');
  await expect.poll(async()=>(await media()).volume).toBeCloseTo(.3);
  await button('Thar Soundtrack').click();
  await expect.poll(async()=>(await media()).paused).toBe(true);
  await shot('thar-radio-expanded.png');
  await button('My Music').click();
  await expect(button('Dune-two')).toHaveAttribute('aria-current','true');
  await button('Play music').click();
  await button('Pause').click();
  page.once('dialog',dialog=>dialog.accept());await button('Return to menu').click();
  await button('Garage').click();await expect(page.locator('[data-radio]')).toHaveCount(0);
  await expect.poll(async()=>(await media()).paused).toBe(false);
  await button('Back').click();await button('Start driving').click();
  await button('Start Free Journey').click();
  await expect(button('Pause music')).toBeVisible();
  await shot('fix-local-expanded.png');
  await button('Collapse').click();
  await expect.poll(async()=>(await media()).paused).toBe(false);
  await shot('fix-radio-compact.png');
  await page.mouse.click(620,320);await page.keyboard.press('m');
  await expect(button('Collapse')).toBeVisible();
  await button('Remove Dune-one').click();await expect(button('Dune-one')).toHaveCount(0);
  await input.setInputFiles({name:'not-a-song.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
  await expect(page.getByRole('complementary',{name:'Thar Radio'}).getByRole('status')).toContainText('Unrecognized');
  await button('Clear playlist').click();
  await expect.poll(async()=>(await media()).paused).toBe(true);
  await button('Pause').click();await button('Audio settings').click();
  await page.getByLabel('Mute all audio').check();
  await expect.poll(async()=>(await media()).volume).toBe(0);
  await page.reload();await button('Settings').click();
  await expect(page.getByRole('slider',{name:'Music volume'})).toHaveValue('0.4');
  await expect(page.getByLabel('Mute all audio')).toBeChecked();
  expect(faults).toEqual([]);
  console.log('Local radio playback, queue, controls, source switching, mute and persistence passed.');
} finally {
  try {await browser?.close();} finally {await server.close();}
}
