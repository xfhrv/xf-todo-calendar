/**
 * XF 待办日历 —— DSH 插件的 Host 半（离线版）。
 *
 * 数据只保存在本机一个 JSON 文件里（默认 `~/.dsh/xf-todo-calendar/store.json`），
 * 不连接任何服务器，也不需要账号。浏览器标签页、微信通道和 agent 的 `todo` 工具
 * 都通过这里的本地路由读写同一份记录。
 *
 * 路由（挂在 DSH Web 服务的回环地址上）：
 *   GET  /.dsh-todo/state  -> { version, updatedAt, tasks, waiting }
 *   PUT  /.dsh-todo/state  -> 只新建/更新（不会删除），返回新记录
 *   POST /.dsh-todo/op     -> 一条操作，返回新记录
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Host 服务：路由挂载在 DSH 自己的回环 Web 服务上。 */
export const inject = ['webServer'];

const DEFAULTS = {
  storePath: join(homedir(), '.dsh', 'xf-todo-calendar', 'store.json'),
  route: '/.dsh-todo'
};

function settings(config) {
  const raw = config !== null && typeof config === 'object' ? config : {};
  const storePath = typeof raw.storePath === 'string' && raw.storePath !== '' ? raw.storePath : DEFAULTS.storePath;
  const route = typeof raw.route === 'string' && raw.route.startsWith('/') ? raw.route : DEFAULTS.route;
  return { storePath, route: route.endsWith('/') ? route.slice(0, -1) : route };
}

// ------------------------------------------------------------------ store ----

function emptyStore() {
  return { version: 1, updatedAt: 0, tasks: [], waiting: [], tombstones: {} };
}

function readStore(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return {
      version: 1,
      updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      waiting: Array.isArray(parsed.waiting) ? parsed.waiting : [],
      tombstones: parsed.tombstones !== null && typeof parsed.tombstones === 'object' ? parsed.tombstones : {}
    };
  } catch (error) {
    return emptyStore();
  }
}

/** Write through a temp file so a crash cannot truncate the list. */
function writeStore(path, store) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(temp, path);
}

function markWrite(store, deletedIds) {
  store.updatedAt = Date.now();
  for (const id of Array.isArray(deletedIds) ? deletedIds : []) store.tombstones[String(id)] = store.updatedAt;
  // Tombs only matter while something could still resurrect the id.
  const keep = Object.entries(store.tombstones).filter(([, at]) => store.updatedAt - at < 1000 * 60 * 60 * 24 * 90);
  store.tombstones = Object.fromEntries(keep);
}

function publicRecord(store) {
  return { version: 1, updatedAt: store.updatedAt, tasks: store.tasks, waiting: store.waiting };
}

function sortRows(rows) {
  return rows.slice().sort((left, right) => Number(left.done) - Number(right.done) || left.createdAt - right.createdAt);
}

function normalizeTitle(value) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, 300);
}

function normalizeDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** One operation; returns the id it touched (or undefined) so routes can report it. */
function applyOp(store, op) {
  const kind = String(op.op === undefined ? '' : op.op);
  const findTask = (id) => store.tasks.find((row) => row.id === id);
  const findWaiting = (id) => store.waiting.find((row) => row.id === id);
  const now = Date.now();

  switch (kind) {
    case 'add': {
      const title = normalizeTitle(op.title);
      if (title === '') return { changed: false };
      const id = randomUUID();
      store.tasks.push({ id, title, date: normalizeDate(op.date), done: false, createdAt: now, completedAt: 0 });
      markWrite(store);
      return { changed: true, id };
    }
    case 'addWaiting': {
      const title = normalizeTitle(op.title);
      if (title === '') return { changed: false };
      const id = randomUUID();
      store.waiting.push({ id, title, done: false, createdAt: now, completedAt: 0 });
      markWrite(store);
      return { changed: true, id };
    }
    case 'toggle': {
      const id = String(op.id);
      const task = findTask(id);
      const item = task === undefined ? findWaiting(id) : task;
      if (item === undefined) return { changed: false };
      item.done = !item.done;
      item.completedAt = item.done ? now : 0;
      markWrite(store);
      return { changed: true, id };
    }
    case 'remove': {
      const id = String(op.id);
      const before = store.tasks.length + store.waiting.length;
      store.tasks = store.tasks.filter((row) => row.id !== id);
      store.waiting = store.waiting.filter((row) => row.id !== id);
      if (store.tasks.length + store.waiting.length === before) return { changed: false };
      markWrite(store, [id]);
      return { changed: true, id };
    }
    case 'setDate': {
      const id = String(op.id);
      const task = findTask(id);
      if (task === undefined) return { changed: false };
      task.date = normalizeDate(op.date);
      markWrite(store);
      return { changed: true, id };
    }
    case 'setTitle': {
      const id = String(op.id);
      const title = normalizeTitle(op.title);
      if (title === '') return { changed: false };
      const item = findTask(id) || findWaiting(id);
      if (item === undefined) return { changed: false };
      item.title = title;
      markWrite(store);
      return { changed: true, id };
    }
    case 'move': {
      const id = String(op.id);
      const task = findTask(id);
      const waiting = findWaiting(id);
      const source = task === undefined ? waiting : task;
      if (source === undefined) return { changed: false };
      const toWaiting = op.waiting === true;
      if (toWaiting) {
        store.tasks = store.tasks.filter((row) => row.id !== id);
        store.waiting = store.waiting.filter((row) => row.id !== id);
        store.waiting.push({ id, title: source.title, done: source.done === true, createdAt: source.createdAt, completedAt: source.completedAt || 0 });
      } else {
        const date = normalizeDate(op.date);
        store.waiting = store.waiting.filter((row) => row.id !== id);
        store.tasks = store.tasks.filter((row) => row.id !== id);
        store.tasks.push({ id, title: source.title, date, done: source.done === true, createdAt: source.createdAt, completedAt: source.completedAt || 0 });
      }
      markWrite(store);
      return { changed: true, id };
    }
    default:
      return { changed: false };
  }
}

// ----------------------------------------------------------------- routes ----

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

/** The agent-facing tool, so the model can read and change the same list. */
function todoTool(conf) {
  const actions = ['today', 'inbox', 'waiting', 'summary', 'add', 'add_waiting', 'toggle', 'remove', 'set_date', 'move'];
  const todayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const render = (rows) => (rows.length === 0 ? '（空）' : rows.map((row) => `${row.done ? '☑' : '☐'} ${row.title}${row.date ? `  （${row.date}）` : ''}`).join('\n'));
  const load = () => readStore(conf.storePath);

  return {
    name: 'todo',
    description:
      '读取或修改用户的 XF 待办日历（与 DSH 右侧栏「待办日历」同一份本地数据：收集箱=无日期、当天=有日期、等待=等他人回复）。' +
      `action: ${actions.join(' | ')}。add 用 title（可写 #标签），可选 date；set_date 用 id + date（空字符串表示回收件箱）；toggle/remove 用 id；move 用 id + target（inbox | today | waiting | date）。`,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: actions, description: '要执行的动作' },
        title: { type: 'string', description: 'add / add_waiting 的文本，可含 #标签' },
        id: { type: 'string', description: '条目的 id（先用读取动作拿到）' },
        date: { type: 'string', description: 'add 的可选日期 YYYY-MM-DD；set_date 的新日期' },
        target: { type: 'string', enum: ['inbox', 'today', 'waiting', 'date'], description: 'move 的目标清单' }
      }
    },
    timeoutMs: 15000,
    isConcurrencySafe: true,
    execute: async (args) => {
      const store = load();
      const action = String(args.action === undefined ? '' : args.action).trim();
      const stamp = todayKey();
      const after = () => {
        const next = load();
        return `收集箱：\n${render(next.tasks.filter((row) => row.date === null || row.date === undefined))}\n今天（${stamp}）：\n${render(next.tasks.filter((row) => row.date === stamp))}\n等待：\n${render(next.waiting)}`;
      };
      if (action === 'today') return { text: `${stamp} 的待办：\n${render(store.tasks.filter((row) => row.date === stamp))}` };
      if (action === 'inbox' || action === 'plan') return { text: `收集箱：\n${render(store.tasks.filter((row) => row.date === null || row.date === undefined))}` };
      if (action === 'waiting') return { text: `等待他人：\n${render(store.waiting)}` };
      if (action === 'summary') {
        const open = store.tasks.filter((row) => !row.done).length;
        const waiting = store.waiting.filter((row) => !row.done).length;
        return { text: `未完成待办 ${open} 项，等待中 ${waiting} 项（今天 ${stamp}）。` };
      }
      if (action === 'add' || action === 'add_waiting') {
        const title = normalizeTitle(args.title);
        if (title === '') return { text: '缺少 title。' };
        const result = applyOp(store, action === 'add' ? { op: 'add', title, date: args.date } : { op: 'addWaiting', title });
        if (result.changed) writeStore(conf.storePath, store);
        return { text: `已添加：${title}\n${after()}` };
      }
      if (action === 'move') {
        const id = String(args.id === undefined ? '' : args.id).trim();
        const target = String(args.target === undefined ? '' : args.target).trim();
        if (id === '' || target === '') return { text: 'move 需要 id 与 target。' };
        const payload = target === 'waiting' ? { op: 'move', id, waiting: true } : { op: 'move', id, date: target === 'today' ? stamp : target === 'date' ? args.date : null };
        const result = applyOp(store, payload);
        if (result.changed) writeStore(conf.storePath, store);
        return { text: `已移动。\n${after()}` };
      }
      const id = String(args.id === undefined ? '' : args.id).trim();
      if (id === '') return { text: '缺少 id。' };
      let payload = null;
      if (action === 'toggle') payload = { op: 'toggle', id };
      else if (action === 'remove') payload = { op: 'remove', id };
      else if (action === 'set_date') payload = { op: 'setDate', id, date: typeof args.date === 'string' ? args.date.trim() : '' };
      if (payload === null) return { text: `未知 action：${action}。可用：${actions.join(', ')}` };
      const result = applyOp(store, payload);
      if (result.changed) writeStore(conf.storePath, store);
      return { text: `已更新。\n${after()}` };
    }
  };
}

// ------------------------------------------------------------------- plugin ----

export function apply(ctx, config) {
  const conf = settings(config);
  if (!existsSync(dirname(conf.storePath))) {
    try {
      mkdirSync(dirname(conf.storePath), { recursive: true });
    } catch (error) {
      console.error('[xf-todo] 无法创建数据目录:', error);
    }
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: conf.route,
        handler: async (req, res) => {
          const url = new URL(req.url === undefined ? '/' : req.url, 'http://localhost');
          const action = url.pathname.slice(conf.route.length).replace(/\/$/, '') || '/';
          try {
            if (action === '/state') {
              if (req.method === 'GET') return sendJson(res, 200, publicRecord(readStore(conf.storePath)));
              if (req.method === 'PUT') {
                const body = await readJson(req);
                const store = readStore(conf.storePath);
                const incoming = Array.isArray(body.tasks) ? body.tasks : [];
                const incomingWaiting = Array.isArray(body.waiting) ? body.waiting : [];
                let touched = false;
                for (const row of incoming) {
                  if (row === null || typeof row.id !== 'string' || typeof row.title !== 'string') continue;
                  if (store.tombstones[row.id] !== undefined) continue;
                  const title = normalizeTitle(row.title);
                  if (title === '') continue;
                  const existing = store.tasks.find((item) => item.id === row.id);
                  if (existing === undefined) {
                    store.tasks.push({ id: row.id, title, date: normalizeDate(row.date), done: row.done === true, createdAt: Number.isFinite(row.createdAt) ? row.createdAt : Date.now(), completedAt: 0 });
                    touched = true;
                  } else if (existing.title !== title || (existing.date || null) !== normalizeDate(row.date) || existing.done !== (row.done === true)) {
                    existing.title = title;
                    existing.date = normalizeDate(row.date);
                    existing.done = row.done === true;
                    touched = true;
                  }
                }
                for (const row of incomingWaiting) {
                  if (row === null || typeof row.id !== 'string' || typeof row.title !== 'string') continue;
                  if (store.tombstones[row.id] !== undefined) continue;
                  const title = normalizeTitle(row.title);
                  if (title === '') continue;
                  const existing = store.waiting.find((item) => item.id === row.id);
                  if (existing === undefined) {
                    store.waiting.push({ id: row.id, title, done: row.done === true, createdAt: Number.isFinite(row.createdAt) ? row.createdAt : Date.now(), completedAt: 0 });
                    touched = true;
                  } else if (existing.title !== title || existing.done !== (row.done === true)) {
                    existing.title = title;
                    existing.done = row.done === true;
                    touched = true;
                  }
                }
                if (touched) {
                  markWrite(store);
                  writeStore(conf.storePath, store);
                }
                return sendJson(res, 200, publicRecord(readStore(conf.storePath)));
              }
              return sendJson(res, 405, { ok: false, error: 'method not allowed' });
            }
            if (action === '/op') {
              if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' });
              const store = readStore(conf.storePath);
              const result = applyOp(store, await readJson(req));
              if (result.changed) writeStore(conf.storePath, store);
              return sendJson(res, 200, publicRecord(readStore(conf.storePath)));
            }
            return sendJson(res, 404, { ok: false, error: 'not found' });
          } catch (error) {
            console.error('[xf-todo] 请求失败:', (error && error.message) || error);
            return sendJson(res, 400, { ok: false, error: String((error && error.message) || error) });
          }
        }
      }),
    'xf-todo-calendar: local record routes'
  );

  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.effect(() => toolCtx.tools.register(todoTool(conf)), 'xf-todo-calendar: todo tool');
  });
}
