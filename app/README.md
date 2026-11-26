# XF 待办日历 · 桌面端

Windows 桌面程序（Electron），离线运行：数据只在本机 `%APPDATA%\xf-todo-calendar\store.json`。

## 功能

- **三栏清单**：收集箱 / 当天 / 等待，各带自己的 `#标签` 筛选条。
- **日历**：月历，点日期切换「当天」，把条目拖到某天即安排。
- **拖拽**：三栏互相拖，等待可拖回收件箱或某一天。
- **托盘**：关闭窗口收进托盘；托盘左键打开，右键菜单「退出」才真正结束。
- **Shift+Space 浮窗**：命令与微信通道一致 —— 直接输入或 `/add 文本` 加入收集箱、`/box` 收集箱、
  `/td` 当天、`/wt` 等待；提交后内容保留，可再按 Enter 重提；空输入按 Enter 显示/隐藏主窗口。
- **窗口**：置顶按钮、记住大小与位置、快捷键切换浮窗。
- 点击即生效（本地乐观更新），没有网络等待。

## 构建与运行

```bash
npm install
npm start          # 开发运行
npm run selftest   # 打印一次本地数据后退出
npm run dist       # 打包到 app/dist（需要能访问 Electron 镜像）
```

> 在无 GPU / 受限沙箱的机器上，用 `XFTodoCalendar.exe --no-sandbox --disable-gpu` 启动；
> 打包脚本生成的快捷方式可以用这两个参数。

## 结构

```
main.js        主进程：窗口、托盘、全局快捷键、快速输入、启动日志
store.mjs      本地 JSON 存储（原子写入 + 删除墓碑）
preload.cjs    contextBridge 暴露的 IPC 面
renderer/      主窗口与快速输入窗口（原生 HTML/CSS/JS）
make-icon.mjs  零依赖生成 tray.png / icon.png / icon.ico
assets/        生成好的图标
```

启动日志：`%APPDATA%\xf-todo-calendar\startup.log`；配置：同目录 `config.json`。
