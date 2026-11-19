import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {join} from 'node:path';

const server=await createServer({
  server:{host:'127.0.0.1',port:5173,strictPort:true},
  plugins:[{name:'roadside-verification',enforce:'pre',transform(code,id){
    if(!id.replaceAll('\\','/').endsWith('/src/scene.ts'))return;
    return code.replace('run=newRun(options.mode,customRoute);',`run=newRun(options.mode,customRoute);
      const sample=new URLSearchParams(location.search);
      if(sample.has('distance')){
        car.position=Number(sample.get('distance'));
        car.lateral=road(car.position)+Number(sample.get('offset')??0);
        car.heading=sample.has('heading')?Number(sample.get('heading')):
          Math.atan2(road(car.position+.2)-road(car.position-.2),.4);
        car.speed=Number(sample.get('speed')??0);
        run.leg=Number(sample.get('leg')??0);
      }`).replace('if(now-qualityCheck>2400){','if(now-qualityCheck>2400&&!document.body.dataset.roadsideBenchmark){')
      .replace('renderer.render(scene,view);',`
      const hidden=document.body.dataset.roadsideBenchmark==='off';
      scene.traverse(item=>{
        if(item.name==='Guardrail hardware'||item.name==='Galvanized W-beam')item.visible=!hidden;
      });
      if(hidden)coinField.mesh.visible=false;
      renderer.render(scene,view);
      const rail=scene.getObjectByName('Galvanized W-beam');
      host.dataset.roadside=JSON.stringify({coins:run.coins,impacts:run.impacts,crashes:run.crashes,
        leg:run.leg,speed:car.speed,offset:car.lateral-road(car.position),instances:coinField.mesh.count,
        railVertices:rail?.geometry.attributes.position.count??0,
        calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});`);
  }}],
});

let browser;
try{
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const base='http://127.0.0.1:5173';
  const page=await browser.newPage({viewport:{width:1120,height:630},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    class TestAudio extends window.AudioContext {
      createBufferSource(){
        const source=super.createBufferSource();
        const start=source.start.bind(source);
        source.start=(...args)=>{
          if(source.buffer?.duration<.2)window.pickupSounds=(window.pickupSounds??0)+1;
          return start(...args);
        };
        return source;
      }
    }
    window.AudioContext=TestAudio;
  });
  const button=name=>page.getByRole('button',{name,exact:true});
  const count=()=>page.locator('.hud-coins');
  const state=async()=>JSON.parse(await page.locator('.world').getAttribute('data-roadside')??'{}');
  const shot=name=>page.screenshot({path:join(process.env.SAEEDAU_SCREENSHOTS??'artifacts','roadside-'+name+'.png')});
  async function begin(parameters,mode='Free Journey',vehicle='jeep'){
    await page.goto(base+'/?'+new URLSearchParams(parameters));
    await page.evaluate(value=>localStorage.setItem('saeedau.vehicle',JSON.stringify(value)),vehicle);
    await page.reload();
    await button('start journey').click();
    if(mode!=='Free Journey')await page.getByRole('group',{name:'Game mode'}).getByRole('button',{name:new RegExp(mode)}).click();
    await button('Start '+mode).click();
    await expect(count()).toBeVisible();
  }

  await begin({distance:1642,offset:2.8,leg:1});
  await expect.poll(async()=>(await state()).railVertices).toBeGreaterThan(200);
  await expect.poll(async()=>(await state()).instances).toBeGreaterThan(3);
  expect((await state()).instances).toBeLessThanOrEqual(48);
  await shot('curved-guardrail-coins');

  await begin({distance:2958,offset:1.7,leg:3});
  await expect.poll(async()=>(await state()).railVertices).toBeGreaterThan(1500);
  await shot('two-sided-guardrails');
  const measure=hide=>page.evaluate(async hidden=>{
    document.body.dataset.roadsideBenchmark=hidden?'off':'on';
    return new Promise(resolve=>{
      let elapsedFrom,frames=0;
      function sample(now){
        elapsedFrom??=now;
        if(now-elapsedFrom>=5500){
          const {calls,triangles}=JSON.parse(document.querySelector('.world').dataset.roadside);
          resolve({calls,triangles,fps:Number((frames*1000/(now-elapsedFrom)).toFixed(2))});
        }else{frames++;requestAnimationFrame(sample);}
      }
      requestAnimationFrame(sample);
    });
  },hide);
  const without=await measure(true),withRoadside=await measure(false);
  expect(withRoadside.calls-without.calls).toBeGreaterThan(0);
  expect(withRoadside.calls-without.calls).toBeLessThanOrEqual(5);
  console.log('Same-view software render budget',JSON.stringify({without,withRoadside}));

  for(const vehicle of ['jeep','kekro','unique']){
    await begin({distance:1680,offset:1,heading:Math.PI/2,speed:23,leg:1},'Free Journey',vehicle);
    await expect.poll(async()=>(await state()).crashes,{timeout:12000}).toBeGreaterThan(0);
    const hit=await state();
    expect(hit.impacts).toBe(1);
    expect(hit.speed).toBeLessThan(5);
    expect(hit.offset).toBeLessThan(7.4);
    console.log(vehicle+' guardrail impact',JSON.stringify(hit));
  }

  for(const [index,mode] of ['Free Journey','Speed Racing','Checkpoint Challenge','Desert Explorer'].entries()){
    await begin({distance:27},mode,['jeep','kekro','unique','jeep'][index]);
    await expect(count()).toHaveAttribute('aria-label','Coins 0');
    await page.keyboard.down('w');
    try{
      await expect.poll(async()=>(await state()).coins,{timeout:24000}).toBeGreaterThan(0);
    }finally{await page.keyboard.up('w');}
    await page.keyboard.down('Space');
    try{await expect(page.locator('.hud-speed strong')).toHaveText('0',{timeout:12000});}
    finally{await page.keyboard.up('Space');}
    const stopped=await state();
    expect(stopped.leg).toBe(0);
    await expect(count()).toHaveAttribute('aria-label','Coins '+stopped.coins);
    await expect.poll(()=>page.evaluate(()=>window.pickupSounds??0)).toBeGreaterThan(0);
    await page.waitForTimeout(400);
    expect((await state()).coins).toBe(stopped.coins);
    if(index===0){
      await shot('coin-hud');
      await page.keyboard.press('r');
      await expect(count()).toHaveAttribute('aria-label','Coins 0');
    }
    if(mode==='Desert Explorer'){
      await button('Pause').click();await button('Finish expedition').click();
      const results=page.locator('.results-panel');
      await expect(results).toContainText(stopped.coins*10+' coin points');
      await expect(results).toContainText('Best '+stopped.coins);
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('saeedau.records')));
      expect(saved['explorer.jeep.summer'].coins).toBe(stopped.coins);
    }
  }
  expect(errors).toEqual([]);
  console.log('Curved guardrails, high-speed impacts, four-mode pickups, audio, restart and coin records passed.');
}finally{
  try{await browser?.close();}finally{await server.close();}
}
