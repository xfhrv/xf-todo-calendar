/**
 * Local storage for XF 待办日历 (offline build).
 *
 * The desktop app keeps its list in one JSON file under the user profile:
 * `%APPDATA%\xf-todo-calendar\store.json` on Windows, `~/.config/xf-todo-calendar/store.json`
 * elsewhere. No account, no network.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const EMPTY = () => ({ version: 1, updatedAt: 0, tasks: [], waiting: [], tombstones: {} });

function read(storePath) {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'));
    return {
      version: 1,
      updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      waiting: Array.isArray(parsed.waiting) ? parsed.waiting : [],
      tombstones: parsed.tombstones !== null && typeof parsed.tombstones === 'object' ? parsed.tombstones : {}
    };
  } catch (error) {
    return EMPTY();
  }
}

function write(storePath, store) {
  mkdirSync(dirname(storePath), { recursive: true });
  const temp = `${storePath}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(temp, storePath);
}

function title(value) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, 300);
}

function date(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function touch(store, deletedIds) {
  store.updatedAt = Date.now();
  for (const id of Array.isArray(deletedIds) ? deletedIds : []) store.tombstones[String(id)] = store.updatedAt;
  const keep = Object.entries(store.tombstones).filter(([, at]) => store.updatedAt - at < 1000 * 60 * 60 * 24 * 90);
  store.tombstones = Object.fromEntries(keep);
}

function publicState(store) {
  return { tasks: store.tasks, waiting: store.waiting, updatedAt: store.updatedAt };
}

export function createStore(storePath) {
  async function loadState() {
    return publicState(read(storePath));
  }

  async function applyOp(op) {
    const store = read(storePath);
    const kind = String(op.op === undefined ? '' : op.op);
    const find = (id) => store.tasks.find((row) => row.id === id) || store.waiting.find((row) => row.id === id);
    const now = Date.now();
    let changed = false;

    switch (kind) {
      case 'add': {
        const text = title(op.title);
        if (text !== '') {
          store.tasks.push({ id: randomUUID(), title: text, date: date(op.date), done: false, createdAt: now });
          changed = true;
        }
        break;
      }
      case 'addWaiting': {
        const text = title(op.title);
        if (text !== '') {
          store.waiting.push({ id: randomUUID(), title: text, done: false, createdAt: now });
          changed = true;
        }
        break;
      }
      case 'toggle': {
        const item = find(String(op.id));
        if (item !== undefined) {
          item.done = !item.done;
          changed = true;
        }
        break;
      }
      case 'remove': {
        const id = String(op.id);
        const before = store.tasks.length + store.waiting.length;
        store.tasks = store.tasks.filter((row) => row.id !== id);
        store.waiting = store.waiting.filter((row) => row.id !== id);
        if (store.tasks.length + store.waiting.length !== before) {
          touch(store, [id]);
          changed = true;
        }
        break;
      }
      case 'setDate': {
        const task = store.tasks.find((row) => row.id === String(op.id));
        if (task !== undefined) {
          task.date = date(op.date);
          changed = true;
        }
        break;
      }
      case 'setTitle': {
        const text = title(op.title);
        const item = find(String(op.id));
        if (item !== undefined && text !== '') {
          item.title = text;
          changed = true;
        }
        break;
      }
      case 'move': {
        const id = String(op.id);
        const source = find(id);
        if (source !== undefined) {
          store.tasks = store.tasks.filter((row) => row.id !== id);
          store.waiting = store.waiting.filter((row) => row.id !== id);
          if (op.waiting === true) {
            store.waiting.push({ id, title: source.title, done: source.done === true, createdAt: source.createdAt });
          } else {
            store.tasks.push({ id, title: source.title, date: date(op.date), done: source.done === true, createdAt: source.createdAt });
          }
          changed = true;
        }
        break;
      }
      default:
        break;
    }

    if (changed) {
      touch(store);
      write(storePath, store);
    }
    return publicState(read(storePath));
  }

  return { storePath, loadState, applyOp };
}
