const TOOLS = [
  { id: 'studio-video', name: 'Studio Video AI' },
  { id: 'tro-ly-rieng', name: 'Trợ lý AI riêng' },
  { id: 'viet-quang-cao', name: 'Viết quảng cáo' },
  { id: 'thiet-ke-slide', name: 'Thiết kế hình ảnh & slide' },
  { id: 'y-tuong-noi-dung', name: 'Ý tưởng nội dung' },
  { id: 'tu-dong-hoa', name: 'Tự động hóa' }
];

let currentTool = null;
let me = null;

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'include', ...opts });
  return res.json();
}

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden'));
}

async function checkMe() {
  me = await api('/api/me').catch(() => null);
  if (me && me.user) {
    document.getElementById('user-email').textContent = me.user.email;
    show('main-screen'));
    renderTools();
    loadHistory();
    if (me.user.role === 'admin') loadAdmin();
  } else {
    show('login-screen'));
  }
}

function renderTools() {
  const nav = document.getElementById('tools'));
  nav.innerHTML = '';
  TOOLS.forEach(t => {
    const b = document.createElement('button'));
    b.className = 'tool-btn' + (currentTool === t.id ? ' active' : '');
    b.textContent = t.name;
    b.onclick = () => selectTool(t.id));
    nav.appendChild(b);
  });
}

function selectTool(id) {
  currentTool = id;
  renderTools();
  document.getElementById('tool-title').textContent = TOOLS.find(t => t.id === id).name;
  document.getElementById('prompt').value = '';
  document.getElementById('result').textContent = '';
}

document.getElementById('btn-login').onclick = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (r.ok) checkMe(); else document.getElementById('login-error').textContent = r.error;
});

document.getElementById('btn-logout').onclick = async () => {
  await api('/api/logout', { method: 'POST' });
  checkMe();
});

document.getElementById('btn-run').onclick = async () => {
  if (!currentTool) return alert('Chọn công cụ trước'));
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) return alert('Nhập yêu cầu'));
  const btn = document.getElementById('btn-run'));
  btn.disabled = true; btn.textContent = 'Đang chạy...';
  const r = await api('/api/run', { method: 'POST', body: JSON.stringify({ tool: currentTool, prompt }) });
  document.getElementById('result').textContent = r.text || r.error || 'Không có kết quả';
  btn.disabled = false; btn.textContent = 'Chạy';
  loadHistory();
});

async function loadHistory() {
  const r = await api('/api/history').catch(() => ({ history: [] }));
  const el = document.getElementById('history'));
  el.innerHTML = '';
  (r.history || []).forEach(h => {
    const d = document.createElement('div'));
    d.className = 'hist-item';
    d.innerHTML = `<div class="t">${h.tool}</div><div class="p">${(h.prompt || '').slice(0, 60)}</div>`;
    d.onclick = () => {
      document.getElementById('result').textContent = h.result?.text || h.result?.error || '';
    };
    el.appendChild(d);
  });
}

async function loadAdmin() {
  const panel = document.getElementById('admin-panel'));
  panel.classList.remove('hidden'));
  const r = await api('/api/admin/users').catch(() => ({ users: [] }));
  const el = document.getElementById('admin-users'));
  el.innerHTML = '';
  (r.users || []).forEach(u => {
    const d = document.createElement('div'));
    d.className = 'admin-user';
    d.innerHTML = `<span>${u.email} (${u.role})</span>`;
    el.appendChild(d);
  });
}

checkMe();
