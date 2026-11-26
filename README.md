# XF 待办日历（支持 DSH 插件）

一个**完全离线**的待办日历：左边一个小日历，右边三栏清单（收集箱 / 当天 / 等待），
用 `#标签` 分组和筛选，把条目拖到日期上就安排好。

两种形态，同一套数据模型：

| 形态 | 位置 | 说明 |
|---|---|---|
| **DSH 插件** | `plugin/` | 装进 DeepSeek Harness：左侧栏底部日历 + 当天清单 + 快速输入，右侧栏「XF 待办日历」标签页 |
| **Windows 桌面端** | `app/` | 独立程序：托盘常驻、`Shift+Space` 浮窗快记、三栏拖拽、标签筛选 |

> 离线版：不连接任何服务器、不需要账号，数据保存在本机一个 JSON 文件里。
> 本仓库是从作者自用的 CalDAV 版本裁剪出来的干净离线版本。

## 功能

- **日历**：周一起始的月历，今天高亮，有事项的日子带圆点；点日期切换「当天」。
- **三栏清单**：收集箱（无日期）/ 当天（选中日期）/ 等待（等他人回复），每栏都能直接添加。
- **拖拽**：收集箱 ↔ 当天 ↔ 等待 三栏互相拖；拖到日历某天 = 安排到那天。
- **`#标签`**：标题里写 `#理文`、`#二叔` 之类的标签，清单按标签分组排序，一条多标签会出现在多组；
  每栏还有自己的 **标签筛选器**（「全部」+ 该栏出现过的标签）。
- **完成 / 删除 / 改名**：点方框打勾，✕ 删除，点文字原地改名。
- **DSH 侧边栏**：左栏底部日历下方直接列出今天的待办，可勾选、可在输入框里直接添加。
- **Windows 桌面端**：系统托盘（关闭即收进托盘，右键退出）、`Shift+Space` 浮窗（命令与微信通道一致：
  纯文本或 `/add` 加入收集箱、`/box` 收集箱、`/td` 当天、`/wt` 等待）、窗口置顶、记住窗口大小位置、右键复制条目。

## 数据保存在哪里

| 形态 | 路径 |
|---|---|
| DSH 插件 | `~/.dsh/xf-todo-calendar/store.json`（Windows：`C:\Users\<你>\.dsh\xf-todo-calendar\store.json`） |
| 桌面端 | `%APPDATA%\xf-todo-calendar\store.json` |

都是一个普通 JSON 文件，可以直接备份、复制、进 Git。删除条目会记「墓碑」，避免旧缓存把它复活。

## 安装：DSH 插件

1. 把仓库的 `plugin/` 目录放到一个稳定路径（例如 `~/xf-todo-calendar/plugin`）。
2. 在 DSH profile 的 `package.json` 里加一条本地依赖和一项 bundle：

```jsonc
{
  "dependencies": {
    "@local/xf-todo-calendar": "link:/绝对路径/xf-todo-calendar/plugin"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // …原有项…
        "@local/xf-todo-calendar"
      ]
    }
  }
}
```

3. 重启 DSH（或重新加载 profile）。左侧栏底部出现日历，右侧出现「XF 待办日历」标签页。

可选的插件配置写在 bundle 的 `cordis.patch.yml` 里：

```yaml
- insert:
    - id: xf-todo-calendar
      name: '@local/xf-todo-calendar'
      config:
        storePath: ''                 # 留空 = ~/.dsh/xf-todo-calendar/store.json
        route: '/.dsh-todo'           # 本地路由前缀
```

自检（不需要启动 DSH，也不需要 React）：

```bash
cd plugin && node test.mjs
```

## 安装：Windows 桌面端

发行版：从 [Releases](https://github.com/xfhrv/xf-todo-calendar/releases/tag/v1.1.0) 下载 `XFTodoCalendar-v1.1.0-windows.zip`（或从 [xfhr.work/xf-todo-calendar](https://xfhr.work/xf-todo-calendar/) 下载），解压后双击 `XFTodoCalendar.exe`。

自己从源码构建：

```bash
cd app
npm install
npm start            # 直接运行
npm run selftest     # 只读一次本地数据并打印条目，然后退出
npm run dist         # 用 electron-packager 打包到 app/dist
```

细节见 [app/README.md](app/README.md)。

## 仓库结构

```
plugin/          DSH 插件（Host 半 + 浏览器半 + 本地存储 + 自检）
  index.js         本地 JSON 存储、/.dsh-todo 路由、agent 的 todo 工具
  client.js        左侧栏日历/今日清单、右侧栏标签页、标签分组与筛选
  test.mjs         不依赖 DSH 的路由自检
  cordis.patch.yml 插件默认配置
app/             Windows 桌面端（Electron，离线）
  main.js          窗口 / 托盘 / 全局快捷键 / 浮窗 / 启动日志
  store.mjs        本地 JSON 存储
  renderer/        主窗口与快速输入窗口
docs/            说明与截图
```

## 已知限制

- 桌面端**只有 Windows 构建脚本**（Electron 本身跨平台，但这里没提供 macOS/Linux 的打包配置）。
- 数据是单机文件：多设备之间不会自动同步；想同步可以把这个 JSON 放到自己的同步盘，或参考作者的
  CalDAV 分支（本仓库未包含）。
- 桌面端在这台机器上需要 `--no-sandbox --disable-gpu`（快捷方式里已经带好）。

## 许可

MIT，见 [LICENSE](LICENSE)。作者：徐费皓苒（[xfhr.work](https://xfhr.work)）。
