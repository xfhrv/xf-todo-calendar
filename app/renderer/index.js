/* Renderer for the standalone desktop app: calendar + 收集箱 / 当天 / 等待. */
const api = window.todoApi;

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const TAG = /#[^\s#，。、；：！？,.;:!?()（）]+/g;

let snapshot = { tasks: [], waiting: [] };
let view = { year: new Date().getFullYear(), month: new Date().getMonth() };
let selected = dayKey(new Date());
let editing = null;
let dragging = null;
let offline = null;

/** Per-zone #tag filter; an empty string means "all". */
let filters = { inbox: '', day: '', waiting: '' };
/** Ticked waiting items are archived; this reveals them again. */
let showArchived = false;

/** The #tags written in one title, without the leading #. */
function tagsOf(title) {
  const found = String(title).match(/#[^\s#，。、；：！？,.;:!?()（）]+/g);
  if (found === null) return [];
  return found.map((raw) => raw.slice(1).trim()).filter((tag) => tag !== '');
}

/** Distinct tags in a zone, sorted the way the DSH tab sorts them. */
function zoneTags(rows) {
  const seen = new Set();
  for (const row of rows) for (const tag of tagsOf(row.title)) seen.add(tag);
  return [...seen].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

/** A tag that no longer exists in the zone falls back to "all". */
function effectiveFilter(zone, rows) {
  const wanted = filters[zone];
  if (wanted === '' || wanted === undefined) return '';
  return zoneTags(rows).includes(wanted) ? wanted : '';
}

function filterRows(rows, filter) {
  return filter === '' ? rows : rows.filter((row) => tagsOf(row.title).includes(filter));
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, count) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
}

function gridStart(year, month) {
  const first = new Date(year, month, 1);
  return addDays(first, -((first.getDay() + 6) % 7));
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function titleHtml(title) {
  return escapeHtml(title).replace(TAG, (tag) => `<span class="tag">${tag}</span>`);
}

function dateLabel(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function orderRows(rows) {
  return rows.slice().sort((left, right) => Number(left.done) - Number(right.done) || left.createdAt - right.createdAt);
}

function inboxRows() {
  return orderRows(snapshot.tasks.filter((row) => row.date === null || row.date === undefined));
}

function dayRows() {
  return orderRows(snapshot.tasks.filter((row) => row.date === selected));
}

function waitingRows() {
  return orderRows(snapshot.waiting);
}

function groupOf(rows) {
  for (const zone of ['inbox', 'day', 'waiting']) {
    const list = zone === 'inbox' ? inboxRows() : zone === 'day' ? dayRows() : waitingRows();
    if (list.some((row) => row.id === rows)) return zone;
  }
  return 'inbox';
}

/* ------------------------------------------------------------------ 渲染 ---- */

function renderCalendar() {
  const today = dayKey(new Date());
  document.getElementById('month').textContent = `${view.year}年${view.month + 1}月`;
  const start = gridStart(view.year, view.month);
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const date = addDays(start, index);
    const key = dayKey(date);
    const rows = snapshot.tasks.filter((row) => row.date === key);
    const dots = rows.slice(0, 3).map((row) => `<i class="${row.done ? 'done' : ''}"></i>`).join('');
    const classes = ['cell'];
    if (date.getMonth() !== view.month) classes.push('outside');
    if (key === today) classes.push('today');
    if (key === selected) classes.push('selected');
    cells.push(
      `<button type="button" class="${classes.join(' ')}" data-date="${key}">` +
        `<span class="num">${date.getDate()}</span>` +
        `<span class="dots">${dots}</span>` +
      '</button>'
    );
  }
  document.getElementById('grid').innerHTML = cells.join('');
}

function rowHtml(row, zone) {
  const isEditing = editing !== null && editing.id === row.id;
  const age =
    zone === 'waiting'
      ? `<span class="age">${waitingStamp(row)}</span>`
      : '';
  const body = isEditing
    ? `<input class="editor" data-editor="${row.id}" value="${escapeHtml(editing.draft)}" maxlength="200" />`
    : `<button type="button" class="title" data-edit="${row.id}">${titleHtml(row.title)}</button>`;
  return (
    `<li class="row ${row.done ? 'done' : ''} ${dragging === row.id ? 'dragging' : ''}" draggable="${isEditing ? 'false' : 'true'}" data-id="${row.id}" data-zone="${zone}">` +
      `<button type="button" class="check ${row.done ? 'on' : ''}" data-toggle="${row.id}" title="完成/取消">✓</button>` +
      body +
      age +
      `<button type="button" class="remove" data-remove="${row.id}" title="删除">✕</button>` +
    '</li>'
  );
}

/** M-D, for the compact start/finish stamps on a waiting row. */
function shortDay(stamp) {
  const date = new Date(stamp);
  return date.getMonth() + 1 + '-' + String(date.getDate()).padStart(2, '0');
}

/** Whole days between two stamps, at least 1. */
function daysBetween(from, to) {
  const startOfDay = (value) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };
  const days = Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
  return days <= 0 ? 1 : days;
}

/** "开始 11-20 · 已等 6 天" while waiting, "11-20 → 11-26 · 共 6 天" once ticked. */
function waitingStamp(row) {
  if (!Number.isFinite(row.createdAt) || row.createdAt <= 0) return row.done ? '已完成' : '今天加入';
  const from = shortDay(row.createdAt);
  if (row.done) {
    const finished = Number.isFinite(row.completedAt) && row.completedAt > 0 ? row.completedAt : 0;
    if (finished <= 0) return `开始 ${from} · 已完成`;
    return `${from} → ${shortDay(finished)} · 共 ${daysBetween(row.createdAt, finished)} 天`;
  }
  return `开始 ${from} · ${waitingAge(row)}`;
}

function waitingAge(row) {
  if (!Number.isFinite(row.createdAt) || row.createdAt <= 0) return '今天加入';
  const created = new Date(row.createdAt);
  const days = Math.round(
    (new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime() -
      new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime()) / 86400000
  );
  return days <= 0 ? '今天加入' : `已等 ${days} 天`;
}

/** "全部" plus one chip per tag present in the zone; empty when the zone has no tag. */
function renderChips(zone, rows, current) {
  const tags = zoneTags(rows);
  if (tags.length === 0) return '';
  const chip = (value, label) =>
    `<button type="button" class="chip" data-tag-zone="${zone}" data-tag="${escapeHtml(value)}" aria-pressed="${current === value ? 'true' : 'false'}">${label}</button>`;
  return [
    chip('', '全部'),
    ...tags.map((tag) => chip(tag, '#' + escapeHtml(tag)))
  ].join('');
}

function renderZones() {
  const zones = [
    ['inbox', inboxRows(), 'inbox-rows', 'inbox-count', 'inbox-chips', '收集箱里还没有条目'],
    ['day', dayRows(), 'day-rows', 'day-count', 'day-chips', '这一天还没有待办'],
    ['waiting', waitingRows(), 'waiting-rows', 'waiting-count', 'waiting-chips', '没有在等的事']
  ];
  for (const [zone, rows, listId, countId, chipsId, emptyText] of zones) {
    const filter = effectiveFilter(zone, rows);
    const visible = filterRows(rows, filter);
    if (zone !== 'waiting') {
      document.getElementById(countId).textContent = `${visible.length} 项`;
      document.getElementById(chipsId).innerHTML = renderChips(zone, rows, filter);
      document.getElementById(listId).innerHTML = visible.length === 0
        ? `<li class="empty">${emptyText}</li>`
        : visible.map((row) => rowHtml(row, zone)).join('');
      continue;
    }
    // Waiting: ticked rows are archived, not listed.
    const active = visible.filter((row) => !row.done);
    const archived = visible.filter((row) => row.done);
    document.getElementById(countId).textContent = `${active.length} 项`;
    document.getElementById(chipsId).innerHTML = renderChips(zone, rows, filter);
    const list = active.map((row) => rowHtml(row, 'waiting')).join('');
    const archToggle = archived.length === 0
      ? ''
      : `<li class="archive-row"><button type="button" class="archive-toggle" data-archive-toggle="true" aria-expanded="${showArchived ? 'true' : 'false'}">${showArchived ? '已归档 ' + archived.length + ' 条 · 收起' : '已归档 ' + archived.length + ' 条 · 展开'}</button></li>`;
    const archRows = showArchived ? archived.map((row) => rowHtml(row, 'waiting')).join('') : '';
    document.getElementById(listId).innerHTML = active.length === 0 && archived.length === 0
      ? `<li class="empty">${emptyText}</li>`
      : list + archToggle + archRows;
  }
  const date = parseDayKey(selected);
  document.getElementById('day-label').textContent = `${dateLabel(date)} · 周${WEEKDAY[date.getDay()]}`;
}

function renderStatus() {
  const status = document.getElementById('status');
  if (offline !== null) {
    status.textContent = `离线：${offline}`;
    status.classList.add('offline');
  } else {
    status.textContent = `已同步 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    status.classList.remove('offline');
  }
}

function render() {
  renderCalendar();
  renderZones();
  renderStatus();
}

/* ------------------------------------------------------------------ 数据 ---- */

async function refresh() {
  try {
    snapshot = await api.read();
    offline = null;
  } catch (error) {
    offline = String(error && error.message ? error.message : error);
  }
  render();
  if (editing !== null) {
    const input = document.querySelector(`[data-editor="${editing.id}"]`);
    if (input !== null) {
      input.focus();
      input.select();
    }
  }
}

/** Local prediction of an operation, so clicks feel instant instead of waiting for CalDAV. */
function predict(operation) {
  const next = { tasks: snapshot.tasks.slice(), waiting: snapshot.waiting.slice() };
  const taskIndex = next.tasks.findIndex((row) => row.id === operation.id);
  const waitingIndex = next.waiting.findIndex((row) => row.id === operation.id);
  switch (operation.op) {
    case 'toggle': {
      if (taskIndex >= 0) next.tasks[taskIndex] = { ...next.tasks[taskIndex], done: !next.tasks[taskIndex].done };
      else if (waitingIndex >= 0) next.waiting[waitingIndex] = { ...next.waiting[waitingIndex], done: !next.waiting[waitingIndex].done };
      return next;
    }
    case 'remove': {
      next.tasks = next.tasks.filter((row) => row.id !== operation.id);
      next.waiting = next.waiting.filter((row) => row.id !== operation.id);
      return next;
    }
    case 'setTitle': {
      if (taskIndex >= 0) next.tasks[taskIndex] = { ...next.tasks[taskIndex], title: operation.title };
      else if (waitingIndex >= 0) next.waiting[waitingIndex] = { ...next.waiting[waitingIndex], title: operation.title };
      return next;
    }
    case 'setDate': {
      if (taskIndex >= 0) next.tasks[taskIndex] = { ...next.tasks[taskIndex], date: operation.date };
      return next;
    }
    case 'move': {
      const source = taskIndex >= 0 ? next.tasks[taskIndex] : next.waiting[waitingIndex];
      if (source === undefined) return next;
      next.tasks = next.tasks.filter((row) => row.id !== operation.id);
      next.waiting = next.waiting.filter((row) => row.id !== operation.id);
      if (operation.waiting === true) next.waiting.push({ id: source.id, title: source.title, done: source.done, createdAt: source.createdAt });
      else next.tasks.push({ id: source.id, title: source.title, done: source.done, createdAt: source.createdAt, date: operation.date === undefined ? null : operation.date });
      return next;
    }
    default:
      return null;
  }
}

async function apply(operation) {
  const before = snapshot;
  const guess = predict(operation);
  if (guess !== null) {
    snapshot = guess;
    render();
  }
  try {
    snapshot = await api.op(operation);
    offline = null;
  } catch (error) {
    snapshot = before;
    offline = String(error && error.message ? error.message : error);
  }
  render();
}

/* ------------------------------------------------------------------ 交互 ---- */

document.getElementById('prev').addEventListener('click', () => {
  view = view.month === 0 ? { year: view.year - 1, month: 11 } : { year: view.year, month: view.month - 1 };
  render();
});
document.getElementById('next').addEventListener('click', () => {
  view = view.month === 11 ? { year: view.year + 1, month: 0 } : { year: view.year, month: view.month + 1 };
  render();
});
document.getElementById('today').addEventListener('click', () => {
  const now = new Date();
  view = { year: now.getFullYear(), month: now.getMonth() };
  selected = dayKey(now);
  render();
});
document.getElementById('hide').addEventListener('click', () => api.hideMain());

const pinButton = document.getElementById('pin');

function setPinUi(pinned) {
  pinButton.setAttribute('aria-pressed', pinned ? 'true' : 'false');
  pinButton.textContent = pinned ? '已置顶' : '置顶';
  pinButton.title = pinned ? '已置顶，点击取消' : '窗口置顶（保持在其他窗口之上）';
}

void api.pinState().then((state) => setPinUi(Boolean(state.pinned)));
pinButton.addEventListener('click', async () => {
  const current = pinButton.getAttribute('aria-pressed') === 'true';
  const result = await api.setPin(!current);
  setPinUi(Boolean(result.pinned));
});

/* Reveal or hide the archived waiting rows. */
document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-archive-toggle]');
  if (toggle === null) return;
  showArchived = !showArchived;
  render();
});

/* #tag chips: one filter per zone; "全部" clears it. */
document.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-tag-zone]');
  if (chip === null) return;
  filters = { ...filters, [chip.dataset.tagZone]: chip.dataset.tag };
  render();
});

document.getElementById('grid').addEventListener('click', (event) => {
  const cell = event.target.closest('[data-date]');
  if (cell === null) return;
  selected = cell.dataset.date;
  const date = parseDayKey(selected);
  if (date.getMonth() !== view.month) view = { year: date.getFullYear(), month: date.getMonth() };
  render();
});

document.querySelectorAll('form.add').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = form.querySelector('input');
    const title = input.value.trim();
    if (title === '') return;
    const zone = form.dataset.add;
    input.value = '';
    if (zone === 'waiting') void apply({ op: 'addWaiting', title });
    else void apply({ op: 'add', title, date: zone === 'day' ? selected : null });
  });
});

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle]');
  if (toggle !== null) {
    void apply({ op: 'toggle', id: toggle.dataset.toggle });
    return;
  }
  const remove = event.target.closest('[data-remove]');
  if (remove !== null) {
    void apply({ op: 'remove', id: remove.dataset.remove });
    return;
  }
  const edit = event.target.closest('[data-edit]');
  if (edit !== null) {
    const id = edit.dataset.edit;
    const row = [...snapshot.tasks, ...snapshot.waiting].find((item) => item.id === id);
    if (row !== undefined) {
      editing = { id, draft: row.title };
      render();
    }
  }
});

document.addEventListener('keydown', (event) => {
  const input = event.target.closest('[data-editor]');
  if (input === null || editing === null) return;
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    const draft = input.value.trim();
    const id = editing.id;
    editing = null;
    if (draft !== '') void apply({ op: 'setTitle', id, title: draft });
    else render();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    editing = null;
    render();
  }
});

document.addEventListener('focusout', (event) => {
  const input = event.target.closest('[data-editor]');
  if (input === null || editing === null) return;
  const draft = input.value.trim();
  const id = editing.id;
  editing = null;
  if (draft !== '') void apply({ op: 'setTitle', id, title: draft });
  else render();
});

/* ----------------------------------------------------------- 右键复制内容 ---- */

const toast = document.getElementById('toast');
let toastTimer = null;

function showToast(text) {
  if (toast === null) return;
  toast.textContent = text;
  toast.classList.add('show');
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1500);
}

document.addEventListener('contextmenu', (event) => {
  if (event.target.closest('input') !== null) return;
  const row = event.target.closest('.row[data-id]');
  if (row === null) return;
  event.preventDefault();
  const id = row.dataset.id;
  const item = [...snapshot.tasks, ...snapshot.waiting].find((entry) => entry.id === id);
  if (item === undefined) return;
  void api.copy(item.title).then(() => showToast('已复制到剪贴板'));
});
/* --------------------------------------------------------------- 拖拽移动 ---- */

document.addEventListener('dragstart', (event) => {
  const row = event.target.closest('.row[data-id]');
  if (row === null) return;
  dragging = row.dataset.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', dragging);
  row.classList.add('dragging');
});

document.addEventListener('dragend', () => {
  dragging = null;
  document.querySelectorAll('.drop').forEach((node) => node.classList.remove('drop'));
  document.querySelectorAll('.row.dragging').forEach((node) => node.classList.remove('dragging'));
});

document.addEventListener('dragover', (event) => {
  if (dragging === null) return;
  const target = event.target.closest('[data-date]') ?? event.target.closest('.zone[data-zone]');
  if (target === null) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  if (!target.classList.contains('drop')) {
    document.querySelectorAll('.drop').forEach((node) => node.classList.remove('drop'));
    target.classList.add('drop');
  }
});

document.addEventListener('drop', (event) => {
  if (dragging === null) return;
  const id = dragging;
  dragging = null;
  document.querySelectorAll('.drop').forEach((node) => node.classList.remove('drop'));
  const cell = event.target.closest('[data-date]');
  if (cell !== null) {
    event.preventDefault();
    void apply({ op: 'move', id, date: cell.dataset.date, waiting: false });
    selected = cell.dataset.date;
    const date = parseDayKey(selected);
    if (date.getMonth() !== view.month) view = { year: date.getFullYear(), month: date.getMonth() };
    render();
    return;
  }
  const zone = event.target.closest('.zone[data-zone]');
  if (zone !== null) {
    event.preventDefault();
    if (zone.dataset.zone === 'waiting') void apply({ op: 'move', id, waiting: true });
    else if (zone.dataset.zone === 'day') void apply({ op: 'move', id, date: selected, waiting: false });
    else void apply({ op: 'move', id, date: null, waiting: false });
  }
});

/* ------------------------------------------------------------------ 启动 ---- */

api.onState((state) => {
  snapshot = state;
  offline = null;
  render();
});
api.onOffline((message) => {
  offline = message;
  renderStatus();
});

void refresh();
setInterval(() => void refresh(), 30000);
