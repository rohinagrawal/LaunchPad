/* Live demo shim. Site/build.py adds this file to a copy of the tracker so the landing page can
   show the real app with no server: it answers the tracker's own requests (health, data.json,
   contacts.json, the saves…) from demo-data.json, and keeps edits in this browser tab only. */
(function(){
'use strict';
var STORE='launchpad_demo_v1';
var framed=window.parent!==window;
// Inside the landing page the demo wears the page's theme; opened by itself it keeps the app's own rule.
function setTheme(t){
  if(t!=='light'&&t!=='dark')return;
  try{localStorage.setItem('launchpad_theme',t);}catch(e){}
  document.documentElement.dataset.theme=t;
  if(typeof window.paintTheme==='function')window.paintTheme();
}
window.__demoTheme=setTheme;
if(framed){try{setTheme(window.parent.document.documentElement.dataset.theme);}catch(e){}}

var realFetch=window.fetch.bind(window);
var base=new URL('.',location.href).pathname;

// The demo's dates were written on the day the site was built; move them so "4 days ago" stays true.
function shiftDates(v,days){
  if(typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)){
    var d=new Date(v+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
  }
  if(Array.isArray(v))return v.map(function(x){return shiftDates(x,days);});
  if(v&&typeof v==='object'){var o={};Object.keys(v).forEach(function(k){o[k]=shiftDates(v[k],days);});return o;}
  return v;
}
function keep(db){try{sessionStorage.setItem(STORE,JSON.stringify(db));}catch(e){}}
var ready=(function(){
  try{var raw=sessionStorage.getItem(STORE);if(raw)return Promise.resolve(JSON.parse(raw));}catch(e){}
  return realFetch('demo-data.json',{cache:'no-store'}).then(function(r){return r.json();}).then(function(seed){
    var days=Math.round((Date.parse(new Date().toISOString().slice(0,10))-Date.parse(seed.builtOn))/864e5);
    var db={jobs:shiftDates(seed.jobs,days),contacts:shiftDates(seed.contacts,days),autopilot:seed.autopilot,
            config:seed.config,rev:{jobs:1,contacts:1,autopilot:1}};
    keep(db);return db;
  });
})();

function json(status,body,headers){
  return new Response(JSON.stringify(body),{status:status,headers:Object.assign({'Content-Type':'application/json'},headers||{})});
}
function save(db,key,init){
  var sent=new Headers(init&&init.headers||{}).get('X-Base-Revision');
  if(sent&&sent!==String(db.rev[key]))return json(409,{ok:false,error:'changed since you loaded',revision:String(db.rev[key])});
  db[key]=JSON.parse(init.body);db.rev[key]+=1;keep(db);
  return json(200,{ok:true,revision:String(db.rev[key])});
}
var NOT_HERE={ok:false,error:'The demo has no files on disk. Run the tracker on your own computer for this.'};
var routes={
  'health':function(){return json(200,{ok:true,version:'demo',dataFile:'data.json',sync:'off'});},
  'data.json':function(db){return json(200,db.jobs,{'X-Data-Revision':String(db.rev.jobs)});},
  'contacts.json':function(db){return json(200,db.contacts,{'X-Contacts-Revision':String(db.rev.contacts)});},
  'autopilot.json':function(db){return json(200,db.autopilot,{'X-Autopilot-Revision':String(db.rev.autopilot)});},
  'outreach-config.json':function(db){return json(200,db.config);},
  'save':function(db,init){return save(db,'jobs',init);},
  'save-contacts':function(db,init){return save(db,'contacts',init);},
  'save-autopilot':function(db,init){return save(db,'autopilot',init);},
  'open':function(){return json(404,NOT_HERE);},
  'reveal':function(){return json(404,NOT_HERE);},
  'upload-attachment':function(){return json(501,NOT_HERE);}
};
window.fetch=function(input,init){
  var url;
  try{url=new URL(typeof input==='string'?input:input.url,location.href);}catch(e){return realFetch(input,init);}
  var name=url.origin===location.origin&&url.pathname.indexOf(base)===0?url.pathname.slice(base.length):'';
  if(!Object.prototype.hasOwnProperty.call(routes,name))return realFetch(input,init);
  return ready.then(function(db){return routes[name](db,init);});
};

// Opened by itself, say what this is and how to get back.
if(!framed)document.addEventListener('DOMContentLoaded',function(){
  var a=document.createElement('a');
  a.href='../';a.textContent='Demo data · edits stay in this tab · back to the site';
  a.style.cssText='position:fixed;right:14px;bottom:14px;z-index:999;padding:7px 12px;border-radius:99px;font-size:12px;text-decoration:none;background:var(--accent);color:var(--on-accent);box-shadow:0 6px 20px rgba(0,0,0,.3)';
  document.body.appendChild(a);
});
})();
