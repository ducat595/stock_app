/* Market overview and Japanese US-market headlines, loaded independently. */
(function(){
  const esc=x=>escapeHtml(String(x??'')),cache=new Map(),pending=new Map();
  const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username?u.href:'';}catch{return '';}};
  function stored(key){try{return JSON.parse(sessionStorage.getItem('marketPanelV1:'+key)||'null');}catch{return null;}}
  function save(key,data){const value={at:Date.now(),data};cache.set(key,value);try{sessionStorage.setItem('marketPanelV1:'+key,JSON.stringify(value));}catch{}}
  function run(key,path,render,force,ttl){
    if(pending.has(key))return pending.get(key);const old=cache.get(key)||stored(key);
    if(old){cache.set(key,old);render(old.data,true);if(!force&&Date.now()-old.at<ttl)return Promise.resolve();}
    const task=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
      try{const r=await fetch(`${API_BASE}${path}`,{signal:controller.signal});if(!r.ok)throw new Error('request failed');let data=await r.json();
        if(key==='quotes'&&old)data={...data,items:(data.items||[]).map(x=>x.price==null?({...((old.data.items||[]).find(y=>y.key===x.key&&y.price!=null)||x),cached:true}):x)};
        if(key==='news'&&data.status==='error'&&!(data.news||[]).length)throw new Error('feed failed');
        save(key,data);render(data,false);
      }catch{if(old)render(old.data,true,true);else render(null,false,true);}finally{clearTimeout(timer);}
    })().finally(()=>pending.delete(key));pending.set(key,task);return task;
  }
  function signed(x,digits=2){return (x>0?'+':'')+Number(x).toLocaleString('ja-JP',{minimumFractionDigits:digits,maximumFractionDigits:digits});}
  function renderQuotes(data,cached=false,error=false){
    const box=document.getElementById('marketDashboard');if(!box)return;
    if(!data){box.innerHTML='<p class="muted">指標を取得できませんでした。市場情報の更新で再試行できます。</p>';return;}
    const groups=[['indices','株式市場','日本と米国の主要指数'],['rates','長期国債利回り','日米の10年・30年'],['risk','リスク・商品','VIX・原油・金']];
    box.innerHTML=groups.map(([key,title,caption])=>`<section class="market-section"><div class="market-section-heading"><h3>${title}</h3><span>${caption}</span></div><div class="market-tile-grid ${key==='rates'?'market-rates-grid':''}">${(data.items||[]).filter(x=>x.group===key).map(x=>{
      const price=x.price,positive=x.change>0,negative=x.change<0,cls=positive?'market-up':negative?'market-down':'market-flat',digits=x.unit==='%'?3:2;
      const change=x.change==null?'前回比未取得':x.unit==='%'?`${signed(x.change,3)} %ポイント`:`${signed(x.change)}${x.changePct==null?'':`（${signed(x.changePct)}%）`}`;
      const time=x.timestamp?new Date(x.timestamp*1000).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):x.asOfDate?x.asOfDate+' 公表分':x.timeLabel||'時刻未取得';
      const url=safeUrl(x.sourceUrl);return `<article class="market-tile ${cls}"><div class="market-tile-label">${esc(x.name)}</div><div class="market-tile-price">${price==null?'—':Number(price).toLocaleString('ja-JP',{minimumFractionDigits:digits,maximumFractionDigits:digits})}<small>${esc(x.unit)}</small></div><div class="market-tile-change">${price==null?'取得できませんでした':(positive?'↗ ':negative?'↘ ':'− ')+esc(change)}</div><p class="market-tile-subtitle">${esc(x.subtitle)}${x.key==='nikkeiFuture'&&x.contractName?'<br>'+esc(x.contractName):''}</p><div class="market-tile-time">${esc(time)}${cached||x.cached||x.stale?' ／ 前回取得':''}</div>${url?`<a class="market-tile-source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(x.source||'配信元')} ↗</a>`:''}</article>`;
    }).join('')}</div></section>`).join('');
    const status=document.getElementById('marketDashboardStatus');if(status)status.textContent=`${cached?'取得済みの指標を表示中。':'配信時刻の指標を表示。'}${error?'一時的に更新できないため保存済みデータを表示しています。':''} 市場・取引時間・配信遅延は指標ごとに異なります。国債は価格ではなく利回りです。${data.fetchedAt?' 取得：'+new Date(data.fetchedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):''}`;
  }
  function renderNews(data,cached=false,error=false){
    const box=document.getElementById('usMarketNews');if(!box)return;const now=Date.now(),rows=(data?.news||[]).filter(x=>{const ts=Date.parse(x.published);return Number.isFinite(ts)&&now-ts>=0&&now-ts<=7*86400000;});
    if(!rows.length){box.innerHTML=`<p class="muted">${error?'米国市場ニュースを取得できませんでした。ニュースの再取得で再試行できます。':'取得できた配信元には直近7日間の関連記事がありません。'}</p>`;return;}
    box.innerHTML=`<p class="market-news-status">${cached||error?'取得済みのニュースを表示しています。':data.status==='partial'?'取得できた配信元のニュースを表示しています。':'日本語で読む米国株・米国市場のニュース'}</p>`+rows.map(x=>{const url=safeUrl(x.link);return `<article class="fx-news-item">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a>`:esc(x.title)}<div class="muted">${esc(x.source)} ・ ${esc(new Date(x.published).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}))}</div></article>`;}).join('');
  }
  function load(force=false){return Promise.all([run('quotes','/api/markets/dashboard',renderQuotes,force,60000),run('news','/api/markets/us-news',renderNews,force,300000)]);}
  window.stockMarketPanel={load,renderQuotes,renderNews};
})();
