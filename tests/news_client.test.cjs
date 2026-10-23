const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const context={window:{},AbortController,setTimeout,clearTimeout};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../news_client.js'),'utf8'),context);
const create=context.window.createStockNewsClient;
const response=data=>({ok:true,json:async()=>data});
const news={status:'ok',items:[{title:'news'}],effect:{score:1}};

test('fresh news is reused across visits and session restoration without requests',async()=>{
  let count=0;const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
  const options={now:()=>1000,fetch:async()=>{count++;return response(news);},storage};
  const client=create(options);await client.load('7203.T','/news',()=>{});
  await client.load('7203.T','/news',()=>{});
  const restored=create(options);const states=[];await restored.load('7203.T','/news',x=>states.push(x));
  assert.equal(count,1);assert.equal(states[0].fromCache,true);
});

test('expired entries appear immediately and are updated in the background',async()=>{
  let now=1000,release;
  const client=create({now:()=>now,storage:null,fetch:async()=>release?new Promise(r=>{release=r;}):response(news)});
  await client.load('7203.T','/news',()=>{});now+=300001;release=true;
  const states=[],loading=client.load('7203.T','/news',x=>states.push(x));
  assert.equal(states[0].fromCache,true);assert.equal(states[0].refreshing,true);
  await Promise.resolve();release(response({...news,items:[]}));await loading;
  assert.equal(states.at(-1).items.length,0);
});

test('concurrent callers share one request',async()=>{
  let count=0,release;
  const client=create({storage:null,fetch:()=>{count++;return new Promise(r=>{release=r;});}});
  const a=client.load('7203.T','/news',()=>{}),b=client.load('7203.T','/news',()=>{});
  await Promise.resolve();assert.equal(count,1);release(response(news));await Promise.all([a,b]);
});

test('failed refresh retains cached articles and avoids rapid repeated retries',async()=>{
  let now=0,fail=false,count=0;
  const client=create({now:()=>now,storage:null,fetch:async()=>{count++;if(fail)throw Error('offline');return response(news);}});
  await client.load('7203.T','/news',()=>{});now=300001;fail=true;
  const states=[];await client.load('7203.T','/news',x=>states.push(x));
  assert.equal(states.at(-1).refreshFailed,true);assert.equal(states.at(-1).items.length,1);
  await client.load('7203.T','/news',()=>{});assert.equal(count,2);
});

test('blocked storage does not prevent news fetching',async()=>{
  const client=create({storage:{getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('full')}},fetch:async()=>response(news)});
  const result=await client.load('7203.T','/news',()=>{});assert.equal(result.items.length,1);
});

test('a partial empty refresh cannot erase previously displayed articles',async()=>{
  let now=1000,partial=false;
  const client=create({now:()=>now,storage:null,fetch:async()=>response(partial?{status:'partial',items:[]}:news)});
  await client.load('8136.T','/news',()=>{});now+=6*3600000;partial=true;
  const states=[];await client.load('8136.T','/news',x=>states.push(x));
  assert.equal(states.at(-1).items.length,1);assert.equal(states.at(-1).refreshFailed,true);
});
