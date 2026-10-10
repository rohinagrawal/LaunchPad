/* LaunchPad landing page behaviour: theme, nav, the scroll story, facts, the live demo frame,
   the skills terminal, copy buttons and reveal-on-scroll. No dependencies. The page reads
   fine with this file missing. */
(function(){
'use strict';
const root=document.documentElement;
root.classList.add('js');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide=matchMedia('(min-width:821px)');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const frame=document.getElementById('demoframe');

/* ---------- theme ---------- */
document.getElementById('themebtn').addEventListener('click',()=>{
  const t=root.dataset.theme==='light'?'dark':'light';
  root.dataset.theme=t;
  try{localStorage.setItem('launchpad_site_theme',t);}catch(e){}
  try{frame.contentWindow.__demoTheme(t);}catch(e){}
});

/* ---------- nav: phone menu, progress line, current section ---------- */
const nav=document.querySelector('.nav'),links=document.getElementById('navlinks'),menuBtn=document.getElementById('menubtn');
function setMenu(open){links.classList.toggle('open',open);menuBtn.setAttribute('aria-expanded',open?'true':'false');}
menuBtn.addEventListener('click',()=>setMenu(!links.classList.contains('open')));
links.addEventListener('click',e=>{if(e.target.tagName==='A')setMenu(false);});
const navLinks=[...links.querySelectorAll('a')];
const sections=navLinks.map(a=>document.querySelector(a.getAttribute('href')));
function paintNav(){
  const max=document.documentElement.scrollHeight-innerHeight;
  nav.style.setProperty('--sp',(max>0?clamp(scrollY/max,0,1)*100:0)+'%');
  let cur=-1;
  sections.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<innerHeight*.4)cur=i;});
  navLinks.forEach((a,i)=>a.classList.toggle('on',i===cur));
}

/* ---------- scroll story ----------
   The runway is several screens tall and its stage is sticky, so scrolling does not move the
   stage; it moves the cards. Progress along the runway is a number f from 0 to STEPS-1. Each
   scene (the Jobs board, the People board) lists when its card slides from one column to
   another, as [from f, to f, from column, to column]; the board pans to keep the card in view.
   On wide screens the hero is pinned over the step list first and fades out as you start. */
const runway=document.querySelector('.runway'),stage=runway.querySelector('.stage'),hero=document.querySelector('.hero');
const win=document.getElementById('win'),sbar=document.getElementById('sbar'),mtitle=document.getElementById('mtitle');
const stepEls=[...stage.querySelectorAll('.steps li')];
const STEP_SCENE=['jobs','jobs','people','people','jobs','jobs','jobs'];
const TITLE={jobs:'Jobs',people:'People'};
const STEPS=STEP_SCENE.length;
function scene(name,moves){
  const view=stage.querySelector('.mview.'+name),track=view.querySelector('.mtrack'),cols=[...track.querySelectorAll('.mcol')];
  return{name,view,track,cols,moves,card:track.querySelector('.hcard'),ghosts:cols.map(c=>c.querySelectorAll('.gcard').length),col:-1};
}
const SCENES=[
  scene('jobs',[[.3,.7,0,1],[3.55,3.9,1,2],[4.3,4.7,2,3],[5.3,5.7,3,4]]),
  scene('people',[[2.1,2.4,0,2],[2.6,2.9,2,3],[3.05,3.4,3,4]])
];
let step=-1,intro=0,ticking=false;

function measure(){
  SCENES.forEach(s=>{
    s.slots=s.cols.map(c=>{const el=c.querySelector('.slot');return{x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth};});
    const cs=getComputedStyle(s.view);
    s.viewW=s.view.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
    s.trackW=s.track.scrollWidth;
    s.card.style.width=s.slots[0].w+'px';
  });
  intro=wide.matches?innerHeight*.55:0;
  // The pinned hero gets the step column plus the room the shrunken window leaves beside it.
  const wrap=win.parentNode;   // measured on the wrapper, which the window's own tilt does not move
  if(wide.matches)hero.style.setProperty('--herow',Math.max(300,wrap.getBoundingClientRect().left-hero.getBoundingClientRect().left+wrap.offsetWidth*.2-32)+'px');
}
function place(s,f){
  let a=s.moves[0][2],b=a,t=0;
  for(const m of s.moves){
    if(f<=m[0])break;
    a=m[2];b=m[3];t=ease(clamp((f-m[0])/(m[1]-m[0]),0,1));
    if(f<m[1])break;
    a=b;t=0;
  }
  const A=s.slots[a],B=s.slots[b],x=A.x+(B.x-A.x)*t,y=A.y+(B.y-A.y)*t,lift=a===b?0:Math.sin(Math.PI*t);
  s.card.style.transform='translate('+x+'px,'+(y-lift*10)+'px) rotate('+(lift*2.5)+'deg) scale('+(1+lift*.05)+')';
  s.track.style.transform='translateX('+(-clamp(x+A.w/2-s.viewW/2,0,Math.max(0,s.trackW-s.viewW)))+'px)';
  const col=t>.5?b:a;
  if(col!==s.col){
    s.col=col;
    s.ghosts.forEach((g,i)=>{
      const n=g+(i===col?1:0);
      s.track.querySelector('[data-ct="'+i+'"]').textContent=n;
      if(s.name==='jobs')stage.querySelector('[data-kpi="'+i+'"]').textContent=n;
    });
  }
}
function setStep(n){
  if(n===step)return;step=n;
  const sc=STEP_SCENE[n];
  stage.dataset.step=n;stage.dataset.scene=sc;mtitle.textContent=TITLE[sc];
  stepEls.forEach((el,i)=>el.classList.toggle('on',i===n));
  stage.querySelectorAll('[data-rail]').forEach(el=>el.classList.toggle('on',el.dataset.rail===sc));
}
function update(){
  ticking=false;
  const r=runway.getBoundingClientRect(),vh=innerHeight;
  const p=clamp((-r.top-intro)/(r.height-vh-intro),0,1),f=p*(STEPS-1);
  SCENES.forEach(s=>place(s,f));
  setStep(Math.round(f));
  sbar.style.width=(p*100)+'%';
  if(wide.matches){
    // k runs 0 to 1 over the first stretch of scrolling: hero out, step list in, window flat.
    const k=reduced?(-r.top>intro*.5?1:0):clamp((nav.offsetHeight-r.top)/(intro*.8),0,1);
    hero.style.opacity=1-k;hero.style.transform='translateY('+(-k*28)+'px)';
    hero.style.visibility=k>=1?'hidden':'visible';hero.style.pointerEvents=k>.5?'none':'';
    stage.style.setProperty('--k',k);
    win.style.transform='perspective(1600px) translateX('+((1-k)*2)+'%) rotateY('+(-(1-k)*13)+'deg) rotateX('+((1-k)*3)+'deg) scale('+(.86+.14*k)+')';
  }else{
    hero.style.opacity=hero.style.transform=hero.style.visibility=hero.style.pointerEvents='';
    stage.style.setProperty('--k',1);
    const enter=reduced?1:clamp(1-stage.getBoundingClientRect().top/vh,0,1);
    win.style.transform='perspective(1400px) rotateX('+((1-enter)*16)+'deg) scale('+(.92+.08*enter)+')';
  }
  paintNav();
}
function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(update);}}
function goStep(n){
  const top=runway.getBoundingClientRect().top+scrollY;
  scrollTo({top:top+intro+(runway.offsetHeight-innerHeight-intro)*(n/(STEPS-1)),behavior:reduced?'auto':'smooth'});
}
measure();update();
addEventListener('scroll',onScroll,{passive:true});
addEventListener('resize',()=>{measure();update();});
addEventListener('load',()=>{measure();update();});
stage.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>goStep(+b.dataset.go)));
// "How it works" lands on the first step, past the hero.
document.querySelectorAll('a[href="#how"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();goStep(0);}));

/* ---------- facts: count up once, when seen ---------- */
function countUp(el){
  const to=+el.dataset.count;if(!to||reduced)return;
  const t0=performance.now();
  (function tick(now){const t=clamp((now-t0)/900,0,1);el.textContent=Math.round(to*ease(t));if(t<1)requestAnimationFrame(tick);})(t0);
}

/* ---------- GitHub stars: shown only once there are enough to be worth showing ---------- */
fetch('https://api.github.com/repos/rohinagrawal/LaunchPad').then(r=>r.ok?r.json():null).then(j=>{
  if(!j||!(j.stargazers_count>=10))return;
  document.querySelectorAll('[data-stars]').forEach(el=>{el.textContent='★ '+j.stargazers_count.toLocaleString();});
}).catch(()=>{});

/* ---------- live demo ----------
   The frame holds the real tracker (see build.py). It reads the page's theme when it loads.
   The chips above it call the tracker's own navigation; Reset drops the tab's demo edits. */
const SCREEN_HASH={move:'move',jobs:'jobs',people:'people',companies:'companies',interviews:'interviews',insights:'insights',palette:'jobs'};
document.querySelectorAll('[data-demo]').forEach(b=>b.addEventListener('click',()=>{
  const what=b.dataset.demo;
  document.querySelectorAll('[data-demo]').forEach(x=>x.classList.toggle('on',x===b));
  frame.scrollIntoView({behavior:reduced?'auto':'smooth',block:'center'});
  try{
    const w=frame.contentWindow;
    if(what==='palette')w.Screens.openPalette();else w.setDataset(what);
  }catch(e){frame.src='app/#'+SCREEN_HASH[what];}   // not loaded yet: open it on that screen
}));
document.getElementById('demoreset').addEventListener('click',()=>{
  try{sessionStorage.removeItem('launchpad_demo_v1');}catch(e){}
  frame.src='app/#jobs';
  try{frame.contentWindow.location.reload();}catch(e){}
});

/* ---------- skills terminal: each prompt plays an example run ---------- */
const RUNS={
  'setup-launchpad':['Checks the tracker app that ships in the repository','Asks what roles you want and writes your job thesis','Builds your master resume from the resume you give it','Writes the answer bank that application forms draw on','!Offers the daily routine and hosting. Never overwrites what is there.'],
  'job-scrub':['Reads your job thesis','Searches public job boards for matching roles','Drops the ones already on your board','Scores each match with a six-part fit breakdown','!Adds them to Screening for you to keep or drop.'],
  'people-finder':['Looks for former colleagues, fellow alumni, engineers in the team, hiring managers and recruiters','Ranks them by how likely they are to refer you','Adds them to People, linked to the role','!Connection requests go only to people you approved.'],
  'referral-outreach':['Drafts a tailored ask for each person who connected','Attaches your resume','Sends the asks you ticked, by LinkedIn or email','Lines up a single follow-up','!Anything you have not approved stays a draft.'],
  'generate-docs':['Finds To Apply cards that have no documents yet','Writes a tailored resume from your master resume','Writes a cover letter for the role','!Links both on the card for you to read.'],
  'apply-to-job':['Opens the application form in the browser','Fills it from your answer bank and resume','!Stops for your review. You press Submit.','Marks the card Applied'],
  'interview-prep':['Researches the company and the round','Lists the questions they are likely to ask','Builds stories from your real experience only','Adds questions for you to ask','!Links the prep document on the card.'],
  'reply-monitor':['Reads your inbox for replies to applications and referral asks','Matches each reply to its card','Moves the cards forward: Phone Screen, Interviewing, Rejected','!Leaves the replies that need a human answer to you.']
};
const ctLines=document.getElementById('ctlines'),ctName=document.getElementById('ctname');
const asks=[...document.querySelectorAll('.asks [role=tab]')];
let runId=0;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function line(text,cls){const li=document.createElement('li');if(cls)li.className=cls;const sp=document.createElement('span');sp.textContent=text;li.appendChild(sp);ctLines.appendChild(li);return li;}
async function play(tab){
  const id=++runId,skill=tab.dataset.skill,say=tab.textContent;
  asks.forEach(t=>t.setAttribute('aria-selected',t===tab?'true':'false'));
  ctName.textContent=skill+' · example run';
  ctLines.textContent='';
  const steps=RUNS[skill].map(s=>s[0]==='!'?[s.slice(1),'stop']:[s,'']);
  if(reduced){line(say,'you');steps.forEach(s=>line(s[0],s[1]));return;}
  const you=line('','you typing'),sp=you.firstChild;
  for(let i=1;i<=say.length;i++){if(id!==runId)return;sp.textContent=say.slice(0,i);await wait(28);}
  you.classList.remove('typing');
  for(const s of steps){await wait(520);if(id!==runId)return;line(s[0],s[1]);}
}
asks.forEach((tab,i)=>{
  tab.addEventListener('click',()=>play(tab));
  tab.addEventListener('keydown',e=>{
    const d=e.key==='ArrowDown'||e.key==='ArrowRight'?1:e.key==='ArrowUp'||e.key==='ArrowLeft'?-1:0;
    if(!d)return;e.preventDefault();
    const next=asks[(i+d+asks.length)%asks.length];next.focus();play(next);
  });
});

/* ---------- copy buttons ---------- */
document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',()=>{
  const done=()=>{b.textContent='Copied';setTimeout(()=>{b.textContent='Copy';},1400);};
  if(navigator.clipboard)navigator.clipboard.writeText(b.dataset.copy).then(done,()=>{});
}));

/* ---------- reveal on scroll ---------- */
const rv=[...document.querySelectorAll('.rv')];
function seen(el){el.classList.add('in');el.querySelectorAll('[data-count]').forEach(countUp);}
if(reduced||!('IntersectionObserver' in window))rv.forEach(el=>el.classList.add('in'));
else{
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){seen(e.target);io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px'});
  rv.forEach((el,i)=>{el.style.transitionDelay=(i%4)*60+'ms';io.observe(el);});
}
})();
