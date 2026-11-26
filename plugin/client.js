/**
 * Client half of the todo-calendar bundle.
 *
 * Registers one right-Sidebar tab type whose body is the calendar plus the
 * selected day's to-dos, its tab-chip title, and one action at the left
 * sidebar's foot that opens that tab. To-dos live in this browser's local
 * storage; nothing here reaches the Session log or the model.
 */
window.__ModuleLoader__.load({
  id: '@local/todo-calendar',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useMemo, useRef, useState } = React;

    /**
     * One additive block (tag chips, the sidebar's today list) must never take the whole
     * surface down: if it throws, the boundary drops it and logs instead.
     */
    class TodoBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }

      static getDerivedStateFromError() {
        return { failed: true };
      }

      componentDidCatch(error) {
        console.warn('[todo-calendar] a block failed to render:', error);
      }

      render() {
        return this.state.failed ? null : this.props.children;
      }
    }

    const NS = 'todoCalendar';
    const KIND = 'todo';
    const TAB_ID = '@local/todo-calendar';
    const PLUGIN_TAG = '@local/todo-calendar';
    const STORAGE_KEY = 'dsh.todo-calendar.v1';
    /** Host routes that hold the locally stored record. */
    const HOST_PREFIX = '/.dsh-todo';

    /** Property guard: the tab body renders even if the runtime supplies no translate seat. */
    const identityT = (key) => key;

    // ---------------------------------------------------------------- copy ----

    const zh = {
      title: 'XF 待办日历',
      description: '在右侧栏显示日历，点日期查看和管理当天的待办',
      open: '打开待办日历',
      prevMonth: '上个月',
      nextMonth: '下个月',
      today: '今天',
      calendarLabel: '日历',
      monthTitle: '{year}年{month}',
      'month.1': '1月',
      'month.2': '2月',
      'month.3': '3月',
      'month.4': '4月',
      'month.5': '5月',
      'month.6': '6月',
      'month.7': '7月',
      'month.8': '8月',
      'month.9': '9月',
      'month.10': '10月',
      'month.11': '11月',
      'month.12': '12月',
      'weekday.mon': '一',
      'weekday.tue': '二',
      'weekday.wed': '三',
      'weekday.thu': '四',
      'weekday.fri': '五',
      'weekday.sat': '六',
      'weekday.sun': '日',
      'weekdayFull.mon': '周一',
      'weekdayFull.tue': '周二',
      'weekdayFull.wed': '周三',
      'weekdayFull.thu': '周四',
      'weekdayFull.fri': '周五',
      'weekdayFull.sat': '周六',
      'weekdayFull.sun': '周日',
      dateLabel: '{month}{day}日',
      dayHeading: '{date} · {weekday}',
      dayLabel: '{date}，{count} 项待办',
      dayLabelEmpty: '{date}',
      daySection: '当天',
      planHeading: '收集箱',
      todayHeading: '今天',
      todayEmpty: '今天还没有待办',
      filterLabel: '按主题筛选',
      filterAll: '全部',
      todayAddPlaceholder: '添加今天的待办',
      todayMarkDone: '标记为完成',
      todayMarkUndone: '标记为未完成',      planHint: '拖到日期上安排',
      planEmpty: '收集箱里还没有条目',
      planPlaceholder: '先丢进收集箱，之后再安排',
      itemCount: '{count} 项',
      dragHint: '拖到日历的日期上设定日期',
      tagHint: '条目里写 #标签 或 #tag，清单就会按标签分组',
      editHint: '点击编辑',
      editLabel: '编辑条目',
      noTopic: '未分类',
      empty: '这一天还没有待办',
      addPlaceholder: '添加当天的待办',
      add: '添加',
      waitingHeading: '等待',
      waitingEmpty: '没有在等的事',
      waitingPlaceholder: '在等谁、等什么',
      waitingDays: '已等 {count} 天',
      waitingToday: '今天加入',
      waitingDone: '已了结',
      waitingToggle: '标记“{title}”已了结',
      waitingToggleBack: '把“{title}”改回等待中',
      toggle: '切换“{title}”的完成状态',
      remove: '删除“{title}”',
      dayLabelOne: '{date}，1 项待办',
      openNoSession: '先开始一个会话',
      backToToday: '回到今天',
      storageWarning: '待办暂时无法保存：浏览器阻止了本地存储。'
    };

    const en = {
      title: 'XF Todo Calendar',
      description: "Shows a calendar in the right sidebar; pick a date to see that day's to-dos",
      open: 'Open todo calendar',
      prevMonth: 'Previous month',
      nextMonth: 'Next month',
      today: 'Today',
      calendarLabel: 'Calendar',
      monthTitle: '{month} {year}',
      'month.1': 'January',
      'month.2': 'February',
      'month.3': 'March',
      'month.4': 'April',
      'month.5': 'May',
      'month.6': 'June',
      'month.7': 'July',
      'month.8': 'August',
      'month.9': 'September',
      'month.10': 'October',
      'month.11': 'November',
      'month.12': 'December',
      'weekday.mon': 'Mon',
      'weekday.tue': 'Tue',
      'weekday.wed': 'Wed',
      'weekday.thu': 'Thu',
      'weekday.fri': 'Fri',
      'weekday.sat': 'Sat',
      'weekday.sun': 'Sun',
      'weekdayFull.mon': 'Mon',
      'weekdayFull.tue': 'Tue',
      'weekdayFull.wed': 'Wed',
      'weekdayFull.thu': 'Thu',
      'weekdayFull.fri': 'Fri',
      'weekdayFull.sat': 'Sat',
      'weekdayFull.sun': 'Sun',
      dateLabel: '{month} {day}',
      dayHeading: '{date} · {weekday}',
      dayLabel: '{date}, {count} to-dos',
      dayLabelEmpty: '{date}',
      daySection: 'This day',
      planHeading: 'Inbox',
      todayHeading: 'Today',
      todayEmpty: 'Nothing for today yet',
      filterLabel: 'Filter by topic',
      filterAll: 'All',
      todayAddPlaceholder: 'Add a to-do for today',
      todayMarkDone: 'Mark as done',
      todayMarkUndone: 'Mark as not done',      planHint: 'Drag onto a date to schedule it',
      planEmpty: 'Inbox is empty',
      planPlaceholder: 'Drop it in the inbox, schedule later',
      itemCount: '{count}',
      dragHint: 'Drag onto a calendar date to set the date',
      tagHint: 'Write #tag in an entry and the lists group by tag',
      editHint: 'Click to edit',
      editLabel: 'Edit entry',
      noTopic: 'Untagged',
      empty: 'No to-dos on this day yet',
      addPlaceholder: 'Add a to-do for this day',
      add: 'Add',
      waitingHeading: 'Waiting',
      waitingEmpty: 'Nothing you are waiting on',
      waitingPlaceholder: 'Who you are waiting on, and what for',
      waitingDays: '{count} d waiting',
      waitingToday: 'added today',
      waitingDone: 'settled',
      waitingToggle: 'Mark “{title}” settled',
      waitingToggleBack: 'Mark “{title}” as still waiting',
      toggle: 'Toggle “{title}”',
      remove: 'Delete “{title}”',
      dayLabelOne: '{date}, 1 to-do',
      openNoSession: 'Start a session first',
      backToToday: 'Back to today',
      storageWarning: 'To-dos cannot be saved: this browser blocked local storage.'
    };

    // --------------------------------------------------------------- dates ----

    const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    /** A `#tag` inside a title: from `#` up to whitespace, another `#`, or punctuation. */
    const TAG_PATTERN = /#[^\s#，。、；：！？,.;:!?()（）]+/g;

    /** Tag groups are ordered locale-aware, so Chinese tags sort by pinyin. */
    const tagCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

    /** The distinct tags written in a title, in the order they appear. */
    function parseTags(title) {
      const found = title.match(TAG_PATTERN);
      if (found === null) return [];
      const tags = [];
      for (const raw of found) {
        const name = raw.slice(1).trim();
        if (name !== '' && tags.indexOf(name) < 0) tags.push(name);
      }
      return tags;
    }

    /**
     * Group the section's entries by tag. An entry carrying two tags appears under
     * both; entries without one fall into a trailing untagged group.
     */
    function groupByTag(items) {
      const groups = new Map();
      const untagged = [];
      for (const item of items) {
        const tags = parseTags(item.title);
        if (tags.length === 0) {
          untagged.push(item);
          continue;
        }
        for (const tag of tags) {
          const list = groups.get(tag);
          if (list === undefined) groups.set(tag, [item]);
          else list.push(item);
        }
      }
      const names = Array.from(groups.keys()).sort(tagCollator.compare);
      return { tags: names.map((tag) => ({ tag, items: groups.get(tag) })), untagged };
    }

    /** The title with every `#tag` emphasized; plain text stays untouched. */
    function renderTitle(title) {
      return title.split(/(#[^\s#，。、；：！？,.;:!?()（）]+)/g).map((piece, index) =>
        piece.startsWith('#') && piece.length > 1
          ? h('span', { key: 'p' + index, className: 'dsh-todo-tag' }, piece)
          : piece
      );
    }

    function pad(value) {
      return value < 10 ? '0' + value : String(value);
    }

    /** Local calendar-day identity, which is what a to-do is filed under. */
    function dayKey(date) {
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    function parseDayKey(key) {
      const parts = key.split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }

    function addDays(date, count) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
    }

    /** Local midnight of a timestamp, so ages count calendar days rather than 24h buckets. */
    function startOfDay(timestamp) {
      const date = new Date(timestamp);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }

    /** A clock the view can read so an open tab never shows a stale age. */
    function useNow(intervalMs) {
      const [now, setNow] = useState(() => Date.now());
      useEffect(() => {
        const tick = () => setNow(Date.now());
        const onVisible = () => {
          if (document.visibilityState === 'visible') tick();
        };
        const id = window.setInterval(tick, intervalMs);
        window.addEventListener('focus', tick);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
          window.clearInterval(id);
          window.removeEventListener('focus', tick);
          document.removeEventListener('visibilitychange', onVisible);
        };
      }, [intervalMs]);
      return now;
    }

    /** The Monday that starts the six-week window holding the month's first day. */
    function gridStart(year, month) {
      const first = new Date(year, month, 1);
      return addDays(first, -((first.getDay() + 6) % 7));
    }

    function monthNameKey(month) {
      return 'month.' + (month + 1);
    }

    // ------------------------------------------------------------- storage ----

    /**
     * Read the stored record: dated to-dos plus the "waiting on someone" list.
     * `blocked` reports storage that cannot be read at all, a persistent condition
     * the view reports; unreadable JSON is reported and treated as an empty record,
     * so the next write repairs it.
     */
    function readStoredTasks() {
      let raw = null;
      try {
        raw = window.localStorage.getItem(STORAGE_KEY);
      } catch (error) {
        console.error('[todo-calendar] local storage is unreadable:', error);
        return { tasks: [], waiting: [], blocked: true, updatedAt: 0 };
      }
      if (raw === null || raw === '') return { tasks: [], waiting: [], blocked: false, updatedAt: 0 };
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        console.error('[todo-calendar] stored to-dos are not valid JSON:', error);
        return { tasks: [], waiting: [], blocked: false, updatedAt: 0 };
      }
      if (parsed === null || typeof parsed !== 'object') return { tasks: [], waiting: [], blocked: false, updatedAt: 0 };
      // Legacy shape: a bare task array from before the record carried a version.
      if (Array.isArray(parsed)) parsed = { tasks: parsed };
      const updatedAt = Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : 0;
      const seen = new Set();
      const tasks = [];
      for (const item of Array.isArray(parsed.tasks) ? parsed.tasks : []) {
        if (item === null || typeof item !== 'object') continue;
        const id = typeof item.id === 'string' && item.id !== '' ? item.id : null;
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        // A null date is a planned item; an unparseable string is a malformed row.
        const rawDate = item.date === null || item.date === undefined ? null : item.date;
        const date = rawDate === null ? null : typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
        if (id === null || title === '' || date === undefined || seen.has(id)) continue;
        seen.add(id);
        tasks.push({
          id,
          title,
          date,
          done: item.done === true,
          createdAt: typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : 0
        });
      }
      const waiting = [];
      for (const item of Array.isArray(parsed.waiting) ? parsed.waiting : []) {
        if (item === null || typeof item !== 'object') continue;
        const id = typeof item.id === 'string' && item.id !== '' ? item.id : null;
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (id === null || title === '' || seen.has(id)) continue;
        seen.add(id);
        waiting.push({
          id,
          title,
          done: item.done === true,
          createdAt: typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : 0
        });
      }
      return { tasks, waiting, blocked: false, updatedAt };
    }

    /**
     * Read the shared Host record; `null` when the Host route is not reachable
     * (an older workspace without this route, or a transient network failure).
     *
     * @returns the Host record or null.
     */
    async function fetchHostRecord() {
      try {
        const response = await fetch(HOST_PREFIX + '/state', { headers: { accept: 'application/json' } });
        if (!response.ok) return null;
        const body = await response.json();
        return body !== null && typeof body === 'object' ? body : null;
      } catch (error) {
        console.warn('[todo-calendar] Host record is unreachable:', error);
        return null;
      }
    }

    /** Fire-and-forget push of the whole record to the Host (the shared copy). */
    function pushHostRecord(record) {
      try {
        void fetch(HOST_PREFIX + '/state', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(record)
        }).catch((error) => console.warn('[todo-calendar] pushing to the Host failed:', error));
      } catch (error) {
        console.warn('[todo-calendar] pushing to the Host failed:', error);
      }
    }

    /** @returns whether the record reached local storage, so the view can say it did not. */
    function writeStoredTasks(tasks, waiting) {
      const record = { version: 1, updatedAt: Date.now(), tasks, waiting };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
        pushHostRecord(record);
        return true;
      } catch (error) {
        console.error('[todo-calendar] saving to-dos failed:', error);
        return false;
      }
    }

    function newTaskId() {
      try {
        if (window.crypto !== undefined && typeof window.crypto.randomUUID === 'function') {
          return window.crypto.randomUUID();
        }
      } catch (error) {
        // A non-secure context may deny the crypto call; the fallback below is enough.
      }
      return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    /**
     * One observable record shared by every mounted surface — the tab body, the
     * sidebar calendar, a second pane, another window — so none renders a stale copy.
     */
    function createTaskStore() {
      let tasks = null;
      let waiting = [];
      let blocked = false;
      let saveFailed = false;
      let snapshot = null;
      const listeners = new Set();

      const load = () => {
        const stored = readStoredTasks();
        tasks = stored.tasks;
        waiting = stored.waiting;
        blocked = stored.blocked;
        saveFailed = false;
        snapshot = { tasks, waiting };
        return snapshot;
      };

      const read = () => (tasks === null ? load() : snapshot);

      const notify = () => {
        for (const listener of Array.from(listeners)) listener();
      };

      const publish = (nextTasks, nextWaiting) => {
        tasks = nextTasks;
        waiting = nextWaiting;
        snapshot = { tasks, waiting };
        saveFailed = blocked ? true : !writeStoredTasks(tasks, waiting);
        notify();
      };

      return {
        get: read,
        /** Persistence conditions the view reports instead of implying a save. */
        status() {
          read();
          return { blocked, saveFailed };
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        reload() {
          load();
          notify();
        },
        /**
         * Reconcile with the Host record (the shared copy the agent and WeChat
         * use). Newer Host data replaces the local list; newer local data is
         * pushed up. Safe to call repeatedly.
         */
        async hydrate() {
          const host = await fetchHostRecord();
          if (host === null) return;
          const local = readStoredTasks();
          const hostStamp = Number.isFinite(host.updatedAt) ? Number(host.updatedAt) : 0;
          const localStamp = Number.isFinite(local.updatedAt) ? Number(local.updatedAt) : 0;
          // Timestamps are second-precision, so a small skew counts as "the same
          // moment" and must not make either side re-push its whole record forever.
          const skew = 2000;
          if (hostStamp > localStamp + skew) {
            try {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                version: 1,
                updatedAt: hostStamp,
                tasks: Array.isArray(host.tasks) ? host.tasks : [],
                waiting: Array.isArray(host.waiting) ? host.waiting : []
              }));
              load();
              notify();
            } catch (error) {
              console.warn('[todo-calendar] Host record could not be stored locally:', error);
            }
            return;
          }
          if (localStamp > hostStamp + skew) {
            try {
              const raw = window.localStorage.getItem(STORAGE_KEY);
              if (raw !== null && raw !== '') pushHostRecord(JSON.parse(raw));
            } catch (error) {
              console.warn('[todo-calendar] local record could not be pushed to the Host:', error);
            }
            return;
          }
          // First migration: an older local list (no timestamp) meets an empty Host
          // record - seed the shared copy instead of showing two different lists.
          const hostEmpty = hostStamp === 0
            && (Array.isArray(host.tasks) ? host.tasks.length : 0) === 0
            && (Array.isArray(host.waiting) ? host.waiting.length : 0) === 0;
          if (hostEmpty && (local.tasks.length > 0 || local.waiting.length > 0)) {
            try {
              const raw = window.localStorage.getItem(STORAGE_KEY);
              if (raw !== null && raw !== '') pushHostRecord(JSON.parse(raw));
            } catch (error) {
              console.warn('[todo-calendar] local record could not be pushed to the Host:', error);
            }
          }
        },
        add(title, date) {
          const current = read();
          publish(current.tasks.concat([{ id: newTaskId(), title, date, done: false, createdAt: Date.now() }]), current.waiting);
        },
        toggle(id) {
          const current = read();
          publish(current.tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)), current.waiting);
        },
        remove(id) {
          const current = read();
          publish(current.tasks.filter((task) => task.id !== id), current.waiting);
        },
        /** File a task under a day, or back into the plan when `date` is null. */
        setDate(id, date) {
          const current = read();
          publish(current.tasks.map((task) => (task.id === id ? { ...task, date } : task)), current.waiting);
        },
        /** Rename an entry; ids are unique across both lists, so one call serves both. */
        setTitle(id, title) {
          const current = read();
          publish(
            current.tasks.map((task) => (task.id === id ? { ...task, title } : task)),
            current.waiting.map((item) => (item.id === id ? { ...item, title } : item))
          );
        },
        addWaiting(title) {
          const current = read();
          publish(current.tasks, current.waiting.concat([{ id: newTaskId(), title, done: false, createdAt: Date.now() }]));
        },
        toggleWaiting(id) {
          const current = read();
          publish(current.tasks, current.waiting.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
        },
        removeWaiting(id) {
          const current = read();
          publish(current.tasks, current.waiting.filter((item) => item.id !== id));
        },
        /**
         * Drag between the three lists: 收集箱 keeps no date, a day files the item
         * there, and 等待 switches it into the waiting collection.
         */
        move(id, options) {
          const current = read();
          const waiting = options !== null && options !== undefined && options.waiting === true;
          const date = waiting ? null : typeof (options || {}).date === 'string' ? options.date : null;
          const task = current.tasks.find((row) => row.id === id);
          const item = task === undefined ? current.waiting.find((row) => row.id === id) : undefined;
          const source = task === undefined ? item : task;
          if (source === undefined) return;
          const nextTasks = current.tasks.filter((row) => row.id !== id);
          const nextWaiting = current.waiting.filter((row) => row.id !== id);
          if (waiting) {
            nextWaiting.push({ id, title: source.title, done: source.done, createdAt: source.createdAt });
          } else {
            nextTasks.push({ id, title: source.title, date, done: source.done, createdAt: source.createdAt });
          }
          publish(nextTasks, nextWaiting);
        }
      };
    }

    const taskStore = createTaskStore();

    /**
     * One pending "open this day" from the sidebar calendar to the tab body. Both
     * halves live in this module, so a plain observable is enough; the request is
     * taken once so a later remount does not jump back to an old day.
     */
    const dateRequests = (() => {
      let request = null;
      let serial = 0;
      const listeners = new Set();
      return {
        request(date) {
          serial += 1;
          request = { date, serial };
          for (const listener of Array.from(listeners)) listener();
        },
        peek() {
          return request;
        },
        take() {
          request = null;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        }
      };
    })();

    function useRequestedDate() {
      const [request, setRequest] = useState(() => dateRequests.peek());
      useEffect(() => {
        const sync = () => setRequest(dateRequests.peek());
        sync();
        return dateRequests.subscribe(sync);
      }, []);
      return request;
    }

    function useTodoSnapshot() {
      const [snapshot, setSnapshot] = useState(() => taskStore.get());
      useEffect(() => {
        const sync = () => setSnapshot(taskStore.get());
        sync();
        return taskStore.subscribe(sync);
      }, []);
      return snapshot;
    }

    /**
     * Read an owner-published observable inside a component. `known` stays false
     * when the value is not one, so callers never mistake "cannot read" for
     * "nothing there".
     */
    function useObservable(source) {
      const read = () =>
        source !== undefined && source !== null && typeof source.getSnapshot === 'function'
          ? { known: true, value: source.getSnapshot() }
          : { known: false, value: undefined };
      const [state, setState] = useState(read);
      useEffect(() => {
        if (source === undefined || source === null || typeof source.subscribe !== 'function') return undefined;
        const sync = () => setState(read());
        sync();
        return source.subscribe(sync);
      }, [source]);
      return state;
    }

    function groupByDay(tasks) {
      const groups = new Map();
      for (const task of tasks) {
        if (task.date === null) continue;
        const list = groups.get(task.date);
        if (list === undefined) groups.set(task.date, [task]);
        else list.push(task);
      }
      return groups;
    }

    /** Unfinished first, then creation order, so toggling never reshuffles the list unexpectedly. */
    function orderTasks(list) {
      return list.slice().sort((left, right) => {
        const done = Number(left.done) - Number(right.done);
        return done !== 0 ? done : left.createdAt - right.createdAt;
      });
    }

    // -------------------------------------------------------------- glyphs ----

    function TodoGlyph(props) {
      const size = props !== null && typeof props.size === 'number' && props.size > 0 ? props.size : 16;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: 'false' },
        h('rect', { x: 2.25, y: 3, width: 11.5, height: 10.5, rx: 2, stroke: 'currentColor', strokeWidth: 1.4 }),
        h('path', { d: 'M2.75 6.25h10.5', stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'M5.25 1.9v2.2M10.75 1.9v2.2', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
        h('path', {
          d: 'M6.1 9.9l1.45 1.5 2.9-3',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round'
        })
      );
    }

    function Chevron(props) {
      const path = props.direction === 'left' ? 'M9.5 3.5L5 8l4.5 4.5' : 'M6.5 3.5L11 8l-4.5 4.5';
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: 'false' },
        h('path', { d: path, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' })
      );
    }

    function CheckGlyph() {
      return h(
        'svg',
        { width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none', 'aria-hidden': true, focusable: 'false' },
        h('path', {
          d: 'M2 5.2L4.1 7.3L8 3',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round'
        })
      );
    }

    function CrossGlyph() {
      return h(
        'svg',
        { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none', 'aria-hidden': true, focusable: 'false' },
        h('path', {
          d: 'M3.6 3.6l4.8 4.8M8.4 3.6l-4.8 4.8',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round'
        })
      );
    }

    /** The drag affordance on a to-do row. */
    function GripGlyph() {
      return h(
        'svg',
        { width: 10, height: 16, viewBox: '0 0 10 16', fill: 'currentColor', 'aria-hidden': true, focusable: 'false' },
        h('circle', { cx: 3, cy: 4, r: 1.15 }),
        h('circle', { cx: 7, cy: 4, r: 1.15 }),
        h('circle', { cx: 3, cy: 8, r: 1.15 }),
        h('circle', { cx: 7, cy: 8, r: 1.15 }),
        h('circle', { cx: 3, cy: 12, r: 1.15 }),
        h('circle', { cx: 7, cy: 12, r: 1.15 })
      );
    }

    // ----------------------------------------------------------- components ----

    function TodoCalendarBody(props) {
      const t = typeof props.t === 'function' ? props.t : typeof props.tt === 'function' ? props.tt : identityT;
      const { tasks, waiting } = useTodoSnapshot();
      const groups = useMemo(() => groupByDay(tasks), [tasks]);

      const now = useNow(1800000);

      const [selected, setSelected] = useState(() => dayKey(new Date()));
      const [draft, setDraft] = useState('');
      const [planDraft, setPlanDraft] = useState('');
      const [waitingDraft, setWaitingDraft] = useState('');
      const [dragging, setDragging] = useState(null);
      const [dropKey, setDropKey] = useState(null);
      const [dropTarget, setDropTarget] = useState(null);
      const [editing, setEditing] = useState(null);
      const [editingValue, setEditingValue] = useState('');
      const [view, setView] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
      });
      const todayKey = dayKey(new Date());
      const storage = taskStore.status();

      const gridRef = useRef(null);
      const rootRef = useRef(null);
      const dayListRef = useRef(null);
      const planListRef = useRef(null);
      const waitingListRef = useRef(null);
      const editInputRef = useRef(null);
      const editSettled = useRef(false);
      const keyboardFocus = useRef(false);

      const focusDay = (key) => {
        const grid = gridRef.current;
        if (grid === null) return;
        const cell = grid.querySelector('[data-day="' + key + '"]');
        if (cell !== null) cell.focus();
      };

      useEffect(() => {
        if (!keyboardFocus.current) return;
        keyboardFocus.current = false;
        focusDay(selected);
      }, [selected]);

      // An entry opened for editing takes the caret with its text selected.
      useEffect(() => {
        if (editing === null) return;
        const input = editInputRef.current;
        if (input === null) return;
        input.focus();
        input.select();
      }, [editing]);

      // A day picked in the sidebar calendar opens this tab on that day.
      const requested = useRequestedDate();
      const handledRequest = useRef(0);
      useEffect(() => {
        if (requested === null || requested.serial <= handledRequest.current) return;
        handledRequest.current = requested.serial;
        dateRequests.take();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(requested.date)) return;
        const date = parseDayKey(requested.date);
        setSelected(dayKey(date));
        setView({ year: date.getFullYear(), month: date.getMonth() });
      }, [requested]);

      const cells = useMemo(() => {
        const start = gridStart(view.year, view.month);
        return Array.from({ length: 42 }, (_, index) => addDays(start, index));
      }, [view.year, view.month]);

      const selectedDate = parseDayKey(selected);
      const dayTasks = groups.get(selected);
      const ordered = dayTasks === undefined ? [] : orderTasks(dayTasks);
      const planned = useMemo(() => orderTasks(tasks.filter((task) => task.date === null)), [tasks]);
      const orderedWaiting = useMemo(() => orderTasks(waiting), [waiting]);
      const [tagFilter, setTagFilter] = useState({ inbox: '', day: '', waiting: '' });

      /** Distinct tags in one section's entries, sorted like the tag groups. */
      const sectionTags = (items) => {
        const seen = new Set();
        for (const item of items) {
          for (const tag of parseTags(item.title)) seen.add(tag);
        }
        return Array.from(seen).sort(tagCollator.compare);
      };

      /** The filter that actually applies: a tag no longer present falls back to all. */
      const effectiveFilter = (zone, items) => {
        const wanted = tagFilter[zone];
        if (wanted === '' || wanted === undefined) return '';
        return sectionTags(items).indexOf(wanted) >= 0 ? wanted : '';
      };

      const filterItems = (items, filter) =>
        filter === '' ? items : items.filter((item) => parseTags(item.title).indexOf(filter) >= 0);

      /** "All" plus one chip per tag; hidden when the section carries no tag at all. */
      const renderTagFilter = (zone, items) => {
        const tags = sectionTags(items);
        if (tags.length === 0) return null;
        const current = effectiveFilter(zone, items);
        const chip = (key, label, value) =>
          h(
            'button',
            {
              type: 'button',
              key,
              className: 'dsh-todo-filterChip',
              'data-active': current === value ? 'true' : undefined,
              'aria-pressed': current === value ? 'true' : 'false',
              onClick: () => setTagFilter((previous) => ({ ...previous, [zone]: value }))
            },
            label
          );
        return h(
          'div',
          { className: 'dsh-todo-filters', role: 'group', 'aria-label': t('filterLabel') },
          chip('all', t('filterAll'), ''),
          tags.map((tag) => chip('tag:' + tag, '#' + tag, tag))
        );
      };
      const inboxFilter = effectiveFilter('inbox', planned);
      const dayFilter = effectiveFilter('day', ordered);
      const waitingFilter = effectiveFilter('waiting', orderedWaiting);
      const filteredPlanned = filterItems(planned, inboxFilter);
      const filteredOrdered = filterItems(ordered, dayFilter);
      const filteredWaiting = filterItems(orderedWaiting, waitingFilter);

      const moveMonth = (delta) => {
        const target = new Date(view.year, view.month + delta, 1);
        const year = target.getFullYear();
        const month = target.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const day = Math.min(selectedDate.getDate(), lastDay);
        setView({ year, month });
        setSelected(dayKey(new Date(year, month, day)));
      };

      const goToday = () => {
        const now = new Date();
        setView({ year: now.getFullYear(), month: now.getMonth() });
        setSelected(dayKey(now));
      };

      const selectDay = (date) => {
        setSelected(dayKey(date));
        if (date.getFullYear() !== view.year || date.getMonth() !== view.month) {
          setView({ year: date.getFullYear(), month: date.getMonth() });
        }
      };

      /** Arrow keys move the selected day inside the grid; focus follows after the commit. */
      const onGridKeyDown = (event) => {
        const step =
          event.key === 'ArrowLeft' ? -1
          : event.key === 'ArrowRight' ? 1
          : event.key === 'ArrowUp' ? -7
          : event.key === 'ArrowDown' ? 7
          : 0;
        if (step === 0) return;
        event.preventDefault();
        keyboardFocus.current = true;
        selectDay(addDays(selectedDate, step));
      };

      const scrollListToEnd = (ref) => {
        window.requestAnimationFrame(() => {
          const node = ref.current;
          if (node !== null) node.scrollIntoView({ block: 'nearest' });
        });
      };

      const submitDay = (event) => {
        event.preventDefault();
        const title = draft.trim();
        if (title === '') return;
        taskStore.add(title, selected);
        setDraft('');
        // The new row lands at the end of the list, which a long day can leave below the fold.
        scrollListToEnd(dayListRef);
      };

      const submitPlan = (event) => {
        event.preventDefault();
        const title = planDraft.trim();
        if (title === '') return;
        taskStore.add(title, null);
        setPlanDraft('');
        scrollListToEnd(planListRef);
      };

      const submitWaiting = (event) => {
        event.preventDefault();
        const title = waitingDraft.trim();
        if (title === '') return;
        taskStore.addWaiting(title);
        setWaitingDraft('');
        scrollListToEnd(waitingListRef);
      };

      /** The id carried by the current row drag, whichever way the browser exposes it. */
      const draggedId = (event) => {
        try {
          const carried = event.dataTransfer.getData('text/plain');
          if (typeof carried === 'string' && carried !== '') return carried;
        } catch (error) {
          // A browser may deny reading data outside its drop handler; fall back to the drag state.
        }
        return dragging;
      };

      const startDrag = (event, task) => {
        try {
          event.dataTransfer.setData('text/plain', task.id);
          event.dataTransfer.effectAllowed = 'move';
        } catch (error) {
          // The drag still works through the component state below.
        }
        setDragging(task.id);
      };

      const endDrag = () => {
        setDragging(null);
        setDropKey(null);
        setDropTarget(null);
      };

      const leaveWithin = (event, callback) => {
        const related = event.relatedTarget;
        if (related !== null && related !== undefined && event.currentTarget.contains(related)) return;
        callback();
      };

      const dropOnDay = (event, date) => {
        event.preventDefault();
        const id = draggedId(event);
        endDrag();
        if (id === null || id === undefined) return;
        taskStore.move(id, { date: dayKey(date), waiting: false });
        // Show the item where it moved to, so the drop has a visible result.
        selectDay(date);
      };

      /* The three lists are drop targets too: 收集箱 clears the date, 当天 files
         the item under the selected day, 等待 turns it into a waiting item. */
      const sectionDragOver = (event, target) => {
        if (dragging === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (dropTarget !== target) setDropTarget(target);
      };

      const clearSectionDrop = (target) => {
        if (dropTarget === target) setDropTarget(null);
      };

      const dropOnSection = (event, target) => {
        event.preventDefault();
        const id = draggedId(event);
        endDrag();
        if (id === null || id === undefined) return;
        if (target === 'waiting') taskStore.move(id, { waiting: true });
        else if (target === 'day') taskStore.move(id, { date: selected, waiting: false });
        else taskStore.move(id, { date: null, waiting: false });
      };

      const startEdit = (item) => {
        editSettled.current = false;
        setEditing({ id: item.id, title: item.title });
        setEditingValue(item.title);
      };

      /** Put focus back on the renamed row once the editor closes. */
      const focusRow = (id) => {
        window.requestAnimationFrame(() => {
          const root = rootRef.current;
          if (root === null) return;
          const node = root.querySelector('[data-edit-target="' + id + '"]');
          if (node !== null) node.focus();
        });
      };

      const finishEdit = (entry, save) => {
        if (editSettled.current) return;
        editSettled.current = true;
        const title = editingValue.trim();
        setEditing(null);
        if (save && title !== '' && title !== entry.title) taskStore.setTitle(entry.id, title);
        focusRow(entry.id);
      };

      const heading = t('dayHeading', {
        date: t('dateLabel', { month: t(monthNameKey(selectedDate.getMonth())), day: String(selectedDate.getDate()) }),
        weekday: t('weekdayFull.' + DAY_KEYS[selectedDate.getDay()])
      });

      const renderCell = (date) => {
        const key = dayKey(date);
        const list = groups.get(key);
        const count = list === undefined ? 0 : list.length;
        const dateText = t('dateLabel', { month: t(monthNameKey(date.getMonth())), day: String(date.getDate()) });
        const label =
          count === 0
            ? t('dayLabelEmpty', { date: dateText })
            : t(count === 1 ? 'dayLabelOne' : 'dayLabel', { date: dateText, count: String(count) });
        const dots = list === undefined
          ? []
          : orderTasks(list).slice(0, 3).map((task) =>
              h('span', { key: task.id, className: 'dsh-todo-dot', 'data-done': task.done ? 'true' : 'false' })
            );
        return h(
          'button',
          {
            key,
            type: 'button',
            className: 'dsh-todo-cell',
            tabIndex: key === selected ? 0 : -1,
            'data-day': key,
            'aria-label': label,
            'aria-pressed': key === selected ? 'true' : 'false',
            'aria-current': key === todayKey ? 'date' : undefined,
            'data-today': key === todayKey ? 'true' : undefined,
            'data-selected': key === selected ? 'true' : undefined,
            'data-outside': date.getMonth() === view.month ? undefined : 'true',
            'data-drop': dropKey === key ? 'true' : undefined,
            onClick: () => selectDay(date),
            onDragOver: (event) => {
              if (dragging === null) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              if (dropKey !== key) setDropKey(key);
            },
            onDragLeave: (event) =>
              leaveWithin(event, () => {
                if (dropKey === key) setDropKey(null);
              }),
            onDrop: (event) => dropOnDay(event, date)
          },
          h('span', { className: 'dsh-todo-cellNum' }, String(date.getDate())),
          dots.length === 0 ? null : h('span', { className: 'dsh-todo-dots' }, dots)
        );
      };

      /** Inline rename editor; Enter or leaving the field saves, Escape reverts. */
      const renderEditInput = (entry) =>
        h('input', {
          ref: editInputRef,
          className: 'dsh-todo-editInput',
          type: 'text',
          value: editingValue,
          maxLength: 200,
          'aria-label': t('editLabel'),
          onChange: (event) => setEditingValue(event.target.value),
          onBlur: () => finishEdit(entry, true),
          onKeyDown: (event) => {
            if (event.key === 'Enter') {
              const native = event.nativeEvent;
              if (native !== undefined && (native.isComposing || native.keyCode === 229)) return;
              event.preventDefault();
              finishEdit(entry, true);
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              finishEdit(entry, false);
            }
          }
        });

      /** The entry text itself is the edit affordance, so it is a real button. */
      const renderTitleButton = (item) =>
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-todo-text dsh-todo-textButton',
            'data-edit-target': item.id,
            title: t('editHint'),
            onClick: () => startEdit(item)
          },
          renderTitle(item.title)
        );

      /** A dated or planned to-do row; dragging it onto a date files it there. */
      const renderTodo = (task) => {
        const isEditing = editing !== null && editing.id === task.id;
        return h(
          'li',
          {
            key: task.id,
            className: 'dsh-todo-task',
            'data-done': task.done ? 'true' : 'false',
            'data-dragging': dragging === task.id ? 'true' : undefined,
            'data-editing': isEditing ? 'true' : undefined,
            draggable: !isEditing,
            onDragStart: (event) => startDrag(event, task),
            onDragEnd: endDrag
          },
          h('span', { className: 'dsh-todo-grip', 'aria-hidden': true, title: t('dragHint') }, h(GripGlyph)),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-todo-check',
              'aria-pressed': task.done ? 'true' : 'false',
              'aria-label': t('toggle', { title: task.title }),
              title: t('toggle', { title: task.title }),
              onClick: () => taskStore.toggle(task.id)
            },
            task.done ? h(CheckGlyph) : null
          ),
          isEditing ? renderEditInput({ id: task.id, title: task.title }) : renderTitleButton(task),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-todo-remove',
              'aria-label': t('remove', { title: task.title }),
              title: t('remove', { title: task.title }),
              onClick: () => taskStore.remove(task.id)
            },
            h(CrossGlyph)
          )
        );
      };

      /** How long an item has been outstanding, counted in calendar days. */
      const waitingAge = (item) => {
        if (!Number.isFinite(item.createdAt) || item.createdAt <= 0) return t('waitingToday');
        const days = Math.round((startOfDay(now) - startOfDay(item.createdAt)) / 86400000);
        return days <= 0 ? t('waitingToday') : t('waitingDays', { count: String(days) });
      };

      const renderWaiting = (item) => {
        const isEditing = editing !== null && editing.id === item.id;
        const toggleLabel = item.done ? t('waitingToggleBack', { title: item.title }) : t('waitingToggle', { title: item.title });
        return h(
          'li',
          {
            key: item.id,
            className: 'dsh-todo-task',
            'data-done': item.done ? 'true' : 'false',
            'data-editing': isEditing ? 'true' : undefined,
            'data-dragging': dragging === item.id ? 'true' : undefined,
            draggable: !isEditing,
            onDragStart: (event) => startDrag(event, item),
            onDragEnd: endDrag
          },
          h('span', { className: 'dsh-todo-grip', 'aria-hidden': true, title: t('dragHint') }, h(GripGlyph)),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-todo-check',
              'aria-pressed': item.done ? 'true' : 'false',
              'aria-label': toggleLabel,
              title: toggleLabel,
              onClick: () => taskStore.toggleWaiting(item.id)
            },
            item.done ? h(CheckGlyph) : null
          ),
          isEditing ? renderEditInput({ id: item.id, title: item.title }) : renderTitleButton(item),
          h('span', { className: 'dsh-todo-age' }, item.done ? t('waitingDone') : waitingAge(item)),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-todo-remove',
              'aria-label': t('remove', { title: item.title }),
              title: t('remove', { title: item.title }),
              onClick: () => taskStore.removeWaiting(item.id)
            },
            h(CrossGlyph)
          )
        );
      };

      /** One section's entries: a flat list, or tag groups when any entry carries one. */
      const renderSectionList = (items, renderRow, ref, flat) => {
        const grouped = groupByTag(items);
        if (flat === true || grouped.tags.length === 0) {
          return h('ul', { className: 'dsh-todo-list', ref }, items.map((item) => renderRow(item)));
        }
        const groupHead = (label, count, muted) =>
          h(
            'div',
            { className: 'dsh-todo-groupHead' },
            h('span', { className: muted ? 'dsh-todo-groupTag dsh-todo-groupTagMuted' : 'dsh-todo-groupTag' }, label),
            h('span', { className: 'dsh-todo-groupCount' }, String(count))
          );
        return h(
          'div',
          { className: 'dsh-todo-groups', ref },
          grouped.tags.map((group) =>
            h(
              'div',
              { key: 'tag:' + group.tag, className: 'dsh-todo-group' },
              groupHead('#' + group.tag, group.items.length, false),
              h('ul', { className: 'dsh-todo-list' }, group.items.map((item) => renderRow(item)))
            )
          ),
          grouped.untagged.length === 0
            ? null
            : h(
                'div',
                { key: 'tag:untagged', className: 'dsh-todo-group' },
                groupHead(t('noTopic'), grouped.untagged.length, true),
                h('ul', { className: 'dsh-todo-list' }, grouped.untagged.map((item) => renderRow(item)))
              )
        );
      };

      /** Shared section head: label, optional muted detail, and the item count. */
      const renderHead = (title, sub, count) =>
        h(
          'div',
          { className: 'dsh-todo-dayHead' },
          h('span', { className: 'dsh-todo-dayTitle' }, title),
          sub === null ? null : h('span', { className: 'dsh-todo-daySub' }, sub),
          h('span', { className: 'dsh-todo-dayCount' }, t('itemCount', { count: String(count) }))
        );

      /** Enter that confirms an IME composition must not submit the form. */
      const guardImeEnter = (event) => {
        if (event.key !== 'Enter') return;
        const native = event.nativeEvent;
        if (native !== undefined && (native.isComposing || native.keyCode === 229)) event.preventDefault();
      };

      const renderAdd = (value, onChange, placeholder, onSubmit) =>
        h(
          'form',
          { className: 'dsh-todo-add', onSubmit },
          h('input', {
            className: 'dsh-todo-input',
            type: 'text',
            value,
            maxLength: 200,
            placeholder,
            'aria-label': placeholder,
            title: t('tagHint'),
            onChange: (event) => onChange(event.target.value),
            onKeyDown: guardImeEnter
          }),
          h('button', { type: 'submit', className: 'dsh-todo-addButton', disabled: value.trim() === '' }, t('add'))
        );

      return h(
        'div',
        { className: 'dsh-todo-root', ref: rootRef },
        h(
          'div',
          { className: 'dsh-todo-header' },
          h('span', { className: 'dsh-todo-month' }, t('monthTitle', { year: String(view.year), month: t(monthNameKey(view.month)) })),
          h('button', { type: 'button', className: 'dsh-todo-today', title: t('today'), onClick: goToday }, t('today')),
          h(
            'span',
            { className: 'dsh-todo-nav' },
            h(
              'button',
              { type: 'button', className: 'dsh-todo-iconButton', 'aria-label': t('prevMonth'), title: t('prevMonth'), onClick: () => moveMonth(-1) },
              h(Chevron, { direction: 'left' })
            ),
            h(
              'button',
              { type: 'button', className: 'dsh-todo-iconButton', 'aria-label': t('nextMonth'), title: t('nextMonth'), onClick: () => moveMonth(1) },
              h(Chevron, { direction: 'right' })
            )
          )
        ),
        h(
          'div',
          { className: 'dsh-todo-weekdays', 'aria-hidden': true },
          WEEKDAY_KEYS.map((key) => h('span', { key, className: 'dsh-todo-weekday' }, t('weekday.' + key)))
        ),
        h(
          'div',
          {
            className: 'dsh-todo-grid',
            role: 'group',
            'aria-label': t('calendarLabel'),
            ref: gridRef,
            onKeyDown: onGridKeyDown
          },
          cells.map(renderCell)
        ),
        h(
          'div',
          { className: 'dsh-todo-sections' },
          h(
            'section',
            {
              className: 'dsh-todo-section',
              'data-drop': dropTarget === 'inbox' ? 'true' : undefined,
            onDragOver: (event) => sectionDragOver(event, 'inbox'),
            onDragLeave: (event) => leaveWithin(event, () => clearSectionDrop('inbox')),
            onDrop: (event) => dropOnSection(event, 'inbox')
          },
          renderHead(t('planHeading'), t('planHint'), filteredPlanned.length),
          h(TodoBoundary, null, renderTagFilter('inbox', planned)),
          renderAdd(planDraft, setPlanDraft, t('planPlaceholder'), submitPlan),
          filteredPlanned.length === 0
            ? h('p', { className: 'dsh-todo-empty' }, t('planEmpty'))
            : renderSectionList(filteredPlanned, renderTodo, planListRef, inboxFilter !== '')
        ),
        h(
          'section',
          {
            className: 'dsh-todo-section',
            'data-drop': dropTarget === 'day' ? 'true' : undefined,
            onDragOver: (event) => sectionDragOver(event, 'day'),
            onDragLeave: (event) => leaveWithin(event, () => clearSectionDrop('day')),
            onDrop: (event) => dropOnSection(event, 'day')
          },
          renderHead(t('daySection'), heading, filteredOrdered.length),
          h(TodoBoundary, null, renderTagFilter('day', ordered)),
          renderAdd(draft, setDraft, t('addPlaceholder'), submitDay),
          filteredOrdered.length === 0
            ? h('p', { className: 'dsh-todo-empty' }, t('empty'))
            : renderSectionList(filteredOrdered, renderTodo, dayListRef, dayFilter !== '')
        ),
        h(
          'section',
          {
            className: 'dsh-todo-section',
            'data-drop': dropTarget === 'waiting' ? 'true' : undefined,
            onDragOver: (event) => sectionDragOver(event, 'waiting'),
            onDragLeave: (event) => leaveWithin(event, () => clearSectionDrop('waiting')),
            onDrop: (event) => dropOnSection(event, 'waiting')
          },
          renderHead(t('waitingHeading'), null, filteredWaiting.length),
          h(TodoBoundary, null, renderTagFilter('waiting', orderedWaiting)),
          renderAdd(waitingDraft, setWaitingDraft, t('waitingPlaceholder'), submitWaiting),
          filteredWaiting.length === 0
            ? h('p', { className: 'dsh-todo-empty' }, t('waitingEmpty'))
            : renderSectionList(filteredWaiting, renderWaiting, waitingListRef, waitingFilter !== '')
          ),
        ),
        storage.blocked || storage.saveFailed
          ? h('p', { className: 'dsh-todo-warning', role: 'alert' }, t('storageWarning'))
          : null
      );
    }

    function TodoTabTitle(props) {
      const t = typeof props.t === 'function' ? props.t : typeof props.tt === 'function' ? props.tt : identityT;
      return h(
        'span',
        { className: 'dsh-todo-chip' },
        h(TodoGlyph, { size: 14 }),
        h('span', { className: 'dsh-todo-chipText' }, t('title'))
      );
    }

    /**
     * The always-visible mini calendar at the left sidebar's foot: this month, today
     * marked, one dot per day that holds to-dos. Picking a day opens this tab on it.
     */
    let markedFooterParent = null;

    function TodoMiniCalendar(props) {
      const t = typeof props.t === 'function' ? props.t : typeof props.tt === 'function' ? props.tt : identityT;
      const { tasks } = useTodoSnapshot();
      const groups = useMemo(() => groupByDay(tasks), [tasks]);
      const session = useObservable(props.mounted);
      const unavailable = session.known && session.value === undefined;

      const todayDate = new Date();
      const todayKey = dayKey(todayDate);
      const [view, setView] = useState(() => ({ year: todayDate.getFullYear(), month: todayDate.getMonth() }));
      const [cursor, setCursor] = useState(todayKey);
      const [draft, setDraft] = useState('');
      const todayTasks = useMemo(
        () => tasks
          .filter((task) => task.date === todayKey)
          .slice()
          .sort((left, right) => Number(left.done) - Number(right.done) || left.createdAt - right.createdAt),
        [tasks, todayKey]
      );

      const gridRef = useRef(null);
      const keyboardFocus = useRef(false);
      const cursorDate = parseDayKey(cursor);

      const focusCell = (key) => {
        const grid = gridRef.current;
        if (grid === null) return;
        const cell = grid.querySelector('[data-day="' + key + '"]');
        if (cell !== null) cell.focus();
      };

      useEffect(() => {
        if (!keyboardFocus.current) return;
        keyboardFocus.current = false;
        focusCell(cursor);
      }, [cursor]);

      const cells = useMemo(() => {
        const start = gridStart(view.year, view.month);
        return Array.from({ length: 42 }, (_, index) => addDays(start, index));
      }, [view.year, view.month]);

      const showMonth = (year, month) => {
        setView({ year, month });
      };

      const moveMonth = (delta) => {
        const target = new Date(view.year, view.month + delta, 1);
        const year = target.getFullYear();
        const month = target.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const day = Math.min(cursorDate.getDate(), lastDay);
        showMonth(year, month);
        setCursor(dayKey(new Date(year, month, day)));
      };

      const goToday = () => {
        const now = new Date();
        showMonth(now.getFullYear(), now.getMonth());
        setCursor(dayKey(now));
      };

      const pick = (date) => {
        const key = dayKey(date);
        setCursor(key);
        if (date.getFullYear() !== view.year || date.getMonth() !== view.month) {
          showMonth(date.getFullYear(), date.getMonth());
        }
        if (unavailable) return;
        dateRequests.request(key);
        props.openCalendar();
      };

      const onGridKeyDown = (event) => {
        const step =
          event.key === 'ArrowLeft' ? -1
          : event.key === 'ArrowRight' ? 1
          : event.key === 'ArrowUp' ? -7
          : event.key === 'ArrowDown' ? 7
          : 0;
        if (step === 0) return;
        event.preventDefault();
        const next = addDays(cursorDate, step);
        keyboardFocus.current = true;
        setCursor(dayKey(next));
        if (next.getFullYear() !== view.year || next.getMonth() !== view.month) {
          showMonth(next.getFullYear(), next.getMonth());
        }
      };

      const renderCell = (date) => {
        const key = dayKey(date);
        const list = groups.get(key);
        const count = list === undefined ? 0 : list.length;
        const dateText = t('dateLabel', { month: t(monthNameKey(date.getMonth())), day: String(date.getDate()) });
        const label =
          count === 0
            ? t('dayLabelEmpty', { date: dateText })
            : t(count === 1 ? 'dayLabelOne' : 'dayLabel', { date: dateText, count: String(count) });
        const dots = list === undefined
          ? []
          : orderTasks(list).slice(0, 3).map((task) =>
              h('span', { key: task.id, className: 'dsh-todo-miniDot', 'data-done': task.done ? 'true' : 'false' })
            );
        return h(
          'button',
          {
            key,
            type: 'button',
            className: 'dsh-todo-miniCell',
            tabIndex: key === cursor ? 0 : -1,
            'data-day': key,
            'aria-label': label,
            'aria-current': key === todayKey ? 'date' : undefined,
            'data-today': key === todayKey ? 'true' : undefined,
            'data-outside': date.getMonth() === view.month ? undefined : 'true',
            onClick: () => pick(date)
          },
          h('span', { className: 'dsh-todo-miniNum' }, String(date.getDate())),
          dots.length === 0 ? null : h('span', { className: 'dsh-todo-miniDots' }, dots)
        );
      };

      const monthText = t('monthTitle', { year: String(view.year), month: t(monthNameKey(view.month)) });

      return h(
        'div',
        {
          className: 'dsh-todo-mini',
          'data-dsh-todo-seat': 'true',
          ref: (node) => {
            // The sidebar renders footer actions in one non-wrapping flex row. Give the
            // calendar its own full-width line above the buttons (Remote, Cordis, …).
            if (node === null) {
              if (markedFooterParent !== null) markedFooterParent.removeAttribute('data-dsh-todo-footer');
              markedFooterParent = null;
              return;
            }
            let parent = node.parentElement;
            for (let depth = 0; depth < 3 && parent !== null; depth += 1) {
              const style = window.getComputedStyle(parent);
              if (style.display === 'flex' && style.flexDirection === 'row') {
                parent.setAttribute('data-dsh-todo-footer', 'true');
                markedFooterParent = parent;
                return;
              }
              parent = parent.parentElement;
            }
          }
        },
        h(
          'div',
          { className: 'dsh-todo-miniHead' },
          h(
            'button',
            { type: 'button', className: 'dsh-todo-miniMonth', title: t('backToToday'), 'aria-label': monthText, onClick: goToday },
            monthText
          ),
          h(
            'button',
            { type: 'button', className: 'dsh-todo-miniNav', 'aria-label': t('prevMonth'), title: t('prevMonth'), onClick: () => moveMonth(-1) },
            h(Chevron, { direction: 'left' })
          ),
          h(
            'button',
            { type: 'button', className: 'dsh-todo-miniNav', 'aria-label': t('nextMonth'), title: t('nextMonth'), onClick: () => moveMonth(1) },
            h(Chevron, { direction: 'right' })
          )
        ),
        h(
          'div',
          { className: 'dsh-todo-miniWeekdays', 'aria-hidden': true },
          WEEKDAY_KEYS.map((key) => h('span', { key }, t('weekday.' + key)))
        ),
        h(
          'div',
          {
            className: 'dsh-todo-miniGrid',
            role: 'group',
            'aria-label': t('calendarLabel'),
            ref: gridRef,
            onKeyDown: onGridKeyDown
          },
          cells.map(renderCell)
        ),
        h(
          TodoBoundary,
          null,
          h(
            'div',
            { className: 'dsh-todo-miniToday' },
          h(
            'div',
            { className: 'dsh-todo-miniTodayHead' },
            h('span', { className: 'dsh-todo-miniTodayTitle' }, t('todayHeading')),
            h('span', { className: 'dsh-todo-miniTodayCount' }, String(todayTasks.length))
          ),
          todayTasks.length === 0
            ? h('p', { className: 'dsh-todo-miniTodayEmpty' }, t('todayEmpty'))
            : h(
                'ul',
                { className: 'dsh-todo-miniTodayList' },
                todayTasks.map((task) =>
                  h(
                    'li',
                    { key: task.id, className: 'dsh-todo-miniTodayRow', 'data-done': task.done ? 'true' : 'false' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-todo-miniTodayCheck',
                        'aria-pressed': task.done ? 'true' : 'false',
                        'aria-label': task.done ? t('todayMarkUndone') : t('todayMarkDone'),
                        onClick: (event) => {
                          event.stopPropagation();
                          taskStore.toggle(task.id);
                        }
                      },
                      task.done ? h(CheckGlyph) : null
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-todo-miniTodayText',
                        title: task.title,
                        onClick: () => {
                          if (unavailable) return;
                          dateRequests.request(todayKey);
                          props.openCalendar();
                        }
                      },
                      task.title
                    )
                  )
                )
              ),
          h(
            'form',
            {
              className: 'dsh-todo-miniTodayAdd',
              onSubmit: (event) => {
                event.preventDefault();
                const title = draft.trim();
                if (title === '') return;
                taskStore.add(title, todayKey);
                setDraft('');
              }
            },
            h('input', {
              type: 'text',
              className: 'dsh-todo-miniTodayInput',
              value: draft,
              maxLength: 200,
              placeholder: t('todayAddPlaceholder'),
              'aria-label': t('todayAddPlaceholder'),
              onChange: (event) => setDraft(event.target.value)
            })
          )
        ))
      );
    }

    /** Collapsed rail: the calendar cannot fit, so one button opens the tab instead. */
    function TodoFootButton(props) {
      const t = typeof props.t === 'function' ? props.t : typeof props.tt === 'function' ? props.tt : identityT;
      const session = useObservable(props.mounted);
      const unavailable = session.known && session.value === undefined;
      const label = unavailable ? t('openNoSession') : t('open');
      return h(
        'button',
        {
          type: 'button',
          className: 'dsh-todo-foot',
          'aria-label': label,
          title: label,
          'aria-disabled': unavailable ? 'true' : undefined,
          onClick: () => {
            if (!unavailable) props.openCalendar();
          }
        },
        h(TodoGlyph, { size: 16 })
      );
    }

    function TodoSidebarAction(props) {
      return props.wide === false ? h(TodoFootButton, props) : h(TodoMiniCalendar, props);
    }

    // ---------------------------------------------------------------- style ----

    const CSS = `
.dsh-todo-root{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;padding:10px 12px 12px;gap:8px;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,14px);line-height:1.55}
.dsh-todo-header{display:flex;align-items:center;gap:6px;flex:none}
.dsh-todo-month{flex:1;min-width:0;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-todo-nav{display:flex;align-items:center;gap:2px;flex:none}
.dsh-todo-today{flex:none;height:28px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}
.dsh-todo-today:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsh-todo-iconButton{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsh-todo-iconButton:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsh-todo-today:focus-visible,.dsh-todo-iconButton:focus-visible,.dsh-todo-cell:focus-visible,.dsh-todo-check:focus-visible,.dsh-todo-remove:focus-visible,.dsh-todo-addButton:focus-visible,.dsh-todo-foot:focus-visible,.dsh-todo-textButton:focus-visible,.dsh-todo-miniMonth:focus-visible,.dsh-todo-miniNav:focus-visible,.dsh-todo-miniCell:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-todo-weekdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;flex:none;color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center}
.dsh-todo-weekday{padding:0 0 2px}
.dsh-todo-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;flex:none}
.dsh-todo-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;height:37px;padding:2px 0;border:.5px solid transparent;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-variant-numeric:tabular-nums;cursor:pointer}
.dsh-todo-cell:hover{background:var(--dsw-alias-bg-layer-2)}
.dsh-todo-cell[data-outside='true']{color:var(--dsw-alias-label-secondary);opacity:.55}
.dsh-todo-cell[data-drop='true']{background:var(--dsw-alias-bg-layer-2);outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dsh-todo-cell[data-selected='true']{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l2)}
.dsh-todo-cell[data-today='true'] .dsh-todo-cellNum{color:var(--dsw-alias-brand-primary);font-weight:600}
.dsh-todo-cell[data-today='true'][data-selected='true']{border-color:var(--dsw-alias-brand-primary)}
.dsh-todo-cellNum{line-height:1.2}
.dsh-todo-dots{display:flex;align-items:center;justify-content:center;gap:2px;height:4px}
.dsh-todo-dot{width:4px;height:4px;border-radius:50%;background:var(--dsw-alias-brand-primary)}
.dsh-todo-dot[data-done='true']{background:var(--dsw-alias-state-idle-primary);opacity:.85}
.dsh-todo-filters{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 2px}
.dsh-todo-filterChip{flex:none;max-width:100%;padding:1px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.dsh-todo-filterChip:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
.dsh-todo-filterChip[data-active='true']{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.dsh-todo-filterChip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.dsh-todo-section{display:flex;flex-direction:column;flex:none;gap:6px;padding:8px 0 2px;border-top:.5px solid var(--dsw-alias-border-l1)}
.dsh-todo-section[data-drop='true']{background:var(--dsw-alias-bg-layer-2);border-radius:8px;outline:2px dashed var(--dsw-alias-brand-primary);outline-offset:2px}
.dsh-todo-age{flex:none;margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}
.dsh-todo-grip{flex:none;width:10px;margin-top:3px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);opacity:.55;cursor:grab}
.dsh-todo-task[data-dragging='true']{opacity:.45}
.dsh-todo-task[draggable='true']{cursor:grab}
.dsh-todo-dayHead{display:flex;align-items:baseline;gap:6px;flex:none;min-width:0}
.dsh-todo-dayTitle{flex:none;font-size:17px;font-weight:700;letter-spacing:.01em;white-space:nowrap}
.dsh-todo-daySub{flex:1;min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-todo-dayCount{flex:none;margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}
.dsh-todo-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;flex:none}
.dsh-todo-sections{display:flex;flex-direction:column;gap:8px;flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding-bottom:2px}
.dsh-todo-groups{display:flex;flex-direction:column;gap:6px}
.dsh-todo-group{display:flex;flex-direction:column;gap:2px}
.dsh-todo-groupHead{display:flex;align-items:baseline;gap:6px;padding:2px 0 1px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.dsh-todo-groupTag{flex:none;max-width:72%;color:var(--dsw-alias-brand-primary);font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-todo-groupTagMuted{color:var(--dsw-alias-label-secondary);font-weight:500}
.dsh-todo-groupCount{flex:none;margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}
.dsh-todo-tag{color:var(--dsw-alias-brand-primary);font-weight:600}
.dsh-todo-task{display:flex;align-items:flex-start;gap:8px;padding:6px 2px;border-radius:6px}
.dsh-todo-task:hover{background:var(--dsw-alias-bg-layer-2)}
.dsh-todo-check{position:relative;flex:none;width:17px;height:17px;margin-top:2px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:1.2px solid var(--dsw-alias-border-l2);border-radius:4px;background:transparent;color:transparent;cursor:pointer}
.dsh-todo-check::after{content:'';position:absolute;inset:-4px;border-radius:8px}
.dsh-todo-check:hover{border-color:var(--dsw-alias-brand-primary)}
.dsh-todo-check[aria-pressed='true']{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.dsh-todo-text{flex:1;min-width:0;overflow-wrap:anywhere}
.dsh-todo-textButton{margin:0;padding:0;border:none;background:transparent;color:inherit;font:inherit;text-align:left;cursor:text}
.dsh-todo-editInput{flex:1;min-width:0;height:26px;padding:0 7px;border:.5px solid var(--dsw-alias-brand-primary);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;outline:none}
.dsh-todo-task[data-done='true'] .dsh-todo-text{color:var(--dsw-alias-label-secondary);text-decoration:line-through}
.dsh-todo-remove{position:relative;flex:none;width:20px;height:20px;margin-top:-2px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);opacity:0;cursor:pointer}
.dsh-todo-remove::after{content:'';position:absolute;inset:-3px;border-radius:6px}
.dsh-todo-task:hover .dsh-todo-remove,.dsh-todo-remove:focus-visible{opacity:1}
@media (hover:none){.dsh-todo-remove{opacity:1}.dsh-todo-cell:not([data-selected='true']):hover{background:transparent}.dsh-todo-task:hover{background:transparent}.dsh-todo-miniCell:not([data-today='true']):hover{background:transparent}}
.dsh-todo-remove:hover{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-2)}
.dsh-todo-empty{margin:0;padding:6px 2px;color:var(--dsw-alias-label-secondary);font-size:13px}
.dsh-todo-add{display:flex;align-items:center;gap:6px;flex:none}
.dsh-todo-input{flex:1;min-width:0;height:30px;padding:0 9px;border:.5px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:13px}
.dsh-todo-input::placeholder{color:var(--dsw-alias-label-secondary)}
.dsh-todo-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsh-todo-addButton{flex:none;height:30px;padding:0 11px;border:.5px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
.dsh-todo-addButton:hover:enabled{border-color:var(--dsw-alias-border-l2)}
.dsh-todo-addButton:disabled{opacity:.5;cursor:default}
.dsh-todo-chip{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%}
.dsh-todo-chipText{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-todo-foot{flex:none;width:36px;height:36px;margin:0 0 6px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsh-todo-foot:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsh-todo-foot[aria-disabled='true']{opacity:.45;cursor:default}
.dsh-todo-foot[aria-disabled='true']:hover{background:transparent;color:var(--dsw-alias-label-secondary)}
.dsh-todo-mini{order:-1;flex:0 1 auto;box-sizing:border-box;width:100%;min-width:150px;max-width:100%;padding:4px var(--dsh-sidebar-row-padding,12px) 4px;display:flex;flex-direction:column;gap:2px;color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.4}
[data-dsh-todo-footer='true']{flex-wrap:wrap;row-gap:6px;align-items:flex-end}
[data-dsh-todo-footer='true'] > *{flex:0 0 auto}
[data-dsh-todo-footer='true'] > [data-dsh-todo-seat='true']{flex:1 1 100%;order:-1;width:100%}
[data-dsh-todo-footer='true'] > *:has([data-dsh-todo-seat='true']){flex:1 1 100%;order:-1;width:100%}.dsh-todo-miniToday{flex:none;display:flex;flex-direction:column;gap:2px;margin-top:4px;padding-top:4px;border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-todo-miniTodayHead{display:flex;align-items:center;gap:6px;padding:0 4px 2px}
.dsh-todo-miniTodayTitle{flex:1;min-width:0;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}
.dsh-todo-miniTodayCount{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dsh-todo-miniTodayList{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px;max-height:126px;overflow-y:auto;overscroll-behavior:contain}
.dsh-todo-miniTodayRow{display:flex;align-items:center;gap:5px;min-height:20px;border-radius:5px}
.dsh-todo-miniTodayRow:hover{background:var(--dsw-alias-bg-layer-2)}
.dsh-todo-miniTodayCheck{flex:none;width:15px;height:15px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:transparent;color:transparent;cursor:pointer}
.dsh-todo-miniTodayCheck:hover{border-color:var(--dsw-alias-brand-primary)}
.dsh-todo-miniTodayCheck[aria-pressed='true']{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.dsh-todo-miniTodayText{flex:1;min-width:0;padding:0 2px;border:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.35;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.dsh-todo-miniTodayRow[data-done='true'] .dsh-todo-miniTodayText{color:var(--dsw-alias-label-secondary);text-decoration:line-through}
.dsh-todo-miniTodayEmpty{margin:0;padding:1px 4px 2px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dsh-todo-miniTodayAdd{flex:none;display:flex;align-items:center;margin-top:2px}
.dsh-todo-miniTodayInput{width:100%;box-sizing:border-box;padding:3px 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.5}
.dsh-todo-miniTodayInput:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsh-todo-miniTodayInput::placeholder{color:var(--dsw-alias-label-secondary)}.dsh-todo-miniHead{display:flex;align-items:center;gap:2px;flex:none}
.dsh-todo-miniMonth{flex:1;min-width:0;height:24px;padding:0 4px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:600;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.dsh-todo-miniMonth:hover{background:var(--dsw-alias-bg-layer-2)}
.dsh-todo-miniNav{flex:none;width:22px;height:22px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsh-todo-miniNav:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsh-todo-miniWeekdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;flex:none;color:var(--dsw-alias-label-secondary);font-size:10px;text-align:center}
.dsh-todo-miniGrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;flex:none}
.dsh-todo-miniCell{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;height:23px;padding:1px 0;border:none;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-variant-numeric:tabular-nums;cursor:pointer}
.dsh-todo-miniCell:hover{background:var(--dsw-alias-bg-layer-2)}
.dsh-todo-miniCell[data-outside='true']{color:var(--dsw-alias-label-secondary);opacity:.5}
.dsh-todo-miniCell[data-today='true']{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600}
.dsh-todo-miniCell[data-today='true']:hover{background:var(--dsw-alias-brand-primary)}
.dsh-todo-miniNum{line-height:1.1}
.dsh-todo-miniDots{display:flex;align-items:center;justify-content:center;gap:1px;height:2px}
.dsh-todo-miniDot{width:2px;height:2px;border-radius:50%;background:var(--dsw-alias-brand-primary)}
.dsh-todo-miniDot[data-done='true']{background:var(--dsw-alias-state-idle-primary)}
.dsh-todo-miniCell[data-today='true'] .dsh-todo-miniDot{background:var(--dsw-alias-bg-base)}
.dsh-todo-warning{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.45}
`;

    // ----------------------------------------------------------------- body ----

    const inject = ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs'];

    function apply(ctx) {
      const t = ctx.locale.bind(NS);

      ctx.effect(() => {
        const style = document.createElement('style');
        style.setAttribute('data-plugin-css', PLUGIN_TAG);
        style.textContent = CSS;
        document.head.appendChild(style);
        return () => {
          style.remove();
        };
      }, 'todo-calendar: styles');

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'todo-calendar: copy');

      ctx.effect(() => {
        const sync = (event) => {
          if (event.key === null || event.key === STORAGE_KEY) taskStore.reload();
        };
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
      }, 'todo-calendar: cross-window sync');

      // The Host record is the shared copy the agent and WeChat change; reconcile
      // once on load, when the page regains focus, and on a slow timer so a WeChat
      // "/add" shows up here without a reload.
      ctx.effect(() => {
        let stopped = false;
        const tick = () => {
          if (stopped) return;
          void taskStore.hydrate();
        };
        const onFocus = () => tick();
        tick();
        const timer = window.setInterval(tick, 30_000);
        window.addEventListener('focus', onFocus);
        return () => {
          stopped = true;
          window.clearInterval(timer);
          window.removeEventListener('focus', onFocus);
        };
      }, 'todo-calendar: Host record sync');

      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: KIND,
            keepMounted: true,
            title: () => t('title'),
            guide: [
              {
                id: 'calendar',
                order: 40,
                title: () => t('title'),
                description: () => t('description'),
                icon: TodoGlyph
              }
            ]
          }),
        'todo-calendar: tab type'
      );

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS, inject: () => ({ tt: t }) },
              TodoCalendarBody
            )
          ),
        'todo-calendar: tab body'
      );

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab.title', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab.title', key: TAB_ID, locale: NS, inject: () => ({ tt: t }) },
              TodoTabTitle
            )
          ),
        'todo-calendar: tab title'
      );

      const openCalendar = () => {
        try {
          ctx.sidebarRight.openTab(KIND);
        } catch (error) {
          console.error('[todo-calendar] opening the calendar tab failed:', error);
        }
      };

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.footer.action', () =>
            ctx.slots.register(
              {
                name: 'sidebar.footer.action',
                id: 'todo-calendar',
                order: -1,
                label: () => t('title'),
                locale: NS,
                inject: () => ({ tt: t, openCalendar, mounted: ctx.sidebarRight.mounted })
              },
              TodoSidebarAction
            )
          ),
        'todo-calendar: sidebar entry'
      );
    }

    return { inject, apply };
  }
});
