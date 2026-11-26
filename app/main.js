/**
 * XF 待办日历 —— 独立 Windows 桌面端主进程（离线版）。
 *
 * 数据只存在本机一个 JSON 文件里（不需要账号和服务器），主进程负责：
 * 主窗口、托盘（关闭=收进托盘，右键退出）、Shift+Space 快速添加浮窗、定时对账，
 * 以及把有日期的待办镜像成 VEVENT 供手机日历显示。
 */
import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG = {
  pollSeconds: 5,
  hotkey: 'Shift+Space',
  alwaysOnTop: false,
  windowBounds: null,
  maximized: false
};

const configPath = path.join(app.getPath('userData'), 'config.json');
const logPath = path.join(app.getPath('userData'), 'startup.log');

/** Append one line to the startup log, so a failed launch can be explained later. */
function log(message) {
  try {
    mkdirSync(path.dirname(logPath), { recursive: true });
    appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch (error) {
    console.error('[todo] log failed', error);
  }
}

process.on('uncaughtException', (error) => log(`uncaughtException: ${(error && error.stack) || error}`));
process.on('unhandledRejection', (error) => log(`unhandledRejection: ${(error && error.stack) || error}`));

function saveConfig(patch) {
  Object.assign(config, patch);
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.warn('[todo] 保存配置失败:', (error && error.message) || error);
  }
}

function loadConfig() {
  try {
    if (existsSync(configPath)) {
      const parsed = JSON.parse(readFileSync(configPath, 'utf8'));
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (error) {
    console.error('[todo] 读取配置失败，使用默认值:', error);
  }
  try {
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
  } catch (error) {
    console.error('[todo] 写入默然配置失败:', error);
  }
  return { ...DEFAULT_CONFIG };
}

const config = loadConfig();
const store = createStore(path.join(app.getPath('userData'), 'store.json'));
const isSelftest = process.argv.includes('--selftest');
const isSmoke = process.argv.includes('--smoke');

// A tray app draws one light window; software rendering avoids GPU-process failures on
// machines and remote sessions where the GPU process cannot start.
// GPU/sandbox left at Electron defaults: the desktop session here is fine with them,
// and forcing them made launches fail on machines where the GPU path works.

let mainWindow = null;
let quickWindow = null;
let tray = null;
let pollTimer = null;
let quitting = false;
// The window manager does not always report the flag back, so the app keeps its own
// record of the choice and applies it on every window creation.
let pinned = config.alwaysOnTop === true;

function publicRecord(state) {
  return { tasks: state.tasks, waiting: state.waiting, updatedAt: state.updatedAt };
}

async function readState() {
  return publicRecord(await store.loadState());
}


async function broadcast() {
  try {
    const state = await readState();
    for (const target of [mainWindow, quickWindow]) {
      if (target !== null && !target.isDestroyed()) target.webContents.send('todo:state', state);
    }
  } catch (error) {
    console.warn('[todo] 同步失败:', (error && error.message) || error);
    for (const target of [mainWindow, quickWindow]) {
      if (target !== null && !target.isDestroyed()) target.webContents.send('todo:offline', String((error && error.message) || error));
    }
  }
}

function createMainWindow() {
  const icon = nativeImage.createFromPath(path.join(here, 'assets', 'icon.png'));
  const restored = restoreBounds();
  mainWindow = new BrowserWindow({
    width: restored === null ? 940 : restored.width,
    height: restored === null ? 700 : restored.height,
    ...(restored === null ? {} : { x: restored.x, y: restored.y }),
    minWidth: 380,
    minHeight: 460,
    title: 'XF 待办日历',
    backgroundColor: '#151517',
    alwaysOnTop: config.alwaysOnTop === true,
    icon: icon.isEmpty() ? undefined : icon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(here, 'renderer', 'index.html'));
  log('main window loadFile dispatched');
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    log(`main window did-fail-load ${code} ${description}`);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`render-process-gone ${JSON.stringify(details)}`);
  });
  mainWindow.on('show', () => log('event: main window show'));
  mainWindow.on('hide', () => log('event: main window hide'));
  mainWindow.on('minimize', () => log('event: main window minimize'));
  mainWindow.on('blur', () => log('event: main window blur'));
  mainWindow.on('resize', scheduleSaveBounds);
  mainWindow.on('move', scheduleSaveBounds);
  mainWindow.on('maximize', scheduleSaveBounds);
  mainWindow.on('unmaximize', scheduleSaveBounds);
  mainWindow.on('close', (event) => {
    flushSaveBounds();
    if (quitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.once('ready-to-show', () => {
    log('main window ready-to-show');
    if (config.maximized === true) mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
    broadcast();
  });
}

/** The saved rect, but only when it still lands on a connected display. */
function restoreBounds() {
  const saved = config.windowBounds;
  if (saved === null || typeof saved !== 'object') return null;
  const width = Math.round(Number(saved.width));
  const height = Math.round(Number(saved.height));
  const x = Math.round(Number(saved.x));
  const y = Math.round(Number(saved.y));
  if (![width, height, x, y].every((value) => Number.isFinite(value))) return null;
  if (width < 380 || height < 460) return null;
  const visible = screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      x + width > area.x + 48 &&
      x < area.x + area.width - 48 &&
      y + height > area.y + 48 &&
      y < area.y + area.height - 48
    );
  });
  return visible ? { x, y, width, height } : null;
}

let saveBoundsTimer = null;

function scheduleSaveBounds() {
  if (mainWindow === null || mainWindow.isDestroyed()) return;
  if (saveBoundsTimer !== null) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(flushSaveBounds, 400);
}

function flushSaveBounds() {
  if (saveBoundsTimer !== null) {
    clearTimeout(saveBoundsTimer);
    saveBoundsTimer = null;
  }
  if (mainWindow === null || mainWindow.isDestroyed()) return;
  saveConfig({ windowBounds: mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() });
}

function createQuickWindow() {
  quickWindow = new BrowserWindow({
    width: 620,
    height: 172,
    frame: false,
    transparent: true,
    resizable: true,
    maximizable: false,
    minimizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  quickWindow.setAlwaysOnTop(true, 'screen-saver');
  quickWindow.setMinimumSize(420, 120);
  quickWindow.loadFile(path.join(here, 'renderer', 'quick.html'));
  quickWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    quickWindow.hide();
  });
}

/** The quick panel grows with its content, at most down to the taskbar. */
function resizeQuickWindow(height) {
  if (quickWindow === null || quickWindow.isDestroyed()) return;
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const [width, currentHeight] = quickWindow.getSize();
  const [left, top] = quickWindow.getPosition();
  const maxHeight = Math.max(160, workArea.y + workArea.height - top);
  const next = Math.max(120, Math.min(Math.round(Number(height) || currentHeight), maxHeight));
  quickWindow.setSize(width, next, false);
}

function toggleQuickWindow() {
  if (quickWindow !== null && !quickWindow.isDestroyed() && quickWindow.isVisible()) {
    quickWindow.hide();
    return;
  }
  showQuickWindow();
}

function showQuickWindow() {
  if (quickWindow === null || quickWindow.isDestroyed()) createQuickWindow();
  const { workArea } = screen.getPrimaryDisplay();
  const [width, height] = quickWindow.getSize();
  quickWindow.setPosition(
    Math.round(workArea.x + (workArea.width - width) / 2),
    Math.round(workArea.y + workArea.height * 0.28),
    false
  );
  quickWindow.show();
  quickWindow.focus();
  quickWindow.webContents.send('todo:quick-focus');
}

function showMainWindow() {
  if (mainWindow === null || mainWindow.isDestroyed()) createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  broadcast();
}

function buildTray() {
  const trayIcon = nativeImage.createFromPath(path.join(here, 'assets', 'tray.png'));
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
  tray.setToolTip('XF 待办日历');
  const menu = Menu.buildFromTemplate([
    { label: '显示主界面', click: () => showMainWindow() },
    { label: '快速添加　Shift+Space', click: () => showQuickWindow() },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showMainWindow());
}

/** 快速输入的解析：与微信侧命令一致 —— 纯文本或 /add 进收集箱，/box /td /wt 查询。 */
function parseQuickCommand(text) {
  const line = String(text || '').trim();
  if (line === '') return { kind: 'empty' };
  if (!line.startsWith('/')) return { kind: 'add', title: line };
  const space = line.indexOf(' ');
  const command = (space < 0 ? line : line.slice(0, space)).toLowerCase();
  const rest = space < 0 ? '' : line.slice(space + 1).trim();
  if (command === '/add') return rest === '' ? { kind: 'empty' } : { kind: 'add', title: rest };
  if (command === '/box' || command === '/pl') return { kind: 'query', list: 'inbox' };
  if (command === '/td') return { kind: 'query', list: 'today' };
  if (command === '/wt') return { kind: 'query', list: 'waiting' };
  return { kind: 'unknown', command };
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function describeList(state, list) {
  const stamp = todayKey();
  const rows = list === 'waiting'
    ? state.waiting
    : state.tasks.filter((row) => (list === 'today' ? row.date === stamp : row.date === null));
  const heading = list === 'waiting' ? '等待他人' : list === 'today' ? `${stamp} 当天` : '收集箱';
  if (rows.length === 0) return `${heading}：空`;
  const lines = rows.slice(0, 8).map((row) => `${row.done ? '☑' : '☐'} ${row.title}`);
  return `${heading}（${rows.length} 项）：\n${lines.join('\n')}${rows.length > 8 ? '\n…' : ''}`;
}

async function runQuick(text) {
  const parsed = parseQuickCommand(text);
  if (parsed.kind === 'empty') return { ok: false, message: '先输入内容；/add 文本、/box、/td、/wt' };
  if (parsed.kind === 'unknown') return { ok: false, message: `未知命令 ${parsed.command}；可用 /add /box /td /wt` };
  try {
    if (parsed.kind === 'add') {
      const next = await store.applyOp({ op: 'add', title: parsed.title, date: null });
      broadcast();
      return { ok: true, message: `已加入收集箱：${parsed.title}`, state: publicRecord(next) };
    }
    const state = await store.loadState();
    return { ok: true, message: describeList(state, parsed.list) };
  } catch (error) {
    return { ok: false, message: `同步失败：${(error && error.message) || error}` };
  }
}

function registerIpc() {
  ipcMain.handle('todo:read', async () => readState());
  ipcMain.handle('todo:op', async (_event, op) => {
    const next = await store.applyOp(op);
    broadcast();
    return publicRecord(next);
  });
  ipcMain.handle('todo:quick', async (_event, text) => runQuick(text));
  ipcMain.handle('todo:hide-quick', () => {
    if (quickWindow !== null && !quickWindow.isDestroyed()) quickWindow.hide();
  });
  ipcMain.handle('todo:resize-quick', (_event, height) => {
    resizeQuickWindow(height);
  });
  ipcMain.handle('todo:hide-main', () => {
    if (mainWindow !== null && !mainWindow.isDestroyed()) mainWindow.hide();
  });
  ipcMain.handle('todo:quit', () => {
    quitting = true;
    app.quit();
  });
  ipcMain.handle('todo:pin-state', () => ({ pinned }));
  ipcMain.handle('todo:set-pin', (_event, value) => {
    pinned = Boolean(value);
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(pinned);
      if (pinned) mainWindow.moveTop();
    }
    saveConfig({ alwaysOnTop: pinned });
    return { pinned };
  });
  ipcMain.handle('todo:toggle-main', () => {
    if (mainWindow === null || mainWindow.isDestroyed()) {
      showMainWindow();
      return { visible: true };
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      return { visible: false };
    }
    showMainWindow();
    return { visible: true };
  });
  ipcMain.handle('todo:copy', (_event, text) => {
    clipboard.writeText(String(text === undefined || text === null ? '' : text));
    return true;
  });
  ipcMain.handle('todo:config-path', () => configPath);
}

async function selftest() {
  try {
    const state = await readState();
    console.log('selftest ok:', JSON.stringify({
      tasks: state.tasks.length,
      waiting: state.waiting.length,
      updatedAt: state.updatedAt,
      titles: [...state.tasks, ...state.waiting].map((row) => row.title)
    }));
    app.exit(0);
  } catch (error) {
    console.error('selftest failed:', (error && error.message) || error);
    app.exit(1);
  }
}

async function smoke() {
  registerIpc();
  createMainWindow();
  createQuickWindow();
  for (const window of [mainWindow, quickWindow]) {
    if (window === null) continue;
    window.webContents.on('console-message', (_event, level, message) => {
      console.log(`[renderer:${level}] ${message}`);
    });
  }
  // Wait for the first record to paint, not just for the window to open.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const painted = await mainWindow.webContents.executeJavaScript(
      `document.querySelectorAll('.cell').length === 42 && document.querySelectorAll('.row').length > 0`
    ).catch(() => false);
    if (painted) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  try {
    const info = await mainWindow.webContents.executeJavaScript(
      `({ zones: document.querySelectorAll('.zone').length, cells: document.querySelectorAll('.cell').length, rows: document.querySelectorAll('.row').length, status: document.getElementById('status').textContent })`
    );
    console.log('smoke main:', JSON.stringify(info));
    const quickInfo = await quickWindow.webContents.executeJavaScript(
      `({ input: Boolean(document.getElementById('input')), hint: document.querySelector('.hint').textContent })`
    );
    console.log('smoke quick:', JSON.stringify(quickInfo));
    const pinInfo = await mainWindow.webContents.executeJavaScript(
      `(async () => {
        const button = document.getElementById('pin');
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 200));
        const pinned = button.getAttribute('aria-pressed');
        const onTop = await window.todoApi.pinState();
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { exists: Boolean(button), pinned, onTop: onTop.pinned, after: button.getAttribute('aria-pressed') };
      })()`
    );
    console.log('smoke pin:', JSON.stringify(pinInfo));
    quickWindow.show();
    const quickKeep = await quickWindow.webContents.executeJavaScript(
      `(async () => {
        const input = document.getElementById('input');
        const result = document.getElementById('result');
        input.value = '/td';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return { inputKept: input.value, resultLen: result.textContent.length, resultHead: result.textContent.slice(0, 24) };
      })()`
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
    console.log('smoke quick-keep:', JSON.stringify(quickKeep));
    console.log('smoke sizes:', JSON.stringify({ mainMin: mainWindow.getMinimumSize(), quickSize: quickWindow.getSize() }));

    // Window geometry persistence.
    mainWindow.setBounds({ x: 120, y: 140, width: 780, height: 620 });
    await new Promise((resolve) => setTimeout(resolve, 900));
    const savedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    console.log('smoke bounds:', JSON.stringify({ saved: savedConfig.windowBounds, maximized: savedConfig.maximized, restored: restoreBounds() }));

    // Right-click copy on a row.
    const copyInfo = await mainWindow.webContents.executeJavaScript(
      `(async () => {
        const row = document.querySelector('.row[data-id]');
        if (row === null) return { skipped: true };
        row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 350));
        return { title: document.querySelector('.toast').textContent, toastShown: document.querySelector('.toast').classList.contains('show') };
      })()`
    );
    let clipRead = '(unavailable)';
    try {
      const raw = clipboard.readText();
      clipRead = typeof raw === 'string' ? raw.slice(0, 40) : `(unavailable: ${typeof raw})`;
    } catch (error) {
      clipRead = '(unavailable)';
    }
    console.log('smoke copy:', JSON.stringify({ ...copyInfo, clipboard: clipRead }));

    // "/add …" keeps the command prefix in the quick input.
    const addInfo = await quickWindow.webContents.executeJavaScript(
      `(async () => {
        const input = document.getElementById('input');
        input.value = '/add 冒烟测试-勿留';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 1600));
        return { kept: input.value, result: document.getElementById('result').textContent.slice(0, 30) };
      })()`
    );
    console.log('smoke add-prefix:', JSON.stringify(addInfo));
    const afterSmoke = await store.loadState();
    for (const row of afterSmoke.tasks) {
      if (row.title === '冒烟测试-勿留') await store.applyOp({ op: 'remove', id: row.id });
    }

    quickWindow.show();
    const toggleInfo = await quickWindow.webContents.executeJavaScript(
      `(async () => {
        const input = document.getElementById('input');
        input.value = '';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 600));
        return { quickVisible: document.visibilityState };
      })()`
    );
    console.log('smoke toggle-main:', JSON.stringify({ mainVisible: mainWindow.isVisible(), quickVisible: quickWindow.isVisible(), ...toggleInfo }));
    mainWindow.show();
    await new Promise((resolve) => setTimeout(resolve, 300));

    let trayOk = false;
    try {
      buildTray();
      trayOk = tray !== null;
    } catch (error) {
      console.warn('smoke tray failed:', (error && error.message) || error);
    }
    const hotkeyOk = globalShortcut.register(config.hotkey || 'Shift+Space', () => {});
    console.log('smoke env:', JSON.stringify({ tray: trayOk, hotkey: config.hotkey, hotkeyRegistered: hotkeyOk }));
    globalShortcut.unregisterAll();
    app.exit(0);
  } catch (error) {
    console.error('smoke failed:', (error && error.message) || error);
    app.exit(1);
  }
}

log(`boot argv=${JSON.stringify(process.argv.slice(1))} userData=${app.getPath('userData')}`);

if (!app.requestSingleInstanceLock()) {
  // Another instance is alive: it receives 'second-instance' and shows its window.
  log('single-instance lock busy -> asking the running instance to show itself');
  app.quit();
  // If that instance is stuck (for example an elevated window behind a security prompt),
  // the user needs to know why nothing happens.
  setTimeout(() => {
    try {
      dialog.showErrorBox(
        'XF 待办日历已在运行',
        '已经有一个实例在运行（可能在系统托盘里，也可能是用“以管理员身份运行”打开的旧窗口）。\n\n' +
          '请先：\n' +
          '1. 看任务栏右下角托盘里有没有它的图标，右键 → 退出；\n' +
          '2. 或者运行程序目录里的 reset-app.cmd 结束所有实例；\n' +
          '3. 然后正常双击快捷方式（不要用“以管理员身份运行”）。'
      );
    } catch (error) {
      log('lock-busy dialog failed: ' + ((error && error.message) || error));
    }
  }, 2500);
} else {
  app.on('second-instance', () => {
    log('second-instance -> showing the main window');
    showMainWindow();
  });
  app.whenReady().then(async () => {
    log('ready');
    if (isSelftest) {
      await selftest();
      return;
    }
    if (isSmoke) {
      await smoke();
      return;
    }
    registerIpc();
    createMainWindow();
    createQuickWindow();
    buildTray();
    log('windows and tray created');
    const hotkey = config.hotkey || 'Shift+Space';
    const registered = globalShortcut.register(hotkey, () => toggleQuickWindow());
    log(`hotkey ${hotkey} registered=${registered}`);
    if (!registered) console.warn(`[todo] 全局快捷键 ${hotkey} 注册失败（可能被占用）`);
    pollTimer = setInterval(() => {
      void broadcast();
    }, Math.max(10, Number(config.pollSeconds) || 30) * 1000);
    void broadcast();
    // Belt and braces: never leave the user with a running process and no window.
    setTimeout(() => {
      if (mainWindow !== null && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        log('window was not visible after 3s -> forcing show');
        mainWindow.show();
        mainWindow.focus();
      }
    }, 3000);
  });

  app.on('window-all-closed', (event) => {
    event.preventDefault();
  });
  app.on('before-quit', () => {
    quitting = true;
    if (pollTimer !== null) clearInterval(pollTimer);
    globalShortcut.unregisterAll();
  });
  app.on('activate', () => showMainWindow());
}
