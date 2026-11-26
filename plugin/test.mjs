/**
 * Small harness for the offline Host half: it drives the registered routes with fake
 * request/response objects, so the store and the operation semantics can be checked
 * without starting DSH. Run with `node test.mjs`.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from './index.js';

const dir = mkdtempSync(join(tmpdir(), 'xf-todo-test-'));
const storePath = join(dir, 'store.json');

const routes = [];
const registered = {};
const ctx = {
  effect: (fn) => fn(),
  webServer: {
    register: (route) => {
      routes.push(route);
      return () => {};
    }
  },
  inject: (_names, callback) => {
    callback({
      effect: (fn) => fn(),
      tools: {
        register: (definition) => {
          registered.tool = definition;
          return () => {};
        }
      }
    });
  }
};

apply(ctx, { storePath });
assert.equal(routes.length, 1, 'one route table registered');
assert.ok(registered.tool !== undefined, 'todo tool registered');

const handler = routes[0].handler;

function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = path;
    const res = {
      status: 0,
      payload: null,
      writeHead(status) {
        this.status = status;
      },
      end(text) {
        this.payload = JSON.parse(text);
        resolve({ status: this.status, body: this.payload });
      }
    };
    handler(req, res).catch(reject);
    if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body), 'utf8'));
    req.emit('end');
  });
}

const state0 = await call('GET', '/.dsh-todo/state');
assert.deepEqual(state0.body.tasks, []);
assert.deepEqual(state0.body.waiting, []);

const added = await call('POST', '/.dsh-todo/op', { op: 'add', title: '写 README #文档', date: '2026-01-02' });
assert.equal(added.body.tasks.length, 1);
const taskId = added.body.tasks[0].id;
assert.equal(added.body.tasks[0].date, '2026-01-02');

const waiting = await call('POST', '/.dsh-todo/op', { op: 'addWaiting', title: '等同事回复 #文档' });
assert.equal(waiting.body.waiting.length, 1);

const moved = await call('POST', '/.dsh-todo/op', { op: 'move', id: taskId, waiting: true });
assert.equal(moved.body.tasks.length, 0);
assert.equal(moved.body.waiting.length, 2);

const back = await call('POST', '/.dsh-todo/op', { op: 'move', id: taskId, date: null });
assert.equal(back.body.tasks.length, 1);
assert.equal(back.body.tasks[0].date, null);

const toggled = await call('POST', '/.dsh-todo/op', { op: 'toggle', id: taskId });
assert.equal(toggled.body.tasks[0].done, true);

const renamed = await call('POST', '/.dsh-todo/op', { op: 'setTitle', id: taskId, title: '写开源说明 #文档' });
assert.equal(renamed.body.tasks[0].title, '写开源说明 #文档');

const removed = await call('POST', '/.dsh-todo/op', { op: 'remove', id: taskId });
assert.equal(removed.body.tasks.length, 0);
const stampAfterDelete = removed.body.updatedAt;

// A stale whole-record push must not resurrect the deleted row.
const stale = {
  version: 1,
  updatedAt: Date.now(),
  tasks: [{ id: taskId, title: '写开源说明 #文档', date: null, done: false, createdAt: Date.now() }],
  waiting: []
};
const pushed = await call('PUT', '/.dsh-todo/state', stale);
assert.equal(pushed.body.tasks.length, 0, 'tombstone blocks the stale push');
assert.ok(pushed.body.updatedAt >= stampAfterDelete);

// The tool talks to the same file.
const toolText = await registered.tool.execute({ action: 'add', title: '工具新增的条目' });
assert.ok(toolText.text.includes('已添加'));
const afterTool = await call('GET', '/.dsh-todo/state');
assert.ok(afterTool.body.tasks.some((row) => row.title === '工具新增的条目'));

rmSync(dir, { recursive: true, force: true });
console.log('offline plugin: all checks passed');
