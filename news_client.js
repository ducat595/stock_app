/* Reuse recent news locally and refresh expired entries without blanking the UI. */
(function(){
  function createStockNewsClient(options={}){
    const clock=options.now||Date.now,fetcher=options.fetch||((...args)=>window.fetch(...args));
    let storage=options.storage;
    if(storage===undefined){try{storage=window.sessionStorage;}catch{storage=null;}}
    const key='stockNewsCacheV3',cache=new Map(),pending=new Map(),maxAge=24*60*60*1000;
    try{
      const saved=JSON.parse(storage?.getItem(key)||'[]');
      if(Array.isArray(saved))for(const [symbol,entry] of saved){
        if(/^(?:[0-9]{4}|[0-9]{3}[A-Z])\.T$/.test(symbol)&&entry&&Array.isArray(entry.data?.items)&&Number.isFinite(entry.at)&&clock()-entry.at>=0&&clock()-entry.at<maxAge)cache.set(symbol,entry);
      }
    }catch{}
    function remember(symbol,data){
      const fetched=Number(data.at)*1000;
      const at=Number.isFinite(fetched)&&fetched>0?Math.min(clock(),fetched):clock();
      cache.delete(symbol);cache.set(symbol,{at,data});
      while(cache.size>12)cache.delete(cache.keys().next().value);
      try{
        let entries=Array.from(cache),serialized=JSON.stringify(entries);
        while(serialized.length>450000&&entries.length){entries.shift();serialized=JSON.stringify(entries);}
        storage?.setItem(key,serialized);
      }catch{}
    }
    function ttl(data){return data.status==='error'?30000:data.status==='partial'?(data.items.length?120000:30000):300000;}
    function request(symbol,url){
      if(pending.has(symbol))return pending.get(symbol);
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),65000);
      const promise=Promise.resolve().then(()=>fetcher(url,{signal:controller.signal})).then(async response=>{
        if(!response.ok)throw new Error('news');
        const data=await response.json();
        if(!Array.isArray(data?.items)||!['ok','empty','partial','error'].includes(data.status))throw new Error('invalid news');
        if(data.status==='error'||(data.status==='partial'&&!data.items.length))throw new Error('news upstream');
        remember(symbol,data);return data;
      }).finally(()=>{clearTimeout(timeout);pending.delete(symbol);});
      pending.set(symbol,promise);return promise;
    }
    async function load(symbol,url,onUpdate,{force=false}={}){
      const entry=cache.get(symbol),age=entry?clock()-entry.at:Infinity;
      const usable=entry&&age>=0&&age<maxAge;
      if(usable){
        if(!force&&entry.retryAfter>clock()){const data={...entry.data,fromCache:true,refreshFailed:true};onUpdate(data);return data;}
        onUpdate({...entry.data,fromCache:true,refreshing:force||age>=ttl(entry.data)});
        if(!force&&age<ttl(entry.data))return entry.data;
      }else onUpdate({status:'loading',items:[]});
      try{const data=await request(symbol,url);onUpdate(data);return data;}
      catch{
        const data=usable?{...entry.data,fromCache:true,refreshFailed:true}:{status:'error',items:[]};
        if(usable)entry.retryAfter=clock()+30000;
        else remember(symbol,{status:'error',items:[]});
        onUpdate(data);return data;
      }
    }
    return {load};
  }
  window.createStockNewsClient=createStockNewsClient;
  window.stockNewsClient=createStockNewsClient();
})();
