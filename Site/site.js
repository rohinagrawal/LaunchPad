/* LaunchPad landing page behaviour: theme switch, the scroll story, the live demo frame,
   copy buttons and reveal-on-scroll. No dependencies. The page reads fine with this file missing. */
(function(){
'use strict';
const root=document.documentElement;
root.classList.add('js');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- theme ---------- */
document.getElementById('themebtn').addEventListener('click',()=>{
  const t=root.dataset.theme==='light'?'dark':'light';
  root.dataset.theme=t;
  try{localStorage.setItem('launchpad_site_theme',t);}catch(e){}
  try{document.getElementById('demoframe').contentWindow.__demoTheme(t);}catch(e){}
});

/* ---------- scroll story ----------
   The section is several screens tall and its stage is sticky, so scrolling does not move the
   stage; it moves the card. Progress through the section picks the step, and between two steps
   the card slides from one column's slot to the next while the board pans to keep it in view. */
const story=document.querySelector('.story'),stage=story.querySelector('.stage');
const win=document.getElementById('win'),view=document.getElementById('mview'),track=document.getElementById('mtrack'),card=document.getElementById('hcard');
const stepEls=[...stage.querySelectorAll('.steps li')];
const cols=[...track.querySelectorAll('.mcol')];
const STEP_COL=[0,1,1,2,3,4];           // which column the card sits in at each step
const GHOSTS=cols.map(c=>c.querySelectorAll('.gcard').length);
const N=STEP_COL.length;
let slots=[],viewW=0,trackW=0,step=-1,ticking=false;

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

function measure(){
  slots=cols.map(c=>{const s=c.querySelector('.slot');return{x:s.offsetLeft,y:s.offsetTop,w:s.offsetWidth};});
  const cs=getComputedStyle(view);
  viewW=view.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  trackW=track.scrollWidth;
  card.style.width=slots[0].w+'px';
}
function setStep(s){
  if(s===step)return;step=s;
  stage.dataset.step=s;
  stepEls.forEach((el,i)=>el.classList.toggle('on',i===s));
  const at=STEP_COL[s];
  GHOSTS.forEach((g,i)=>{
    const n=g+(i===at?1:0);
    track.querySelector('[data-ct="'+i+'"]').textContent=n;
    stage.querySelector('[data-kpi="'+i+'"]').textContent=n;
  });
}
function update(){
  ticking=false;
  const r=story.getBoundingClientRect(),vh=innerHeight;
  const p=clamp(-r.top/(r.height-vh),0,1);
  const f=p*(N-1),i=Math.min(Math.floor(f),N-2);
  const t=ease(clamp((f-i-.3)/.4,0,1));          // hold, slide, hold
  const a=slots[STEP_COL[i]],b=slots[STEP_COL[i+1]];
  const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
  const lift=a===b?0:Math.sin(Math.PI*t);
  card.style.transform='translate('+x+'px,'+(y-lift*10)+'px) rotate('+(lift*2.5)+'deg) scale('+(1+lift*.05)+')';
  const pan=clamp(x+a.w/2-viewW/2,0,Math.max(0,trackW-viewW));
  track.style.transform='translateX('+(-pan)+'px)';
  setStep(t>.5?i+1:i);
  // The window tips back while it rises into view and lies flat once the stage is pinned.
  const enter=reduced?1:clamp(1-r.top/vh,0,1);
  win.style.transform='perspective(1400px) rotateX('+((1-enter)*16)+'deg) scale('+(.92+.08*enter)+')';
}
function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(update);}}
measure();update();
addEventListener('scroll',onScroll,{passive:true});
addEventListener('resize',()=>{measure();update();});
// Clicking a step scrolls to the point in the section where that step is showing.
stage.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{
  const top=story.getBoundingClientRect().top+scrollY;
  scrollTo({top:top+(story.offsetHeight-innerHeight)*(+b.dataset.go/(N-1)),behavior:reduced?'auto':'smooth'});
}));

/* ---------- live demo ----------
   The frame holds the real tracker (see build.py). It reads the page's theme when it loads;
   Reset drops the tab's demo edits and loads it again. */
const frame=document.getElementById('demoframe');
document.getElementById('demoreset').addEventListener('click',()=>{
  try{sessionStorage.removeItem('launchpad_demo_v1');}catch(e){}
  frame.src='app/#jobs';
  try{frame.contentWindow.location.reload();}catch(e){}
});

/* ---------- copy buttons ---------- */
document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',()=>{
  const done=()=>{b.textContent='Copied';setTimeout(()=>{b.textContent='Copy';},1400);};
  if(navigator.clipboard)navigator.clipboard.writeText(b.dataset.copy).then(done,()=>{});
}));

/* ---------- reveal on scroll ---------- */
const rv=[...document.querySelectorAll('.rv')];
if(reduced||!('IntersectionObserver' in window))rv.forEach(el=>el.classList.add('in'));
else{
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px'});
  rv.forEach((el,i)=>{el.style.transitionDelay=(i%4)*60+'ms';io.observe(el);});
}
})();
