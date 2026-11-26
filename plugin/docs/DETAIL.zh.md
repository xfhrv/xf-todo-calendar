# XF 待办日历 · 插件细节

## 数据

本机一个 JSON 文件（默认 `~/.dsh/xf-todo-calendar/store.json`）：

```json
{
  "version": 1,
  "updatedAt": 1795599999999,
  "tasks": [
    { "id": "uuid", "title": "买牛奶 #生活", "date": "2026-11-26", "done": false, "createdAt": 1795599999999 }
  ],
  "waiting": [
    { "id": "uuid", "title": "等同事回复 #项目", "done": false, "createdAt": 1795599999999 }
  ],
  "tombstones": { "uuid": 1795599999999 }
}
```

- `date` 为 `null` 表示收集箱条目，有日期表示当天条目；`waiting` 数组是「等待」。
- 写入走临时文件 + 改名，断电不会留下半截文件。
- `tombstones` 记录删除过的 id：整表推送（其它浏览器标签页缓存）只能新增/更新，
  **不能**删除，也不能把删掉的条目复活。

## 路由

挂在 DSH 回环 Web 服务上（默认前缀 `/.dsh-todo`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/state` | 返回 `{ version, updatedAt, tasks, waiting }` |
| PUT | `/state` | 整表写入，只新增/更新，返回新记录 |
| POST | `/op` | 单条操作，返回新记录 |

操作：`add`（title, date?）、`addWaiting`（title）、`toggle`（id）、`remove`（id）、
`setDate`（id, date|null）、`setTitle`（id, title）、`move`（id, waiting?, date?）。

## 浏览器侧

`client.js` 注册三样东西：

1. **左侧栏底部**：本月小日历 + 今天清单（可勾选、可输入新增），日历与 Remote/Cordis 按钮分行显示。
2. **右侧栏标签页**：日历 + 收集箱 / 当天 / 等待三栏（拖拽、`#标签` 分组、每栏独立标签筛选）。
3. **标题 chip**：标签页标题。

浏览器侧把数据缓存在 `localStorage`（键 `dsh.todo-calendar.v1`），并与本地路由对账：
本地新就推、服务端新就采用。整表推送不会删除任何条目。

## agent 工具

`todo` 工具（随插件注册）支持 `today / inbox / waiting / summary / add / add_waiting /
toggle / remove / set_date / move`，读写同一个 JSON 文件。

## 自检

```bash
node test.mjs
```

用假的 `ctx` 驱动注册的路由，覆盖增删改、跨清单移动、墓碑与整表推送，不依赖 DSH 或浏览器。
