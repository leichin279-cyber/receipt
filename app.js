/* ══════════════════════════════
   자기계발 영수증 다이어리 — app.js
   v9 · 2025
══════════════════════════════ */
(function () {
  'use strict';

  /* ── 색상 팔레트 ── */
  var PALS = [
    { bg: '#fde8f0', tx: '#8a1a3a', bd: '#f0a0c0' },
    { bg: '#e8f0fd', tx: '#1a3a8a', bd: '#90b0f0' },
    { bg: '#e8fdf0', tx: '#1a6030', bd: '#80d8a0' },
    { bg: '#fff8e0', tx: '#6a4800', bd: '#f0d060' },
    { bg: '#f0e8fd', tx: '#4a1a8a', bd: '#c0a0f0' },
    { bg: '#e8fdfd', tx: '#0a5050', bd: '#70d8d8' },
    { bg: '#fdf0e8', tx: '#6a2a00', bd: '#f0b880' },
    { bg: '#fde8e8', tx: '#8a1818', bd: '#f09090' },
    { bg: '#e8fde8', tx: '#185818', bd: '#90f090' },
    { bg: '#f8f8e8', tx: '#4a4800', bd: '#d8d870' }
  ];
  var CPALS = [
    ['#f090b0', '#90b0f0', '#70c890'],
    ['#e07090', '#7090e0', '#50b870'],
    ['#f0c050', '#c050f0', '#50d0c0'],
    ['#e09060', '#60a0e0', '#90e060'],
    ['#f070a0', '#70a0f0', '#a0f070']
  ];

  /* ── 상태 ── */
  var ROW = 32;
  var sS = 6, sE = 22;
  var todos = [];
  var pDone = [false, false, false];
  var blocks = [], bId = 0;
  var colorMap = {}, colorN = 0;
  var entries = [], calY, calM, selDate = null;
  var signing = false, sCtx = null;
  var editBid = null, dragTxt = '';
  var schedEventsReady = false;
  var deferredInstall = null;

  /* ── 유틸 ── */
  function pad(n) { return String(n).padStart(2, '0'); }
  function snap(h) { return Math.round(h * 2) / 2; }
  function hY(h) { return (h - sS) * ROW; }
  function hL(h) { var hh = Math.floor(h), mm = Math.round((h - hh) * 60); return pad(hh) + ':' + (mm ? '30' : '00'); }
  function gc(t) { if (colorMap[t] === undefined) { colorMap[t] = colorN % PALS.length; colorN++; } return colorMap[t]; }
  function fmtD(d) {
    var ds = ['일', '월', '화', '수', '목', '금', '토'];
    return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' (' + ds[d.getDay()] + ')';
  }
  function getCP(k) { var d = new Date(k); return CPALS[Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5) % CPALS.length]; }
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

  /* ── 토스트 ── */
  var toastTimer = null;
  function toast(m) {
    var t = qs('#toast');
    t.textContent = m; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  /* ══════════════════════════════
     INIT
  ══════════════════════════════ */
  function init() {
    var now = new Date();
    calY = now.getFullYear(); calM = now.getMonth();
    loadFromStorage();
    buildPriorityItems('plist-todo');
    buildPriorityItems('plist-sched');
    renderTodos();
    buildSchedAxis();
    if (!schedEventsReady) { attachSchedEvents(); schedEventsReady = true; }
    renderBlocksFromData();
    initSign();
    renderCal();
    bindNavTabs();
    bindTodoEvents();
    bindSchedModal();
    bindReceiptView();
    bindSignBtn();
    bindPWA();
    registerSW();
  }

  /* ── localStorage ── */
  function loadFromStorage() {
    try { entries = JSON.parse(localStorage.getItem('diary_entries') || '[]'); } catch (e) { entries = []; }
    try { todos = JSON.parse(localStorage.getItem('diary_todos') || '[]'); } catch (e) { todos = []; }
    try { pDone = JSON.parse(localStorage.getItem('diary_pdone') || '[false,false,false]'); } catch (e) { pDone = [false, false, false]; }
    try {
      var pi = JSON.parse(localStorage.getItem('diary_pinputs') || '["","",""]');
      ['pin0', 'pin1', 'pin2'].forEach(function (id, i) { var el = qs('#' + id); if (el) el.value = pi[i] || ''; });
    } catch (e) { }
    try { blocks = JSON.parse(localStorage.getItem('diary_blocks') || '[]'); bId = blocks.reduce(function (m, b) { return Math.max(m, parseInt(b.id.replace('b', '')) || 0); }, 0); } catch (e) { blocks = []; }
    try { var r = JSON.parse(localStorage.getItem('diary_sched_range') || 'null'); if (r) { sS = r.s; sE = r.e; } } catch (e) { }
  }

  function saveToStorage() {
    try {
      localStorage.setItem('diary_todos', JSON.stringify(todos));
      localStorage.setItem('diary_pdone', JSON.stringify(pDone));
      localStorage.setItem('diary_pinputs', JSON.stringify(['pin0', 'pin1', 'pin2'].map(function (id) { var el = qs('#' + id); return el ? el.value : ''; })));
      localStorage.setItem('diary_blocks', JSON.stringify(blocks));
      localStorage.setItem('diary_sched_range', JSON.stringify({ s: sS, e: sE }));
    } catch (e) { }
  }

  /* ── 달력 실시간 연동 ── */
  function syncToday() {
    var now = new Date(), dk = now.toISOString().slice(0, 10);
    var prios = ['pin0', 'pin1', 'pin2'].map(function (id, i) { var el = qs('#' + id); return { text: el ? el.value.trim() : '', done: pDone[i] }; });
    var hasPrio = prios.some(function (p) { return p.text; });
    if (!hasPrio && !todos.length && !blocks.length) {
      entries = entries.filter(function (e) { return e.date !== dk; });
    } else {
      var entry = { date: dk, displayDate: fmtD(now), priorities: prios, todos: JSON.parse(JSON.stringify(todos)), blocks: JSON.parse(JSON.stringify(blocks)), savedAt: now.toISOString() };
      var idx = entries.findIndex(function (e) { return e.date === dk; });
      if (idx >= 0) entries[idx] = entry; else entries.unshift(entry);
    }
    try { localStorage.setItem('diary_entries', JSON.stringify(entries)); } catch (e) { }
    renderCal();
  }

  /* ══════════════════════════════
     탭 네비게이션
  ══════════════════════════════ */
  function bindNavTabs() {
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.dataset.page;
        document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('on'); });
        document.querySelectorAll('.pg').forEach(function (p) { p.classList.remove('on'); });
        btn.classList.add('on');
        qs('#' + target).classList.add('on');
        // 결제 화면 표시 중이었으면 todo로 돌아갈 때 숨기기
        if (target !== 'pg-todo') {
          qs('#pg-receipt-view').classList.remove('on');
        }
        if (target === 'pg-cal') renderCal();
      });
    });
  }

  /* ══════════════════════════════
     To-Do
  ══════════════════════════════ */
  function bindTodoEvents() {
    qs('#todo-add-btn').addEventListener('click', addTodo);
    qs('#todo-inp').addEventListener('keydown', function (e) { if (e.key === 'Enter') addTodo(); });
  }

  function addTodo() {
    var inp = qs('#todo-inp');
    var v = inp.value.trim(); if (!v) return;
    todos.push({ text: v, done: false }); inp.value = '';
    renderTodos(); saveToStorage(); syncToday();
  }

  function renderTodos() {
    var l = qs('#tlist'); l.innerHTML = '';
    todos.forEach(function (t, i) {
      var d = document.createElement('div'); d.className = 'ti' + (t.done ? ' done' : '');
      var cb = document.createElement('div'); cb.className = 'tcb';
      var sp = document.createElement('span'); sp.textContent = t.text;
      d.appendChild(cb); d.appendChild(sp);
      d.addEventListener('click', function () { todos[i].done = !todos[i].done; renderTodos(); saveToStorage(); syncToday(); });
      d.setAttribute('draggable', 'true');
      d.addEventListener('dragstart', function (e) { dragTxt = t.text; e.dataTransfer.setData('text/plain', t.text); });
      l.appendChild(d);
    });
  }

  /* ══════════════════════════════
     핵심 3가지 (두 plist 공유)
  ══════════════════════════════ */
  function buildPriorityItems(containerId) {
    var pl = qs('#' + containerId);
    pl.innerHTML = '';
    // 도장은 todo 탭에만
    if (containerId === 'plist-todo') {
      var stamp = document.createElement('div'); stamp.className = 'bstamp'; stamp.id = 'bstamp';
      stamp.innerHTML = '<div class="bstamp-i"><span class="s1">참 잘했어요</span><span class="s2">★ ★ ★</span></div>';
      pl.appendChild(stamp);
    }
    [0, 1, 2].forEach(function (i) {
      var d = document.createElement('div'); d.className = 'pi'; d.id = 'pi' + i + '-' + containerId;
      var cb = document.createElement('div'); cb.className = 'pcb'; cb.id = 'pcb' + i + '-' + containerId;
      if (pDone[i]) { cb.classList.add('on'); d.classList.add('dp'); }
      var tw = document.createElement('div'); tw.className = 'ptw';
      // 두 plist가 같은 input을 공유하기 위해 — todo 탭에는 진짜 input, sched 탭에는 미러 span
      if (containerId === 'plist-todo') {
        var inp = document.createElement('input'); inp.id = 'pin' + i; inp.placeholder = ['가장 중요한 일', '두 번째 중요한 일', '세 번째 중요한 일'][i];
        inp.addEventListener('input', function () { saveToStorage(); syncToday(); mirrorPrio(i); });
        tw.appendChild(inp);
      } else {
        var span = document.createElement('span'); span.id = 'pmirror' + i;
        span.style.cssText = 'font-size:12px;color:var(--text2);font-family:inherit;';
        span.textContent = (function () { var el = qs('#pin' + i); return el ? el.value : ''; })();
        tw.appendChild(span);
      }
      var dh = document.createElement('span'); dh.className = 'pdh'; dh.setAttribute('draggable', 'true'); dh.textContent = '⠿';
      dh.addEventListener('dragstart', function (e) { var v = (qs('#pin' + i) || {}).value || ''; if (!v) { e.preventDefault(); return; } dragTxt = v; e.dataTransfer.setData('text/plain', v); });
      d.appendChild(cb); d.appendChild(tw); d.appendChild(dh);
      pl.appendChild(d);
      cb.addEventListener('click', function () { togP(i); });
    });
  }

  function mirrorPrio(i) {
    var m = qs('#pmirror' + i); var inp = qs('#pin' + i);
    if (m && inp) m.textContent = inp.value;
  }

  function togP(i) {
    var inp = qs('#pin' + i); var v = inp ? inp.value.trim() : '';
    if (!v) return;
    pDone[i] = !pDone[i];
    // 두 plist 모두 업데이트
    ['plist-todo', 'plist-sched'].forEach(function (cid) {
      var cb = qs('#pcb' + i + '-' + cid);
      var item = qs('#pi' + i + '-' + cid);
      if (!cb || !item) return;
      if (pDone[i]) { cb.classList.add('on'); item.classList.add('dp'); }
      else { cb.classList.remove('on'); item.classList.remove('dp'); }
    });
    if (pDone[i]) fireConf();
    var stamp = qs('#bstamp');
    if (stamp) { if (pDone.every(Boolean)) stamp.classList.add('on'); else stamp.classList.remove('on'); }
    saveToStorage(); syncToday();
  }

  /* ══════════════════════════════
     결제하기 → 영수증 뷰
  ══════════════════════════════ */
  function bindReceiptView() {
    qs('#btn-checkout').addEventListener('click', showReceiptView);
    qs('#btn-back').addEventListener('click', function () {
      qs('#pg-receipt-view').classList.remove('on');
      qs('#pg-todo').classList.add('on');
      qs('[data-page="pg-todo"]').classList.add('on');
    });
    qs('#btn-save-img').addEventListener('click', saveReceiptImage);
  }

  function showReceiptView() {
    var now = new Date();
    // 날짜
    qs('#rv-date').textContent = fmtD(now);
    qs('#rv-no').textContent = 'NO.' + now.toISOString().slice(0, 10).replace(/-/g, '');

    // todos
    var todoCont = qs('#rv-todos'); todoCont.innerHTML = '';
    if (!todos.length) {
      var none = document.createElement('div'); none.style.cssText = 'padding:4px 16px;font-size:12px;color:var(--text3);';
      none.textContent = '(없음)'; todoCont.appendChild(none);
    }
    todos.forEach(function (t) {
      var row = document.createElement('div'); row.className = 'rv-todo-item';
      var ck = document.createElement('span'); ck.className = 'rv-todo-check'; ck.textContent = t.done ? '☑' : '☐';
      var tx = document.createElement('span'); tx.className = 'rv-todo-txt' + (t.done ? ' done' : ''); tx.textContent = t.text;
      row.appendChild(ck); row.appendChild(tx); todoCont.appendChild(row);
    });

    // 완료 수
    var doneCount = todos.filter(function (t) { return t.done; }).length;
    var rate = todos.length ? Math.round(doneCount / todos.length * 100) : 0;

    // priorities
    var prioCont = qs('#rv-prios'); prioCont.innerHTML = '';
    var pDoneCount = 0;
    [0, 1, 2].forEach(function (i) {
      var inp = qs('#pin' + i); var v = inp ? inp.value.trim() : '';
      if (!v) return;
      if (pDone[i]) pDoneCount++;
      var row = document.createElement('div'); row.className = 'rv-prio-item';
      var num = document.createElement('span'); num.className = 'rv-prio-num'; num.textContent = (i + 1) + '.';
      var tx = document.createElement('span'); tx.className = 'rv-prio-txt' + (pDone[i] ? ' done' : ''); tx.textContent = v;
      var ck = document.createElement('span'); ck.className = 'rv-prio-ck'; ck.textContent = pDone[i] ? '✅' : '⬜';
      row.appendChild(num); row.appendChild(tx); row.appendChild(ck); prioCont.appendChild(row);
    });

    qs('#rv-rate').textContent = 'To-Do ' + doneCount + '/' + todos.length + ' (' + rate + '%)';
    var totalPrios = [0, 1, 2].filter(function (i) { var el = qs('#pin' + i); return el && el.value.trim(); }).length;
    qs('#rv-score').textContent = '핵심 ' + pDoneCount + '/' + totalPrios;

    // 페이지 전환
    qs('#pg-todo').classList.remove('on');
    qs('#pg-receipt-view').classList.add('on');
    // tabbar에서 todo 탭 on 유지
    syncToday();
  }

  /* ══════════════════════════════
     이미지 저장 (가장 안정적인 방법)
  ══════════════════════════════ */
  function saveReceiptImage() {
    var btn = qs('#btn-save-img');
    btn.textContent = '저장 중...'; btn.disabled = true;

    // 캡처 대상: receipt + sign 카드 합성
    var area = qs('#receipt-area');
    var signCard = qs('.sign-card');

    // 임시 래퍼 만들어서 두 요소 합성
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + area.offsetWidth + 'px;background:#f2f2f2;padding:16px;font-family:Courier New,monospace;';
    var areaClone = area.cloneNode(true);
    var signClone = signCard.cloneNode(true);

    // 서명 캔버스 이미지 복사
    var origCanvas = qs('#scv');
    var cloneCanvas = signClone.querySelector('canvas');
    if (cloneCanvas && origCanvas) {
      cloneCanvas.width = origCanvas.width; cloneCanvas.height = origCanvas.height;
      var ctx2 = cloneCanvas.getContext('2d');
      ctx2.drawImage(origCanvas, 0, 0);
    }
    // 저장·지우기 버튼 숨기기
    var cloneBtns = signClone.querySelectorAll('button');
    cloneBtns.forEach(function (b) { b.style.display = 'none'; });

    wrapper.appendChild(areaClone); wrapper.appendChild(signClone);
    document.body.appendChild(wrapper);

    setTimeout(function () {
      html2canvas(wrapper, {
        backgroundColor: '#f2f2f2',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0, scrollY: 0
      }).then(function (canvas) {
        document.body.removeChild(wrapper);
        btn.textContent = '⬇ 이미지 저장'; btn.disabled = false;

        // toBlob → objectURL → click 방식 (가장 안정적)
        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            var url = URL.createObjectURL(blob);
            downloadFile(url, 'diary-' + new Date().toISOString().slice(0, 10) + '.png');
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          }, 'image/png');
        } else {
          // fallback: toDataURL
          downloadFile(canvas.toDataURL('image/png'), 'diary-' + new Date().toISOString().slice(0, 10) + '.png');
        }
        toast('PNG 저장 완료! 📸');
      }).catch(function (err) {
        document.body.removeChild(wrapper);
        btn.textContent = '⬇ 이미지 저장'; btn.disabled = false;
        console.error(err);
        toast('저장 실패: ' + err.message);
      });
    }, 100);
  }

  function downloadFile(url, filename) {
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { document.body.removeChild(a); } catch (e) { } }, 300);
  }

  /* ══════════════════════════════
     서명
  ══════════════════════════════ */
  function initSign() {
    var cv = qs('#scv'); if (!cv) return;
    // 반응형 캔버스 크기
    cv.width = cv.parentElement.offsetWidth - 28 || 300;
    sCtx = cv.getContext('2d');
    sCtx.strokeStyle = '#333'; sCtx.lineWidth = 1.5; sCtx.lineCap = 'round';
    function pos(e) { var r = cv.getBoundingClientRect(); var s = e.touches ? e.touches[0] : e; return [s.clientX - r.left, s.clientY - r.top]; }
    cv.addEventListener('mousedown', function (e) { signing = true; var p = pos(e); sCtx.beginPath(); sCtx.moveTo(p[0], p[1]); });
    cv.addEventListener('mousemove', function (e) { if (!signing) return; var p = pos(e); sCtx.lineTo(p[0], p[1]); sCtx.stroke(); });
    cv.addEventListener('mouseup', function () { signing = false; });
    cv.addEventListener('mouseleave', function () { signing = false; });
    cv.addEventListener('touchstart', function (e) { e.preventDefault(); signing = true; var p = pos(e); sCtx.beginPath(); sCtx.moveTo(p[0], p[1]); }, { passive: false });
    cv.addEventListener('touchmove', function (e) { e.preventDefault(); if (!signing) return; var p = pos(e); sCtx.lineTo(p[0], p[1]); sCtx.stroke(); }, { passive: false });
    cv.addEventListener('touchend', function () { signing = false; });
  }

  function bindSignBtn() {
    var btn = qs('#sign-clr'); if (btn) btn.addEventListener('click', function () { if (sCtx) sCtx.clearRect(0, 0, qs('#scv').width, qs('#scv').height); });
  }

  /* ══════════════════════════════
     스케줄 — 축 & 선
  ══════════════════════════════ */
  function buildSchedAxis() {
    var ax = qs('#st-ax'), cv = qs('#st-cv');
    var totalH = (sE - sS) * ROW;
    ax.style.height = totalH + 'px'; cv.style.height = totalH + 'px';
    qs('#st-wrap').style.height = totalH + 'px';
    ax.innerHTML = '';
    cv.querySelectorAll('.st-hl').forEach(function (el) { el.remove(); });
    for (var hr = sS; hr <= sE; hr++) {
      var lb = document.createElement('div'); lb.className = 'st-axl';
      lb.textContent = pad(hr) + ':00'; lb.style.top = hY(hr) + 'px';
      ax.appendChild(lb);
      var ln = document.createElement('div'); ln.className = 'st-hl'; ln.style.top = hY(hr) + 'px'; cv.appendChild(ln);
      if (hr < sE) {
        var hl = document.createElement('div'); hl.className = 'st-hl';
        hl.style.top = (hY(hr) + ROW / 2) + 'px'; hl.style.opacity = '.35'; cv.appendChild(hl);
      }
    }
  }

  /* ── 블록 스타일 적용 (in-place) ── */
  function applyBlockStyle(el, b) {
    var ci = gc(b.text), col = PALS[ci];
    var top = hY(b.startH), ht = Math.max(hY(b.endH) - top, 18);
    el.style.top = top + 'px'; el.style.height = ht + 'px';
    el.style.background = col.bg; el.style.color = col.tx;
    el.style.border = '0.5px solid ' + col.bd;
    el.style.borderLeft = '3px solid ' + col.tx;
  }

  /* ── 블록 DOM 생성 (1회) ── */
  function createBlockEl(b) {
    var cv = qs('#st-cv');
    if (document.getElementById('bel-' + b.id)) return; // 중복 방지
    var el = document.createElement('div'); el.className = 'sb'; el.id = 'bel-' + b.id;
    var rht = document.createElement('div'); rht.className = 'rht';
    var nm = document.createElement('span'); nm.className = 'sbn'; nm.textContent = b.text;
    var mv = document.createElement('div'); mv.className = 'sbm'; mv.textContent = '⋮';
    var rhb = document.createElement('div'); rhb.className = 'rhb';
    el.appendChild(rht); el.appendChild(nm); el.appendChild(mv); el.appendChild(rhb);
    applyBlockStyle(el, b);
    attachBlockHandlers(el, b);
    cv.appendChild(el);
  }

  /* ── 기존 blocks 배열로 DOM 복원 ── */
  function renderBlocksFromData() {
    qs('#st-cv').querySelectorAll('.sb').forEach(function (el) { el.remove(); });
    blocks.forEach(function (b) { createBlockEl(b); });
  }

  /* ── 블록 핸들러 ── */
  function attachBlockHandlers(el, b) {
    var pressTimer = null, pressY = 0;
    el.addEventListener('pointerdown', function (e) {
      if (e.target.classList.contains('rht') || e.target.classList.contains('rhb') || e.target.classList.contains('sbm')) return;
      pressY = e.clientY;
      pressTimer = setTimeout(function () { pressTimer = null; openBM(b.id, b.startH, b.endH, b.text); }, 500);
    });
    el.addEventListener('pointermove', function (e) { if (pressTimer && Math.abs(e.clientY - pressY) > 8) { clearTimeout(pressTimer); pressTimer = null; } });
    el.addEventListener('pointerup', function () { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });

    var rht = el.querySelector('.rht'), rhb = el.querySelector('.rhb'), mv = el.querySelector('.sbm');
    var iaY0, iaS0, iaE0;

    rht.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); iaY0 = e.clientY; iaS0 = b.startH; iaE0 = b.endH; rht.setPointerCapture(e.pointerId); });
    rht.addEventListener('pointermove', function (e) {
      if (!rht.hasPointerCapture(e.pointerId)) return;
      b.startH = Math.max(sS, Math.min(b.endH - 0.5, snap(iaS0 + (e.clientY - iaY0) / ROW)));
      applyBlockStyle(el, b);
    });
    rht.addEventListener('pointerup', function (e) { if (rht.hasPointerCapture(e.pointerId)) { rht.releasePointerCapture(e.pointerId); saveToStorage(); syncToday(); } });

    rhb.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); iaY0 = e.clientY; iaS0 = b.startH; iaE0 = b.endH; rhb.setPointerCapture(e.pointerId); });
    rhb.addEventListener('pointermove', function (e) {
      if (!rhb.hasPointerCapture(e.pointerId)) return;
      b.endH = Math.min(sE, Math.max(b.startH + 0.5, snap(iaE0 + (e.clientY - iaY0) / ROW)));
      applyBlockStyle(el, b);
    });
    rhb.addEventListener('pointerup', function (e) { if (rhb.hasPointerCapture(e.pointerId)) { rhb.releasePointerCapture(e.pointerId); saveToStorage(); syncToday(); } });

    mv.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); iaY0 = e.clientY; iaS0 = b.startH; iaE0 = b.endH; mv.setPointerCapture(e.pointerId); });
    mv.addEventListener('pointermove', function (e) {
      if (!mv.hasPointerCapture(e.pointerId)) return;
      var dur = iaE0 - iaS0, ns = snap(iaS0 + (e.clientY - iaY0) / ROW);
      ns = Math.max(sS, Math.min(sE - dur, ns)); b.startH = ns; b.endH = ns + dur;
      applyBlockStyle(el, b);
    });
    mv.addEventListener('pointerup', function (e) { if (mv.hasPointerCapture(e.pointerId)) { mv.releasePointerCapture(e.pointerId); saveToStorage(); syncToday(); } });
  }

  /* ── 스케줄 이벤트 (1회만) ── */
  function attachSchedEvents() {
    var cv = qs('#st-cv');
    cv.addEventListener('dragover', function (e) { e.preventDefault(); });
    cv.addEventListener('drop', function (e) {
      e.preventDefault();
      var txt = e.dataTransfer.getData('text/plain') || dragTxt; if (!txt) return;
      var r = cv.getBoundingClientRect();
      var sh = snap(Math.max(sS, Math.min(sE - 0.5, (e.clientY - r.top) / ROW + sS)));
      addBlock(txt, sh, Math.min(sh + 1, sE)); dragTxt = '';
    });
    var tapTimer = null, tapY0 = 0;
    cv.addEventListener('pointerdown', function (e) {
      if (e.target !== cv && !e.target.classList.contains('st-hl')) return;
      tapY0 = e.clientY;
      tapTimer = setTimeout(function () { tapTimer = null; }, 400);
    });
    cv.addEventListener('pointerup', function (e) {
      if (!tapTimer) return; clearTimeout(tapTimer); tapTimer = null;
      if (Math.abs(e.clientY - tapY0) > 8) return;
      var r = cv.getBoundingClientRect();
      var sh = snap(Math.max(sS, Math.min(sE - 0.5, (e.clientY - r.top) / ROW + sS)));
      openBM(null, sh, Math.min(sh + 1, sE), '');
    });
  }

  function addBlock(txt, sh, eh) {
    var b = { id: 'b' + (++bId), text: txt, startH: sh, endH: eh };
    blocks.push(b); createBlockEl(b); saveToStorage(); syncToday();
  }

  /* ── 시간 범위 모달 ── */
  function bindSchedModal() {
    qs('#tr-ico').addEventListener('click', openTR);
    qs('#tr-cancel').addEventListener('click', function () { qs('#ov-tr').classList.remove('on'); });
    qs('#tr-ok').addEventListener('click', applyTR);
  }

  function openTR() {
    var ss = qs('#tr-s'), se = qs('#tr-e'); ss.innerHTML = ''; se.innerHTML = '';
    for (var h = 1; h <= 23; h++) { var o = document.createElement('option'); o.value = h; o.textContent = pad(h) + ':00'; if (h === sS) o.selected = true; ss.appendChild(o); }
    for (var h2 = 2; h2 <= 24; h2++) { var o2 = document.createElement('option'); o2.value = h2; o2.textContent = h2 === 24 ? '24:00' : pad(h2) + ':00'; if (h2 === sE) o2.selected = true; se.appendChild(o2); }
    qs('#ov-tr').classList.add('on');
  }

  function applyTR() {
    var s = parseInt(qs('#tr-s').value), e = parseInt(qs('#tr-e').value);
    if (e <= s) { toast('종료 시간이 시작 시간보다 늦어야 합니다'); return; }
    sS = s; sE = e;
    blocks.forEach(function (b) {
      b.startH = Math.max(b.startH, sS); b.endH = Math.min(b.endH, sE);
      if (b.endH <= b.startH) b.endH = Math.min(b.startH + 0.5, sE);
      var el = document.getElementById('bel-' + b.id);
      if (el) applyBlockStyle(el, b);
    });
    qs('#ov-tr').classList.remove('on');
    buildSchedAxis();
    saveToStorage();
  }

  /* ── 블록 추가/수정 모달 ── */
  function fillSel(id, def) {
    var s = qs('#' + id); s.innerHTML = '';
    for (var h = sS; h <= sE; h += 0.5) {
      var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      var o = document.createElement('option'); o.value = h; o.textContent = pad(hh) + ':' + (mm ? '30' : '00');
      if (Math.abs(h - def) < 0.01) o.selected = true; s.appendChild(o);
    }
  }

  function openBM(bid, sh, eh, txt) {
    editBid = bid;
    qs('#bl-title').textContent = bid ? '블록 수정' : '블록 추가';
    qs('#bl-txt').value = txt || '';
    fillSel('bl-s', sh); fillSel('bl-e', eh);
    var btns = qs('#bl-btns'); btns.innerHTML = '';
    if (bid) {
      var del = document.createElement('button'); del.className = 'mdel'; del.textContent = '삭제';
      del.addEventListener('click', function () {
        if (editBid) { var el = document.getElementById('bel-' + editBid); if (el) el.remove(); blocks = blocks.filter(function (b) { return b.id !== editBid; }); saveToStorage(); syncToday(); }
        qs('#ov-bl').classList.remove('on');
      });
      btns.appendChild(del);
    }
    var cancel = document.createElement('button'); cancel.textContent = '취소';
    cancel.addEventListener('click', function () { qs('#ov-bl').classList.remove('on'); });
    var ok = document.createElement('button'); ok.className = 'mok'; ok.textContent = bid ? '저장' : '추가';
    ok.addEventListener('click', confirmB);
    btns.appendChild(cancel); btns.appendChild(ok);
    qs('#ov-bl').classList.add('on');
    setTimeout(function () { qs('#bl-txt').focus(); }, 50);
  }

  function confirmB() {
    var txt = qs('#bl-txt').value.trim(); if (!txt) { toast('내용을 입력해 주세요'); return; }
    var s = parseFloat(qs('#bl-s').value), e = parseFloat(qs('#bl-e').value);
    if (e <= s) { toast('종료 시간이 시작 시간보다 늦어야 합니다'); return; }
    if (editBid) {
      var b = blocks.find(function (x) { return x.id === editBid; });
      if (b) { b.text = txt; b.startH = s; b.endH = e; var el = document.getElementById('bel-' + editBid); if (el) { el.querySelector('.sbn').textContent = txt; applyBlockStyle(el, b); } }
    } else { addBlock(txt, s, e); }
    saveToStorage(); syncToday();
    qs('#ov-bl').classList.remove('on');
  }

  /* ══════════════════════════════
     달력
  ══════════════════════════════ */
  function chCal(d) { calM += d; if (calM < 0) { calM = 11; calY--; } if (calM > 11) { calM = 0; calY++; } selDate = null; renderCal(); }

  function renderCal() {
    qs('#cal-lbl').textContent = calY + '년 ' + (calM + 1) + '월';
    var byDate = {}; entries.forEach(function (e) { byDate[e.date] = e; });
    var g = qs('#cgrid'); g.innerHTML = '';
    ['일', '월', '화', '수', '목', '금', '토'].forEach(function (l) { var d = document.createElement('div'); d.className = 'cdl'; d.textContent = l; g.appendChild(d); });
    var first = new Date(calY, calM, 1).getDay(), days = new Date(calY, calM + 1, 0).getDate();
    for (var i = 0; i < first; i++) { var emp = document.createElement('div'); emp.className = 'cc emp'; g.appendChild(emp); }
    for (var dy = 1; dy <= days; dy++) {
      (function (day) {
        var key = calY + '-' + pad(calM + 1) + '-' + pad(day);
        var e = byDate[key], pal = getCP(key);
        var cell = document.createElement('div'); cell.className = 'cc' + (e ? ' has' : '') + (selDate === key ? ' sel' : '');
        var dn = document.createElement('span'); dn.className = 'dn'; dn.textContent = day; cell.appendChild(dn);
        if (e && e.priorities) {
          var dd = document.createElement('div'); dd.className = 'dots';
          e.priorities.forEach(function (p, pi) { var dot = document.createElement('div'); dot.className = 'dot'; dot.style.background = p.done ? pal[pi] : '#ddd'; dd.appendChild(dot); });
          cell.appendChild(dd);
        }
        cell.addEventListener('click', function () { showCalDet(key); });
        g.appendChild(cell);
      })(dy);
    }
    if (selDate) showCalDet(selDate, true); else qs('#cdet').innerHTML = '';
  }

  function schedSum(bks) {
    if (!bks || !bks.length) return [];
    var s = bks.slice().sort(function (a, b) { return a.startH - b.startH; }); var res = [];
    s.forEach(function (b) { var l = res[res.length - 1]; if (l && l.text === b.text && Math.abs(l.endH - b.startH) < 0.01) l.endH = b.endH; else res.push({ text: b.text, startH: b.startH, endH: b.endH }); });
    return res;
  }

  function showCalDet(key, noR) {
    selDate = key;
    var e = entries.find(function (x) { return x.date === key; });
    var det = qs('#cdet');
    if (!e) { det.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px;">' + key + ' — 기록 없음</div>'; if (!noR) renderCal(); return; }
    var dc = e.priorities.filter(function (p) { return p.done; }).length;
    var tot = e.priorities.filter(function (p) { return p.text; }).length;
    var pal = getCP(key), sg = schedSum(e.blocks || []);
    var h = '<div class="cdet"><div class="cdh"><span class="cd-date">' + (e.displayDate || key) + '</span><span class="cd-score">' + dc + '/' + tot + '</span></div>';
    h += '<div class="cdsec">★ 핵심 3가지</div>';
    e.priorities.filter(function (p) { return p.text; }).forEach(function (p, pi) {
      h += '<div class="cdpi"><div class="cdpd" style="background:' + (p.done ? pal[pi] : '#ddd') + '"></div><span class="cdpt' + (p.done ? ' dn' : '') + '">' + p.text + '</span></div>';
    });
    if (sg.length) {
      h += '<div class="cdsec">⏱ 스케줄</div><div>';
      sg.forEach(function (gp) { var col = PALS[gc(gp.text) % PALS.length]; h += '<span class="cstag" style="background:' + col.bg + ';color:' + col.tx + ';">' + hL(gp.startH) + '~' + hL(gp.endH) + ' ' + gp.text + '</span>'; });
      h += '</div>';
    }
    h += '</div>'; det.innerHTML = h;
    if (!noR) renderCal();
  }

  /* ══════════════════════════════
     PWA 설치
  ══════════════════════════════ */
  function bindPWA() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferredInstall = e;
      qs('#install-status').textContent = '설치 준비 완료!';
    });
    qs('#btn-pwa-install').addEventListener('click', function () {
      if (deferredInstall) {
        deferredInstall.prompt();
        deferredInstall.userChoice.then(function (r) {
          if (r.outcome === 'accepted') { toast('앱이 설치됐습니다! 🎉'); qs('#install-status').textContent = '설치 완료!'; }
          else { qs('#install-status').textContent = '설치를 취소했습니다.'; }
          deferredInstall = null;
        });
      } else {
        toast('위의 수동 설치 방법을 따라주세요');
        qs('#install-status').textContent = '아래 수동 안내를 확인해주세요';
      }
    });
    window.addEventListener('appinstalled', function () {
      toast('앱 설치 완료! 🎉'); qs('#install-status').textContent = '설치 완료!';
    });
  }

  /* ══════════════════════════════
     폭죽
  ══════════════════════════════ */
  function fireConf() {
    var cv = qs('#conf-cv'); cv.style.display = 'block';
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    var ctx = cv.getContext('2d');
    var cols = ['#f9a8c9', '#7ec8e3', '#90e0af', '#ffd580', '#b5a0f7', '#e74c3c'];
    var ps = []; for (var i = 0; i < 90; i++) ps.push({ x: Math.random() * cv.width, y: cv.height * 0.4, vx: (Math.random() - 0.5) * 10, vy: -(Math.random() * 10 + 4), r: Math.random() * 4 + 2, c: cols[i % cols.length], rot: Math.random() * 360, rv: (Math.random() - 0.5) * 12, life: 1 });
    var raf;
    (function anim() {
      ctx.clearRect(0, 0, cv.width, cv.height); var alive = false;
      ps.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.rot += p.rv; p.life -= 0.02; if (p.life > 0) { alive = true; ctx.save(); ctx.globalAlpha = p.life; ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); } });
      if (alive) raf = requestAnimationFrame(anim); else { cv.style.display = 'none'; cancelAnimationFrame(raf); }
    })();
  }

  /* ══════════════════════════════
     달력 nav 바인드 (pg-cal에서)
  ══════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    qs('#cal-prev').addEventListener('click', function () { chCal(-1); });
    qs('#cal-next').addEventListener('click', function () { chCal(1); });
  });

  /* ══════════════════════════════
     Service Worker 등록
  ══════════════════════════════ */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function (e) { console.log('SW:', e); });
    }
  }

  /* ── 시작 ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
