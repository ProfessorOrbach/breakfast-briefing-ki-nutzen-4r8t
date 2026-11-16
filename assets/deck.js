/* Web-Präsentation – Navigation, Schritte, Moderatoransicht */
(() => {
  'use strict';

  const CHAPTERS = window.DECK_CHAPTERS || [
    { id: 1, name: 'Der Kunde', minutes: 6.5, color: '#C00009' },
    { id: 2, name: 'Der Nutzen', minutes: 6.5, color: '#E24300' },
    { id: 3, name: 'Wer profitiert', minutes: 7, color: '#9D167A' },
  ];

  const params = new URLSearchParams(location.search);
  const EMBED = params.has('embed');
  const ALLSTEPS = params.has('allsteps'); // Vorschau: alle Klick-Schritte sofort zeigen
  if (EMBED) document.body.classList.add('embed');

  const stage = document.getElementById('stage');
  const slides = Array.from(stage.querySelectorAll('.slide'));
  const total = slides.length;
  let index = 0;
  let step = 0;
  let presenterWin = null;

  // ---------- Vorbereitung ----------
  slides.forEach((s, i) => {
    s.dataset.index = i;
    const items = Array.from(s.querySelectorAll('.step, [data-add]'));
    items.forEach((el, k) => { if (!el.dataset.order) el.dataset.order = k; });
    items.sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));
    s._steps = items;
  });

  const titleOf = (s) => {
    if (!s) return '';
    if (s.dataset.title) return s.dataset.title;
    const h = s.querySelector('h1, h2, blockquote');
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  };
  const notesOf = (s) => {
    const n = s && s.querySelector('.notes');
    return n ? n.innerHTML.trim() : '';
  };
  const chapterOf = (s) => Number(s.dataset.chapter || 1);

  // ---------- Skalierung ----------
  function fit() {
    const sc = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${sc})`;
  }
  window.addEventListener('resize', fit);
  fit();

  // ---------- Footer / Fortschritt ----------
  const progress = document.getElementById('progress');
  const slideno = document.getElementById('slideno');
  const totalMinutes = CHAPTERS.reduce((a, c) => a + c.minutes, 0);
  const segEls = CHAPTERS.map((c) => {
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.style.width = Math.round((c.minutes / totalMinutes) * 640) + 'px';
    seg.innerHTML = `<div class="lbl">${c.name}</div><div class="bar"><i style="background:${c.color}"></i></div>`;
    progress.appendChild(seg);
    return seg;
  });

  function updateChrome() {
    const s = slides[index];
    const ch = chapterOf(s);
    stage.classList.toggle('on-dark', s.classList.contains('dark'));
    stage.classList.toggle('no-chrome', s.hasAttribute('data-nochrome'));
    CHAPTERS.forEach((c, k) => {
      const inCh = slides.filter((x) => chapterOf(x) === c.id);
      const pos = inCh.indexOf(s);
      let frac = 0;
      if (c.id < ch) frac = 1;
      else if (c.id === ch) frac = (pos + 1) / inCh.length;
      segEls[k].querySelector('i').style.width = (frac * 100) + '%';
      segEls[k].classList.toggle('current', c.id === ch);
    });
    slideno.textContent = `${index + 1} / ${total}`;
  }

  // ---------- Schritte ----------
  function applySteps(s, n) {
    s._steps.forEach((el, k) => {
      const on = k < n;
      if (el.dataset.add) el.classList.toggle(el.dataset.add, on);
      else el.classList.toggle('shown', on);
    });
  }

  // ---------- Zähler-Animation ----------
  function runCounters(s) {
    s.querySelectorAll('.count').forEach((el) => {
      const to = parseFloat(el.dataset.to);
      const dec = Number(el.dataset.decimals || 0);
      const pre = el.dataset.prefix || '';
      const suf = el.dataset.suffix || '';
      const fmt = (v) => pre + v.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
      if (EMBED) { el.textContent = fmt(to); return; }
      const from = parseFloat(el.dataset.from || 0);
      const dur = Number(el.dataset.dur || 1400);
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(tick);
      };
      el.textContent = fmt(from);
      requestAnimationFrame(tick);
      setTimeout(() => { el.textContent = fmt(to); }, dur + 150); // Sicherheit, falls rAF gedrosselt ist
    });
  }

  // ---------- Eingebettete Live-Ergebnisse (Mentimeter) ----------
  // Erst laden, wenn die Folie (oder die davor) erreicht ist; nie in Vorschauen
  function loadFrames(s) {
    if (!s || EMBED) return;
    s.querySelectorAll('iframe[data-src]').forEach((f) => {
      if (!f.getAttribute('src')) {
        f.src = f.dataset.src;
        f.closest('.menti-frame')?.classList.add('loaded');
      }
    });
  }
  stage.addEventListener('click', (e) => {
    const b = e.target.closest('.menti-toggle');
    if (!b) return;
    const box = b.closest('.menti-frame');
    const on = box.classList.toggle('interactive');
    b.textContent = on ? 'Fertig – zurück zur Präsentation' : 'Mentimeter bedienen';
    if (!on) window.focus();
  });

  // ---------- Navigation ----------
  function show(i, st = 0, opts = {}) {
    i = Math.max(0, Math.min(total - 1, i));
    const changed = i !== index || opts.force;
    slides.forEach((s, k) => {
      s.classList.toggle('active', k === i);
      s.classList.toggle('past', k < i);
    });
    const s = slides[i];
    const max = s._steps.length;
    step = (st === 'all' || ALLSTEPS) ? max : Math.max(0, Math.min(max, st));
    applySteps(s, step);
    index = i;
    if (changed) runCounters(s);
    loadFrames(s);
    loadFrames(slides[i + 1]);
    updateChrome();
    if (!EMBED) {
      const h = `#/${index + 1}`;
      if (location.hash !== h) history.replaceState(null, '', h);
      sendState();
    }
  }

  function next() {
    const s = slides[index];
    if (step < s._steps.length) {
      step++;
      applySteps(s, step);
      sendState();
    } else if (index < total - 1) {
      show(index + 1, 0);
    }
  }
  function prev() {
    const s = slides[index];
    if (step > 0) {
      step--;
      applySteps(s, step);
      sendState();
    } else if (index > 0) {
      show(index - 1, 'all');
    }
  }

  // ---------- Moderatoransicht ----------
  function stateMsg() {
    const s = slides[index];
    const n = slides[index + 1];
    return {
      type: 'deck-state',
      index, total, step,
      steps: s._steps.length,
      title: titleOf(s),
      notes: notesOf(s),
      chapter: chapterOf(s),
      nextTitle: n ? titleOf(n) : '— Ende —',
      chapters: CHAPTERS,
      titles: slides.map(titleOf),
      chapterOfSlide: slides.map(chapterOf),
    };
  }
  // Zweiter Kanal: synchronisiert auch über getrennte Tabs (gleiche Herkunft, z. B. localhost oder GitHub Pages)
  let channel = null;
  if (!EMBED && 'BroadcastChannel' in window) {
    try { channel = new BroadcastChannel('deck-sync'); } catch (e) { channel = null; }
  }
  function sendState() {
    const msg = stateMsg();
    if (presenterWin && !presenterWin.closed) {
      try { presenterWin.postMessage(msg, '*'); } catch (e) { /* ignore */ }
    }
    if (channel) { try { channel.postMessage(msg); } catch (e) { /* ignore */ } }
  }
  function openPresenter() {
    presenterWin = window.open('presenter.html?deck=' + encodeURIComponent(location.pathname.split('/').pop() || 'index.html'), 'deck-presenter', 'width=1400,height=860');
    setTimeout(sendState, 600);
    setTimeout(sendState, 1500);
  }

  function handleMsg(d, source) {
    if (d.type === 'presenter-hello') { if (source) presenterWin = source; sendState(); }
    if (d.type === 'presenter-nav') {
      if (d.action === 'next') next();
      if (d.action === 'prev') prev();
      if (d.action === 'goto') show(d.index, 0);
    }
  }
  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (EMBED) { if (d.type === 'embed-goto') show(d.index, d.step, { force: true }); return; }
    handleMsg(d, ev.source);
  });
  if (channel) channel.onmessage = (ev) => handleMsg(ev.data || {}, null);

  if (EMBED) {
    show(Number(params.get('slide') || 0), params.get('step') === 'all' ? 'all' : 0, { force: true });
    return; // keine Interaktion in eingebetteten Vorschauen
  }

  // ---------- Übersicht ----------
  const overview = document.getElementById('overview');
  let overviewBuilt = false;
  function buildOverview() {
    const byCh = {};
    slides.forEach((s, i) => { (byCh[chapterOf(s)] = byCh[chapterOf(s)] || []).push(i); });
    let html = '<div class="hint">Klick auf eine Folie springt dorthin · Esc schließt</div>';
    CHAPTERS.forEach((c) => {
      html += `<h4>${String(c.id).padStart(2, '0')} · ${c.name} · ${c.minutes} Min.</h4><div class="ov-grid" data-ch="${c.id}"></div>`;
    });
    overview.innerHTML = html;
    CHAPTERS.forEach((c) => {
      const grid = overview.querySelector(`.ov-grid[data-ch="${c.id}"]`);
      (byCh[c.id] || []).forEach((i) => {
        const t = document.createElement('div');
        t.className = 'thumb';
        t.dataset.goto = i;
        const inner = document.createElement('div');
        inner.className = 'inner';
        const clone = slides[i].cloneNode(true);
        clone.classList.add('active');
        clone.classList.remove('past');
        clone.querySelectorAll('[data-add]').forEach((el) => el.classList.add(el.dataset.add));
        clone.querySelectorAll('iframe').forEach((f) => f.remove());
        clone.querySelectorAll('.menti-frame').forEach((m) => m.classList.remove('loaded', 'interactive'));
        clone.querySelectorAll('.count').forEach((el) => {
          const dec = Number(el.dataset.decimals || 0);
          el.textContent = (el.dataset.prefix || '') + parseFloat(el.dataset.to).toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (el.dataset.suffix || '');
        });
        inner.appendChild(clone);
        t.appendChild(inner);
        const num = document.createElement('div');
        num.className = 'thumb-no';
        num.textContent = i + 1;
        t.appendChild(num);
        grid.appendChild(t);
      });
    });
    overviewBuilt = true;
  }
  function sizeThumbs() {
    overview.querySelectorAll('.thumb').forEach((t) => {
      t.querySelector('.inner').style.transform = `scale(${t.clientWidth / 1920})`;
    });
  }
  function toggleOverview(force) {
    const on = force !== undefined ? force : !document.body.classList.contains('overview');
    if (on && !overviewBuilt) buildOverview();
    document.body.classList.toggle('overview', on);
    if (on) {
      sizeThumbs();
      overview.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('current', Number(t.dataset.goto) === index));
      const cur = overview.querySelector('.thumb.current');
      if (cur) cur.scrollIntoView({ block: 'center' });
    }
  }
  overview.addEventListener('click', (e) => {
    const t = e.target.closest('.thumb');
    if (t) { show(Number(t.dataset.goto), 0); toggleOverview(false); }
  });
  window.addEventListener('resize', () => { if (document.body.classList.contains('overview')) sizeThumbs(); });

  // ---------- Vollbild ----------
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // ---------- Tastatur ----------
  let typed = '';
  let typedTimer = null;
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (document.body.classList.contains('overview') && k === 'Escape') { toggleOverview(false); return; }
    if (/^[0-9]$/.test(k)) {
      typed += k;
      clearTimeout(typedTimer);
      typedTimer = setTimeout(() => { typed = ''; }, 1500);
      return;
    }
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'n':
        e.preventDefault(); next(); break;
      case 'Enter':
        e.preventDefault();
        if (typed) { show(Number(typed) - 1, 0); typed = ''; } else next();
        break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        e.preventDefault(); prev(); break;
      case 'Home': show(0, 0); break;
      case 'End': show(total - 1, 0); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'o': case 'O': case 'g': case 'G': case 'Escape': toggleOverview(); break;
      case 'b': case 'B': case '.': document.body.classList.toggle('blackout'); break;
      case 'p': case 'P': openPresenter(); break;
      case 'h': case 'H': case '?': document.body.classList.toggle('help'); break;
      default: break;
    }
  });

  // ---------- Maus & Touch ----------
  stage.addEventListener('click', (e) => {
    if (e.target.closest('a, button, .prompt, .no-advance')) return;
    if (window.getSelection && String(window.getSelection()).length) return;
    next();
  });
  let tx = null;
  stage.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    tx = null;
  });

  let idle = null;
  document.addEventListener('mousemove', () => {
    document.body.classList.add('mouse-active');
    clearTimeout(idle);
    idle = setTimeout(() => document.body.classList.remove('mouse-active'), 2200);
  });

  document.getElementById('controls').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'prev') prev();
    if (a === 'next') next();
    if (a === 'overview') toggleOverview();
    if (a === 'full') toggleFullscreen();
    if (a === 'presenter') openPresenter();
    if (a === 'help') document.body.classList.toggle('help');
  });
  document.getElementById('blackout').addEventListener('click', () => document.body.classList.remove('blackout'));

  // ---------- Prompts kopieren ----------
  function copyText(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt);
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return Promise.resolve();
  }
  stage.addEventListener('click', (e) => {
    const b = e.target.closest('.copy');
    if (!b) return;
    const pre = b.closest('.prompt').querySelector('pre');
    copyText(pre.innerText.trim()).then(() => {
      const old = b.innerHTML;
      b.classList.add('ok');
      b.textContent = 'Kopiert ✓';
      setTimeout(() => { b.classList.remove('ok'); b.innerHTML = old; }, 1600);
    });
  });

  // ---------- Start ----------
  const m = location.hash.match(/#\/(\d+)/);
  show(m ? Number(m[1]) - 1 : 0, 0, { force: true });
  window.addEventListener('hashchange', () => {
    const mm = location.hash.match(/#\/(\d+)/);
    if (mm && Number(mm[1]) - 1 !== index) show(Number(mm[1]) - 1, 0);
  });
})();
