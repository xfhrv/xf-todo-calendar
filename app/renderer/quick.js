/* 快速添加浮窗：命令与微信侧一致（/add 文本、/box、/td、/wt）。
   提交后输入内容与结果都保留，直到用户按 Esc、再次提交或再按快捷键收起。 */
const api = window.todoApi;
const input = document.getElementById('input');
const result = document.getElementById('result');
const card = document.querySelector('.card');

/** Ask the main process to fit the window to the card, capped at the taskbar. */
function fitWindow() {
  const height = Math.ceil(card.getBoundingClientRect().height + 20 + 2);
  void api.resizeQuick(height);
}

let pending = false;

function showResult(text, isError) {
  result.textContent = text;
  result.classList.toggle('error', Boolean(isError));
  fitWindow();
}

async function submit() {
  const text = input.value.trim();
  if (text === '' || pending) return;
  pending = true;
  try {
    const answer = await api.quick(text);
    showResult(answer.message, !answer.ok);
    // After "/add …" keep the command prefix so the next entry can follow directly.
    if (/^\/add(\s|$)/i.test(text)) {
      input.value = '/add ';
      input.setSelectionRange(input.value.length, input.value.length);
    } else {
      input.select();
    }
  } finally {
    pending = false;
    input.focus();
  }
}

input.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    api.hideQuick();
    return;
  }
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  // An empty box turns Enter into "show/hide the main window".
  if (input.value.trim() === '') {
    void api.toggleMain().then(() => api.hideQuick());
    return;
  }
  void submit();
});

/* The hotkey keeps whatever is on screen: just focus and select for the next edit. */
api.onQuickFocus(() => {
  input.focus();
  input.select();
  fitWindow();
});

window.addEventListener('resize', () => fitWindow());
window.addEventListener('focus', () => input.focus());
input.focus();
fitWindow();
