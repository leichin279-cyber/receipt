/* 영수증 다이어리 app.js — index.html ID 기준 */
(function(){
'use strict';

var PALS=[
  {bg:'#fde8f0',tx:'#8a1a3a',bd:'#f0a0c0'},{bg:'#e8f0fd',tx:'#1a3a8a',bd:'#90b0f0'},
  {bg:'#e8fdf0',tx:'#1a6030',bd:'#80d8a0'},{bg:'#fff8e0',tx:'#6a4800',bd:'#f0d060'},
  {bg:'#f0e8fd',tx:'#4a1a8a',bd:'#c0a0f0'},{bg:'#e8fdfd',tx:'#0a5050',bd:'#70d8d8'},
  {bg:'#fdf0e8',tx:'#6a2a00',bd:'#f0b880'},{bg:'#fde8e8',tx:'#8a1818',bd:'#f09090'},
  {bg:'#e8fde8',tx:'#185818',bd:'#90f090'},{bg:'#f8f8e8',tx:'#4a4800',bd:'#d8d870'}
];
var CPALS=[
  ['#f090b0','#90b0f0','#70c890'],['#e07090','#7090e0','#50b870'],
  ['#f0c050','#c050f0','#50d0c0'],['#e09060','#60a0e0','#90e060'],
  ['#f070a0','#70a0f0','#a0f070']
];

var ROW=32, sS=6, sE=22;
var todos=[], pT=['','',''], pD=[false,false,false];
var blocks=[], bId=0, cMap={}, cN=0;
var entries=[], calY, calM, selDate=null;
var sCtx=null, editBid=null, dragTxt='', deferredInstall=null, schedReady=false;

function pad(n){return String(n).padStart(2,'0');}
function snap(h){return Math.round(h*2)/2;}
function hY(h){return (h-sS)*ROW;}
function hL(h){var hh=Math.floor(h),mm=Math.round((h-hh)*60);return pad(hh)+':'+(mm?'30':'00');}
function gc(t){if(cMap[t]===undefined){cMap[t]=cN%PALS.length;cN++;}return cMap[t];}
function fmtD(d){var ds=['일','월','화','수','목','금','토'];return d.getFullYear()+'.'+pad(d.getMonth()+1)+'.'+pad(d.getDate())+' ('+ds[d.getDay()]+')';}
function gCP(k){var d=new Date(k);return CPALS[Math.floor((d-new Date(d.getFullYear(),0,0))/864e5)%CPALS.length];}
function qs(s,c){return (c||document).querySelector(s);}
function ce(t){return document.createElement(t);}
var _tt;
function toast(m){var t=qs('#toast');if(!t)return;t.textContent=m;t.classList.add('on');clearTimeout(_tt);_tt=setTimeout(function(){t.classList.remove('on');},2500);}

/* ═ 저장/불러오기 ═ */
function load(){
  try{entries=JSON.parse(localStorage.getItem('de')||'[]');}catch(e){entries=[];}
  try{todos=JSON.parse(localStorage.getItem('dt')||'[]');}catch(e){todos=[];}
  try{pD=JSON.parse(localStorage.getItem('pd')||'[false,false,false]');}catch(e){pD=[false,false,false];}
  try{pT=JSON.parse(localStorage.getItem('pt')||'["","",""]');}catch(e){pT=['','',''];}
  try{blocks=JSON.parse(localStorage.getItem('db')||'[]');bId=blocks.reduce(function(m,b){return Math.max(m,parseInt(b.id.replace('b',''))||0);},0);}catch(e){blocks=[];}
  try{var r=JSON.parse(localStorage.getItem('dr')||'null');if(r){sS=r.s;sE=r.e;}}catch(e){}
}
function save(){
  try{
    localStorage.setItem('dt',JSON.stringify(todos));
    localStorage.setItem('pd',JSON.stringify(pD));
    localStorage.setItem('pt',JSON.stringify(pT));
    localStorage.setItem('db',JSON.stringify(blocks));
    localStorage.setItem('dr',JSON.stringify({s:sS,e:sE}));
  }catch(e){}
}
function sync(){
  var now=new Date(),dk=now.toISOString().slice(0,10);
  var pr=pT.map(function(t,i){return{text:t,done:pD[i]};});
  var has=pr.some(function(p){return p.text;})||todos.length||blocks.length;
  if(!has){entries=entries.filter(function(e){return e.date!==dk;});}
  else{
    var ent={date:dk,displayDate:fmtD(now),priorities:pr,todos:JSON.parse(JSON.stringify(todos)),blocks:JSON.parse(JSON.stringify(blocks)),savedAt:now.toISOString()};
    var ix=entries.findIndex(function(e){return e.date===dk;});
    if(ix>=0)entries[ix]=ent; else entries.unshift(ent);
  }
  try{localStorage.setItem('de',JSON.stringify(entries));}catch(e){}
  renderCal();
}

/* ═ INIT ═ */
function init(){
  var now=new Date(); calY=now.getFullYear(); calM=now.getMonth();
  load();
  buildPrioUI();
  renderTodos();
  buildSchedAxis();
  if(!schedReady){attachSchedEvents();schedReady=true;}
  renderBlocksFromData();
  renderCal();
  bindTabs();
  bindTodo();
  bindReset();
  bindReceiptView();
  bindSign();
  bindSchedModal();
  bindCalNav();
  bindPWA();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){});
}

/* ═ 탭 네비게이션 — data-pg 기준 ═ */
function bindTabs(){
  document.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click',function(){
      var tgt=btn.dataset.pg;
      if(!tgt) return;
      document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('on');});
      document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('on');});
      btn.classList.add('on');
      var pg=qs('#'+tgt);
      if(pg) pg.classList.add('on');
      if(tgt==='pg-cal') renderCal();
      if(tgt==='pg-sched') refreshSchedPrio();
    });
  });
}

/* ═ 리셋 — mReset, mResetCancel, mResetOk ═ */
function bindReset(){
  var btnRst=qs('#btnReset');
  var modal=qs('#mReset');
  var cancelBtn=qs('#mResetCancel');
  var okBtn=qs('#mResetOk');
  if(btnRst) btnRst.addEventListener('click',function(){ if(modal) modal.classList.add('on'); });
  if(cancelBtn) cancelBtn.addEventListener('click',function(){ if(modal) modal.classList.remove('on'); });
  if(okBtn) okBtn.addEventListener('click',function(){
    todos=[]; pT=['','','']; pD=[false,false,false];
    save(); sync();
    buildPrioUI();
    renderTodos();
    var stamp=qs('#bstamp'); if(stamp) stamp.classList.remove('on');
    if(modal) modal.classList.remove('on');
    toast('기록이 초기화됐습니다 ↺');
  });
}

/* ═ 핵심 3가지 ═ */
function buildPrioUI(){
  buildPC('plTodo', true);
  buildPC('plSched', false);
}
function buildPC(cid, withInp){
  var pl=qs('#'+cid); if(!pl) return;
  pl.innerHTML='';
  if(withInp){
    var st=ce('div'); st.className='bstamp'; st.id='bstamp';
    st.innerHTML='<div class="bstamp-i"><span class="bs1">참 잘했어요</span><span class="bs2">★ ★ ★</span></div>';
    pl.appendChild(st);
  }
  for(var i=0;i<3;i++){
    (function(idx){
      var row=ce('div'); row.className='pi'+(pD[idx]?' dp':''); row.id='pi-'+idx+'-'+cid;
      var cb=ce('div'); cb.className='pcb'+(pD[idx]?' on':''); cb.id='pcb-'+idx+'-'+cid;
      cb.addEventListener('click', function(){ togP(idx); });
      var tw=ce('div'); tw.className='ptw';
      if(withInp){
        var inp=ce('input'); inp.className='pinp'; inp.id='pin'+idx;
        inp.placeholder=['가장 중요한 일','두 번째 중요한 일','세 번째 중요한 일'][idx];
        inp.value=pT[idx]||'';
        inp.addEventListener('input',(function(ii){return function(){pT[ii]=inp.value;save();sync();refreshSchedPrio();};})(idx));
        tw.appendChild(inp);
        var dh=ce('span'); dh.className='pdh'; dh.setAttribute('draggable','true'); dh.textContent='⠿';
        dh.addEventListener('dragstart',(function(ii){return function(e){var v=pT[ii];if(!v){e.preventDefault();return;}dragTxt=v;e.dataTransfer.setData('text/plain',v);};})(idx));
        row.appendChild(cb); row.appendChild(tw); row.appendChild(dh);
      } else {
        var sp=ce('span'); sp.className='pmirror'; sp.id='pm-'+idx; sp.textContent=pT[idx]||'';
        tw.appendChild(sp);
        row.appendChild(cb); row.appendChild(tw);
      }
      pl.appendChild(row);
    })(i);
  }
}
function refreshSchedPrio(){
  for(var i=0;i<3;i++){
    var m=qs('#pm-'+i); if(m) m.textContent=pT[i]||'';
    ['plTodo','plSched'].forEach(function(cid){
      var cb=qs('#pcb-'+i+'-'+cid);
      var it=qs('#pi-'+i+'-'+cid);
      if(!cb||!it) return;
      if(pD[i]){cb.classList.add('on');it.classList.add('dp');}
      else{cb.classList.remove('on');it.classList.remove('dp');}
    });
  }
  var st=qs('#bstamp');
  if(st){ if(pD.every(Boolean)) st.classList.add('on'); else st.classList.remove('on'); }
}
function togP(i){
  if(!pT[i]) return;
  pD[i]=!pD[i];
  refreshSchedPrio();
  if(pD[i]) fireConf();
  save(); sync();
}

/* ═ TO-DO ═ */
function bindTodo(){
  var addBtn=qs('#todoAddBtn');
  var inp=qs('#todoInp');
  if(addBtn) addBtn.addEventListener('click', addTodo);
  if(inp) inp.addEventListener('keydown',function(e){if(e.key==='Enter') addTodo();});
}
function addTodo(){
  var inp=qs('#todoInp'); if(!inp) return;
  var v=inp.value.trim(); if(!v) return;
  todos.push({text:v,done:false}); inp.value='';
  renderTodos(); save(); sync();
}
function renderTodos(){
  var l=qs('#tlist'); if(!l) return;
  l.innerHTML='';
  if(todos.length===0){
    var e=ce('div'); e.className='empty'; e.id='todoEmpty'; e.textContent='할 일을 추가해보세요 ✏️';
    l.appendChild(e); return;
  }
  todos.forEach(function(t,i){
    var row=ce('div'); row.className='ti'+(t.done?' dn':'');
    var cb=ce('div'); cb.className='tcb';
    cb.addEventListener('click',function(ev){ev.stopPropagation();todos[i].done=!todos[i].done;renderTodos();save();sync();});
    var sp=ce('span'); sp.className='titxt'; sp.textContent=t.text;
    var ia=ce('div'); ia.className='tia';
    var eb=ce('button'); eb.className='tib edit'; eb.textContent='✏️'; eb.title='수정';
    eb.addEventListener('click',function(ev){
      ev.stopPropagation();
      var nv=prompt('할 일 수정:',t.text);
      if(nv!==null&&nv.trim()){todos[i].text=nv.trim();renderTodos();save();sync();}
    });
    var db=ce('button'); db.className='tib del'; db.textContent='🗑️'; db.title='삭제';
    db.addEventListener('click',function(ev){
      ev.stopPropagation(); todos.splice(i,1); renderTodos(); save(); sync();
    });
    ia.appendChild(eb); ia.appendChild(db);
    row.appendChild(cb); row.appendChild(sp); row.appendChild(ia);
    row.setAttribute('draggable','true');
    row.addEventListener('dragstart',function(ev){dragTxt=t.text;ev.dataTransfer.setData('text/plain',t.text);});
    l.appendChild(row);
  });
}

/* ═ 영수증 뷰 ═ */
function bindReceiptView(){
  var btnCO=qs('#btnCheckout');
  var btnBk=qs('#btnBack');
  var btnSv=qs('#btnSaveImg');
  if(btnCO) btnCO.addEventListener('click', showRcpt);
  if(btnBk) btnBk.addEventListener('click',function(){
    qs('#pg-rcpt').classList.remove('on');
    qs('#pg-todo').classList.add('on');
    // 탭바 오늘 탭 활성화
    document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('on');});
    var todotab=qs('.tab[data-pg="pg-todo"]');
    if(todotab) todotab.classList.add('on');
  });
  if(btnSv) btnSv.addEventListener('click', saveImg);
}
function showRcpt(){
  var now=new Date();
  var rvDate=qs('#rvDate'); if(rvDate) rvDate.textContent=fmtD(now);
  var rvNo=qs('#rvNo'); if(rvNo) rvNo.textContent='NO.'+now.toISOString().slice(0,10).replace(/-/g,'');
  // todos
  var tc=qs('#rvTodos'); if(!tc) return; tc.innerHTML='';
  if(!todos.length){var n=ce('div');n.style.cssText='padding:4px 16px;font-size:12px;color:var(--tx3)';n.textContent='(없음)';tc.appendChild(n);}
  todos.forEach(function(t){
    var r=ce('div'); r.className='rti';
    var ck=ce('span'); ck.className='rtick'; ck.textContent=t.done?'☑':'☐';
    var tx=ce('span'); tx.className='rtxt'+(t.done?' dn':''); tx.textContent=t.text;
    r.appendChild(ck); r.appendChild(tx); tc.appendChild(r);
  });
  // prios
  var pc=qs('#rvPrios'); if(!pc) return; pc.innerHTML=''; var pdc=0;
  pT.forEach(function(v,i){
    if(!v) return; if(pD[i]) pdc++;
    var r=ce('div'); r.className='rpi';
    var n=ce('span'); n.className='rpn'; n.textContent=(i+1)+'.';
    var tx=ce('span'); tx.className='rpt'+(pD[i]?' dn':''); tx.textContent=v;
    var ck=ce('span'); ck.className='rpck'; ck.textContent=pD[i]?'✅':'⬜';
    r.appendChild(n); r.appendChild(tx); r.appendChild(ck); pc.appendChild(r);
  });
  var dc=todos.filter(function(t){return t.done;}).length;
  var rt=todos.length?Math.round(dc/todos.length*100):0;
  var rvRate=qs('#rvRate'); if(rvRate) rvRate.textContent='To-Do '+dc+'/'+todos.length+' ('+rt+'%)';
  var tot=pT.filter(function(t){return t;}).length;
  var rvScore=qs('#rvScore'); if(rvScore) rvScore.textContent='핵심 '+pdc+'/'+tot;
  qs('#pg-todo').classList.remove('on');
  qs('#pg-rcpt').classList.add('on');
  sync();
}
function saveImg(){
  var btn=qs('#btnSaveImg'); if(!btn) return;
  btn.textContent='저장 중...'; btn.disabled=true;
  var area=qs('#rcptArea'), sc=qs('.signcard');
  if(!area||!sc){btn.textContent='⬇ 이미지 저장';btn.disabled=false;return;}
  var wrap=ce('div');
  wrap.style.cssText='position:fixed;top:-9999px;left:-9999px;width:'+area.offsetWidth+'px;background:#f0f0f0;padding:14px;font-family:Courier New,monospace;';
  var ac=area.cloneNode(true), scc=sc.cloneNode(true);
  var oc=qs('#scv-prev'), cc=scc.querySelector('canvas');
  if(oc&&cc){cc.width=oc.width;cc.height=oc.height;cc.getContext('2d').drawImage(oc,0,0);}
  scc.querySelectorAll('button,.sighint').forEach(function(b){b.style.display='none';});
  wrap.appendChild(ac); wrap.appendChild(scc); document.body.appendChild(wrap);
  setTimeout(function(){
    html2canvas(wrap,{backgroundColor:'#f0f0f0',scale:2,useCORS:true,allowTaint:true,logging:false})
    .then(function(c){
      document.body.removeChild(wrap);
      btn.textContent='⬇ 이미지 저장'; btn.disabled=false;
      var name='diary-'+new Date().toISOString().slice(0,10)+'.png';
      function dlUrl(url){var a=ce('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(function(){try{document.body.removeChild(a);}catch(e){}},300);}
      if(c.toBlob){c.toBlob(function(blob){var u=URL.createObjectURL(blob);dlUrl(u);setTimeout(function(){URL.revokeObjectURL(u);},1000);},'image/png');}
      else dlUrl(c.toDataURL('image/png'));
      toast('PNG 저장 완료! 📸');
    }).catch(function(err){
      document.body.removeChild(wrap);
      btn.textContent='⬇ 이미지 저장'; btn.disabled=false;
      console.error(err); toast('저장 실패');
    });
  },120);
}

/* ═ 서명 ═ */
function bindSign(){
  var card=qs('#signPreviewCard'), prev=qs('#scv-prev');
  if(card) card.addEventListener('click', openSign);
  if(prev) prev.addEventListener('click', openSign);
  var clrBtn=qs('#signClr');
  var okBtn=qs('#signOk');
  var modal=qs('#mSign');
  if(clrBtn) clrBtn.addEventListener('click',function(){var cv=qs('#scv');if(cv&&sCtx)sCtx.clearRect(0,0,cv.offsetWidth,cv.offsetHeight);});
  if(okBtn) okBtn.addEventListener('click',function(){closeSign(true);});
  if(modal) modal.addEventListener('click',function(e){if(e.target===this)closeSign(false);});
}
function openSign(){
  var modal=qs('#mSign'); if(!modal) return;
  modal.classList.add('on');
  setTimeout(function(){
    var cv=qs('#scv'); if(!cv) return;
    var dpr=window.devicePixelRatio||1, w=cv.parentElement.clientWidth||340, h=200;
    var fr=ce('canvas'); fr.id='scv';
    fr.style.cssText='display:block;width:'+w+'px;height:'+h+'px;cursor:crosshair;touch-action:none;background:#fff;';
    fr.width=Math.round(w*dpr); fr.height=Math.round(h*dpr);
    cv.parentNode.replaceChild(fr,cv);
    var ctx=fr.getContext('2d'); ctx.scale(dpr,dpr);
    ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round';
    sCtx=ctx; var drawing=false;
    function gp(e){var r=fr.getBoundingClientRect(),src=(e.touches&&e.touches.length)?e.touches[0]:(e.changedTouches&&e.changedTouches.length)?e.changedTouches[0]:e;return{x:src.clientX-r.left,y:src.clientY-r.top};}
    fr.addEventListener('mousedown',function(e){drawing=true;var p=gp(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});
    fr.addEventListener('mousemove',function(e){if(!drawing)return;var p=gp(e);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y);});
    fr.addEventListener('mouseup',function(){drawing=false;});
    fr.addEventListener('mouseleave',function(){drawing=false;});
    fr.addEventListener('touchstart',function(e){e.preventDefault();drawing=true;var p=gp(e);ctx.beginPath();ctx.moveTo(p.x,p.y);},{passive:false});
    fr.addEventListener('touchmove',function(e){e.preventDefault();if(!drawing)return;var p=gp(e);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y);},{passive:false});
    fr.addEventListener('touchend',function(){drawing=false;});
  },80);
}
function closeSign(save){
  if(save){
    var src=qs('#scv'), dst=qs('#scv-prev');
    if(src&&dst){
      var dpr=window.devicePixelRatio||1;
      dst.width=dst.offsetWidth*dpr; dst.height=dst.offsetHeight*dpr;
      dst.getContext('2d').drawImage(src,0,0,dst.width,dst.height);
      var h=qs('#signHint'); if(h) h.style.display='none';
    }
  }
  var modal=qs('#mSign'); if(modal) modal.classList.remove('on');
}

/* ═ 스케줄 ═ */
function buildSchedAxis(){
  var ax=qs('#stAx'), cv=qs('#stCv'); if(!ax||!cv) return;
  var th=(sE-sS)*ROW;
  ax.style.height=th+'px'; cv.style.height=th+'px';
  var wrap=qs('#stWrap'); if(wrap) wrap.style.height=th+'px';
  ax.innerHTML='';
  cv.querySelectorAll('.sthl').forEach(function(el){el.remove();});
  for(var hr=sS;hr<=sE;hr++){
    var lb=ce('div'); lb.className='staxl'; lb.textContent=pad(hr)+':00'; lb.style.top=hY(hr)+'px'; ax.appendChild(lb);
    var ln=ce('div'); ln.className='sthl'; ln.style.top=hY(hr)+'px'; cv.appendChild(ln);
    if(hr<sE){var hl=ce('div');hl.className='sthl h';hl.style.top=(hY(hr)+ROW/2)+'px';cv.appendChild(hl);}
  }
}
function applyBS(el,b){
  var ci=gc(b.text), col=PALS[ci], top=hY(b.startH), ht=Math.max(hY(b.endH)-top,18);
  el.style.top=top+'px'; el.style.height=ht+'px';
  el.style.background=col.bg; el.style.color=col.tx;
  el.style.border='.5px solid '+col.bd; el.style.borderLeft='3px solid '+col.tx;
}
function createBEl(b){
  if(document.getElementById('bel-'+b.id)) return;
  var cv=qs('#stCv'); if(!cv) return;
  var el=ce('div'); el.className='sb'; el.id='bel-'+b.id;
  var rht=ce('div'); rht.className='rht';
  var nm=ce('span'); nm.className='sbn'; nm.textContent=b.text;
  var mv=ce('div'); mv.className='sbm'; mv.textContent='⋮';
  var rhb=ce('div'); rhb.className='rhb';
  el.appendChild(rht); el.appendChild(nm); el.appendChild(mv); el.appendChild(rhb);
  applyBS(el,b); attachBH(el,b); cv.appendChild(el);
}
function renderBlocksFromData(){
  var cv=qs('#stCv'); if(!cv) return;
  cv.querySelectorAll('.sb').forEach(function(el){el.remove();});
  blocks.forEach(function(b){createBEl(b);});
}
function attachBH(el,b){
  var pt=null, py=0;
  el.addEventListener('pointerdown',function(e){if(e.target.classList.contains('rht')||e.target.classList.contains('rhb')||e.target.classList.contains('sbm'))return;py=e.clientY;pt=setTimeout(function(){pt=null;openBM(b.id,b.startH,b.endH,b.text);},500);});
  el.addEventListener('pointermove',function(e){if(pt&&Math.abs(e.clientY-py)>8){clearTimeout(pt);pt=null;}});
  el.addEventListener('pointerup',function(){if(pt){clearTimeout(pt);pt=null;}});
  var rht=el.querySelector('.rht'), rhb=el.querySelector('.rhb'), mv=el.querySelector('.sbm'), y0,s0,e0;
  rht.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();y0=e.clientY;s0=b.startH;e0=b.endH;rht.setPointerCapture(e.pointerId);});
  rht.addEventListener('pointermove',function(e){if(!rht.hasPointerCapture(e.pointerId))return;b.startH=Math.max(sS,Math.min(b.endH-.5,snap(s0+(e.clientY-y0)/ROW)));applyBS(el,b);});
  rht.addEventListener('pointerup',function(e){if(rht.hasPointerCapture(e.pointerId)){rht.releasePointerCapture(e.pointerId);save();sync();}});
  rhb.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();y0=e.clientY;s0=b.startH;e0=b.endH;rhb.setPointerCapture(e.pointerId);});
  rhb.addEventListener('pointermove',function(e){if(!rhb.hasPointerCapture(e.pointerId))return;b.endH=Math.min(sE,Math.max(b.startH+.5,snap(e0+(e.clientY-y0)/ROW)));applyBS(el,b);});
  rhb.addEventListener('pointerup',function(e){if(rhb.hasPointerCapture(e.pointerId)){rhb.releasePointerCapture(e.pointerId);save();sync();}});
  mv.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();y0=e.clientY;s0=b.startH;e0=b.endH;mv.setPointerCapture(e.pointerId);});
  mv.addEventListener('pointermove',function(e){if(!mv.hasPointerCapture(e.pointerId))return;var dur=e0-s0,ns=snap(s0+(e.clientY-y0)/ROW);ns=Math.max(sS,Math.min(sE-dur,ns));b.startH=ns;b.endH=ns+dur;applyBS(el,b);});
  mv.addEventListener('pointerup',function(e){if(mv.hasPointerCapture(e.pointerId)){mv.releasePointerCapture(e.pointerId);save();sync();}});
}
function attachSchedEvents(){
  var cv=qs('#stCv'); if(!cv) return;
  cv.addEventListener('dragover',function(e){e.preventDefault();});
  cv.addEventListener('drop',function(e){
    e.preventDefault();
    var txt=e.dataTransfer.getData('text/plain')||dragTxt; if(!txt) return;
    var r=cv.getBoundingClientRect(), sh=snap(Math.max(sS,Math.min(sE-.5,(e.clientY-r.top)/ROW+sS)));
    addBlock(txt,sh,Math.min(sh+1,sE)); dragTxt='';
  });
  var tapT=null, tapY=0;
  cv.addEventListener('pointerdown',function(e){if(e.target!==cv&&!e.target.classList.contains('sthl'))return;tapY=e.clientY;tapT=setTimeout(function(){tapT=null;},400);});
  cv.addEventListener('pointerup',function(e){if(!tapT)return;clearTimeout(tapT);tapT=null;if(Math.abs(e.clientY-tapY)>8)return;var r=cv.getBoundingClientRect(),sh=snap(Math.max(sS,Math.min(sE-.5,(e.clientY-r.top)/ROW+sS)));openBM(null,sh,Math.min(sh+1,sE),'');});
}
function addBlock(txt,sh,eh){var b={id:'b'+(++bId),text:txt,startH:sh,endH:eh};blocks.push(b);createBEl(b);save();sync();}

/* ═ 스케줄 시간 범위 모달 ═ */
function bindSchedModal(){
  var btnTR=qs('#btnTR');
  var cancelTR=qs('#mTRCancel');
  var okTR=qs('#mTROk');
  if(btnTR) btnTR.addEventListener('click', openTR);
  if(cancelTR) cancelTR.addEventListener('click',function(){var m=qs('#mTR');if(m)m.classList.remove('on');});
  if(okTR) okTR.addEventListener('click', applyTR);
}
function openTR(){
  var ss=qs('#trS'), se=qs('#trE'); if(!ss||!se) return;
  ss.innerHTML=''; se.innerHTML='';
  for(var h=1;h<=23;h++){var o=ce('option');o.value=h;o.textContent=pad(h)+':00';if(h===sS)o.selected=true;ss.appendChild(o);}
  for(var h2=2;h2<=24;h2++){var o2=ce('option');o2.value=h2;o2.textContent=h2===24?'24:00':pad(h2)+':00';if(h2===sE)o2.selected=true;se.appendChild(o2);}
  var m=qs('#mTR'); if(m) m.classList.add('on');
}
function applyTR(){
  var ss=qs('#trS'), se=qs('#trE'); if(!ss||!se) return;
  var s=parseInt(ss.value), e=parseInt(se.value);
  if(e<=s){toast('종료 시간이 시작 시간보다 늦어야 합니다');return;}
  sS=s; sE=e;
  blocks.forEach(function(b){
    b.startH=Math.max(b.startH,sS); b.endH=Math.min(b.endH,sE);
    if(b.endH<=b.startH) b.endH=Math.min(b.startH+.5,sE);
    var el=document.getElementById('bel-'+b.id); if(el) applyBS(el,b);
  });
  var m=qs('#mTR'); if(m) m.classList.remove('on');
  buildSchedAxis(); save();
}
function fillSel(id,def){
  var s=qs('#'+id); if(!s) return; s.innerHTML='';
  for(var h=sS;h<=sE;h+=.5){
    var hh=Math.floor(h),mm=Math.round((h-hh)*60),o=ce('option');
    o.value=h; o.textContent=pad(hh)+':'+(mm?'30':'00');
    if(Math.abs(h-def)<.01) o.selected=true;
    s.appendChild(o);
  }
}
function openBM(bid,sh,eh,txt){
  editBid=bid;
  var title=qs('#mBlockTitle'); if(title) title.textContent=bid?'블록 수정':'블록 추가';
  var blTxt=qs('#blTxt'); if(blTxt) blTxt.value=txt||'';
  fillSel('blS',sh); fillSel('blE',eh);
  var btns=qs('#blBtns'); if(!btns) return; btns.innerHTML='';
  if(bid){
    var dl=ce('button'); dl.className='mdel'; dl.textContent='삭제';
    dl.addEventListener('click',function(){
      if(editBid){var el=document.getElementById('bel-'+editBid);if(el)el.remove();blocks=blocks.filter(function(b){return b.id!==editBid;});save();sync();}
      var m=qs('#mBlock'); if(m) m.classList.remove('on');
    });
    btns.appendChild(dl);
  }
  var ca=ce('button'); ca.textContent='취소';
  ca.addEventListener('click',function(){var m=qs('#mBlock');if(m)m.classList.remove('on');});
  var ok=ce('button'); ok.className='mok'; ok.textContent=bid?'저장':'추가';
  ok.addEventListener('click', confirmB);
  btns.appendChild(ca); btns.appendChild(ok);
  var m=qs('#mBlock'); if(m) m.classList.add('on');
  setTimeout(function(){var t=qs('#blTxt');if(t)t.focus();},50);
}
function confirmB(){
  var blTxt=qs('#blTxt'); if(!blTxt) return;
  var txt=blTxt.value.trim(); if(!txt){toast('내용을 입력해 주세요');return;}
  var blS=qs('#blS'), blE=qs('#blE'); if(!blS||!blE) return;
  var s=parseFloat(blS.value), e=parseFloat(blE.value);
  if(e<=s){toast('종료 시간이 시작 시간보다 늦어야 합니다');return;}
  if(editBid){
    var b=blocks.find(function(x){return x.id===editBid;});
    if(b){b.text=txt;b.startH=s;b.endH=e;var el=document.getElementById('bel-'+editBid);if(el){el.querySelector('.sbn').textContent=txt;applyBS(el,b);}}
  } else {
    addBlock(txt,s,e);
  }
  save(); sync();
  var m=qs('#mBlock'); if(m) m.classList.remove('on');
}

/* ═ 달력 ═ */
function bindCalNav(){
  var prev=qs('#calPrev'), next=qs('#calNext');
  if(prev) prev.addEventListener('click',function(){chCal(-1);});
  if(next) next.addEventListener('click',function(){chCal(1);});
}
function chCal(d){calM+=d;if(calM<0){calM=11;calY--;}if(calM>11){calM=0;calY++;}selDate=null;renderCal();}
function renderCal(){
  var lbl=qs('#calLbl'); if(lbl) lbl.textContent=calY+'년 '+(calM+1)+'월';
  var byD={}; entries.forEach(function(e){byD[e.date]=e;});
  var g=qs('#cgrid'); if(!g) return; g.innerHTML='';
  ['일','월','화','수','목','금','토'].forEach(function(l){var d=ce('div');d.className='cdl';d.textContent=l;g.appendChild(d);});
  var first=new Date(calY,calM,1).getDay(), days=new Date(calY,calM+1,0).getDate();
  for(var i=0;i<first;i++){var emp=ce('div');emp.className='cc emp';g.appendChild(emp);}
  for(var dy=1;dy<=days;dy++){
    (function(day){
      var key=calY+'-'+pad(calM+1)+'-'+pad(day), e=byD[key], pal=gCP(key);
      var cell=ce('div'); cell.className='cc'+(e?' has':'')+(selDate===key?' sel':'');
      var dn=ce('span'); dn.className='dn'; dn.textContent=day; cell.appendChild(dn);
      if(e&&e.priorities){
        var dd=ce('div'); dd.className='dots';
        e.priorities.forEach(function(p,pi){var dot=ce('div');dot.className='dot';dot.style.background=p.done?pal[pi]:'#ddd';dd.appendChild(dot);});
        cell.appendChild(dd);
      }
      cell.addEventListener('click',function(){showCalDet(key);});
      g.appendChild(cell);
    })(dy);
  }
  var det=qs('#cdet'); if(det){if(selDate)showCalDet(selDate,true);else det.innerHTML='';}
}
function schedSum(bks){
  if(!bks||!bks.length) return [];
  var s=bks.slice().sort(function(a,b){return a.startH-b.startH;}), res=[];
  s.forEach(function(b){var l=res[res.length-1];if(l&&l.text===b.text&&Math.abs(l.endH-b.startH)<.01)l.endH=b.endH;else res.push({text:b.text,startH:b.startH,endH:b.endH});});
  return res;
}
function showCalDet(key,noR){
  selDate=key;
  var e=entries.find(function(x){return x.date===key;}), det=qs('#cdet'); if(!det) return;
  if(!e){det.innerHTML='<div style="padding:14px;text-align:center;color:var(--tx3);font-size:13px;">'+key+' — 기록 없음</div>';if(!noR)renderCal();return;}
  var dc=e.priorities.filter(function(p){return p.done;}).length, tot=e.priorities.filter(function(p){return p.text;}).length, pal=gCP(key), sg=schedSum(e.blocks||[]);
  var h='<div class="cdet"><div class="cdh"><span class="cddate">'+(e.displayDate||key)+'</span><span class="cdscore">'+dc+'/'+tot+'</span></div>';
  h+='<div class="cdsec">★ 핵심 3가지</div>';
  e.priorities.filter(function(p){return p.text;}).forEach(function(p,pi){h+='<div class="cdpi"><div class="cdpd" style="background:'+(p.done?pal[pi]:'#ddd')+'"></div><span class="cdpt'+(p.done?' dn':'')+'">'+p.text+'</span></div>';});
  if(sg.length){h+='<div class="cdsec">⏱ 스케줄</div><div>';sg.forEach(function(gp){var col=PALS[gc(gp.text)%PALS.length];h+='<span class="cstag" style="background:'+col.bg+';color:'+col.tx+';">'+hL(gp.startH)+'~'+hL(gp.endH)+' '+gp.text+'</span>';});h+='</div>';}
  h+='</div>'; det.innerHTML=h; if(!noR) renderCal();
}

/* ═ PWA ═ */
function bindPWA(){
  var urlEl=qs('#pwaUrl'); if(urlEl) urlEl.textContent=location.hostname||'receipt-khoe.vercel.app';
  if(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone){setInstalled();return;}
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault(); deferredInstall=e;
    var btn=qs('#btnInstall'); if(btn){btn.disabled=false;btn.textContent='설치';}
    var st=qs('#instStatus'); if(st) st.textContent='설치 준비 완료!';
  });
  var installBtn=qs('#btnInstall');
  if(installBtn) installBtn.addEventListener('click',function(){
    if(deferredInstall){
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function(r){
        deferredInstall=null;
        if(r.outcome==='accepted'){toast('앱 설치 중... 🎉');setInstalled();}
        else{var st=qs('#instStatus');if(st)st.textContent='설치를 취소했습니다.';}
      });
    } else {
      toast('아래 수동 설치 방법을 따라주세요 👇');
    }
  });
  window.addEventListener('appinstalled',function(){toast('앱 설치 완료! 🎉');setInstalled();});
}
function setInstalled(){
  var c=qs('#pwaCard'), b=qs('#instDone'), s=qs('#instStatus');
  if(c) c.style.display='none';
  if(b) b.classList.add('on');
  if(s) s.textContent='홈 화면에서 앱을 실행하세요.';
}

/* ═ 폭죽 ═ */
function fireConf(){
  var cv=qs('#confcv'); if(!cv) return;
  cv.style.display='block'; cv.width=window.innerWidth; cv.height=window.innerHeight;
  var ctx=cv.getContext('2d'), cols=['#f9a8c9','#7ec8e3','#90e0af','#ffd580','#b5a0f7','#e74c3c'], ps=[];
  for(var i=0;i<90;i++) ps.push({x:Math.random()*cv.width,y:cv.height*.4,vx:(Math.random()-.5)*10,vy:-(Math.random()*10+4),r:Math.random()*4+2,c:cols[i%cols.length],rot:Math.random()*360,rv:(Math.random()-.5)*12,life:1});
  var raf; (function anim(){ctx.clearRect(0,0,cv.width,cv.height);var alive=false;
    ps.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=.3;p.rot+=p.rv;p.life-=.02;if(p.life>0){alive=true;ctx.save();ctx.globalAlpha=p.life;ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);ctx.fillStyle=p.c;ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r);ctx.restore();}});
    if(alive) raf=requestAnimationFrame(anim); else{cv.style.display='none';cancelAnimationFrame(raf);}
  })();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
