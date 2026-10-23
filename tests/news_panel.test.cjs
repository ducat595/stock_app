const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const context={window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../signals_panel.js'),'utf8'),context);
const render=context.window.stockNewsHtml;
const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

test('news renders without a forecast or feature signals',()=>{
  const html=render({status:'ok',items:[{title:'業績上方修正',source:'配信元',publishedAt:'2026-10-23T00:00:00Z',score:1,categories:['業績上方修正'],predictionEligible:true,url:'https://example.com/news'}],effect:{eligibleCount:1,score:.5,adjustmentPct:.175}},escape);
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
  assert.match(render({status:'ok',items:[{title:'古い記事',predictionEligible:false}]},escape),/掲載後72時間超/);
});

test('untrusted article content is escaped and unsafe links are not clickable',()=>{
  const html=render({status:'ok',items:[{title:'<img src=x onerror=alert(1)>',source:'<script>bad</script>',categories:['<b>risk</b>'],url:'javascript:alert(1)'}]},escape);
  assert(!html.includes('<img'));
  assert(!html.includes('<script>'));
  assert(!html.includes('href="javascript:'));
  assert(html.includes('&lt;img'));
});
