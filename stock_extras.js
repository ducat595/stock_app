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
  async function loadMonthlySummary(){
    const {year,month}=jst();
    try{
      const data=await get(`/api/events/month?year=${year}&month=${month}`,3600000);
      for(const [type,id,noteId] of [['dividends','currentDividendCount','currentDividendCountNote'],['benefits','currentBenefitCount','currentBenefitCountNote'],['earnings','currentEarningsCount','currentEarningsCountNote']]){
        const count=document.getElementById(id),note=document.getElementById(noteId),value=data[type];
        if(count)count.textContent=value?.count==null?'—':Number(value.count).toLocaleString('ja-JP')+'銘柄';
        if(note)note.textContent=type==='earnings'?`${year}年${month}月・JPX予定表に掲載された範囲（全銘柄の網羅ではありません）`:type==='benefits'?`${year}年${month}月の登録済み権利月候補・権利日と最新制度は未確認`:`${year}年${month}月の配当権利日候補・未確認日は候補表示`;
      }
    }catch{for(const id of ['currentDividendCount','currentBenefitCount','currentEarningsCount']){const el=document.getElementById(id);if(el)el.textContent='取得失敗';}}
  }
  function openBenefits(){const {month}=jst();location.hash='#page-benefits';openPage('benefits');document.getElementById('benefitMonth').value=String(month);loadBenefitList();}
  let earningsSeq=0;
  async function loadEarningsMonth(){
    const seq=++earningsSeq,{year,month}=jst();const box=document.getElementById('earningsMonthList');if(!box)return;box.textContent='今月の決算発表予定を取得中…';
    try{
      const data=await get(`/api/events/month?year=${year}&month=${month}&kind=earnings`,3600000);if(seq!==earningsSeq)return;
      const unique=new Map();for(const item of data.items||[]){const row=unique.get(item.code)||{...item,dates:[]};if(!row.dates.includes(item.date))row.dates.push(item.date);unique.set(item.code,row);}
      box.innerHTML=`<p>${year}年${month}月：JPX掲載分 ${unique.size}銘柄。${esc(data.note||'取得範囲には限りがあります。')}</p>${data.status==='error'?'<p>予定表の取得に失敗しました。</p>':`<div style="overflow:auto"><table><thead><tr><th>予定日</th><th>コード</th><th>銘柄</th></tr></thead><tbody>${[...unique.values()].map(x=>`<tr><td>${x.dates.map(esc).join(' ／ ')}</td><td><a href="https://finance.yahoo.co.jp/quote/${encodeURIComponent(String(x.code))}.T" target="_blank" rel="noopener noreferrer">${esc(x.code)}</a></td><td><a href="#page-detail" data-earnings-code="${esc(x.code)}">${esc(x.name)}</a></td></tr>`).join('')}</tbody></table></div>`}`;
      box.querySelectorAll('[data-earnings-code]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();location.hash='#page-detail';openPage('detail');evaluateDetailStock(link.dataset.earningsCode);}));
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
  window.stockExtras={loadDetail,loadMonthlySummary,openBenefits,loadEarningsMonth,enroll,creditHtml,eventsHtml,comparisonHtml};
  window.addEventListener('DOMContentLoaded',()=>enroll(loadFavs()));
})();
