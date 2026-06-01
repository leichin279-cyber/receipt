/* ═══════════════════════════════════════
   영수증 다이어리 — app.js  v11
═══════════════════════════════════════ */
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

/* ── 상태 ── */
var ROW=32, sS=6, sE=22;
var todos=[], pTexts=['','',''], pDone=[false,false,false];
var blocks=[], bId=0, colorMap={}, colorN=0;
var entries=[], calY, calM, selDate=null;
var signing=false, sCtx=null, editBid=null, dragTxt='';
var schedReady=false, deferredInstall=null;

/* ── 유틸 ── */
function pad(n){return String(n).padStart(2,'0');}
function snap(h){return Math.round(h*2)/2;}
function hY(h){return(h-sS)*ROW;}
function hL(h){var hh=Math.floor(h),mm=Math.round((h-hh)*60);return pad(hh)+':'+(mm?'30':'00');}
function gc(t){if(colorMap[t]===undefined){colorMap[t]=colorN%PALS.length;colorN++;}return colorMap[t];}
function fmtD(d){var ds=['일','월','화','수','목','금','토'];return d.getFullYear()+'.'+pad(d.getMonth()+1)+'.'+pad(d.getDate())+' ('+ds[d.getDay()]+')';}
function getCP(k){var d=new Date(k);return CPALS[Math.floor((d-new Date(d.getFullYear(),0,0))/864e5)%CPALS.length];}
function qs(s,c){return(c||document).querySelector(s);}
function ce(t){return document.createElement(t);}

var _tt=null;
function toast(m){var t=qs('#toast');t.textContent=m;t.classList.add('show');clearTimeout(_tt);_tt=setTimeout(function(){t.classList.remove('show');},2500);}

/* ═══════════════ INIT ═══════════════ */
function init(){
  var now=new Date(); calY=now.getFullYear(); calM=now.getMonth();
  loadStorage();
  buildPrioUI();
  renderTodos();
  buildSchedAxis();
  if(!schedReady){attachSchedEvents();schedReady=true;}
  renderBlocksFromData();
  initSignHandlers();
  renderCal();
  bindNav();
  bindTodo();
  bindReset();
  bindSchedModal();
  bindReceiptView();
  bindPWA();
  registerSW();
}

/* ── 저장/불러오기 ── */
function loadStorage(){
  try{entries=JSON.parse(localStorage.getItem('diary_entries')||'[]');}catch(e){entries=[];}
  try{todos=JSON.parse(localStorage.getItem('diary_todos')||'[]');}catch(e){todos=[];}
  try{pDone=JSON.parse(localStorage.getItem('diary_pdone')||'[false,false,false]');}catch(e){pDone=[false,false,false];}
  try{pTexts=JSON.parse(localStorage.getItem('diary_ptexts')||'["","",""]');}catch(e){pTexts=['','',''];}
  try{blocks=JSON.parse(localStorage.getItem('diary_blocks')||'[]');bId=blocks.reduce(function(m,b){return Math.max(m,parseInt(b.id.replace('b',''))||0);},0);}catch(e){blocks=[];}
  try{var r=JSON.parse(localStorage.getItem('diary_sched_range')||'null');if(r){sS=r.s;sE=r.e;}}catch(e){}
}
function saveStorage(){
  try{
    localStorage.setItem('diary_todos',JSON.stringify(todos));
    localStorage.setItem('diary_pdone',JSON.stringify(pDone));
    localStorage.setItem('diary_ptexts',JSON.stringify(pTexts));
    localStorage.setItem('diary_blocks',JSON.stringify(blocks));
    localStorage.setItem('diary_sched_range',JSON.stringify({s:sS,e:sE}));
  }catch(e){}
}
function syncToday(){
  var now=new Date(), dk=now.toISOString().slice(0,10);
  var prios=pTexts.map(function(t,i){return{text:t,done:pDone[i]};});
  var hasData=prios.some(function(p){return p.text;})||todos.length||blocks.length;
  if(!hasData){entries=entries.filter(function(e){return e.date!==dk;});}
  else{
    var entry={date:dk,displayDate:fmtD(now),priorities:prios,todos:JSON.parse(JSON.stringify(todos)),blocks:JSON.parse(JSON.stringify(blocks)),savedAt:now.toISOString()};
    var idx=entries.findIndex(function(e){return e.date===dk;});
    if(idx>=0)entries[idx]=entry;else entries.unshift(entry);
  }
  try{localStorage.setItem('diary_entries',JSON.stringify(entries));}catch(e){}
  renderCal();
}

/* ═══════════════ 탭 네비 ═══════════════ */
function bindNav(){
  document.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click',function(){
      var target=btn.dataset.page;
      document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('on');});
      document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('on');});
      btn.classList.add('on');
      qs('#'+target).classList.add('on');
      if(target==='pg-cal')renderCal();
      if(target==='pg-sched')refreshSchedPrio();
    });
  });
}

/* ═══════════════ 리셋 ═══════════════ */
function bindReset(){
  qs('#btn-reset').addEventListener('click',function(){
    qs('#ov-reset').classList.add('on');
  });
  qs('#reset-cancel').addEventListener('click',function(){qs('#ov-reset').classList.remove('on');});
  qs('#reset-ok').addEventListener('click',function(){
    todos=[]; pTexts=['','','']; pDone=[false,false,false];
    saveStorage(); syncToday();
    buildPrioUI(); renderTodos();
    // 도장 숨기기
    var stamp=qs('#bstamp'); if(stamp)stamp.classList.remove('on');
    qs('#ov-reset').classList.remove('on');
    toast('오늘 기록이 초기화됐습니다');
  });
}

/* ═══════════════ 핵심 3가지 ═══════════════ */
function buildPrioUI(){
  buildPrioContainer('plist-todo',true);
  buildPrioContainer('plist-sched',false);
}

function buildPrioContainer(cid,withInput){
  var pl=qs('#'+cid); if(!pl)return;
  pl.innerHTML='';
  if(withInput){
    var stamp=ce('div');stamp.className='bstamp';stamp.id='bstamp';
    stamp.innerHTML='<div class="bstamp-i"><span class="s1">참 잘했어요</span><span class="s2">★ ★ ★</span></div>';
    pl.appendChild(stamp);
  }
  for(var i=0;i<3;i++){
    (function(idx){
      var row=ce('div');row.className='pi'+(pDone[idx]?' dp':'');row.id='pi-'+idx+'-'+cid;
      var cb=ce('div');cb.className='pcb'+(pDone[idx]?' on':'');cb.id='pcb-'+idx+'-'+cid;
      cb.addEventListener('click',function(){togPrio(idx);});
      var tw=ce('div');tw.className='ptw';
      if(withInput){
        var inp=ce('input');inp.className='prio-inp';inp.id='pin'+idx;
        inp.placeholder=['가장 중요한 일','두 번째 중요한 일','세 번째 중요한 일'][idx];
        inp.value=pTexts[idx]||'';
        inp.addEventListener('input',(function(ii){return function(){pTexts[ii]=inp.value;saveStorage();syncToday();refreshSchedPrio();};})(idx));
        tw.appendChild(inp);
        var dh=ce('span');dh.className='pdh';dh.setAttribute('draggable','true');dh.textContent='⠿';
        dh.addEventListener('dragstart',(function(ii){return function(e){var v=pTexts[ii];if(!v){e.preventDefault();return;}dragTxt=v;e.dataTransfer.setData('text/plain',v);};})(idx));
        row.appendChild(cb);row.appendChild(tw);row.appendChild(dh);
      }else{
        var sp=ce('span');sp.className='prio-mirror';sp.id='pmirror-'+idx;
        sp.textContent=pTexts[idx]||'';
        tw.appendChild(sp);
        row.appendChild(cb);row.appendChild(tw);
      }
      pl.appendChild(row);
    })(i);
  }
}

function refreshSchedPrio(){
  for(var i=0;i<3;i++){
    var m=qs('#pmirror-'+i);if(m)m.textContent=pTexts[i]||'';
    ['todo','sched'].forEach(function(c){
      var cb=qs('#pcb-'+i+'-plist-'+c);
      var item=qs('#pi-'+i+'-plist-'+c);
      if(!cb||!item)return;
      if(pDone[i]){cb.classList.add('on');item.classList.add('dp');}
      else{cb.classList.remove('on');item.classList.remove('dp');}
    });
  }
  var stamp=qs('#bstamp');
  if(stamp){if(pDone.every(Boolean))stamp.classList.add('on');else stamp.classList.remove('on');}
}

function togPrio(i){
  if(!pTexts[i])return;
  pDone[i]=!pDone[i];
  refreshSchedPrio();
  if(pDone[i])fireConf();
  saveStorage();syncToday();
}

/* ═══════════════ TO-DO ═══════════════ */
function bindTodo(){
  qs('#todo-add-btn').addEventListener('click',addTodo);
  qs('#todo-inp').addEventListener('keydown',function(e){if(e.key==='Enter')addTodo();});
}
function addTodo(){
  var inp=qs('#todo-inp'),v=inp.value.trim();if(!v)return;
  todos.push({text:v,done:false});inp.value='';
  renderTodos();saveStorage();syncToday();
}
function renderTodos(){
  var l=qs('#tlist');l.innerHTML='';
  var empty=qs('#todo-empty');
  if(todos.length===0){
    if(empty)empty.style.display='';
    return;
  }
  if(empty)empty.style.display='none';
  todos.forEach(function(t,i){
    var row=ce('div');row.className='ti'+(t.done?' done':'');
    // 체크박스
    var cb=ce('div');cb.className='tcb';
    cb.addEventListener('click',function(e){e.stopPropagation();todos[i].done=!todos[i].done;renderTodos();saveStorage();syncToday();});
    // 텍스트
    var sp=ce('span');sp.className='ti-txt';sp.textContent=t.text;
    // 수정·삭제
    var actions=ce('div');actions.className='ti-actions';
    var editBtn=ce('button');editBtn.className='ti-btn edit';editBtn.textContent='✏️';editBtn.title='수정';
    editBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var nv=prompt('할 일 수정:',t.text);
      if(nv!==null&&nv.trim()){todos[i].text=nv.trim();renderTodos();saveStorage();syncToday();}
    });
    var delBtn=ce('button');delBtn.className='ti-btn del';delBtn.textContent='🗑️';delBtn.title='삭제';
    delBtn.addEventListener('click',function(e){
      e.stopPropagation();
      todos.splice(i,1);renderTodos();saveStorage();syncToday();
    });
    actions.appendChild(editBtn);actions.appendChild(delBtn);
    row.appendChild(cb);row.appendChild(sp);row.appendChild(actions);
    row.setAttribute('draggable','true');
    row.addEventListener('dragstart',function(e){dragTxt=t.text;e.dataTransfer.setData('text/plain',t.text);});
    l.appendChild(row);
  });
}

/* ═══════════════ 결제 → 영수증 ═══════════════ */
function bindReceiptView(){
  qs('#btn-checkout').addEventListener('click',showReceiptView);
  qs('#btn-back').addEventListener('click',function(){
    qs('#pg-receipt-view').classList.remove('on');
    qs('#pg-todo').classList.add('on');
    qs('[data-page="pg-todo"]').classList.add('on');
  });
  qs('#btn-save-img').addEventListener('click',saveReceiptImage);
}
function showReceiptView(){
  var now=new Date();
  qs('#rv-date').textContent=fmtD(now);
  qs('#rv-no').textContent='NO.'+now.toISOString().slice(0,10).replace(/-/g,'');
  // todos
  var tc=qs('#rv-todos');tc.innerHTML='';
  if(!todos.length){var none=ce('div');none.style.cssText='padding:4px 16px;font-size:12px;color:var(--text3);';none.textContent='(없음)';tc.appendChild(none);}
  todos.forEach(function(t){
    var row=ce('div');row.className='rv-todo-item';
    var ck=ce('span');ck.className='rv-todo-check';ck.textContent=t.done?'☑':'☐';
    var tx=ce('span');tx.className='rv-todo-txt'+(t.done?' done':'');tx.textContent=t.text;
    row.appendChild(ck);row.appendChild(tx);tc.appendChild(row);
  });
  // prios
  var pc=qs('#rv-prios');pc.innerHTML='';var pdCnt=0;
  pTexts.forEach(function(v,i){
    if(!v)return;if(pDone[i])pdCnt++;
    var row=ce('div');row.className='rv-prio-item';
    var num=ce('span');num.className='rv-prio-num';num.textContent=(i+1)+'.';
    var tx=ce('span');tx.className='rv-prio-txt'+(pDone[i]?' done':'');tx.textContent=v;
    var ck=ce('span');ck.className='rv-prio-ck';ck.textContent=pDone[i]?'✅':'⬜';
    row.appendChild(num);row.appendChild(tx);row.appendChild(ck);pc.appendChild(row);
  });
  var dc=todos.filter(function(t){return t.done;}).length;
  var rate=todos.length?Math.round(dc/todos.length*100):0;
  qs('#rv-rate').textContent='To-Do '+dc+'/'+todos.length+' ('+rate+'%)';
  var tot=pTexts.filter(function(t){return t;}).length;
  qs('#rv-score').textContent='핵심 '+pdCnt+'/'+tot;
  qs('#pg-todo').classList.remove('on');
  qs('#pg-receipt-view').classList.add('on');
  syncToday();
}
function saveReceiptImage(){
  var btn=qs('#btn-save-img');btn.textContent='저장 중...';btn.disabled=true;
  var area=qs('#receipt-area'),sc=qs('.sign-card');
  var wrap=ce('div');
  wrap.style.cssText='position:fixed;top:-9999px;left:-9999px;width:'+area.offsetWidth+'px;background:#f2f2f2;padding:16px;font-family:Courier New,monospace;';
  var ac=area.cloneNode(true),scc=sc.cloneNode(true);
  var oc=qs('#scv-preview'),cc=scc.querySelector('canvas');
  if(oc&&cc){cc.width=oc.width;cc.height=oc.height;cc.getContext('2d').drawImage(oc,0,0);}
  scc.querySelectorAll('button').forEach(function(b){b.style.display='none';});
  wrap.appendChild(ac);wrap.appendChild(scc);document.body.appendChild(wrap);
  setTimeout(function(){
    html2canvas(wrap,{backgroundColor:'#f2f2f2',scale:2,useCORS:true,allowTaint:true,logging:false})
    .then(function(c){
      document.body.removeChild(wrap);btn.textContent='⬇ 이미지 저장';btn.disabled=false;
      var name='diary-'+new Date().toISOString().slice(0,10)+'.png';
      if(c.toBlob){c.toBlob(function(blob){var u=URL.createObjectURL(blob);dl(u,name);setTimeout(function(){URL.revokeObjectURL(u);},1000);},'image/png');}
      else dl(c.toDataURL('image/png'),name);
      toast('PNG 저장 완료! 📸');
    }).catch(function(err){document.body.removeChild(wrap);btn.textContent='⬇ 이미지 저장';btn.disabled=false;console.error(err);toast('저장 실패');});
  },100);
}
function dl(url,name){var a=ce('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(function(){try{document.body.removeChild(a);}catch(e){}},300);}

/* ═══════════════ 서명 ═══════════════ */
function initSignHandlers(){
  var card=qs('#sign-preview-card'),prev=qs('#scv-preview');
  if(card)card.addEventListener('click',openSignModal);
  if(prev)prev.addEventListener('click',openSignModal);
  var clr=qs('#sign-modal-clr');if(clr)clr.addEventListener('click',function(){var cv=qs('#scv');if(cv&&sCtx)sCtx.clearRect(0,0,cv.offsetWidth,cv.offsetHeight);});
  var ok=qs('#sign-modal-ok');if(ok)ok.addEventListener('click',function(){closeSignModal(true);});
  var bg=qs('#ov-sign');if(bg)bg.addEventListener('click',function(e){if(e.target===this)closeSignModal(false);});
}
function openSignModal(){
  qs('#ov-sign').classList.add('on');
  setTimeout(function(){
    var cv=qs('#scv');if(!cv)return;
    var dpr=window.devicePixelRatio||1,w=cv.parentElement.clientWidth||360,h=200;
    var fresh=ce('canvas');fresh.id='scv';
    fresh.style.cssText='display:block;width:'+w+'px;height:'+h+'px;cursor:crosshair;touch-action:none;background:#fff;';
    fresh.width=Math.round(w*dpr);fresh.height=Math.round(h*dpr);
    cv.parentNode.replaceChild(fresh,cv);
    var ctx=fresh.getContext('2d');ctx.scale(dpr,dpr);
    ctx.strokeStyle='#1a1a1a';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
    sCtx=ctx;
    var drawing=false;
    function gp(e){var r=fresh.getBoundingClientRect(),src=(e.touches&&e.touches.length)?e.touches[0]:(e.changedTouches&&e.changedTouches.length)?e.changedTouches[0]:e;return{x:src.clientX-r.left,y:src.clientY-r.top};}
    fresh.addEventListener('mousedown',function(e){drawing=true;var p=gp(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});
    fresh.addEventListener('mousemove',function(e){if(!drawing)return;var p=gp(e);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y);});
    fresh.addEventListener('mouseup',function(){drawing=false;});
    fresh.addEventListener('mouseleave',function(){drawing=false;});
    fresh.addEventListener('touchstart',function(e){e.preventDefault();drawing=true;var p=gp(e);ctx.beginPath();ctx.moveTo(p.x,p.y);},{passive:false});
    fresh.addEventListener('touchmove',function(e){e.preventDefault();if(!drawing)return;var p=gp(e);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y);},{passive:false});
    fresh.addEventListener('touchend',function(){drawing=false;});
  },80);
}
function closeSignModal(save){
  if(save){
    var src=qs('#scv'),dst=qs('#scv-preview');
    if(src&&dst){
      var dpr=window.devicePixelRatio||1;
      dst.width=dst.offsetWidth*dpr;dst.height=dst.offsetHeight*dpr;
      dst.getContext('2d').drawImage(src,0,0,dst.width,dst.height);
      var h=qs('#sign-preview-hint');if(h)h.style.display='none';
    }
  }
  qs('#ov-sign').classList.remove('on');
}

/* ═══════════════ 스케줄 ═══════════════ */
function buildSchedAxis(){
  var ax=qs('#st-ax'),cv=qs('#st-cv'),totalH=(sE-sS)*ROW;
  ax.style.height=totalH+'px';cv.style.height=totalH+'px';
  qs('#st-wrap').style.height=totalH+'px';
  ax.innerHTML='';
  cv.querySelectorAll('.st-hl').forEach(function(el){el.remove();});
  for(var hr=sS;hr<=sE;hr++){
    var lb=ce('div');lb.className='st-axl';lb.textContent=pad(hr)+':00';lb.style.top=hY(hr)+'px';ax.appendChild(lb);
    var ln=ce('div');ln.className='st-hl';ln.style.top=hY(hr)+'px';cv.appendChild(ln);
    if(hr<sE){var hl=ce('div');hl.className='st-hl half';hl.style.top=(hY(hr)+ROW/2)+'px';cv.appendChild(hl);}
  }
}
function applyBlockStyle(el,b){
  var ci=gc(b.text),col=PALS[ci],top=hY(b.startH),ht=Math.max(hY(b.endH)-top,18);
  el.style.top=top+'px';el.style.height=ht+'px';el.style.background=col.bg;el.style.color=col.tx;
  el.style.border='0.5px solid '+col.bd;el.style.borderLeft='3px solid '+col.tx;
}
function createBlockEl(b){
  if(document.getElementById('bel-'+b.id))return;
  var cv=qs('#st-cv'),el=ce('div');el.className='sb';el.id='bel-'+b.id;
  var rht=ce('div');rht.className='rht';
  var nm=ce('span');nm.className='sbn';nm.textContent=b.text;
  var mv=ce('div');mv.className='sbm';mv.textContent='⋮';
  var rhb=ce('div');rhb.className='rhb';
  el.appendChild(rht);el.appendChild(nm);el.appendChild(mv);el.appendChild(rhb);
  applyBlockStyle(el,b);attachBlockHandlers(el,b);cv.appendChild(el);
}
function renderBlocksFromData(){
  qs('#st-cv').querySelectorAll('.sb').forEach(function(el){el.remove();});
  blocks.forEach(function(b){createBlockEl(b);});
}
function attachBlockHandlers(el,b){
  var pt=null,py=0;
  el.addEventListener('pointerdown',function(e){if(e.target.classList.contains('rht')||e.target.classList.contains('rhb')||e.target.classList.contains('sbm'))return;py=e.clientY;pt=setTimeout(function(){pt=null;openBM(b.id,b.startH,b.endH,b.text);},500);});
  el.addEventListener('pointermove',function(e){if(pt&&Math.abs(e.clientY-py)>8){clearTimeout(pt);pt=null;}});
  el.addEventListener('pointerup',function(){if(pt){clearTimeout(pt);pt=null;}});
  var rht=el.querySelector('.rht'),rhb=el.querySelector('.rhb'),mv=el.querySelector('.sbm'),y0,s0,e0;
  rht.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();y0=e.clientY;s0=b.startH;e0=b.endH;rht.setPointerCapture(e.pointerId);});
  rht.addEventListener('pointermove',function(e){if(!rht.hasPointerCapture(e.pointerId))return;b.startH=Math.max(sS,Math.min(b.endH-0.5,snap(s0+(e.clientY-y0)/ROW)));applyBlockStyle(el,b);});
  rht.addEventListener('pointerup',function(e){if(rht.hasPointerCapture(e.pointerId)){rht.releasePointerCapture(e.pointerId);saveStorage();syncToday();}});
  rhb.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();y0=e.clientY;s0=b.startH;e0=b.endH;rhb.setPointerCapture(e.pointerId);});
  rhb.addEventListener('pointermove',function(e){if(!rhb.hasPointerCapture(e.pointerId))return;b.endH=Math.min(sE,Math.max(b.startH+0.5,snap(e0+(e.clientY-y0)/ROW)));applyBlockStyle(el,b);});
  rhb.addEventListener('pointerup',function(e){if(rhb.hasPointerCapture(e.pointerId)){rhb.releasePointerCapture(e.pointerId);saveStorage();syncToday();}});
  mv.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();y0=e.clientY;s0=b.startH;e0=b.endH;mv.setPointerCapture(e.pointerId);});
  mv.addEventListener('pointermove',function(e){if(!mv.hasPointerCapture(e.pointerId))return;var dur=e0-s0,ns=snap(s0+(e.clientY-y0)/ROW);ns=Math.max(sS,Math.min(sE-dur,ns));b.startH=ns;b.endH=ns+dur;applyBlockStyle(el,b);});
  mv.addEventListener('pointerup',function(e){if(mv.hasPointerCapture(e.pointerId)){mv.releasePointerCapture(e.pointerId);saveStorage();syncToday();}});
}
function attachSchedEvents(){
  var cv=qs('#st-cv');
  cv.addEventListener('dragover',function(e){e.preventDefault();});
  cv.addEventListener('drop',function(e){e.preventDefault();var txt=e.dataTransfer.getData('text/plain')||dragTxt;if(!txt)return;var r=cv.getBoundingClientRect(),sh=snap(Math.max(sS,Math.min(sE-0.5,(e.clientY-r.top)/ROW+sS)));addBlock(txt,sh,Math.min(sh+1,sE));dragTxt='';});
  var tapT=null,tapY=0;
  cv.addEventListener('pointerdown',function(e){if(e.target!==cv&&!e.target.classList.contains('st-hl'))return;tapY=e.clientY;tapT=setTimeout(function(){tapT=null;},400);});
  cv.addEventListener('pointerup',function(e){if(!tapT)return;clearTimeout(tapT);tapT=null;if(Math.abs(e.clientY-tapY)>8)return;var r=cv.getBoundingClientRect(),sh=snap(Math.max(sS,Math.min(sE-0.5,(e.clientY-r.top)/ROW+sS)));openBM(null,sh,Math.min(sh+1,sE),'');});
}
function addBlock(txt,sh,eh){var b={id:'b'+(++bId),text:txt,startH:sh,endH:eh};blocks.push(b);createBlockEl(b);saveStorage();syncToday();}
function bindSchedModal(){
  qs('#tr-ico').addEventListener('click',openTR);
  qs('#tr-cancel').addEventListener('click',function(){qs('#ov-tr').classList.remove('on');});
  qs('#tr-ok').addEventListener('click',applyTR);
}
function openTR(){
  var ss=qs('#tr-s'),se=qs('#tr-e');ss.innerHTML='';se.innerHTML='';
  for(var h=1;h<=23;h++){var o=ce('option');o.value=h;o.textContent=pad(h)+':00';if(h===sS)o.selected=true;ss.appendChild(o);}
  for(var h2=2;h2<=24;h2++){var o2=ce('option');o2.value=h2;o2.textContent=h2===24?'24:00':pad(h2)+':00';if(h2===sE)o2.selected=true;se.appendChild(o2);}
  qs('#ov-tr').classList.add('on');
}
function applyTR(){
  var s=parseInt(qs('#tr-s').value),e=parseInt(qs('#tr-e').value);
  if(e<=s){toast('종료 시간이 시작 시간보다 늦어야 합니다');return;}
  sS=s;sE=e;
  blocks.forEach(function(b){b.startH=Math.max(b.startH,sS);b.endH=Math.min(b.endH,sE);if(b.endH<=b.startH)b.endH=Math.min(b.startH+0.5,sE);var el=document.getElementById('bel-'+b.id);if(el)applyBlockStyle(el,b);});
  qs('#ov-tr').classList.remove('on');buildSchedAxis();saveStorage();
}
function fillSel(id,def){var s=qs('#'+id);s.innerHTML='';for(var h=sS;h<=sE;h+=0.5){var hh=Math.floor(h),mm=Math.round((h-hh)*60),o=ce('option');o.value=h;o.textContent=pad(hh)+':'+(mm?'30':'00');if(Math.abs(h-def)<0.01)o.selected=true;s.appendChild(o);}}
function openBM(bid,sh,eh,txt){
  editBid=bid;qs('#bl-title').textContent=bid?'블록 수정':'블록 추가';qs('#bl-txt').value=txt||'';
  fillSel('bl-s',sh);fillSel('bl-e',eh);
  var btns=qs('#bl-btns');btns.innerHTML='';
  if(bid){var del=ce('button');del.className='mdel';del.textContent='삭제';del.addEventListener('click',function(){if(editBid){var el=document.getElementById('bel-'+editBid);if(el)el.remove();blocks=blocks.filter(function(b){return b.id!==editBid;});saveStorage();syncToday();}qs('#ov-bl').classList.remove('on');});btns.appendChild(del);}
  var cancel=ce('button');cancel.textContent='취소';cancel.addEventListener('click',function(){qs('#ov-bl').classList.remove('on');});
  var ok=ce('button');ok.className='mok';ok.textContent=bid?'저장':'추가';ok.addEventListener('click',confirmB);
  btns.appendChild(cancel);btns.appendChild(ok);
  qs('#ov-bl').classList.add('on');setTimeout(function(){qs('#bl-txt').focus();},50);
}
function confirmB(){
  var txt=qs('#bl-txt').value.trim();if(!txt){toast('내용을 입력해 주세요');return;}
  var s=parseFloat(qs('#bl-s').value),e=parseFloat(qs('#bl-e').value);if(e<=s){toast('종료 시간이 시작 시간보다 늦어야 합니다');return;}
  if(editBid){var b=blocks.find(function(x){return x.id===editBid;});if(b){b.text=txt;b.startH=s;b.endH=e;var el=document.getElementById('bel-'+editBid);if(el){el.querySelector('.sbn').textContent=txt;applyBlockStyle(el,b);}}}
  else addBlock(txt,s,e);
  saveStorage();syncToday();qs('#ov-bl').classList.remove('on');
}

/* ═══════════════ 달력 ═══════════════ */
document.addEventListener('DOMContentLoaded',function(){
  qs('#cal-prev').addEventListener('click',function(){chCal(-1);});
  qs('#cal-next').addEventListener('click',function(){chCal(1);});
});
function chCal(d){calM+=d;if(calM<0){calM=11;calY--;}if(calM>11){calM=0;calY++;}selDate=null;renderCal();}
function renderCal(){
  qs('#cal-lbl').textContent=calY+'년 '+(calM+1)+'월';
  var byDate={};entries.forEach(function(e){byDate[e.date]=e;});
  var g=qs('#cgrid');g.innerHTML='';
  ['일','월','화','수','목','금','토'].forEach(function(l){var d=ce('div');d.className='cdl';d.textContent=l;g.appendChild(d);});
  var first=new Date(calY,calM,1).getDay(),days=new Date(calY,calM+1,0).getDate();
  for(var i=0;i<first;i++){var emp=ce('div');emp.className='cc emp';g.appendChild(emp);}
  for(var dy=1;dy<=days;dy++){
    (function(day){
      var key=calY+'-'+pad(calM+1)+'-'+pad(day),e=byDate[key],pal=getCP(key);
      var cell=ce('div');cell.className='cc'+(e?' has':'')+(selDate===key?' sel':'');
      var dn=ce('span');dn.className='dn';dn.textContent=day;cell.appendChild(dn);
      if(e&&e.priorities){var dd=ce('div');dd.className='dots';e.priorities.forEach(function(p,pi){var dot=ce('div');dot.className='dot';dot.style.background=p.done?pal[pi]:'#ddd';dd.appendChild(dot);});cell.appendChild(dd);}
      cell.addEventListener('click',function(){showCalDet(key);});
      g.appendChild(cell);
    })(dy);
  }
  if(selDate)showCalDet(selDate,true);else qs('#cdet').innerHTML='';
}
function schedSum(bks){if(!bks||!bks.length)return[];var s=bks.slice().sort(function(a,b){return a.startH-b.startH;});var res=[];s.forEach(function(b){var l=res[res.length-1];if(l&&l.text===b.text&&Math.abs(l.endH-b.startH)<.01)l.endH=b.endH;else res.push({text:b.text,startH:b.startH,endH:b.endH});});return res;}
function showCalDet(key,noR){
  selDate=key;var e=entries.find(function(x){return x.date===key;});var det=qs('#cdet');
  if(!e){det.innerHTML='<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px;">'+key+' — 기록 없음</div>';if(!noR)renderCal();return;}
  var dc=e.priorities.filter(function(p){return p.done;}).length,tot=e.priorities.filter(function(p){return p.text;}).length,pal=getCP(key),sg=schedSum(e.blocks||[]);
  var h='<div class="cdet"><div class="cdh"><span class="cd-date">'+(e.displayDate||key)+'</span><span class="cd-score">'+dc+'/'+tot+'</span></div>';
  h+='<div class="cdsec">★ 핵심 3가지</div>';
  e.priorities.filter(function(p){return p.text;}).forEach(function(p,pi){h+='<div class="cdpi"><div class="cdpd" style="background:'+(p.done?pal[pi]:'#ddd')+'"></div><span class="cdpt'+(p.done?' dn':'')+'">'+p.text+'</span></div>';});
  if(sg.length){h+='<div class="cdsec">⏱ 스케줄</div><div>';sg.forEach(function(gp){var col=PALS[gc(gp.text)%PALS.length];h+='<span class="cstag" style="background:'+col.bg+';color:'+col.tx+';">'+hL(gp.startH)+'~'+hL(gp.endH)+' '+gp.text+'</span>';});h+='</div>';}
  h+='</div>';det.innerHTML=h;if(!noR)renderCal();
}

/* ═══════════════ PWA ═══════════════ */
function bindPWA(){
  var urlEl=qs('#pwa-url-display');if(urlEl)urlEl.textContent=location.hostname||'diary-app.vercel.app';
  if(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone){setInstalledState();return;}
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault();deferredInstall=e;
    var btn=qs('#btn-pwa-install');if(btn){btn.disabled=false;btn.textContent='설치';}
  });
  var btn=qs('#btn-pwa-install');
  if(btn)btn.addEventListener('click',function(){
    if(deferredInstall){
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function(r){
        deferredInstall=null;
        if(r.outcome==='accepted'){toast('앱 설치 중... 🎉');setInstalledState();}
        else{var st=qs('#install-status');if(st)st.textContent='설치를 취소했습니다.';}
      });
    }else{toast('아래 수동 설치 방법을 따라주세요 👇');}
  });
  window.addEventListener('appinstalled',function(){toast('앱 설치 완료! 🎉');setInstalledState();});
}
function setInstalledState(){
  var p=qs('#pwa-install-popup'),b=qs('#installed-banner'),st=qs('#install-status');
  if(p)p.style.display='none';if(b)b.classList.add('show');if(st)st.textContent='홈 화면에서 앱을 실행할 수 있습니다.';
}

/* ═══════════════ 폭죽 ═══════════════ */
function fireConf(){
  var cv=qs('#conf-cv');cv.style.display='block';cv.width=window.innerWidth;cv.height=window.innerHeight;
  var ctx=cv.getContext('2d'),cols=['#f9a8c9','#7ec8e3','#90e0af','#ffd580','#b5a0f7','#e74c3c'],ps=[];
  for(var i=0;i<90;i++)ps.push({x:Math.random()*cv.width,y:cv.height*.4,vx:(Math.random()-.5)*10,vy:-(Math.random()*10+4),r:Math.random()*4+2,c:cols[i%cols.length],rot:Math.random()*360,rv:(Math.random()-.5)*12,life:1});
  var raf;(function anim(){ctx.clearRect(0,0,cv.width,cv.height);var alive=false;ps.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=.3;p.rot+=p.rv;p.life-=.02;if(p.life>0){alive=true;ctx.save();ctx.globalAlpha=p.life;ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);ctx.fillStyle=p.c;ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r);ctx.restore();}});if(alive)raf=requestAnimationFrame(anim);else{cv.style.display='none';cancelAnimationFrame(raf);}})();
}

/* ═══════════════ SW ═══════════════ */
function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(function(e){console.log('SW:',e);});}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
