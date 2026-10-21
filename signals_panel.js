/* v61 stock-associated observations and unverified news leads. */
window.stockSignalsHtml=function(model,esc){
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
  const leads=events.length?events.map(e=>{
    const label=(e.categories||[]).length?e.categories.map(safe).join('・'):'分類外';
    const url=typeof e.url==='string'&&e.url.startsWith('https://')?'<a href="'+safe(e.url)+'" target="_blank" rel="noopener noreferrer">記事を開く</a>':'';
    return '<li style="padding:10px 0;border-bottom:1px solid #e2e8f0;line-height:1.6"><strong>'+safe(e.title)+'</strong><div><small>'+label+' ／ ニュース見出し・TDnet未照合'+(e.publishedAt?' ／ '+safe(e.publishedAt):'')+'</small> '+url+'</div></li>';
  }).join(''):'<li>関連ニュースを取得できませんでした。開示が存在しないという意味ではありません。</li>';
  return '<section style="margin-top:14px;padding:15px;background:#fff;border:1px solid #d7e3ee;border-radius:13px;color:#172b45">'+
    '<h3 style="margin:0 0 8px;font-size:15px">銘柄別データ・需給指標</h3>'+
    '<p style="font-size:12px;color:#52657c;margin:0 0 10px">観測・算出値。新しい特徴量は現行の時刻別予測価格に未反映です。</p>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">'+cards+'</div>'+
    otherGroups+
    '<details style="margin-top:12px"><summary style="font-weight:700;cursor:pointer">算出方法・利用範囲</summary>'+
    '<p style="font-size:12px">'+safe(sig.vwapMethod||'VWAP未取得')+'。'+safe(sig.volumeMethod||'')+'</p>'+
    '<p style="font-size:12px">VWAPは5分足からの近似で約定ティックVWAPではありません。板気配・業種別指数は未接続です。</p></details>'+
    '<details open style="margin-top:12px"><summary style="font-weight:700;cursor:pointer">関連ニュース・企業材料（'+events.length+'件）</summary>'+
    '<p style="font-size:12px;color:#80571d">ニュース見出しからの参考分類です。公式TDnet適時開示とは未照合で、株価予測への自動反映も未実装です。</p>'+
    '<ul style="padding-left:20px;margin:0;max-height:360px;overflow:auto">'+leads+'</ul></details></section>';
};