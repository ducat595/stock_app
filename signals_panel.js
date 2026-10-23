/* v63 trusted Japanese news, score ordering, cache-aware display and forecast commentary. */
window.stockNewsSourceAllowed=function(item){
  const domains=['release.tdnet.info','www2.jpx.co.jp','tdnet-search.appspot.com','yahoo.co.jp','jp.reuters.com','bloomberg.co.jp','nikkei.com','nhk.or.jp','news.web.nhk','jiji.com','kyodonews.jp','kyodo.co.jp','asahi.com','mainichi.jp','yomiuri.co.jp','sankei.com','news.ntv.co.jp','tv-asahi.co.jp','newsdig.tbs.co.jp','fnn.jp','tv-tokyo.co.jp','kabutan.jp','minkabu.jp','toyokeizai.net','diamond.jp','itmedia.co.jp','businessinsider.jp','gamebiz.jp','ryutsuu.biz'];
  try{const url=new URL(item.url);if(url.protocol!=='https:'||url.username)return false;const host=url.hostname.toLowerCase();const source=host==='news.google.com'?String(item.sourceDomain||'').toLowerCase():host;return domains.some(d=>source===d||source.endsWith('.'+d))&&(host!=='news.google.com'||/^\/(rss\/)?articles\//.test(url.pathname));}catch{return false;}
};
window.stockSignalsHtml=function(model,esc,includeNews=true){
  if(!model || !model.featureSignals) return '';
  const sig=model.featureSignals||{}, events=model.disclosureLeads||[];
  const safe=x=>esc(String(x==null?'':x));
  const num=(value,suffix,dp)=>value==null||!Number.isFinite(Number(value))?'未取得':Number(value).toLocaleString('ja-JP',{maximumFractionDigits:dp==null?2:dp})+(suffix||'');
  const factors=[
    ['VWAP近似値',num(sig.vwapApprox,'円',2)],
    ['VWAPからの乖離',num(sig.vwapDeviationPct,'%',2)],
    ['同時刻比の出来高',num(sig.volumeToSameTimeAvg,'倍',2)],
    ['当日累積出来高',num(sig.volumeToday,'株',0)],
    ['過去比較日数',num(sig.comparisonSessions,'営業日',0)],
    ['実際の板情報','未取得'],
    ['業種別指数','未接続']
  ];
  const cards=factors.map(pair=>'<div style="background:#f6f9fc;border:1px solid #dde7f0;border-radius:9px;padding:11px;min-width:0"><small style="display:block;color:#64748b;margin-bottom:4px">'+safe(pair[0])+'</small><strong>'+safe(pair[1])+'</strong></div>').join('');
  const mc=model.marketContext||{}, tech=mc.tech||{}, stk=mc.stock||{}, mat=model.materialScores||{};
  const group=(heading,pairs)=>'<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">'+safe(heading)+'</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;margin:8px 0">'+pairs.map(p=>'<div style="padding:8px;border:1px solid #e2e8f0;border-radius:7px"><small style="display:block;color:#64748b">'+safe(p[0])+'</small><strong>'+safe(p[1])+'</strong></div>').join('')+'</div></details>';
  const otherGroups=group('テクニカル・企業指標',[
    ['RSI',num(tech.rsi,'',2)],['MA5',num(tech.ma5,'円',2)],['MA25',num(tech.ma25,'円',2)],
    ['MA75',num(tech.ma75,'円',2)],['MACD',num(tech.macd,'',2)],['MACDヒストグラム',num(tech.macdHist,'',2)],['PBR',num(stk.pbr,'倍',2)]
  ])+group('信用需給・企業材料',[
    ['信用買い残',num(stk.marginBuy,'株',0)],['信用売り残',num(stk.marginSell,'株',0)],
    ['信用倍率',num(stk.marginRatio,'倍',2)],['決算スコア',num(mat.earnings,'',3)],
    ['ニューススコア',num(mat.news,'',3)]
  ])+group('国内・海外マーケット',[
    ['日経平均',num(mc.nikkei&&mc.nikkei.changePct,'%',2)],['TOPIX',num(mc.topix&&mc.topix.changePct,'%',2)],
    ['NYダウ',num(mc.dow&&mc.dow.changePct,'%',2)],['S&P500',num(mc.sp500&&mc.sp500.changePct,'%',2)],
    ['NASDAQ',num(mc.nasdaq&&mc.nasdaq.changePct,'%',2)],['ドル円',num(mc.usdJpy&&mc.usdJpy.changePct,'%',2)]
  ]);
  return '<section style="margin-top:14px;padding:15px;background:#fff;border:1px solid #d7e3ee;border-radius:13px;color:#172b45">'+
    '<h3 style="margin:0 0 8px;font-size:15px">銘柄別データ・需給指標</h3>'+
    '<p style="font-size:12px;color:#52657c;margin:0 0 10px">観測・算出値。新しい特徴量は現行の時刻別予測価格に未反映です。</p>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">'+cards+'</div>'+
    otherGroups+
    '<details style="margin-top:12px"><summary style="font-weight:700;cursor:pointer">算出方法・利用範囲</summary>'+
    '<p style="font-size:12px">'+safe(sig.vwapMethod||'VWAP未取得')+'。'+safe(sig.volumeMethod||'')+'</p>'+
    '<p style="font-size:12px">VWAPは5分足からの近似で約定ティックVWAPではありません。板気配・業種別指数は未接続です。</p></details>'+
    (includeNews?window.stockNewsHtml(model.news||{status:'unavailable',items:events},esc):'')+'</section>';
};

window.stockNewsHtml=function(data,esc){
  const safe=value=>esc(String(value==null?'':value));
  const originalItems=Array.isArray(data?.items)?data.items:[];
  let items=originalItems.filter(window.stockNewsSourceAllowed);
  let effect=data?.effect;
  if(data?.fromCache||items.length!==originalItems.length){
    const now=Date.now();
    items=items.filter(item=>{const age=now-new Date(item.publishedAt).getTime();return Number.isFinite(age)&&age>=0&&age<=14*86400000;}).map(item=>{
      const age=(now-new Date(item.publishedAt).getTime())/1000;
      const eligible=age<=72*3600;
      return {...item,predictionEligible:eligible,decayWeight:eligible?Math.max(.25,1-age/(72*3600)):0};
    });
    if(effect){const directional=items.filter(x=>x.predictionEligible&&Number(x.score));const score=directional.reduce((total,x)=>total+Number(x.score)*x.decayWeight,0)/Math.max(1,directional.length);effect={...effect,eligibleCount:items.filter(x=>x.predictionEligible).length,score,adjustmentPct:score*(effect.maxAdjustmentPct??.35)};}
  }
  const scoreOf=item=>item.score!=null&&Number.isFinite(Number(item.score))?Number(item.score):-Infinity;
  items.sort((a,b)=>scoreOf(b)-scoreOf(a)||(new Date(b.publishedAt).getTime()||0)-(new Date(a.publishedAt).getTime()||0));
  const state=data?.status||'unavailable';
  const messages={loading:'ニュースを取得しています…',error:'ニュースの取得に失敗しました。時間をおいて再試行してください。',partial:items.length?`関連ニュースを${items.length}件取得しました。一部の配信元は応答していません。`:'一部の配信元から取得できませんでした。ニュースを再取得してください。',empty:'過去2週間の関連ニュースは見つかりませんでした。',unavailable:'ニュース機能の更新待ち、または取得状態が不明です。',ok:'銘柄コード・会社名で取得した関連ニュースです。'};
  const signed=(v,dp=3)=>{const n=Number(v);return v!=null&&Number.isFinite(n)?(n>0?'+':'')+n.toFixed(dp):'—';};
  const badge=(score,label)=>{const n=Number(score),color=n>0?'#137333':n<0?'#c5221f':'#5f6368',background=n>0?'#e6f4ea':n<0?'#fce8e6':'#f1f3f4';return `<span class="news-score" data-direction="${n>0?'up':n<0?'down':'neutral'}" style="display:inline-block;padding:4px 8px;border-radius:8px;color:${color};background:${background};font-weight:700">${safe(label)} ${safe(signed(score,2))}</span>`;};
  const impact=effect?`<p style="font-size:12px">判定対象 ${Number(effect.eligibleCount)||0}件 ／ ${badge(effect.score,'総合スコア')}（−1～+1） ／ 予想騰落率への補正 ${safe(signed(effect.adjustmentPct))}%ポイント</p>`:'';
  const cards=items.map(item=>{
    const validLink=typeof item.url==='string'&&/^https:\/\/[^/\s]+/i.test(item.url);
    const published=new Date(item.publishedAt);
    const date=Number.isNaN(published.getTime())?'日時不明':published.toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});
    const eligibility=item.predictionEligible?'予測への反映対象（72時間以内）':item.predictionEligible===false?'表示のみ（掲載後72時間超）':'表示のみ（判定状態不明）';
    const title=validLink?`<a href="${safe(item.url)}" target="_blank" rel="noopener noreferrer">${safe(item.title)}</a>`:safe(item.title);
    return `<li style="padding:12px 0;border-bottom:1px solid #e2e8f0">${badge(item.score,Number(item.score)>0?'上昇材料':Number(item.score)<0?'下落材料':'中立')}<br><strong style="display:block;margin-top:7px">${title}</strong><div><small>${safe(item.source)} ／ ${safe(date)}<br>${safe((item.categories||[]).join('・')||'中立・分類外')}<br>${safe(eligibility)}</small></div></li>`;
  });
  const cacheNote=data?.refreshing?'保存済みのニュースを先に表示しています。最新情報を確認中…':data?.refreshFailed?'更新に失敗したため、保存済みのニュースを表示しています。':data?.fromCache?'保存済みのニュースを表示しています。':'';
  const list=`<ul style="padding-left:20px">${cards.slice(0,12).join('')||'<li>表示できる記事はありません。</li>'}</ul>${cards.length>12?`<details><summary style="cursor:pointer">残り${cards.length-12}件を表示</summary><ul style="padding-left:20px">${cards.slice(12).join('')}</ul></details>`:''}`;
  return `<div class="stock-news-content"><h3 style="font-size:16px">関連ニュース・企業材料（${items.length}件）</h3><p><a href="https://tdnet-search.appspot.com/" target="_blank" rel="noopener noreferrer">TDnet検索（TDnetSearch）</a> ／ <a href="https://www.jpx.co.jp/listing/disclosure/index.html" target="_blank" rel="noopener noreferrer">JPX公式・適時開示情報</a></p><p role="status">${safe(messages[state]||messages.unavailable)}${cacheNote?'<br>'+safe(cacheNote):''}</p>${impact}<p class="muted">スコアが高い順（プラス→マイナス）。掲載後2週間表示し、3日以内を予想の判定対象にします。</p><details><summary>スコアの見方・予想への反映</summary><p class="muted">緑は上昇材料、赤は下落材料、灰色は中立です。見出し・配信要約を分類し、経過時間で影響を弱めます。補正上限は±0.35%ポイント。TDnetは非公式APIとTDnet Searchから取得し、開示タイトルを判定します。PDF本文の照合・精度の校正は未実施です。予想コメントは、その予想を計算した時点の記事に基づきます。</p></details>${data?.fetchedAt?`<p class="muted">最終取得：${safe(new Date(data.fetchedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}))}</p>`:''}${list}</div>`;
};

window.stockNewsImpactHtml=function(model,esc){
  const effect=model?.newsEffect;
  if(!effect)return '';
  if(Array.isArray(model.timeSlots)&&!model.timeSlots.some(x=>x.status==='forecast'&&x.newsAdjustmentPct!=null))return '<section class="news-forecast-comment"><strong>ニュースが予想に与えた影響</strong><p>これから先の予測対象がないため、この表示ではニュースによる価格補正は行っていません。</p></section>';
  const safe=x=>esc(String(x??''));
  const signed=x=>(Number(x)>0?'+':'')+Number(x).toFixed(3);
  const contributors=Array.isArray(effect.contributors)?effect.contributors.filter(window.stockNewsSourceAllowed):[];
  const closing=(model.timeSlots||[]).find(x=>x.label==='大引け'&&x.status==='forecast'&&x.baselineForecastPrice!=null&&x.newsAdjustmentPct!=null);
  const prices=closing?`<p>ニュース補正前 ${safe(closing.baselineForecastPrice)}円 → 補正後 ${safe(closing.forecastPrice)}円</p>`:'';
  const color=Number(effect.score)>0?'#137333':Number(effect.score)<0?'#c5221f':'#5f6368';
  const articles=contributors.map(item=>{
    const c=Number(item.contributionPct)>0?'#137333':Number(item.contributionPct)<0?'#c5221f':'#5f6368';
    const title=typeof item.url==='string'&&/^https:\/\/[^/\s]+/i.test(item.url)?`<a href="${safe(item.url)}" target="_blank" rel="noopener noreferrer">${safe(item.title)}</a>`:safe(item.title);
    return `<li>${title}<br>${safe(item.explanation)} <strong style="color:${c}">予想騰落率へ ${safe(signed(item.contributionPct))}%ポイント</strong></li>`;
  }).join('');
  return `<section class="news-forecast-comment" style="margin:14px 0;padding:12px;border:1px solid #dbe3ee;border-radius:10px"><strong style="color:${color}">ニュースが予想に与えた影響</strong><p>${safe(effect.commentary||'ニュースの補正値は予想価格・上昇確率に反映されています。記事別の説明は更新後の予想で表示します。')}</p>${prices}${articles?`<ul>${articles}</ul><small>影響の大きい記事を最大5件表示。掲載時刻と経過時間を考慮したルール判定です。</small>`:''}</section>`;
};
