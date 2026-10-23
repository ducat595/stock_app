const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const context={window:{},URL};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../signals_panel.js'),'utf8'),context);
const render=context.window.stockNewsHtml;
const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

test('news renders without a forecast or feature signals',()=>{
  const html=render({status:'ok',items:[{title:'業績上方修正',source:'配信元',publishedAt:'2026-10-23T00:00:00Z',score:1,categories:['業績上方修正'],predictionEligible:true,url:'https://jp.reuters.com/news'}],effect:{eligibleCount:1,score:.5,adjustmentPct:.175}},escape);
  assert.match(html,/業績上方修正/);
  assert.match(html,/72時間以内/);
  assert.match(html,/\+0\.175/);
  assert.match(html,/target="_blank" rel="noopener noreferrer"/);
});

test('display-only articles and fetch failures are distinct',()=>{
  assert.match(render({status:'empty',items:[]},escape),/見つかりませんでした/);
  assert.match(render({status:'error',items:[]},escape),/取得に失敗/);
  assert.match(render({status:'partial',items:[]},escape),/一部の取得先/);
  assert.match(render({status:'loading',items:[]},escape),/取得しています/);
  assert.match(render({status:'ok',items:[{title:'古い記事',predictionEligible:false,url:'https://jp.reuters.com/old'}]},escape),/掲載後72時間超/);
});

test('untrusted article content is escaped and unsafe links are not clickable',()=>{
  const html=render({status:'ok',items:[{title:'<img src=x onerror=alert(1)>',source:'<script>bad</script>',categories:['<b>risk</b>'],url:'javascript:alert(1)'}]},escape);
  assert(!html.includes('<img'));
  assert(!html.includes('<script>'));
  assert(!html.includes('href="javascript:'));
  assert(!html.includes('onerror=alert'));
});

test('article scores sort descending, with green positive and red negative badges',()=>{
  const items=[{title:'negative',score:-1,url:'https://jp.reuters.com/a'},{title:'neutral',score:0,url:'https://jp.reuters.com/b'},{title:'positive',score:1,url:'https://jp.reuters.com/c'},{title:'missing',url:'https://jp.reuters.com/d'}];
  const html=render({status:'ok',items},escape);
  assert(html.indexOf('>positive<')<html.indexOf('>neutral<'));
  assert(html.indexOf('>neutral<')<html.indexOf('>negative<'));
  assert(html.indexOf('>negative<')<html.indexOf('>missing<'));
  assert.match(html,/data-direction="up"[^>]*color:#137333/);
  assert.match(html,/data-direction="down"[^>]*color:#c5221f/);
  assert.match(html,/data-direction="neutral"[^>]*color:#5f6368/);
  assert.equal(items[0].title,'negative');
});

test('cached news cannot remain eligible after 72h or visible after 14 days',()=>{
  const now=Date.now();
  const html=render({status:'ok',fromCache:true,items:[
    {title:'expired',score:1,url:'https://jp.reuters.com/expired',publishedAt:new Date(now-15*86400000).toISOString()},
    {title:'display-only',score:1,url:'https://jp.reuters.com/old',predictionEligible:true,publishedAt:new Date(now-4*86400000).toISOString()}],
    effect:{eligibleCount:2,score:1,adjustmentPct:.35}},escape);
  assert(!html.includes('>expired<'));assert.match(html,/掲載後72時間超/);assert.match(html,/判定対象 0件/);
});

test('forecast commentary uses the exact forecast snapshot and signed article contributions',()=>{
  const html=context.window.stockNewsImpactHtml({newsEffect:{score:-.5,commentary:'下方修正の記事を反映',contributors:[{title:'対象記事',explanation:'収益期待の悪化',contributionPct:-.175,url:'https://jp.reuters.com/'}]},timeSlots:[{label:'大引け',status:'forecast',baselineForecastPrice:100,forecastPrice:99.825,newsAdjustmentPct:-.175}]},escape);
  assert.match(html,/下方修正の記事を反映/);assert.match(html,/対象記事/);assert.match(html,/収益期待の悪化/);
  assert.match(html,/-0.175/);assert.match(html,/補正前 100円/);assert.match(html,/補正後 99.825円/);assert.match(html,/color:#c5221f/);
});

test('untrusted sources and missing redirect publisher metadata are not displayed or scored',()=>{
  const html=render({status:'ok',items:[{title:'不審な上方修正',url:'https://media.unisba.ac.id/video',score:1,predictionEligible:true,publishedAt:new Date().toISOString()}],effect:{eligibleCount:1,score:1,adjustmentPct:.35}},escape);
  assert(!html.includes('不審な上方修正'));assert.match(html,/判定対象 0件/);
  assert.equal(context.window.stockNewsSourceAllowed({url:'https://news.google.com/rss/articles/id'}),false);
  assert.equal(context.window.stockNewsSourceAllowed({url:'https://news.google.com/rss/articles/id',sourceDomain:'finance.yahoo.co.jp'}),true);
  assert.equal(context.window.stockNewsSourceAllowed({url:'https://jp.reuters.com.evil.example/'}),false);
});
