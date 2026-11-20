const http = require('http');
const fs = require('fs');
const path = require('path);
const crypto = require('crypto);

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@local.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const sessions = new Map();
const users = new Map([[ADMIN_EMAIL, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' }]]);
const history = [];

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

function getSession(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/sid=([^;]+)/);
  if (!m) return null;
  return sessions.get(m[1]) || null;
}

function setSession(res, user) {
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, user);
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);
}

function send(res, code, data, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, data, types[ext] || 'application/octet-stream');
  });
}

async function callOpenAI(prompt, system) {
  if (!OPENAI_API_KEY) return { error: 'OPENAI_API_KEY not set on server.' };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: system || 'You are a helpful assistant. Reply in Vietnamese.' }, { role: 'user', content: prompt }], max_tokens: 2000 })
  });
  const data = await res.json();
  if (data.error) return { error: data.error.message };
  return { text: data.choices[0].message.content };
}

const TOOLS = {
  'studio-video': { name: 'Studio Video AI', system: 'Bạn là đạo diễn AI. Viết kịch bản video và prompt cho tool tạo video. Trả về tiếng Việt, có cấu trúc: Hook, Nội dung, CTA.' },
  'tro-ly-rieng': { name: 'Trợ lý AI riêng', system: 'Bạn là trợ lý cá nhân. Trò chuyện, trả lời, soạn thảo. Trả về tiếng Việt.' },
  'viet-quang-cao': { name: 'Viết quảng cáo', system: 'Bạn là copywriter. Tạo headline, mô tả, caption quảng cáo. Trả về tiếng Việt, có nhiều lựa chọn.' },
  'thiet-ke-slide': { name: 'Thiết kế hình ảnh & slide', system: 'Bạn là designer. Đề xuất bố cục, text, gợi ý màu cho slide/hình ảnh. Trả về tiếng Việt.' },
  'y-tuong-noi-dung': { name: 'Ý tưởng nội dung', system: 'Bạn là content strategist. Brainstorm chủ đề, outline. Trả về tiếng Việt.' },
  'tu-dong-hoa': { name: 'Tự động hóa', system: 'Bạn là automation engineer. Soạn flow cho n8n/Make. Trả về tiếng Việt, có bước rõ ràng.' }
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const sess = getSession(req);

  if (url.pathname.startsWith('/public/')) {
    return serveStatic(res, path.join(__dirname, url.pathname));
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return serveStatic(res, path.join(__dirname, 'public/index.html'));
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await parseBody(req);
    const u = users.get(body.email);
    if (u && u.password === body.password) { setSession(res, u); return send(res, 200, { ok: true, user: { email: u.email, role: u.role } }); }
    return send(res, 401, { error: 'Sai email hoặc mật khẩu' });
  }
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const cookie = req.headers.cookie || '';
    const m = cookie.match(/sid=([^;]+)/);
    if (m) sessions.delete(m[1]);
    res.setHeader('Set-Cookie', 'sid=; Max-Age=0; Path=/');
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/me') {
    return send(res, 200, { user: sess });
  }
  if (!sess) return send(res, 401, { error: 'Chưa đăng nhập' });

  if (req.method === 'POST' && url.pathname === '/api/run') {
    const body = await parseBody(req);
    const tool = TOOLS[body.tool];
    if (!tool) return send(res, 400, { error: 'Tool không tồn tại' });
    const result = await callOpenAI(body.prompt, tool.system);
    history.push({ tool: tool.name, prompt: body.prompt, result, at: new Date().toISOString() });
    return send(res, 200, result);
  }
  if (req.method === 'GET' && url.pathname === '/api/history') {
    return send(res, 200, { history: history.slice(-50).reverse() });
  }
  if (sess.role === 'admin') {
    if (req.method === 'GET' && url.pathname === '/api/admin/users') return send(res, 200, { users: [...users.values()].map(u => ({ email: u.email, role: u.role })) });
    if (req.method === 'POST' && url.pathname === '/api/admin/reset-password') {
      const body = await parseBody(req);
      const u = users.get(body.email);
      if (!u) return send(res, 404, { error: 'Không tìm thấy' });
      u.password = body.password;
      return send(res, 200, { ok: true });
    }
  }
  send(res, 404, 'Not found', 'text/plain);
});

server.listen(PORT, () => console.log(`AI Super Power running on port ${PORT}`));
