
(() => {
  'use strict';
  const rootData = window.APP_DATA || {items: []};
  const items = Array.isArray(rootData.items) ? rootData.items : [];
  const STORAGE_KEY = 'doboku2_progress_v1';
  const PAGE_SIZE = 24;

  const els = {
    search: document.getElementById('searchInput'),
    clear: document.getElementById('clearSearch'),
    subjects: document.getElementById('subjectFilters'),
    ranks: document.getElementById('rankFilters'),
    status: document.getElementById('statusFilter'),
    reset: document.getElementById('resetFilters'),
    count: document.getElementById('resultCount'),
    summary: document.getElementById('activeSummary'),
    results: document.getElementById('results'),
    more: document.getElementById('moreButton'),
    template: document.getElementById('cardTemplate')
  };

  const subjects = ['すべて', ...Array.from(new Set(items.map(x => x.subject)))];
  const ranks = ['すべて', 'A', 'B', 'C'];
  let state = { subject: 'すべて', rank: 'すべて', status: 'all', query: '', shown: PAGE_SIZE };
  let progress = loadProgress();

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch (_) { return {}; }
  }

  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (_) {}
  }

  function getStatus(id) {
    const v = progress[id];
    return v && ['未学習','復習','習得'].includes(v.status) ? v.status : '未学習';
  }

  function setStatus(id, status) {
    progress[id] = {...(progress[id] || {}), status};
    saveProgress();
    render();
  }

  function normalize(s) {
    return String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function highlight(text, query) {
    const safe = escapeHtml(text);
    const q = normalize(query);
    if (!q) return safe;
    const tokens = q.split(' ').filter(Boolean).slice(0, 8);
    let out = safe;
    tokens.forEach(token => {
      const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try { out = out.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>'); } catch (_) {}
    });
    return out;
  }

  function matches(item) {
    if (state.subject !== 'すべて' && item.subject !== state.subject) return false;
    if (state.rank !== 'すべて' && item.rank !== state.rank) return false;
    if (state.status !== 'all' && getStatus(item.id) !== state.status) return false;
    const q = normalize(state.query);
    if (!q) return true;
    const hay = normalize(item.searchText || [item.subject,item.rank,item.category1,item.category2,item.title,item.summary,item.keyInfo,item.trap,item.related,item.supplement].join(' '));
    return q.split(' ').filter(Boolean).every(t => hay.includes(t));
  }

  function makeChip(label, type) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = label;
    b.dataset.value = label;
    b.addEventListener('click', () => {
      if (type === 'subject') state.subject = label; else state.rank = label;
      state.shown = PAGE_SIZE;
      render();
    });
    return b;
  }

  subjects.forEach(s => els.subjects.appendChild(makeChip(s, 'subject')));
  ranks.forEach(r => els.ranks.appendChild(makeChip(r, 'rank')));

  function detailRows(item, query) {
    const rows = [];
    if (item.distinguish) rows.push(['見分け方', item.distinguish]);
    (item.extras || []).forEach(x => { if (x && x.value) rows.push([x.label || '補足', x.value]); });
    if (item.related) rows.push(['関連', item.related]);
    if (item.supplement) rows.push(['補足', item.supplement]);
    if (item.sourceType) rows.push(['データ区分', item.sourceType]);
    if (!rows.length) rows.push(['補足', '追加情報はありません']);
    return rows.map(([k,v]) => `<dl class="detail-row"><dt>${escapeHtml(k)}</dt><dd>${highlight(v, query)}</dd></dl>`).join('');
  }

  function renderCard(item) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    const badges = node.querySelector('.badges');
    const rb = document.createElement('span');
    rb.className = `badge rank-${item.rank}`;
    rb.textContent = `${item.rank}ランク`;
    const sb = document.createElement('span');
    sb.className = 'badge';
    sb.textContent = item.subject;
    badges.append(rb, sb);

    const category = [item.category1, item.category2].filter(Boolean).join(' ＞ ');
    node.querySelector('.category').textContent = category;
    node.querySelector('.title').innerHTML = highlight(item.title, state.query);
    node.querySelector('.summary').innerHTML = highlight(item.summary, state.query);
    node.querySelector('.key-label').textContent = item.keyLabel || '重要ポイント';
    node.querySelector('.key-info').innerHTML = highlight(item.keyInfo || '—', state.query);

    const trapBox = node.querySelector('.trap-box');
    if (item.trap) {
      trapBox.hidden = false;
      node.querySelector('.trap').innerHTML = highlight(item.trap, state.query);
    }
    node.querySelector('.details-body').innerHTML = detailRows(item, state.query);

    const status = getStatus(item.id);
    const statusButton = node.querySelector('.status-button');
    statusButton.textContent = status;
    statusButton.dataset.status = status;
    statusButton.addEventListener('click', () => {
      const next = status === '未学習' ? '復習' : status === '復習' ? '習得' : '未学習';
      setStatus(item.id, next);
    });

    node.querySelectorAll('.learn-actions button').forEach(b => {
      const s = b.dataset.status;
      b.classList.toggle('selected', s === status);
      b.addEventListener('click', () => setStatus(item.id, s));
    });
    return node;
  }

  function render() {
    els.subjects.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.value === state.subject));
    els.ranks.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.value === state.rank));
    els.status.value = state.status;

    const filtered = items.filter(matches);
    els.count.textContent = `${filtered.length}件`;
    const parts = [];
    if (state.query) parts.push(`「${state.query}」`);
    if (state.subject !== 'すべて') parts.push(state.subject);
    if (state.rank !== 'すべて') parts.push(`${state.rank}ランク`);
    if (state.status !== 'all') parts.push(state.status);
    els.summary.textContent = parts.length ? parts.join('・') : `${items.length}件から検索`;

    els.results.replaceChildren();
    if (!filtered.length) {
      const p = document.createElement('div');
      p.className = 'empty';
      p.innerHTML = '<strong>見つかりませんでした</strong><br>検索語を短くするか、絞り込みを解除してください。';
      els.results.appendChild(p);
      els.more.hidden = true;
      return;
    }
    filtered.slice(0, state.shown).forEach(item => els.results.appendChild(renderCard(item)));
    els.more.hidden = filtered.length <= state.shown;
    els.more.textContent = `さらに表示（残り ${Math.max(0, filtered.length - state.shown)}件）`;
  }

  els.search.addEventListener('input', e => { state.query = e.target.value; state.shown = PAGE_SIZE; render(); });
  els.clear.addEventListener('click', () => { els.search.value = ''; state.query = ''; state.shown = PAGE_SIZE; els.search.focus(); render(); });
  els.status.addEventListener('change', e => { state.status = e.target.value; state.shown = PAGE_SIZE; render(); });
  els.reset.addEventListener('click', () => {
    state = { subject: 'すべて', rank: 'すべて', status: 'all', query: '', shown: PAGE_SIZE };
    els.search.value = '';
    render();
  });
  els.more.addEventListener('click', () => { state.shown += PAGE_SIZE; render(); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  render();
})();
