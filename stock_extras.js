/* Dated credit trends, corporate schedules and durable opening/closing comparisons. */
(function(){
  const cache=new Map(),pending=new Map();
  const esc=x=>escapeHtml(String(x??''));
  const yen=x=>x==null?'—':Number(x).toLocaleString('ja-JP',{maximumFractionDigits:3})+'円';
  const shares=x=>x==null?'—':Number(x).toLocaleString('ja-JP')+'株';
  const sign=x=>x==null?'—':(Number(x)>0?'+':'')+Number(x).toLocaleString('ja-JP',{maximumFractionDigits:2});
  const jst=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));};
  async function get(path,ttl=300000){
    const entry=cache.get(path);if(entry&&Date.now()-entry.at<ttl)return entry.data;
    if(pending.has(path))return pending.get(path);
    const promise=fetch(`${API_BASE}${path}`).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.setupRequired?'保存用SQLの適用待ちです。':'取得できませんでした。');cache.set(path,{at:Date.now(),data:d});if(cache.size>80)cache.delete(cache.keys().next().value);return d;}).finally(()=>pending.delete(path));
    pending.set(path,promise);return promise;
  }
  function creditHtml(data){
    if(data.status!=='ok'||!data.latest)return '<h3>信用買い残・信用売り残の推移</h3><p>履歴を取得できませんでした。信用銘柄でない場合もあります。</p>';
    const names={increase:'増加',decrease:'減少',flat:'横ばい',unknown:'比較データ不足'};
    const cell=(label,key)=>{const change=data[key+'Change'],trend=data[key+'Trend'];return `<div><strong>${esc(label)} ${shares(data.latest[key])}</strong><p>前回比：${change?`${sign(change.shares)}株（${change.pct==null?'前回0株のため率は算出不可':sign(change.pct)+'%'}）`:'比較データ不足'}</p><p>直近${Number(trend?.observations)||0}回：${esc(names[trend?.direction]||names.unknown)}</p></div>`;};
    return `<h3>信用買い残・信用売り残の推移</h3><p>対象日：${esc(data.latest.date)} ／ 比較対象：${esc(data.previous?.date||'未取得')} ／ 信用倍率：${data.latest.ratio==null?'—':Number(data.latest.ratio).toFixed(2)+'倍'}</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">${cell('信用買い残','buy')}${cell('信用売り残','sell')}</div><details><summary>信用残の履歴（最大20回）</summary><div style="overflow:auto"><table><thead><tr><th>対象日</th><th>買い残</th><th>売り残</th><th>倍率</th></tr></thead><tbody>${(data.history||[]).map(x=>`<tr><td>${esc(x.date)}</td><td>${shares(x.buy)}</td><td>${shares(x.sell)}</td><td>${x.ratio==null?'—':Number(x.ratio).toFixed(2)}</td></tr>`).join('')}</tbody></table></div></details><p class="muted">${esc(data.note)} 信用残による予想価格の直接補正はまだ行わず、増減傾向を確認・記録します。</p>`;
  }
  function eventsHtml(data){
    const earnings=data.earnings?.next;
    const dividend=data.dividend;
    const benefit=data.benefit;
    const months=[...new Set((benefit?.items||[]).map(x=>x.recordDate&&x.recordDate!=='要確認'?String(x.recordDate):x.month?`${x.month}月（権利日未確認）`:'日付未確認'))];
    return `<h3>決算・配当・優待の予定</h3><dl><dt>決算発表予定日</dt><dd>${earnings?esc(earnings.date)+' '+esc(earnings.kind):data.earnings?.status==='error'?'取得失敗':'JPX掲載分では今後の予定未確認'}${data.earnings?.stale?'（前回取得情報）':''}</dd><dt>配当権利確定予定日</dt><dd>${dividend?.date?esc(dividend.date)+'（候補・企業IR未確認）':'未確認'}</dd><dt>優待権利確定予定日</dt><dd>${months.length?months.map(esc).join(' ／ ')+'（登録済み候補）':benefit?.status==='error'?'取得失敗':'登録情報なし・優待なしを意味しません'}</dd></dl><p class="muted">${esc(dividend?.note||'')} 優待は登録済み権利月から表示し、不明な日付は補完しません。権利確定日と権利付き最終売買日は異なります。</p><a href="https://www.jpx.co.jp/listing/event-schedules/financial-announcement/" target="_blank" rel="noopener">JPX公式の決算予定を確認</a>`;
  }
  function comparisonHtml(data){
    const rows=data.items||[];
    return `<h3>始値・終値：当時の予想と実績</h3><p class="muted">${esc(data.note||'')} お気に入り登録済みの銘柄は、削除後も収集を継続します。</p>${rows.length?`<div style="overflow:auto"><table><thead><tr><th>取引日</th><th>予想始値</th><th>実際の始値</th><th>始値誤差</th><th>予想終値</th><th>実際の終値</th><th>終値誤差</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.trading_date)}</td><td>${yen(x.predicted_open)}</td><td>${yen(x.opening_price)}</td><td>${yen(x.opening_error)}</td><td>${yen(x.predicted_close)}</td><td>${yen(x.closing_price)}</td><td>${yen(x.closing_error)}</td></tr>`).join('')}</tbody></table></div>`:'<p>保存履歴はまだありません。登録後の定期収集から蓄積します。過去の予想を後から作って埋めることはしません。</p>'}`;
  }
  function loadDetail(code,seq){
    const result=document.getElementById('detailEvaluationResult');let box=document.getElementById('detailSupportingData');
    if(!box){box=document.createElement('div');box.id='detailSupportingData';result.insertAdjacentElement('afterend',box);}
    box.dataset.sequence=String(seq);
    box.innerHTML='<section class="card" data-extra="events">決算・配当・優待予定を取得中…</section><section class="card" data-extra="credit">信用残の推移を取得中…</section><section class="card" data-extra="history">始値・終値の比較履歴を取得中…</section>';
    const symbol=String(code).replace(/\.T$/i,'').toUpperCase()+'.T';
    for(const [part,path,renderer,ttl] of [['events','/api/stock-events',eventsHtml,3600000],['credit','/api/credit-history',creditHtml,900000],['history','/api/learning/comparison',comparisonHtml,60000]]){
      get(path+'?symbol='+encodeURIComponent(symbol),ttl).then(data=>{if(box.dataset.sequence===String(seq))box.querySelector(`[data-extra="${part}"]`).innerHTML=renderer(data);}).catch(error=>{if(box.dataset.sequence===String(seq))box.querySelector(`[data-extra="${part}"]`).innerHTML=`<p>${esc(error.message)}</p>`;});
    }
  }
  const todayIso=()=>{const x=jst();return `${x.year}-${String(x.month).padStart(2,'0')}-${String(x.day).padStart(2,'0')}`;};
  const windowPath=(kind='')=>`/api/events/window?asof=${todayIso()}${kind?'&kind='+kind:''}`;
  async function loadMonthlySummary(){
    try{
      const data=await get(windowPath(),3600000);
      for(const [type,id] of [['dividends','currentDividendCount'],['benefits','currentBenefitCount'],['earnings','currentEarningsCount']]){
        const el=document.getElementById(id);if(el)el.textContent=data[type]?.count==null?'—':Number(data[type].count).toLocaleString('ja-JP')+'銘柄';
      }
      const note=document.getElementById('eventWindowNote');
      if(note)note.textContent=`${data.start}～${data.end}（両日を含む）。件数から一覧を開けます。配当は決算日を基にした候補、優待は登録情報、決算はJPX掲載分です。企業IRで未確認の情報を含み、全銘柄を網羅するものではありません。優待の権利日未確認 ${data.benefits?.unknownDateCount??'—'}銘柄は期間内か判定できないため件数から除外しています。${Object.values(data).some(x=>x?.status==='error'||x?.status==='partial'||x?.stale)?'一部の情報が未取得、または前回取得情報です。':''}`;
    }catch{for(const id of ['currentDividendCount','currentBenefitCount','currentEarningsCount']){const el=document.getElementById(id);if(el)el.textContent='取得失敗';}}
  }
  function openBenefits(){location.hash='#page-upcoming-benefits';openPage('upcoming-benefits');}
  function bindCompanyLinks(box){box.querySelectorAll('[data-earnings-code]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();location.hash='#page-detail';openPage('detail');evaluateDetailStock(link.dataset.earningsCode);}));}
  const companyCells=x=>`<td><a href="https://finance.yahoo.co.jp/quote/${encodeURIComponent(String(x.code))}.T" target="_blank" rel="noopener noreferrer">${esc(x.code)}</a></td><td><a href="#page-detail" data-earnings-code="${esc(x.code)}">${esc(x.name)}</a></td>`;
  async function loadWindowList(kind){
    const box=document.getElementById('upcoming-'+kind+'List');if(!box)return;box.textContent='今日から2週間先の予定を取得中…';const key=todayIso();box.dataset.request=key;
    try{
      const data=await get(windowPath(kind),3600000);if(box.dataset.request!==key)return;
      box.innerHTML=`<p>${esc(data.start)}～${esc(data.end)}：${data.count==null?'取得失敗':Number(data.count)+'銘柄'}${kind==='benefits'?` ／ 権利日未確認の${data.unknownDateCount??'—'}銘柄は除外`:''}</p>${data.status==='error'?'<p>予定を取得できませんでした。</p>':(data.items||[]).length?`<div style="overflow:auto"><table><thead><tr><th>権利確定日・候補</th><th>コード</th><th>銘柄</th></tr></thead><tbody>${data.items.map(x=>`<tr><td>${esc(x.date)}</td>${companyCells(x)}</tr>`).join('')}</tbody></table></div>`:'<p>この期間の日付が確認できる登録情報はありません。該当する制度がないことを意味するものではありません。</p>'}`;bindCompanyLinks(box);
    }catch(error){box.textContent=error.message;}
  }
  let earningsSeq=0,earningsState=null,lastQuoteRequestAt=0;const quoteCache=new Map();
  function earningsRows(state){return state.rows.filter(x=>{if(state.min==null&&state.max==null)return true;const p=state.prices.get(String(x.code))?.price;return p!=null&&(state.min==null||p>=state.min)&&(state.max==null||p<=state.max);});}
  function renderEarnings(state){
    if(earningsState!==state)return;const box=document.getElementById('earningsMonthList');if(!box)return;
    const open=new Set([...box.querySelectorAll('details[open]')].map(x=>x.dataset.earningsDate));const groups=new Map(),rows=earningsRows(state);
    for(const x of rows){if(!groups.has(x.date))groups.set(x.date,new Map());groups.get(x.date).set(String(x.code),x);}
    const codes=new Set(rows.map(x=>String(x.code))),filtered=state.min!=null||state.max!=null;
    box.innerHTML=`<p>${esc(state.data.start)}～${esc(state.data.end)}：${codes.size}銘柄${filtered?'（株価条件に一致する取得済み銘柄）':''}</p>${state.data.status==='error'?'<p>予定表の取得に失敗しました。</p>':groups.size?[...groups.keys()].sort().map(day=>{
      const items=[...groups.get(day).values()].sort((a,b)=>String(a.code).localeCompare(String(b.code),'ja'));
      return `<details data-earnings-date="${esc(day)}"${open.has(day)?' open':''} style="margin:12px 0"><summary style="cursor:pointer;padding:10px 0"><strong>${esc(day)}（${items.length}銘柄）</strong></summary><div style="overflow:auto"><table class="earnings-date-table"><colgroup><col class="earnings-code-col"><col class="earnings-name-col"><col class="earnings-price-col"></colgroup><thead><tr><th>コード</th><th>銘柄</th><th>現在株価</th></tr></thead><tbody>${items.map(x=>{
        const q=state.prices.get(String(x.code));const time=q?.timestamp?new Date(q.timestamp*1000).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'';
        return `<tr>${companyCells(x)}<td>${q?yen(q.price):'取得待ち'}${time?`<br><small>配信 ${esc(time)}</small>`:''}${q?.status==='error'?'<br><small>取得失敗</small>':''}</td></tr>`;
      }).join('')}</tbody></table></div></details>`;
    }).join(''):'<p>この期間・株価条件に一致する取得済みの予定はありません。</p>'}`;
    bindCompanyLinks(box);box.querySelectorAll('details').forEach(el=>el.addEventListener('toggle',()=>{if(el.open)queueEarningsPrices(state,state.rows.filter(x=>x.date===el.dataset.earningsDate));}));
    const status=document.getElementById('earningsPriceStatus');if(status)status.textContent=`株価取得 ${state.prices.size}/${new Set(state.rows.map(x=>String(x.code))).size}銘柄。${state.busy?'順次取得中… ':''}日付を展開すると株価を取得します。価格条件の検索時は全対象を取得し、未取得・取得失敗は絞込結果から除外します。株価は配信時刻の値です。`;
  }
  async function queueEarningsPrices(state,rows){
    let changed=false;
    for(const x of rows){const code=String(x.code),cached=quoteCache.get(code);if(!state.prices.has(code)&&cached&&Date.now()-cached.at<60000){state.prices.set(code,cached.data);changed=true;}if(!state.prices.has(code)&&!state.requested.has(code)){state.requested.add(code);state.queue.push(code);}}
    if(state.busy||!state.queue.length){if(changed)renderEarnings(state);return;}state.busy=true;renderEarnings(state);
    try{
      while(state.queue.length&&earningsState===state){
        const wait=Math.max(0,2100-(Date.now()-lastQuoteRequestAt));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
        if(earningsState!==state)break;lastQuoteRequestAt=Date.now();const codes=state.queue.splice(0,12);
        try{const data=await get('/api/events/prices?symbols='+encodeURIComponent(codes.map(x=>x+'.T').join(',')),60000);for(const code of codes){const q=(data.items||[]).find(x=>x.symbol===code+'.T')||{price:null,status:'error'};state.prices.set(code,q);quoteCache.set(code,{at:Date.now(),data:q});}}
        catch{for(const code of codes)state.prices.set(code,{price:null,status:'error'});}
        renderEarnings(state);
      }
    }finally{state.busy=false;renderEarnings(state);}
  }
  function applyEarningsFilter(clear=false){
    const state=earningsState;if(!state)return;const low=document.getElementById('earningsPriceMin'),high=document.getElementById('earningsPriceMax');if(clear){low.value='';high.value='';}
    const min=low.value.trim()===''?null:Number(low.value),max=high.value.trim()===''?null:Number(high.value);
    if((min!=null&&(!Number.isFinite(min)||min<0))||(max!=null&&(!Number.isFinite(max)||max<0))||(min!=null&&max!=null&&min>max)){document.getElementById('earningsPriceStatus').textContent='株価の下限・上限を正しく指定してください。';return;}
    state.min=min;state.max=max;renderEarnings(state);if(!clear&&(min!=null||max!=null))queueEarningsPrices(state,state.rows);
  }
  function searchEarningsMonth(){location.hash='#page-earnings-search';return loadEarningsMonth('month');}
  async function loadEarningsMonth(requestedMode){
    const mode=requestedMode==='month'||location.hash==='#page-earnings-search'?'month':'window';
    const seq=++earningsSeq;earningsState=null;const box=document.getElementById('earningsMonthList');if(!box)return;
    const yearInput=document.getElementById('earningsSearchYear'),monthInput=document.getElementById('earningsSearchMonth'),current=jst();
    if(yearInput&&!yearInput.options.length){yearInput.innerHTML=Array.from({length:101},(_,i)=>`<option value="${2000+i}">${2000+i}年</option>`).join('');yearInput.value=String(current.year);}
    if(monthInput&&!monthInput.dataset.initialized){monthInput.value=String(current.month);monthInput.dataset.initialized='true';}
    const title=document.getElementById('earningsPageTitle');if(title)title.textContent=mode==='month'?'決算発表検索':'今日から2週間先の決算発表銘柄';
    box.textContent='決算発表予定を取得中…';
    try{
      let data;
      if(mode==='month'){
        const year=Number(yearInput?.value),month=Number(monthInput?.value);
        if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12)throw new Error('検索する年と月を指定してください。');
        const value=`${year}-${String(month).padStart(2,'0')}`;
        const response=await get(`/api/events/month?year=${year}&month=${month}&kind=earnings`,3600000);
        data={...response,start:value+'-01',end:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)};
      }else data=await get(windowPath('earnings'),3600000);
      if(seq!==earningsSeq)return;
      const start=mode==='month'?data.start:todayIso();
      const rows=(data.items||[]).filter(x=>x.date>=start&&x.date<=data.end);const state={data,rows,prices:new Map(),requested:new Set(),queue:[],busy:false,min:null,max:null};earningsState=state;renderEarnings(state);
      const low=document.getElementById('earningsPriceMin'),high=document.getElementById('earningsPriceMax');if(low&&high&&(low.value||high.value))applyEarningsFilter();
    }catch(error){if(seq===earningsSeq)box.textContent=error.message;}
  }
  const registryKey='stockLearningEverFavoritesV1';let enrollPending=null;
  function readRegistry(){try{const raw=JSON.parse(localStorage.getItem(registryKey)||'{}');return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};}catch{return {};}}
  function writeRegistry(value){try{localStorage.setItem(registryKey,JSON.stringify(value));}catch{}}
  async function enroll(favorites){
    const registry=readRegistry();for(const item of favorites||[]){const code=String(item.code||'').toUpperCase();if(/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(code)&&!registry[code])registry[code]={name:item.name||code,registered:false};}writeRegistry(registry);
    if(enrollPending)return enrollPending;
    enrollPending=Promise.resolve().then(async()=>{
      const status=document.getElementById('favoriteTrackingStatus');
      try{
        let entries=Object.entries(readRegistry()).filter(([,value])=>!value.registered);
        if(entries.length&&status)status.textContent='学習用の継続記録対象を登録しています…';
        while(entries.length){
          const batch=entries.slice(0,25);const response=await fetch(`${API_BASE}/api/history/enroll`,{method:'POST',headers:{'Content-Type':'application/json','X-Widget-Token':widgetToken()},body:JSON.stringify({favorites:batch.map(([code,item])=>({code,name:item.name}))})});
          if(!response.ok)throw new Error('registration');
          const latest=readRegistry();for(const [code] of batch)if(latest[code])latest[code].registered=true;writeRegistry(latest);
          entries=Object.entries(readRegistry()).filter(([,value])=>!value.registered);
        }
        if(status)status.textContent='登録された銘柄は、お気に入りから削除しても始値・終値と予想の記録を継続します。';
      }catch{if(status)status.textContent='継続記録の登録が未完了です。お気に入りは保存済みです。次回アクセス時に再試行します。';}
      finally{enrollPending=null;}
    });return enrollPending;
  }
  window.stockExtras={loadDetail,loadMonthlySummary,openBenefits,loadEarningsMonth,searchEarningsMonth,enroll,loadWindowList,applyEarningsFilter,creditHtml,eventsHtml,comparisonHtml};
  window.addEventListener('DOMContentLoaded',()=>enroll(loadFavs()));
})();
