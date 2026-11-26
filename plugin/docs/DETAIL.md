# XF Todo Calendar · plugin details

## Storage

One JSON file on this machine (default `~/.dsh/xf-todo-calendar/store.json`):

```json
{
  "version": 1,
  "updatedAt": 1795599999999,
  "tasks": [
    { "id": "uuid", "title": "buy milk #life", "date": "2026-11-26", "done": false, "createdAt": 1795599999999 }
  ],
  "waiting": [
    { "id": "uuid", "title": "waiting for review #work", "done": false, "createdAt": 1795599999999 }
  ],
  "tombstones": { "uuid": 1795599999999 }
}
```

- `date: null` is an inbox item; a date files it under that day. `waiting` holds the waiting list.
- Writes go through a temp file and a rename, so a crash cannot truncate the list.
- `tombstones` remembers deleted ids: a whole-record push from a stale browser tab may create and
  update, but never delete — and cannot bring a deleted to-do back.

## Routes

Served on the DSH loopback Web server (default prefix `/.dsh-todo`):

| Method | Path | Meaning |
|---|---|---|
| GET | `/state` | `{ version, updatedAt, tasks, waiting }` |
| PUT | `/state` | whole record; create/update only, returns the new record |
| POST | `/op` | one operation, returns the new record |

Operations: `add` (title, date?), `addWaiting` (title), `toggle` (id), `remove` (id),
`setDate` (id, date|null), `setTitle` (id, title), `move` (id, waiting?, date?).

## Browser half

`client.js` registers three things:

1. **Sidebar foot**: this month's mini calendar plus today's list (tick items off, add a new one
   inline); the calendar takes its own line above the other footer buttons.
2. **Right-sidebar tab**: calendar plus the Inbox / This day / Waiting lists (drag between them,
   `#tag` grouping, one tag filter per list).
3. **Tab title chip**.

The browser caches the record in `localStorage` (key `dsh.todo-calendar.v1`) and reconciles with the
local routes: a newer local stamp pushes, a newer server stamp is adopted. A whole-record push never
deletes anything.

## Agent tool

The `todo` tool (registered with the plugin) supports `today / inbox / waiting / summary / add /
add_waiting / toggle / remove / set_date / move` against the same JSON file.

## Self check

```bash
node test.mjs
```

Drives the registered routes with a fake `ctx`, covering add/update/move, tombstones and a stale
whole-record push — no DSH and no browser needed.
