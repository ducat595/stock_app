/* Visible and keyboard-accessible controls for the single-row menu. */
window.addEventListener('DOMContentLoaded',()=>{
  const nav=document.getElementById('mainMenu'),shell=document.getElementById('menuScrollShell'),left=document.getElementById('menuScrollLeft'),right=document.getElementById('menuScrollRight'),hint=document.getElementById('menuScrollHint');
  if(!nav||!shell)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function update(){
    const maximum=Math.max(0,nav.scrollWidth-nav.clientWidth),overflow=maximum>2;
    left.hidden=right.hidden=hint.hidden=!overflow;
    left.disabled=nav.scrollLeft<=2;right.disabled=nav.scrollLeft>=maximum-2;
    shell.classList.toggle('has-overflow',overflow);shell.classList.toggle('can-scroll-left',overflow&&!left.disabled);shell.classList.toggle('can-scroll-right',overflow&&!right.disabled);
  }
  function move(distance){nav.scrollBy({left:distance,behavior:reduced.matches?'instant':'smooth'});}
  function revealActive(){
    const active=nav.querySelector('a.active');if(active){const item=active.getBoundingClientRect(),view=nav.getBoundingClientRect();if(item.left<view.left+4)move(item.left-view.left-4);else if(item.right>view.right-4)move(item.right-view.right+4);}update();
  }
  left.addEventListener('click',()=>move(-Math.max(120,nav.clientWidth*.75)));
  right.addEventListener('click',()=>move(Math.max(120,nav.clientWidth*.75)));
  nav.addEventListener('scroll',update,{passive:true});
  nav.addEventListener('focusin',event=>{if(event.target.matches('a')){const item=event.target.getBoundingClientRect(),view=nav.getBoundingClientRect();if(item.left<view.left)move(item.left-view.left-4);else if(item.right>view.right)move(item.right-view.right+4);}});
  new MutationObserver(revealActive).observe(nav,{attributes:true,attributeFilter:['class'],subtree:true});
  if(window.ResizeObserver)new ResizeObserver(revealActive).observe(nav);else window.addEventListener('resize',revealActive);
  revealActive();
});
